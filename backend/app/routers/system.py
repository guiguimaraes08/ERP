"""Ajustes, painel inicial, backup e dados de exemplo."""

import io
import os
import socket
import sqlite3
import sys
import tempfile
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse, Response
import segno

from .. import __version__
from ..db import copy_database, data_dir, db_path, get_db, is_valid_backup
from ..schemas import SettingsIn
from ..seed import seed_demo
from ..services import pricing, schedule, stock, updates
from .orders import order_summary

router = APIRouter(prefix="/api", tags=["sistema"])


@router.get("/settings")
def read_settings(conn: sqlite3.Connection = Depends(get_db)):
    s = pricing.get_settings(conn)
    return {
        "business_name": s.get("business_name", ""),
        "labor_rate": float(s.get("labor_rate", 0)),
        "machine_rate": float(s.get("machine_rate", 0)),
        "default_margin": float(s.get("default_margin", 40)),
        "allow_phone": s.get("allow_phone") == "1",
        "auto_update": s.get("auto_update", "1") == "1",
    }


@router.put("/settings")
def write_settings(body: SettingsIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        conn.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [(k, ("1" if v else "0") if isinstance(v, bool) else str(v)) for k, v in body.model_dump().items()],
        )
    return read_settings(conn)


@router.get("/dashboard")
def dashboard(conn: sqlite3.Connection = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1).isoformat()
    soon = (today + timedelta(days=3)).isoformat()

    orders = [
        order_summary(conn, r["id"])
        for r in conn.execute("SELECT id FROM orders WHERE status != 'cancelado'")
    ]
    open_orders = [o for o in orders if o["status"] in ("a_fazer", "fazendo", "pronto")]
    by_status = {s: 0 for s in ("a_fazer", "fazendo", "pronto")}
    for o in open_orders:
        by_status[o["status"]] += 1

    delivered_month = [
        o for o in orders if o["status"] == "entregue" and (o["delivered_at"] or "") >= month_start
    ]
    received_month = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE paid_at >= ?", (month_start,)
    ).fetchone()["v"]

    # Falta de material só olha pedidos "a fazer": os outros já tiraram do estoque.
    needs: dict[int, float] = defaultdict(float)
    for o in open_orders:
        if o["status"] == "a_fazer":
            for material_id, qty in stock.order_needs(conn, o["id"]).items():
                needs[material_id] += qty

    low_stock = conn.execute(
        """SELECT id, name, unit, stock, min_stock FROM materials
           WHERE archived = 0 AND stock <= min_stock ORDER BY name COLLATE NOCASE"""
    ).fetchall()

    def brief(o: dict) -> dict:
        keys = ("id", "customer_name", "status", "due_date", "total", "balance", "late")
        return {k: o[k] for k in keys} | {"items": [i["product_name"] for i in o["items"]]}

    return {
        "open_by_status": by_status,
        "late": [brief(o) for o in open_orders if o["late"]],
        "due_soon": [
            brief(o) for o in open_orders
            if not o["late"] and o["due_date"] and o["due_date"] <= soon
        ],
        "to_receive": round(sum(max(o["balance"], 0) for o in orders), 2),
        "received_month": round(received_month, 2),
        "sold_month": round(sum(o["total"] for o in delivered_month), 2),
        "profit_month": round(sum(o["profit"] for o in delivered_month), 2),
        "delivered_month": len(delivered_month),
        "shortages": stock.shortages_for(conn, dict(needs)),
        "low_stock": [dict(r) for r in low_stock],
        # Pela agenda: vão passar do prazo (os que já passaram estão em "late").
        "will_be_late": [
            j for j in schedule.simulate(conn)["jobs"]
            if j["late"] and j["order_id"] is not None and (j["due_date"] or "9999") >= today.isoformat()
        ],
        "has_workers": conn.execute("SELECT 1 FROM workers WHERE active = 1").fetchone() is not None,
        "is_empty": conn.execute(
            "SELECT (SELECT COUNT(*) FROM materials) + (SELECT COUNT(*) FROM products) + (SELECT COUNT(*) FROM orders) AS n"
        ).fetchone()["n"] == 0,
    }


def _lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("10.255.255.255", 1))  # não envia nada, só descobre a interface
            return sock.getsockname()[0]
    except OSError:
        return None


def _local_only(request: Request) -> None:
    if request.client is None or request.client.host not in ("127.0.0.1", "::1", "testclient"):
        raise HTTPException(403, "Isso só pode ser feito no computador onde o sistema está instalado")


def _phone_url() -> str | None:
    """Endereço para o celular, só quando o programa foi aberto liberando a rede."""
    if os.environ.get("ERP_PHONE") != "1":
        return None
    ip = _lan_ip()
    return f"http://{ip}:{os.environ.get('ERP_PORT', '8765')}" if ip else None


@router.get("/info")
def info():
    return {"version": __version__, "data_dir": str(data_dir()), "phone_url": _phone_url()}


@router.get("/update")
def update_status():
    """Tem versão nova no GitHub? Sem internet, só responde que não."""
    return updates.status(__version__)


@router.post("/update/install")
def update_install(request: Request):
    _local_only(request)
    try:
        return {"version": updates.install(__version__)}
    except updates.UpdateError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.get("/phone-qr.svg", include_in_schema=False)
def phone_qr():
    """QR Code do endereço do celular: é só apontar a câmera."""
    url = _phone_url()
    if url is None:
        raise HTTPException(404, "Acesso pelo celular desligado")
    out = io.BytesIO()
    # Escuro sobre branco mesmo no tema escuro: câmera de celular lê melhor assim.
    segno.make(url, error="m").save(out, kind="svg", scale=8, border=2, dark="#1c1917", light="#ffffff", xmldecl=False)
    return Response(out.getvalue(), media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


@router.get("/backup")
def backup(background: BackgroundTasks):
    """Cópia consistente do banco, pronta para baixar."""
    tmp = Path(tempfile.mkdtemp()) / f"nexos-erp-copia-{date.today().isoformat()}.db"
    copy_database(tmp)
    background.add_task(tmp.unlink, missing_ok=True)
    return FileResponse(tmp, filename=tmp.name, media_type="application/x-sqlite3")


@router.post("/restore")
async def restore(request: Request, conn: sqlite3.Connection = Depends(get_db)):
    """Volta uma cópia de segurança. Antes, guarda o estado atual em backups/."""
    _local_only(request)
    body = await request.body()
    if not body:
        raise HTTPException(422, "Nenhum arquivo enviado")
    tmp = Path(tempfile.mkdtemp()) / "restaurar.db"
    tmp.write_bytes(body)
    try:
        if not is_valid_backup(tmp):
            raise HTTPException(422, "Esse arquivo não é uma cópia de segurança do Nexos ERP")
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        copy_database(db_path().parent / "backups" / f"antes-de-restaurar-{stamp}.db")
        src = sqlite3.connect(tmp)
        try:
            src.backup(conn)  # sobrescreve o banco aberto de forma segura
        finally:
            src.close()
    finally:
        tmp.unlink(missing_ok=True)
    return {"ok": True}


@router.post("/open-folder", status_code=204)
def open_folder(request: Request):
    _local_only(request)
    folder = data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    if sys.platform != "win32":
        raise HTTPException(501, f"Abra manualmente: {folder}")
    os.startfile(folder)  # noqa: S606 — abre o Explorer na pasta dos dados


@router.post("/demo", status_code=201)
def load_demo(conn: sqlite3.Connection = Depends(get_db)):
    if not dashboard(conn)["is_empty"]:
        raise HTTPException(409, "Os dados de exemplo só podem ser carregados com o sistema vazio")
    with conn:
        seed_demo(conn)
    return {"ok": True}
