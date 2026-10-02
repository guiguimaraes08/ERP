"""Movimentação de estoque.

Regra central: o material de um pedido sai do estoque UMA vez, quando o pedido
começa a ser feito, e volta (estorno) se o pedido for cancelado, voltar para
"a fazer" ou for excluído. O estorno devolve exatamente o que foi baixado,
somando os movimentos do pedido; não recalcula pela receita atual.
"""

import json
import sqlite3
from collections import defaultdict


class ShortageError(Exception):
    def __init__(self, shortages: list[dict]):
        self.shortages = shortages
        names = ", ".join(s["name"] for s in shortages)
        super().__init__(f"Falta material: {names}")


def move(
    conn: sqlite3.Connection,
    material_id: int,
    delta: float,
    reason: str,
    *,
    order_id: int | None = None,
    note: str = "",
) -> None:
    if abs(delta) < 1e-9:
        return
    conn.execute(
        "INSERT INTO stock_movements (material_id, delta, reason, order_id, note) VALUES (?, ?, ?, ?, ?)",
        (material_id, delta, reason, order_id, note),
    )
    conn.execute(
        "UPDATE materials SET stock = stock + ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
        (delta, material_id),
    )


def order_needs(conn: sqlite3.Connection, order_id: int) -> dict[int, float]:
    """Quanto de cada material o pedido consome, pela receita congelada nos itens."""
    needs: dict[int, float] = defaultdict(float)
    rows = conn.execute(
        "SELECT quantity, recipe_json FROM order_items WHERE order_id = ?", (order_id,)
    ).fetchall()
    for row in rows:
        for part in json.loads(row["recipe_json"]):
            needs[part["material_id"]] += part["quantity"] * row["quantity"]
    return dict(needs)


def shortages_for(conn: sqlite3.Connection, needs: dict[int, float]) -> list[dict]:
    result = []
    for material_id, needed in needs.items():
        row = conn.execute(
            "SELECT name, unit, stock FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if row is None:
            continue
        if needed > row["stock"] + 1e-9:
            result.append(
                {
                    "material_id": material_id,
                    "name": row["name"],
                    "unit": row["unit"],
                    "needed": round(needed, 3),
                    "stock": round(row["stock"], 3),
                    "missing": round(needed - row["stock"], 3),
                }
            )
    return result


def deduct_for_order(conn: sqlite3.Connection, order_id: int, *, force: bool = False) -> None:
    order = conn.execute("SELECT stock_deducted FROM orders WHERE id = ?", (order_id,)).fetchone()
    if order is None or order["stock_deducted"]:
        return
    needs = order_needs(conn, order_id)
    if not force:
        missing = shortages_for(conn, needs)
        if missing:
            raise ShortageError(missing)
    for material_id, qty in needs.items():
        move(conn, material_id, -qty, "pedido", order_id=order_id, note=f"Pedido #{order_id}")
    conn.execute("UPDATE orders SET stock_deducted = 1 WHERE id = ?", (order_id,))


def restore_for_order(conn: sqlite3.Connection, order_id: int) -> None:
    rows = conn.execute(
        """
        SELECT material_id, SUM(delta) AS net
        FROM stock_movements
        WHERE order_id = ? AND reason IN ('pedido', 'estorno')
        GROUP BY material_id
        """,
        (order_id,),
    ).fetchall()
    for row in rows:
        if row["net"] < -1e-9:
            move(conn, row["material_id"], -row["net"], "estorno", order_id=order_id,
                 note=f"Estorno do pedido #{order_id}")
    conn.execute("UPDATE orders SET stock_deducted = 0 WHERE id = ?", (order_id,))
