"""Atualização automática pelas Releases do GitHub.

A cada versão publicada, a Release precisa ter o arquivo `Nexos-ERP.exe`.
O programa compara a versão dela com a dele e, se for mais nova, baixa e troca
o próprio .exe: renomeia o atual para ".old" (o Windows deixa renomear um
programa aberto), põe o novo no lugar e reabre.
"""

import json
import os
import re
import shutil
import sys
import time
import urllib.request
from pathlib import Path

REPO = "guiguimaraes08/ERP"
ASSET_NAME = "Nexos-ERP.exe"
RELEASES_PAGE = f"https://github.com/{REPO}/releases/latest"
CACHE_SECONDS = 6 * 3600

_cache: dict = {"at": 0.0, "data": None}


class UpdateError(Exception):
    pass


def api_url() -> str:
    return os.environ.get("ERP_UPDATE_URL", f"https://api.github.com/repos/{REPO}/releases/latest")


def parse_version(text: str) -> tuple[int, ...]:
    return tuple(int(n) for n in re.findall(r"\d+", text)[:3]) or (0,)


def _get(url: str, timeout: float):
    req = urllib.request.Request(url, headers={"User-Agent": "Nexos-ERP", "Accept": "application/vnd.github+json"})
    return urllib.request.urlopen(req, timeout=timeout)  # noqa: S310 — URL fixa do GitHub


def latest_release(force: bool = False) -> dict | None:
    """Última versão publicada, ou None se estiver sem internet ou sem release."""
    if not force and _cache["data"] and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["data"]
    try:
        with _get(api_url(), timeout=5) as res:
            data = json.load(res)
    except (OSError, ValueError):
        return None
    asset = next((a for a in data.get("assets", []) if a.get("name") == ASSET_NAME), None)
    if not asset or not data.get("tag_name"):
        return None
    info = {
        "version": data["tag_name"].lstrip("vV"),
        "notes": (data.get("body") or "").strip(),
        "download_url": asset["browser_download_url"],
        "size": asset.get("size") or 0,
    }
    _cache.update(at=time.time(), data=info)
    return info


def installed_exe() -> Path | None:
    """Caminho do .exe em uso; None quando roda do código-fonte."""
    return Path(sys.executable) if getattr(sys, "frozen", False) else None


def status(current: str) -> dict:
    release = latest_release()
    available = bool(release and parse_version(release["version"]) > parse_version(current))
    exe = installed_exe()
    return {
        "current": current,
        "latest": release["version"] if release else None,
        "available": available,
        "notes": release["notes"][:2000] if release and available else "",
        "can_install": available and exe is not None and os.access(exe.parent, os.W_OK),
        "page": RELEASES_PAGE,
    }


def install(current: str) -> str:
    """Baixa e troca o .exe. Devolve a versão instalada; o programa precisa reabrir."""
    release = latest_release(force=True)
    if not release or parse_version(release["version"]) <= parse_version(current):
        raise UpdateError("Você já está na versão mais nova")
    exe = installed_exe()
    if exe is None:
        raise UpdateError("A atualização automática só funciona no programa instalado")

    new = exe.with_name(f"{exe.stem}.new")
    old = exe.with_name(f"{exe.stem}.old")
    try:
        with _get(release["download_url"], timeout=60) as res, open(new, "wb") as out:
            shutil.copyfileobj(res, out)
    except OSError as exc:
        new.unlink(missing_ok=True)
        raise UpdateError("Não consegui baixar a versão nova. Confira a internet e tente de novo.") from exc

    size = new.stat().st_size
    with open(new, "rb") as f:
        is_exe = f.read(2) == b"MZ"
    if not is_exe or size < 1_000_000 or (release["size"] and size != release["size"]):
        new.unlink(missing_ok=True)
        raise UpdateError("O arquivo baixado veio com defeito. Tente de novo mais tarde.")

    old.unlink(missing_ok=True)
    exe.rename(old)
    try:
        new.rename(exe)
    except OSError:
        old.rename(exe)  # devolve o original se algo der errado
        raise
    return release["version"]


def cleanup_previous() -> None:
    """Apaga o .old da atualização anterior (na próxima vez que o programa abre)."""
    exe = installed_exe()
    if exe:
        try:
            exe.with_name(f"{exe.stem}.old").unlink(missing_ok=True)
        except OSError:
            pass  # a versão antiga ainda está fechando; fica para a próxima
