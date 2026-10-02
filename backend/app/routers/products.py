import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..schemas import ProductIn
from ..services import pricing

router = APIRouter(prefix="/api/products", tags=["produtos"])


def _serialize(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    data = dict(row)
    breakdown = pricing.product_breakdown(conn, row)
    data["cost"] = breakdown.as_dict()
    data["materials"] = [
        {"material_id": line.material_id, "quantity": line.quantity} for line in breakdown.lines
    ]
    return data


def _get(conn: sqlite3.Connection, product_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM products WHERE id = ? AND archived = 0", (product_id,)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Produto não encontrado")
    return row


def _check_materials(conn: sqlite3.Connection, body: ProductIn) -> None:
    ids = [m.material_id for m in body.materials]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "O mesmo insumo aparece duas vezes na receita")
    for material_id in ids:
        if conn.execute("SELECT 1 FROM materials WHERE id = ?", (material_id,)).fetchone() is None:
            raise HTTPException(422, f"Insumo {material_id} não existe")


def _save_recipe(conn: sqlite3.Connection, product_id: int, body: ProductIn) -> None:
    conn.execute("DELETE FROM product_materials WHERE product_id = ?", (product_id,))
    conn.executemany(
        "INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)",
        [(product_id, m.material_id, m.quantity) for m in body.materials],
    )


@router.get("")
def list_products(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        "SELECT * FROM products WHERE archived = 0 ORDER BY name COLLATE NOCASE"
    ).fetchall()
    return [_serialize(conn, r) for r in rows]


@router.get("/{product_id}")
def get_product(product_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return _serialize(conn, _get(conn, product_id))


@router.post("/preview")
def preview(body: ProductIn, conn: sqlite3.Connection = Depends(get_db)):
    """Calculadora: custo e preço sugerido de um produto que ainda não foi salvo."""
    return pricing.calculate(
        conn,
        materials=[(m.material_id, m.quantity) for m in body.materials],
        labor_minutes=body.labor_minutes,
        machine_minutes=body.machine_minutes,
        extra_cost=body.extra_cost,
        margin_pct=body.margin_pct,
        price=body.price,
    ).as_dict()


@router.post("", status_code=201)
def create_product(body: ProductIn, conn: sqlite3.Connection = Depends(get_db)):
    _check_materials(conn, body)
    with conn:
        cur = conn.execute(
            """INSERT INTO products (name, description, labor_minutes, machine_minutes, extra_cost, margin_pct, price)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (body.name, body.description, body.labor_minutes, body.machine_minutes,
             body.extra_cost, body.margin_pct, body.price),
        )
        _save_recipe(conn, cur.lastrowid, body)
    return _serialize(conn, _get(conn, cur.lastrowid))


@router.put("/{product_id}")
def update_product(product_id: int, body: ProductIn, conn: sqlite3.Connection = Depends(get_db)):
    _get(conn, product_id)
    _check_materials(conn, body)
    with conn:
        conn.execute(
            """UPDATE products SET name = ?, description = ?, labor_minutes = ?, machine_minutes = ?,
                      extra_cost = ?, margin_pct = ?, price = ?, updated_at = datetime('now', 'localtime')
               WHERE id = ?""",
            (body.name, body.description, body.labor_minutes, body.machine_minutes,
             body.extra_cost, body.margin_pct, body.price, product_id),
        )
        _save_recipe(conn, product_id, body)
    return _serialize(conn, _get(conn, product_id))


@router.delete("/{product_id}", status_code=204)
def archive_product(product_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Arquiva: pedidos antigos continuam mostrando o produto."""
    _get(conn, product_id)
    with conn:
        conn.execute("UPDATE products SET archived = 1 WHERE id = ?", (product_id,))
