import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..schemas import AdjustIn, MaterialIn, PurchaseIn
from ..services import stock

router = APIRouter(prefix="/api/materials", tags=["insumos"])


def _serialize(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["low"] = row["stock"] <= row["min_stock"]
    data["stock_value"] = round(max(row["stock"], 0) * row["unit_cost"], 2)
    return data


def _get(conn: sqlite3.Connection, material_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM materials WHERE id = ? AND archived = 0", (material_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Insumo não encontrado")
    return row


@router.get("")
def list_materials(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        "SELECT * FROM materials WHERE archived = 0 ORDER BY name COLLATE NOCASE"
    ).fetchall()
    return [_serialize(r) for r in rows]


@router.post("", status_code=201)
def create_material(body: MaterialIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        cur = conn.execute(
            """INSERT INTO materials (name, unit, min_stock, unit_cost, supplier, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (body.name, body.unit, body.min_stock, body.unit_cost, body.supplier, body.notes),
        )
        material_id = cur.lastrowid
        if body.initial_stock > 0:
            stock.move(conn, material_id, body.initial_stock, "ajuste", note="Estoque inicial")
    return _serialize(_get(conn, material_id))


@router.put("/{material_id}")
def update_material(material_id: int, body: MaterialIn, conn: sqlite3.Connection = Depends(get_db)):
    _get(conn, material_id)
    with conn:
        conn.execute(
            """UPDATE materials SET name = ?, unit = ?, min_stock = ?, unit_cost = ?,
                      supplier = ?, notes = ?, updated_at = datetime('now', 'localtime')
               WHERE id = ?""",
            (body.name, body.unit, body.min_stock, body.unit_cost, body.supplier, body.notes, material_id),
        )
    return _serialize(_get(conn, material_id))


@router.delete("/{material_id}", status_code=204)
def archive_material(material_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Arquiva em vez de apagar: o histórico de compras e pedidos continua de pé."""
    _get(conn, material_id)
    used_in = conn.execute(
        """SELECT p.name FROM product_materials pm JOIN products p ON p.id = pm.product_id
           WHERE pm.material_id = ? AND p.archived = 0""",
        (material_id,),
    ).fetchall()
    if used_in:
        names = ", ".join(r["name"] for r in used_in)
        raise HTTPException(409, f"Esse insumo é usado em: {names}. Tire ele desses produtos antes.")
    with conn:
        conn.execute("UPDATE materials SET archived = 1 WHERE id = ?", (material_id,))


@router.post("/{material_id}/purchases", status_code=201)
def register_purchase(material_id: int, body: PurchaseIn, conn: sqlite3.Connection = Depends(get_db)):
    """Entrada por compra. O custo por unidade vira a média ponderada do que você tem."""
    material = _get(conn, material_id)
    qty = body.packages * body.package_size
    total = body.packages * body.package_price
    current = max(material["stock"], 0)
    new_unit_cost = (current * material["unit_cost"] + total) / (current + qty)

    with conn:
        conn.execute(
            """INSERT INTO purchases (material_id, packages, package_size, package_price, supplier, purchased_at)
               VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now', 'localtime')))""",
            (material_id, body.packages, body.package_size, body.package_price,
             body.supplier or material["supplier"],
             body.purchased_at.isoformat() if body.purchased_at else None),
        )
        stock.move(conn, material_id, qty, "compra",
                   note=f"{body.packages:g} × {body.package_size:g} {material['unit']}")
        conn.execute("UPDATE materials SET unit_cost = ? WHERE id = ?", (new_unit_cost, material_id))
        if body.supplier and not material["supplier"]:
            conn.execute("UPDATE materials SET supplier = ? WHERE id = ?", (body.supplier, material_id))
    return _serialize(_get(conn, material_id))


@router.post("/{material_id}/adjust")
def adjust_stock(material_id: int, body: AdjustIn, conn: sqlite3.Connection = Depends(get_db)):
    material = _get(conn, material_id)
    if body.new_stock is not None:
        delta = body.new_stock - material["stock"]
        note = body.note or "Contagem"
    elif body.delta is not None:
        delta = body.delta
        note = body.note or ("Perda" if delta < 0 else "Ajuste")
    else:
        raise HTTPException(422, "Informe a nova quantidade ou a diferença")
    with conn:
        stock.move(conn, material_id, delta, "ajuste", note=note)
    return _serialize(_get(conn, material_id))


@router.get("/{material_id}/movements")
def list_movements(material_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _get(conn, material_id)
    rows = conn.execute(
        """SELECT * FROM stock_movements WHERE material_id = ?
           ORDER BY created_at DESC, id DESC LIMIT 100""",
        (material_id,),
    ).fetchall()
    return [dict(r) for r in rows]
