import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import FROZEN, ROOT_DIR, auto_backup, init_db
from .routers import assistant, customers, manual, materials, orders, products, schedule, system

# Dentro do .exe, o PyInstaller descompacta os arquivos em sys._MEIPASS.
FRONTEND_DIST = (
    Path(getattr(sys, "_MEIPASS", ".")) / "frontend_dist" if FROZEN else ROOT_DIR / "frontend" / "dist"
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    auto_backup()
    yield


app = FastAPI(title="Nexos ERP", lifespan=lifespan)

for module in (materials, products, customers, orders, schedule, system, assistant, manual):
    app.include_router(module.router)


# Em produção o próprio Python serve o site compilado (frontend/dist).
# Em desenvolvimento o Vite roda na porta 5173 e repassa /api para cá.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
