"""Nexos ERP: abre o sistema numa janela própria.

Dois cliques no "Nexos ERP.exe" (ou `python run.py`):
  1. aparece a tela de abertura (NEXOS);
  2. no .exe, procura versão nova no GitHub e, se houver, baixa e reabre já atualizado;
  3. liga o servidor, carrega o sistema numa janela escondida e troca as janelas,
     com o sistema surgindo em fade-in.
O servidor fecha junto com a janela.

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
from app.splash import splash_html  # noqa: E402

APP_NAME = "Nexos ERP"
PREFERRED_PORT = 8765
SPLASH_MIN_SECONDS = 2.6  # tempo para a animação da abertura terminar


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


_instance_lock = None


def single_instance(wait: float) -> bool:
    """Trava do Windows para não abrir duas cópias. `wait`: quanto esperar a anterior fechar."""
    global _instance_lock
    if sys.platform != "win32":
        return True
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.windll.kernel32
    kernel32.CreateMutexW.restype = wintypes.HANDLE
    kernel32.CreateMutexW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.LPCWSTR]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    deadline = time.time() + wait
    while True:
        handle = kernel32.CreateMutexW(None, False, "Local\\NexosERP")
        if kernel32.GetLastError() != 183:  # 183 = ERROR_ALREADY_EXISTS: outra cópia aberta
            _instance_lock = handle  # fica aberto enquanto o programa roda
            return True
        kernel32.CloseHandle(handle)
        if time.time() >= deadline:
            return False
        time.sleep(0.3)


def free_port(host: str) -> int:
    with socket.socket() as s:
        try:
            s.bind((host, PREFERRED_PORT))
            return PREFERRED_PORT
        except OSError:
            s.bind((host, 0))  # porta preferida ocupada por outro programa
            return s.getsockname()[1]


def setting(key: str, default: str) -> str:
    conn = connect()
    try:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def start_server():
    """Liga o servidor. Devolve (server, thread, url)."""
    import uvicorn

    from app.main import app

    host = "0.0.0.0" if setting("allow_phone", "0") == "1" else "127.0.0.1"
    port = free_port(host)
    os.environ["ERP_PORT"] = str(port)
    os.environ["ERP_PHONE"] = "1" if host == "0.0.0.0" else "0"

    server = uvicorn.Server(uvicorn.Config(
        app, host=host, port=port, log_config=None, log_level="warning",
        timeout_graceful_shutdown=1,  # fechar a janela encerra o programa rápido
    ))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 20
    while not server.started:
        if not thread.is_alive() or time.time() > deadline:
            raise RuntimeError("O servidor não conseguiu iniciar")
        time.sleep(0.05)
    return server, thread, f"http://127.0.0.1:{port}"


def launch_new_version(target: str = "") -> None:
    """Abre o .exe (já trocado pela versão nova); este processo fecha em seguida."""
    exe = updates.installed_exe()
    if exe is None:
        return
    # Sem isso, o .exe novo tentaria reaproveitar a pasta temporária deste (PyInstaller).
    env = {**os.environ, "PYINSTALLER_RESET_ENVIRONMENT": "1"}
    subprocess.Popen(
        [str(exe), "--depois-de-atualizar", target],
        env=env,
        creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )


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
        """Atualização pelo botão da faixa: abre o .exe novo e fecha este."""
        launch_new_version()
        self._window.destroy()


def boot(splash, api: DesktopApi, args, state: dict) -> None:
    """Roda por trás da tela de abertura: atualização, servidor e janela principal."""
    import webview

    started = time.time()

    def status(text: str, pct: float | None = None) -> None:
        try:
            splash.evaluate_js(f"setStatus({json.dumps(text)}, {json.dumps(pct)})")
        except Exception:  # noqa: BLE001 — a tela de abertura é só enfeite
            pass

    # 1. Versão nova no GitHub? (só no .exe; sem internet segue direto)
    if FROZEN and not args.depois_de_atualizar and setting("auto_update", "1") == "1":
        status("Procurando atualização…")
        release = updates.startup_release(__version__)
        if release:
            label = f"Baixando a versão {release['version']}…"
            last = [0.0]

            def progress(done: int, total: int) -> None:
                if time.time() - last[0] > 0.1:  # no máximo 10 atualizações da barra por segundo
                    last[0] = time.time()
                    status(label, done / total if total else None)

            try:
                status(label, 0)
                updates.install(__version__, progress=progress, release=release)
                status("Pronto! Abrindo a versão nova…", 1)
                launch_new_version(release["version"])
                time.sleep(0.8)
                splash.destroy()
                return
            except (updates.UpdateError, OSError) as exc:
                print(f"Atualização automática falhou: {exc}", file=sys.stderr)
                status("Não deu para atualizar agora. Abrindo assim mesmo…")
                time.sleep(1.2)

    # 2. Servidor
    status("Abrindo…")
    try:
        server, thread, url = start_server()
    except Exception as exc:  # noqa: BLE001
        state["error"] = exc
        splash.destroy()
        return
    state["server"], state["thread"] = server, thread

    # 3. Janela principal: carrega escondida, aparece pronta.
    main = webview.create_window(
        APP_NAME, f"{url}/?desktop=1", js_api=api, width=1200, height=820,
        min_size=(380, 560), text_select=True, hidden=True,
    )
    api._window = main
    main.events.loaded.wait(20)
    wait = SPLASH_MIN_SECONDS - (time.time() - started)
    if wait > 0:
        time.sleep(wait)
    status("Pronto")
    try:
        splash.evaluate_js("leave()")
    except Exception:  # noqa: BLE001
        pass
    time.sleep(0.38)
    main.show()
    try:
        main.evaluate_js("window.__nexosReveal && window.__nexosReveal()")
    except Exception:  # noqa: BLE001
        pass
    splash.destroy()
    # A versão anterior (.old) já terminou de fechar: agora dá para apagar.
    cleanup = threading.Timer(15, updates.cleanup_previous)
    cleanup.daemon = True  # não segura o programa aberto depois que a janela fecha
    cleanup.start()


def open_desktop(args) -> dict:
    import webview

    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True  # WhatsApp abre no navegador
    splash = webview.create_window(
        f"{APP_NAME} · abrindo", html=splash_html(__version__), width=720, height=420,
        frameless=True, easy_drag=True, resizable=False, background_color="#0c0b0a",
    )
    state: dict = {}
    webview.start(boot, (splash, DesktopApi(), args, state), gui="edgechromium", private_mode=False)
    return state


def main() -> None:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--navegador", action="store_true", help="abrir no navegador em vez da janela")
    parser.add_argument("--depois-de-atualizar", nargs="?", const="", default=None, help=argparse.SUPPRESS)
    args = parser.parse_args()

    # Sem terminal (.exe), o que seria impresso vai para um arquivo de log.
    folder = data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    if sys.stdout is None or sys.stderr is None:
        log = open(folder / "erp.log", "a", encoding="utf-8", buffering=1)  # noqa: SIM115
        sys.stdout = sys.stdout or log
        sys.stderr = sys.stderr or log

    # Uma cópia só. Já aberta: traz a janela para a frente. Sem janela, a anterior está
    # fechando (ou reabrindo pela atualização): espera ela terminar e segue normalmente.
    if not single_instance(wait=0):
        if bring_to_front():
            return
        if not single_instance(wait=20):
            if already_running(PREFERRED_PORT):
                webbrowser.open(f"http://127.0.0.1:{PREFERRED_PORT}")
            return
    if args.depois_de_atualizar:
        updates.confirm_update(args.depois_de_atualizar, __version__)
    updates.cleanup_previous()
    init_db()

    if args.navegador:
        server, thread, url = start_server()
        print(f"{APP_NAME} {__version__} em {url}  (Ctrl+C para fechar)")
        webbrowser.open(url)
        try:
            while thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
        server.should_exit = True
        return

    try:
        state = open_desktop(args)
    except Exception as exc:  # noqa: BLE001 — sem WebView2: usa o navegador
        print(f"Janela indisponível ({exc}); abrindo no navegador", file=sys.stderr)
        server, thread, url = start_server()
        webbrowser.open(url)
        message("O Nexos ERP abriu no seu navegador.\n\nQuando terminar de usar, clique em OK para fechar o programa.")
        server.should_exit = True
        thread.join(timeout=5)
        return

    if "error" in state:
        message(f"Não consegui abrir o sistema.\n\n{state['error']}\n\nDetalhes em: {folder / 'erp.log'}", error=True)
    if "server" in state:
        state["server"].should_exit = True
        state["thread"].join(timeout=5)


if __name__ == "__main__":
    main()
