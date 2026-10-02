import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..schemas import CustomerIn
from .orders import order_summary

router = APIRouter(prefix="/api/customers", tags=["clientes"])


def _serialize(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    data = dict(row)
    order_ids = [
        r["id"] for r in conn.execute(
            "SELECT id FROM orders WHERE customer_id = ? AND status != 'cancelado'", (row["id"],)
        )
    ]
    orders = [order_summary(conn, oid) for oid in order_ids]
    data["orders_count"] = len(orders)
    data["total_bought"] = round(sum(o["total"] for o in orders), 2)
    data["balance"] = round(sum(o["balance"] for o in orders), 2)
    return data


def _get(conn: sqlite3.Connection, customer_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Cliente não encontrado")
    return row


@router.get("")
def list_customers(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute("SELECT * FROM customers ORDER BY name COLLATE NOCASE").fetchall()
    return [_serialize(conn, r) for r in rows]


@router.post("", status_code=201)
def create_customer(body: CustomerIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        cur = conn.execute(
            "INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?)",
            (body.name, body.phone, body.notes),
        )
    return _serialize(conn, _get(conn, cur.lastrowid))


@router.put("/{customer_id}")
def update_customer(customer_id: int, body: CustomerIn, conn: sqlite3.Connection = Depends(get_db)):
    _get(conn, customer_id)
    with conn:
        conn.execute(
            "UPDATE customers SET name = ?, phone = ?, notes = ? WHERE id = ?",
            (body.name, body.phone, body.notes, customer_id),
        )
    return _serialize(conn, _get(conn, customer_id))


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, conn: sqlite3.Connection = Depends(get_db)):
    """Os pedidos do cliente ficam, só perdem o vínculo."""
    _get(conn, customer_id)
    with conn:
        conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
