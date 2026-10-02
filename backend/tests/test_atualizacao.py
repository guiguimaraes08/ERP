import io
from contextlib import contextmanager

import pytest

from app.services import updates

NEW_EXE = b"MZ" + b"\0" * 1_100_000


@pytest.fixture
def release(monkeypatch):
    info = {"version": "9.9.9", "notes": "Coisas novas", "download_url": "https://exemplo/x.exe", "size": len(NEW_EXE)}
    monkeypatch.setattr(updates, "latest_release", lambda force=False: info)
    return info


@pytest.fixture
def fake_exe(tmp_path, monkeypatch):
    exe = tmp_path / "Nexos ERP.exe"
    exe.write_bytes(b"MZ versao antiga")
    monkeypatch.setattr(updates, "installed_exe", lambda: exe)
    return exe


def serve(monkeypatch, content: bytes):
    @contextmanager
    def fake_get(url, timeout):
        yield io.BytesIO(content)

    monkeypatch.setattr(updates, "_get", fake_get)


def test_compara_versoes():
    assert updates.parse_version("v2.10.0") > updates.parse_version("2.9.1")
    assert updates.parse_version("v2.0.0") == (2, 0, 0)


def test_sem_internet_nao_avisa_nada(monkeypatch):
    monkeypatch.setattr(updates, "latest_release", lambda force=False: None)
    status = updates.status("2.0.0")
    assert status["available"] is False


def test_avisa_versao_nova_mas_so_instala_no_exe(release):
    status = updates.status("2.0.0")
    assert status["available"] is True
    assert status["latest"] == "9.9.9"
    assert status["can_install"] is False  # rodando do código-fonte


def test_troca_o_exe(monkeypatch, release, fake_exe):
    serve(monkeypatch, NEW_EXE)
    assert updates.install("2.0.0") == "9.9.9"
    assert fake_exe.read_bytes() == NEW_EXE
    assert fake_exe.with_name("Nexos ERP.old").read_bytes() == b"MZ versao antiga"

    updates.cleanup_previous()
    assert not fake_exe.with_name("Nexos ERP.old").exists()


def test_download_estragado_nao_mexe_no_exe(monkeypatch, release, fake_exe):
    serve(monkeypatch, b"<html>erro</html>")
    with pytest.raises(updates.UpdateError):
        updates.install("2.0.0")
    assert fake_exe.read_bytes() == b"MZ versao antiga"
    assert not fake_exe.with_name("Nexos ERP.new").exists()


def test_rota_de_atualizacao(client, release):
    data = client.get("/api/update").json()
    assert data["available"] is True and data["notes"] == "Coisas novas"


def test_qr_so_com_celular_ligado(client, monkeypatch):
    assert client.get("/api/phone-qr.svg").status_code == 404
    monkeypatch.setenv("ERP_PHONE", "1")
    r = client.get("/api/phone-qr.svg")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")


# --- Atualização ao abrir --------------------------------------------------------------

def test_download_informa_progresso(monkeypatch, release, fake_exe):
    serve(monkeypatch, NEW_EXE)
    seen = []
    updates.install("2.0.0", progress=lambda done, total: seen.append((done, total)))
    assert seen[-1] == (len(NEW_EXE), len(NEW_EXE))
    assert len(seen) > 1  # veio em pedaços


def test_ao_abrir_so_atualiza_quando_tem_versao_nova(monkeypatch, tmp_path, release, fake_exe):
    monkeypatch.setenv("ERP_DATA_DIR", str(tmp_path / "dados"))
    (tmp_path / "dados").mkdir()
    assert updates.startup_release("2.0.0")["version"] == "9.9.9"
    assert updates.startup_release("9.9.9") is None


def test_ao_abrir_nao_atualiza_rodando_do_codigo(release):
    assert updates.startup_release("2.0.0") is None  # installed_exe() é None fora do .exe


def test_release_com_arquivo_errado_nao_vira_loop(monkeypatch, tmp_path, release, fake_exe):
    dados = tmp_path / "dados"
    dados.mkdir()
    monkeypatch.setenv("ERP_DATA_DIR", str(dados))
    # A Release dizia 9.9.9, mas o .exe baixado abriu dizendo 2.0.0: não baixa de novo.
    updates.confirm_update("9.9.9", "2.0.0")
    assert updates.startup_release("2.0.0") is None
    # Quando a versão certa abre, a marca some.
    updates.confirm_update("9.9.9", "9.9.9")
    assert updates.startup_release("2.0.0")["version"] == "9.9.9"


def test_opcao_atualizar_sozinho(client):
    assert client.get("/api/settings").json()["auto_update"] is True
    body = {"business_name": "X", "labor_rate": 1, "machine_rate": 1, "default_margin": 30, "auto_update": False}
    assert client.put("/api/settings", json=body).json()["auto_update"] is False
