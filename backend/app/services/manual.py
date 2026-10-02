"""Manual de uso: uma fonte só (docs/manual.md) para a aba Ajuda, o Assistente e o PDF."""

import re
import sys
from functools import lru_cache
from pathlib import Path

from ..db import FROZEN, ROOT_DIR

DOCS_DIR = Path(getattr(sys, "_MEIPASS", ".")) / "docs" if FROZEN else ROOT_DIR / "docs"
MANUAL_MD = DOCS_DIR / "manual.md"
MANUAL_PDF = DOCS_DIR / "Manual do Nexos ERP.pdf"


@lru_cache(maxsize=1)
def manual_text() -> str:
    """O manual sem o cabeçalho de documento (PRESTADOR/CLIENTE), que só faz sentido no PDF."""
    try:
        text = MANUAL_MD.read_text(encoding="utf-8")
    except OSError:
        return ""
    return re.sub(r"(?m)^\*\*(PRESTADOR|CLIENTE):\*\*.*\n", "", text).strip()
