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
