"""Gera o programa e os instaladores do Nexos ERP.

    python build.py

Em dist/:
  Nexos ERP.exe                       o programa (um arquivo só, com Python e a tela dentro)
  Nexos-ERP.exe                       o mesmo arquivo, com o nome que a Release do GitHub usa
  Instalar-Nexos-ERP.exe              instalador pequeno: baixa a última versão do GitHub
  Instalar-Nexos-ERP-offline.exe      instalador com o programa dentro (pendrive, sem internet)

Precisa, só na máquina de quem gera: Node.js, as dependências de
backend/requirements.txt + backend/requirements-build.txt e, para os
instaladores, o Inno Setup 6 (https://jrsoftware.org/isdl.php).
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
DIST = ROOT / "dist"
NPM = shutil.which("npm") or sys.exit("Não encontrei o npm. Instale o Node.js: https://nodejs.org")


def run(*cmd: str, cwd: Path = ROOT) -> None:
    print("›", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def version() -> str:
    text = (ROOT / "backend" / "app" / "__init__.py").read_text(encoding="utf-8")
    return re.search(r'__version__ = "([^"]+)"', text).group(1)


def find_iscc() -> str | None:
    candidates = [
        shutil.which("ISCC"),
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Inno Setup 6" / "ISCC.exe",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Inno Setup 6" / "ISCC.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Inno Setup 6" / "ISCC.exe",
    ]
    return next((str(c) for c in candidates if c and Path(c).is_file()), None)


def main() -> None:
    v = version()
    print(f"Nexos ERP {v}\n")

    run(NPM, "install", "--no-audit", "--no-fund", cwd=FRONTEND)
    run(NPM, "run", "build", cwd=FRONTEND)

    sep = ";" if sys.platform == "win32" else ":"
    run(
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean",
        "--onefile",
        "--windowed",                       # sem a janela preta do terminal
        "--name", "Nexos ERP",
        "--icon", str(ROOT / "assets" / "icone.ico"),
        "--paths", str(ROOT / "backend"),
        "--add-data", f"{FRONTEND / 'dist'}{sep}frontend_dist",
        # Manual: a aba Ajuda e o Assistente leem o .md; o botão PDF entrega o .pdf.
        "--add-data", f"{ROOT / 'docs' / 'manual.md'}{sep}docs",
        "--add-data", f"{ROOT / 'docs' / 'Manual do Nexos ERP.pdf'}{sep}docs",
        "--collect-submodules", "uvicorn",  # o uvicorn carrega partes por nome
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
        "--distpath", str(DIST),
        str(ROOT / "run.py"),
    )
    if sys.platform != "win32":
        print(f"\nPronto: {DIST / 'Nexos ERP'}")
        return

    exe = DIST / "Nexos ERP.exe"
    # Nome sem espaço: é o que a atualização automática e o instalador procuram na Release.
    shutil.copyfile(exe, DIST / "Nexos-ERP.exe")

    iscc = find_iscc()
    if iscc:
        script = str(ROOT / "installer" / "NexosERP.iss")
        run(iscc, "/Q", f"/DAppVersion={v}", script)
        run(iscc, "/Q", f"/DAppVersion={v}", "/DOffline", script)
    else:
        print("\nAviso: Inno Setup não encontrado; os instaladores não foram gerados.")

    print("\nPronto:")
    for f in sorted(DIST.glob("*.exe")):
        print(f"  {f.name:<38} {f.stat().st_size / 1_048_576:5.1f} MB")


if __name__ == "__main__":
    main()
