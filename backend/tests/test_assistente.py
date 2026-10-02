import json
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.services import assistant

KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz-1234"


class FakeClient:
    """Substitui o SDK: nada vai para a internet."""

    def __init__(self, chunks=("Olá", "! Tudo certo."), stop="end_turn", fail_on_open=None):
        self.chunks, self.stop, self.fail_on_open = chunks, stop, fail_on_open
        self.params = None
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))
        self.models = SimpleNamespace(retrieve=lambda model: SimpleNamespace(display_name="Claude Teste"))

    def _stream(self, **params):
        self.params = params
        client = self

        class Manager:
            def __enter__(self):
                if client.fail_on_open:
                    raise client.fail_on_open
                return SimpleNamespace(
                    text_stream=iter(client.chunks),
                    get_final_message=lambda: SimpleNamespace(stop_reason=client.stop),
                )

            def __exit__(self, *exc):
                return False

        return Manager()


@pytest.fixture
def fake(monkeypatch):
    holder = {"client": FakeClient()}
    monkeypatch.setattr(assistant, "make_client", lambda key: holder["client"])
    return holder


def configure(client, **extra):
    return client.put("/api/assistant/config", json={"api_key": KEY, "model": "claude-opus-5-5", **extra})


def test_chave_fica_escondida(client):
    data = configure(client).json()
    assert data["configured"] is True
    assert KEY not in json.dumps(data)
    assert data["key_hint"] == "sk-ant-…1234"
    # Trocar só o modelo mantém a chave.
    data = client.put("/api/assistant/config", json={"model": "claude-sonnet-5-5"}).json()
    assert data["configured"] is True and data["model"] == "claude-sonnet-5-5"
    # Chave vazia apaga.
    assert client.put("/api/assistant/config", json={"api_key": "", "model": "claude-opus-5-5"}).json()["configured"] is False


def test_sem_chave_avisa(client):
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "oi"}]})
    assert r.status_code == 409 and "Ajustes" in r.json()["detail"]


def test_conversa_em_streaming(client, fake, cordao):
    configure(client)
    r = client.post("/api/assistant/chat", json={"messages": [
        {"role": "user", "content": "Oi"},
        {"role": "assistant", "content": "Olá!"},
        {"role": "user", "content": "Qual produto dá mais lucro?"},
    ]})
    assert r.status_code == 200
    assert r.text == "Olá! Tudo certo."

    params = fake["client"].params
    assert params["model"] == "claude-opus-5-5"
    assert params["output_config"] == {"effort": "medium"}
    assert params["fallbacks"] == "default" and params["betas"] == ["server-side-fallback-2026-07-01"]
    assert [m["role"] for m in params["messages"]] == ["user", "assistant", "user"]
    dados = json.loads(params["system"][1]["text"].split("\n", 1)[1])
    assert dados["produtos"][0]["produto"] == "Cordão"
    assert dados["produtos"][0]["min_trabalho"] == 6


def test_haiku_nao_recebe_parametros_que_nao_suporta(client, fake):
    configure(client, model="claude-haiku-4-5")
    client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "oi"}]})
    params = fake["client"].params
    assert "output_config" not in params and "fallbacks" not in params


def test_recusa_vira_frase_amigavel(client, fake):
    configure(client)
    fake["client"] = FakeClient(chunks=(), stop="refusal")
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "x"}]})
    assert "Não consigo ajudar" in r.text


def test_chave_errada_vira_erro_claro(client, fake):
    configure(client)
    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    err = anthropic.AuthenticationError("invalid x-api-key", response=httpx2.Response(401, request=req), body=None)
    fake["client"] = FakeClient(fail_on_open=err)
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "oi"}]})
    assert r.status_code == 409 and "chave" in r.json()["detail"].lower()


def test_historico_limpo():
    msgs = assistant.clean_history([
        {"role": "assistant", "content": "sobra do começo"},
        {"role": "user", "content": "a"},
        {"role": "user", "content": "b"},
        {"role": "system", "content": "ignorado"},
    ])
    assert msgs == [{"role": "user", "content": "a\n\nb"}]
    with pytest.raises(assistant.AssistantError):
        assistant.clean_history([{"role": "user", "content": "oi"}, {"role": "assistant", "content": "olá"}])


def test_teste_de_conexao(client, fake):
    configure(client)
    assert client.post("/api/assistant/test").json() == {"ok": True, "model": "Claude Teste"}


# --- Manual ---------------------------------------------------------------------------

def test_aba_ajuda_entrega_o_manual_sem_cabecalho(client):
    data = client.get("/api/manual").json()
    assert data["markdown"].startswith("# Manual do Nexos ERP")
    assert "PRESTADOR" not in data["markdown"] and "CLIENTE:" not in data["markdown"]
    assert "## Primeiros passos" in data["markdown"]
    pdf = client.get("/api/manual/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


def test_assistente_le_o_manual(client, fake):
    configure(client)
    client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "Como registro uma compra?"}]})
    system = fake["client"].params["system"]
    assert "<manual>" in system[0]["text"] and "Comprei" in system[0]["text"]
    # Manual nas instruções fixas (cacheáveis); dados do momento no segundo bloco.
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    assert system[1]["text"].startswith("Dados do sistema agora")


# --- Google Gemini ---------------------------------------------------------------------

import io
import urllib.error
import urllib.request

GKEY = "AIzaChaveDeTesteDoGoogle-0000000000000"


class FakeHTTP(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def sse(*events):
    return b"".join(b"data: " + json.dumps(e).encode() + b"\r\n\r\n" for e in events)


@pytest.fixture
def google(monkeypatch):
    calls = []
    holder = {"response": FakeHTTP(sse(
        {"candidates": [{"content": {"parts": [{"text": "pensando...", "thought": True}]}}]},
        {"candidates": [{"content": {"parts": [{"text": "Olá"}]}}]},
        {"candidates": [{"content": {"parts": [{"text": " do Gemini!"}]}, "finishReason": "STOP"}]},
    ))}

    def fake_urlopen(req, timeout=None):
        calls.append(req)
        if isinstance(holder["response"], Exception):
            raise holder["response"]
        return holder["response"]

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    holder["calls"] = calls
    return holder


def test_cada_fornecedor_guarda_sua_chave(client):
    configure(client)  # Claude
    data = client.put("/api/assistant/config", json={"model": "gemini-2.5-flash", "api_key": GKEY}).json()
    assert data["provider"] == "google" and data["configured"] is True
    assert data["keys_url"] == "aistudio.google.com/apikey"
    data = client.put("/api/assistant/config", json={"model": "claude-opus-5-5"}).json()
    assert data["configured"] is True and data["key_hint"] == "sk-ant-…1234"  # a do Claude continua lá
    assert all(m["has_key"] for m in data["models"])


def test_gemini_responde_em_streaming(client, google, cordao):
    client.put("/api/assistant/config", json={"model": "gemini-2.5-flash", "api_key": GKEY})
    r = client.post("/api/assistant/chat", json={"messages": [
        {"role": "user", "content": "Oi"}, {"role": "assistant", "content": "Olá!"}, {"role": "user", "content": "Tudo bem?"},
    ]})
    assert r.status_code == 200 and r.text == "Olá do Gemini!"  # o "pensamento" não aparece
    req = google["calls"][0]
    assert "gemini-2.5-flash:streamGenerateContent" in req.full_url
    assert req.get_header("X-goog-api-key") == GKEY and GKEY not in req.full_url
    body = json.loads(req.data)
    assert [c["role"] for c in body["contents"]] == ["user", "model", "user"]
    system = body["systemInstruction"]["parts"][0]["text"]
    assert "<manual>" in system and '"produto":"Cordão"' in system


def test_gemini_chave_errada(client, google):
    client.put("/api/assistant/config", json={"model": "gemini-2.5-flash", "api_key": GKEY})
    body = json.dumps({"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}).encode()
    google["response"] = urllib.error.HTTPError("u", 400, "Bad Request", {}, io.BytesIO(body))
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "oi"}]})
    assert r.status_code == 409 and "chave do Google" in r.json()["detail"]


def test_gemini_bloqueio_vira_frase_amigavel(client, google):
    client.put("/api/assistant/config", json={"model": "gemini-2.5-flash", "api_key": GKEY})
    google["response"] = FakeHTTP(sse({"candidates": [{"finishReason": "SAFETY"}]}))
    r = client.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "x"}]})
    assert "Não consigo ajudar" in r.text


def test_gemini_teste_de_conexao(client, google):
    client.put("/api/assistant/config", json={"model": "gemini-2.5-flash", "api_key": GKEY})
    google["response"] = FakeHTTP(json.dumps({"displayName": "Gemini 2.5 Flash"}).encode())
    assert client.post("/api/assistant/test").json() == {"ok": True, "model": "Gemini 2.5 Flash"}
