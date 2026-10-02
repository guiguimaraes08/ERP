import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..db import get_db
from ..services import assistant, pricing
from .system import _local_only

router = APIRouter(prefix="/api/assistant", tags=["assistente"])


class ConfigIn(BaseModel):
    # Chave do fornecedor do modelo escolhido. None = manter a atual; "" = apagar.
    api_key: str | None = Field(default=None, max_length=300)
    model: str = assistant.DEFAULT_MODEL


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=20000)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)


def _config(conn: sqlite3.Connection) -> dict:
    key, model = assistant.get_config(conn)
    settings = pricing.get_settings(conn)
    provider = assistant.provider_of(model)
    return {
        "configured": bool(key),
        "key_hint": assistant.key_hint(key),
        "model": model,
        "provider": provider,
        "provider_name": assistant.PROVIDERS[provider]["name"],
        "keys_url": assistant.PROVIDERS[provider]["keys_url"],
        "models": [
            {
                "id": k,
                "label": v["label"],
                "provider": v["provider"],
                "has_key": bool(settings.get(assistant.PROVIDERS[v["provider"]]["setting"])),
            }
            for k, v in assistant.MODELS.items()
        ],
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
        setting = assistant.PROVIDERS[assistant.provider_of(body.model)]["setting"]
        rows.append((setting, body.api_key.strip()))
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
        return {"ok": True, "model": assistant.test_connection(key, model)}
    except assistant.AssistantError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.post("/chat")
def chat(body: ChatIn, conn: sqlite3.Connection = Depends(get_db)):
    """Responde em texto corrido (streaming): a tela mostra enquanto a IA escreve."""
    key, model = assistant.get_config(conn)
    if not key:
        raise HTTPException(409, "O assistente ainda não foi configurado. Vá em Ajustes → Assistente com IA.")
    try:
        messages = assistant.clean_history([m.model_dump() for m in body.messages])
        chunks = assistant.open_chat(key, model, assistant.build_snapshot(conn), messages)
    except assistant.AssistantError as exc:
        status = 422 if str(exc) == "Escreva uma pergunta." else 409
        raise HTTPException(status, str(exc)) from exc

    return StreamingResponse(chunks, media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
