import sqlite3

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..db import get_db
from ..services import assistant
from .system import _local_only

router = APIRouter(prefix="/api/assistant", tags=["assistente"])


class ConfigIn(BaseModel):
    api_key: str | None = Field(default=None, max_length=300)  # None = manter a atual; "" = apagar
    model: str = assistant.DEFAULT_MODEL


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=20000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)


def _config(conn: sqlite3.Connection) -> dict:
    key, model = assistant.get_config(conn)
    return {
        "configured": bool(key),
        "key_hint": assistant.key_hint(key),
        "model": model,
        "models": [{"id": k, "label": v["label"]} for k, v in assistant.MODELS.items()],
    }


@router.get("/config")
def read_config(conn: sqlite3.Connection = Depends(get_db)):
    return _config(conn)


@router.put("/config")
def write_config(body: ConfigIn, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    _local_only(request)  # a chave só é trocada no computador, não pelo celular
    if body.model not in assistant.MODELS:
        raise HTTPException(422, "Modelo desconhecido")
    rows = [("ai_model", body.model)]
    if body.api_key is not None:
        rows.append(("ai_api_key", body.api_key.strip()))
    with conn:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rows,
        )
    return _config(conn)


@router.post("/test")
def test_config(conn: sqlite3.Connection = Depends(get_db)):
    key, model = assistant.get_config(conn)
    if not key:
        raise HTTPException(409, "Cole a chave da API primeiro")
    try:
        info = assistant.make_client(key).models.retrieve(model)
    except anthropic.APIError as exc:
        raise HTTPException(409, assistant.friendly_error(exc)) from exc
    return {"ok": True, "model": info.display_name}


@router.post("/chat")
def chat(body: ChatIn, conn: sqlite3.Connection = Depends(get_db)):
    """Responde em texto corrido (streaming): a tela mostra enquanto a IA escreve."""
    key, model = assistant.get_config(conn)
    if not key:
        raise HTTPException(409, "O assistente ainda não foi configurado. Vá em Ajustes → Assistente com IA.")
    try:
        messages = assistant.clean_history([m.model_dump() for m in body.messages])
    except assistant.AssistantError as exc:
        raise HTTPException(422, str(exc)) from exc

    params = assistant.request_params(model, assistant.build_snapshot(conn), messages)
    manager = assistant.make_client(key).beta.messages.stream(**params)
    try:
        stream = manager.__enter__()  # abre a conexão aqui, para erro de chave/internet virar resposta de erro
    except anthropic.APIError as exc:
        raise HTTPException(409, assistant.friendly_error(exc)) from exc

    def generate():
        try:
            for text in stream.text_stream:
                yield text
            final = stream.get_final_message()
            if final.stop_reason == "refusal":
                yield "\n\nNão consigo ajudar com esse pedido. Tente perguntar de outro jeito."
            elif final.stop_reason == "max_tokens":
                yield "\n\n(A resposta ficou longa demais e foi cortada.)"
        except anthropic.APIError as exc:
            yield f"\n\n⚠️ {assistant.friendly_error(exc)}"
        finally:
            manager.__exit__(None, None, None)

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
