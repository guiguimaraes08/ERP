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
