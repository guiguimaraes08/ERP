import json
import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..schemas import OrderIn, PaymentIn, StatusIn
from ..services import pricing, schedule, stock

router = APIRouter(prefix="/api/orders", tags=["pedidos"])

OPEN_STATUSES = ("a_fazer", "fazendo", "pronto")
# Status em que o material já foi usado (saiu do estoque).
CONSUMING_STATUSES = ("fazendo", "pronto", "entregue")


def _shortage_http(err: stock.ShortageError) -> HTTPException:
    return HTTPException(409, {"message": str(err), "shortages": err.shortages})


def order_summary(conn: sqlite3.Connection, order_id: int) -> dict:
    row = conn.execute(
        """SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
           FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
           WHERE o.id = ?""",
        (order_id,),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Pedido não encontrado")

    items = conn.execute(
        "SELECT * FROM order_items WHERE order_id = ? ORDER BY id", (order_id,)
    ).fetchall()
    payments = conn.execute(
        "SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at, id", (order_id,)
    ).fetchall()

    subtotal = sum(i["quantity"] * i["unit_price"] for i in items)
    total = max(subtotal - row["discount"], 0)
    cost = sum(i["quantity"] * i["unit_cost"] for i in items)
    paid = sum(p["amount"] for p in payments)

    data = dict(row)
    data.update(
        items=[{k: v for k, v in dict(i).items() if k != "recipe_json"} for i in items],
        payments=[dict(p) for p in payments],
        subtotal=round(subtotal, 2),
        total=round(total, 2),
        cost=round(cost, 2),
        profit=round(total - cost, 2),
        paid=round(paid, 2),
        balance=round(total - paid, 2) if row["status"] != "cancelado" else 0,
        late=bool(
            row["due_date"]
            and row["status"] in OPEN_STATUSES
            and row["due_date"] < date.today().isoformat()
        ),
    )
    # Para pedidos ainda não iniciados, avisa o que vai faltar.
    data["shortages"] = (
        stock.shortages_for(conn, stock.order_needs(conn, order_id))
        if row["status"] == "a_fazer"
        else []
    )
    return data


def _resolve_customer(conn: sqlite3.Connection, body: OrderIn) -> int | None:
    if body.customer_id is not None:
        if conn.execute("SELECT 1 FROM customers WHERE id = ?", (body.customer_id,)).fetchone() is None:
            raise HTTPException(422, "Cliente não encontrado")
        return body.customer_id
    name = (body.customer_name or "").strip()
    if not name:
        return None
    existing = conn.execute(
        "SELECT id FROM customers WHERE name = ? COLLATE NOCASE", (name,)
    ).fetchone()
    if existing:
        return existing["id"]
    cur = conn.execute(
        "INSERT INTO customers (name, phone) VALUES (?, ?)", (name, (body.customer_phone or "").strip())
    )
    return cur.lastrowid


def _write_items(conn: sqlite3.Connection, order_id: int, body: OrderIn) -> None:
    conn.execute("DELETE FROM order_items WHERE order_id = ?", (order_id,))
    for item in body.items:
        if item.product_id is not None:
            product = conn.execute(
                "SELECT * FROM products WHERE id = ?", (item.product_id,)
            ).fetchone()
            if product is None:
                raise HTTPException(422, f"Produto {item.product_id} não encontrado")
            breakdown = pricing.product_breakdown(conn, product)
            recipe = [
                {"material_id": m_id, "quantity": qty}
                for m_id, qty in pricing.product_recipe(conn, product["id"])
            ]
            name = item.product_name or product["name"]
            unit_price = item.unit_price if item.unit_price is not None else breakdown.price
            unit_cost = breakdown.unit_cost
            labor, machine = product["labor_minutes"], product["machine_minutes"]
        else:
            if not item.product_name or item.unit_price is None:
                raise HTTPException(422, "Item avulso precisa de nome e preço")
            name, unit_price, unit_cost, recipe = item.product_name, item.unit_price, 0.0, []
            labor = machine = 0.0
        if item.labor_minutes is not None:
            labor = item.labor_minutes
        if item.machine_minutes is not None:
            machine = item.machine_minutes

        conn.execute(
            """INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost,
                                        recipe_json, labor_minutes, machine_minutes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (order_id, item.product_id, name, item.quantity, unit_price, unit_cost, json.dumps(recipe), labor, machine),
        )


@router.get("")
def list_orders(status: str | None = None, conn: sqlite3.Connection = Depends(get_db)):
    if status == "abertos":
        query = "SELECT id FROM orders WHERE status IN ('a_fazer', 'fazendo', 'pronto')"
        params: tuple = ()
    elif status:
        query, params = "SELECT id FROM orders WHERE status = ?", (status,)
    else:
        query, params = "SELECT id FROM orders", ()
    # Abertos primeiro pelo prazo mais próximo; sem prazo vão para o fim.
    query += " ORDER BY due_date IS NULL, due_date, id DESC"
    forecast = schedule.forecast_by_order(conn)
    return [
        order_summary(conn, r["id"]) | {"forecast": forecast.get(r["id"])}
        for r in conn.execute(query, params).fetchall()
    ]


@router.get("/{order_id}")
def get_order(order_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return order_summary(conn, order_id) | {"forecast": schedule.forecast_by_order(conn).get(order_id)}


@router.post("", status_code=201)
def create_order(body: OrderIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        customer_id = _resolve_customer(conn, body)
        cur = conn.execute(
            "INSERT INTO orders (customer_id, due_date, notes, discount) VALUES (?, ?, ?, ?)",
            (customer_id, body.due_date.isoformat() if body.due_date else None, body.notes, body.discount),
        )
        _write_items(conn, cur.lastrowid, body)
    return order_summary(conn, cur.lastrowid)


@router.put("/{order_id}")
def update_order(order_id: int, body: OrderIn, conn: sqlite3.Connection = Depends(get_db)):
    order = order_summary(conn, order_id)
    try:
        with conn:
            customer_id = _resolve_customer(conn, body)
            # Se o material já tinha saído, devolve e baixa de novo com os itens novos.
            was_deducted = bool(order["stock_deducted"])
            if was_deducted:
                stock.restore_for_order(conn, order_id)
            conn.execute(
                """UPDATE orders SET customer_id = ?, due_date = ?, notes = ?, discount = ?,
                          updated_at = datetime('now', 'localtime') WHERE id = ?""",
                (customer_id, body.due_date.isoformat() if body.due_date else None,
                 body.notes, body.discount, order_id),
            )
            _write_items(conn, order_id, body)
            if was_deducted:
                stock.deduct_for_order(conn, order_id, force=body.force)
    except stock.ShortageError as err:
        raise _shortage_http(err)
    return order_summary(conn, order_id)


@router.post("/{order_id}/status")
def change_status(order_id: int, body: StatusIn, conn: sqlite3.Connection = Depends(get_db)):
    order_summary(conn, order_id)
    try:
        with conn:
            if body.status in CONSUMING_STATUSES:
                stock.deduct_for_order(conn, order_id, force=body.force)
            else:
                stock.restore_for_order(conn, order_id)
            conn.execute(
                """UPDATE orders SET status = ?,
                          delivered_at = CASE WHEN ? = 'entregue'
                                              THEN COALESCE(delivered_at, date('now', 'localtime'))
                                              ELSE NULL END,
                          updated_at = datetime('now', 'localtime')
                   WHERE id = ?""",
                (body.status, body.status, order_id),
            )
    except stock.ShortageError as err:
        raise _shortage_http(err)
    return order_summary(conn, order_id)


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, conn: sqlite3.Connection = Depends(get_db)):
    order_summary(conn, order_id)
    with conn:
        stock.restore_for_order(conn, order_id)
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))


@router.post("/{order_id}/payments", status_code=201)
def add_payment(order_id: int, body: PaymentIn, conn: sqlite3.Connection = Depends(get_db)):
    order_summary(conn, order_id)
    with conn:
        conn.execute(
            "INSERT INTO payments (order_id, amount, method, paid_at) VALUES (?, ?, ?, COALESCE(?, date('now', 'localtime')))",
            (order_id, body.amount, body.method, body.paid_at.isoformat() if body.paid_at else None),
        )
    return order_summary(conn, order_id)


@router.delete("/{order_id}/payments/{payment_id}")
def delete_payment(order_id: int, payment_id: int, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        cur = conn.execute(
            "DELETE FROM payments WHERE id = ? AND order_id = ?", (payment_id, order_id)
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "Pagamento não encontrado")
    return order_summary(conn, order_id)
