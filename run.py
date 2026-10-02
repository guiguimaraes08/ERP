"""Nexos ERP: abre o sistema numa janela própria.

Dois cliques no "Nexos ERP.exe" (ou `python run.py`) e pronto: o servidor sobe
por baixo e fecha junto com a janela.

    python run.py --navegador   → abre no navegador em vez da janela (para desenvolver)
"""

import argparse
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from datetime import date
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
if not FROZEN:
    sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from app import __version__  # noqa: E402
from app.db import connect, copy_database, data_dir, init_db  # noqa: E402
from app.services import updates  # noqa: E402

APP_NAME = "Nexos ERP"
PREFERRED_PORT = 8765


def message(text: str, error: bool = False) -> None:
    """Caixinha de aviso do Windows (no .exe não existe terminal para print)."""
    if sys.platform == "win32":
        import ctypes

        ctypes.windll.user32.MessageBoxW(None, text, APP_NAME, 0x10 if error else 0x40)
    else:
        print(text)


def already_running(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/info", timeout=1) as res:
            return "version" in json.load(res)
    except (OSError, ValueError):
        return False


def bring_to_front() -> bool:
    """Se a janela do programa já está aberta (talvez minimizada), traz para a frente."""
    if sys.platform != "win32":
        return False
    import ctypes

    user32 = ctypes.windll.user32
    hwnd = user32.FindWindowW(None, APP_NAME)
    if not hwnd:
        return False
    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
    user32.SetForegroundWindow(hwnd)
    return True


def free_port(host: str) -> int:
    with socket.socket() as s:
        try:
            s.bind((host, PREFERRED_PORT))
            return PREFERRED_PORT
        except OSError:
            s.bind((host, 0))  # porta preferida ocupada por outro programa
            return s.getsockname()[1]


def phone_allowed() -> bool:
    conn = connect()
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = 'allow_phone'").fetchone()
        return bool(row and row["value"] == "1")
    finally:
        conn.close()


def start_server(host: str, port: int):
    import uvicorn

    from app.main import app

    server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, log_config=None, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 20
    while not server.started:
        if not thread.is_alive() or time.time() > deadline:
            raise RuntimeError("O servidor não conseguiu iniciar")
        time.sleep(0.05)
    return server, thread


class DesktopApi:
    """Funções que a tela chama quando está dentro da janela (window.pywebview.api)."""

    def __init__(self) -> None:
        self._window = None  # com "_" o pywebview não expõe para a tela

    def save_backup(self) -> str | None:
        import webview

        result = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=f"Nexos ERP - copia {date.today().strftime('%d-%m-%Y')}.db",
            file_types=("Cópia do Nexos ERP (*.db)",),
        )
        if not result:
            return None
        target = Path(result if isinstance(result, str) else result[0])
        copy_database(target)
        return str(target)

    def restart(self) -> None:
        """Depois de atualizar: abre o .exe novo e fecha este."""
        exe = updates.installed_exe()
        if exe is None:
            return
        # Sem isso, o .exe novo tentaria reaproveitar a pasta temporária deste (PyInstaller).
        env = {**os.environ, "PYINSTALLER_RESET_ENVIRONMENT": "1"}
        subprocess.Popen(
            [str(exe), "--depois-de-atualizar"],
            env=env,
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )
        self._window.destroy()


def open_window(url: str) -> None:
    import webview

    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp abre no navegador
    api = DesktopApi()
    api._window = webview.create_window(
        APP_NAME, url, js_api=api, width=1200, height=820, min_size=(380, 560), text_select=True,
    )
    webview.start(gui="edgechromium", private_mode=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--navegador", action="store_true", help="abrir no navegador em vez da janela")
    parser.add_argument("--depois-de-atualizar", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    # Sem terminal (.exe), o que seria impresso vai para um arquivo de log.
    folder = data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None or sys.stderr is None:
        log = open(folder / "erp.log", "a", encoding="utf-8", buffering=1)  # noqa: SIM115
        sys.stdout = sys.stdout or log
        sys.stderr = sys.stderr or log

    # Reaberto pela atualização: espera a versão anterior terminar de fechar.
    if args.depois_de_atualizar:
        deadline = time.time() + 20
        while already_running(PREFERRED_PORT) and time.time() < deadline:
            time.sleep(0.3)
    updates.cleanup_previous()

    # Clicou de novo com o programa aberto: mostra a janela que já existe.
    if already_running(PREFERRED_PORT):
        if args.navegador or not bring_to_front():
            webbrowser.open(f"http://127.0.0.1:{PREFERRED_PORT}")
        return

    init_db()
    host = "0.0.0.0" if phone_allowed() else "127.0.0.1"
    port = free_port(host)
    os.environ["ERP_PORT"] = str(port)
    os.environ["ERP_PHONE"] = "1" if host == "0.0.0.0" else "0"
    url = f"http://127.0.0.1:{port}"

    try:
        server, thread = start_server(host, port)
    except Exception as exc:  # noqa: BLE001
        message(f"Não consegui abrir o sistema.\n\n{exc}\n\nDetalhes em: {folder / 'erp.log'}", error=True)
        raise

    try:
        if args.navegador:
            print(f"{APP_NAME} {__version__} em {url}  (Ctrl+C para fechar)")
            webbrowser.open(url)
            while thread.is_alive():
                time.sleep(0.5)
        else:
            try:
                open_window(url)
            except Exception as exc:  # noqa: BLE001 — sem WebView2: usa o navegador
                print(f"Janela indisponível ({exc}); abrindo no navegador", file=sys.stderr)
                webbrowser.open(url)
                message("O Nexos ERP abriu no seu navegador.\n\nQuando terminar de usar, clique em OK para fechar o programa.")
    except KeyboardInterrupt:
        pass
    finally:
        server.should_exit = True
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
