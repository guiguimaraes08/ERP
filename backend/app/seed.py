"""Dados de exemplo (impressão 3D + cordões) para conhecer o sistema."""

import json
import sqlite3
from datetime import date, timedelta

from .services import pricing, stock

MATERIALS = [
    # nome, unidade, estoque, mínimo, custo/unidade, fornecedor
    ("Filamento PLA preto", "g", 2400, 1000, 0.11, "3D Fila"),
    ("Filamento PETG transparente", "g", 800, 1000, 0.13, "Esun"),
    ("Filamento TPU laranja", "g", 450, 300, 0.18, "Voolt3D"),
    ("Fita de cordão azul 20mm", "m", 380, 100, 0.85, "Fitas Brasil"),
    ("Fita de cordão preta 20mm", "m", 120, 100, 0.85, "Fitas Brasil"),
    ("Mosquetão giratório 20mm", "un", 240, 100, 1.45, "Ferragens Sul"),
    ("Trava de segurança 20mm", "un", 520, 100, 0.62, "PlastFix"),
    ("Argola de chaveiro", "un", 90, 50, 0.30, "Ferragens Sul"),
    ("Saquinho kraft com visor", "un", 180, 50, 0.95, "EcoPack"),
]

PRODUCTS = [
    # nome, min. trabalho, min. máquina, extra, margem, receita [(índice do insumo, qtd)]
    ("Cordão azul com mosquetão", 4, 0, 0, None, [(3, 0.9), (5, 1), (6, 1), (8, 1)]),
    ("Cordão preto com mosquetão", 4, 0, 0, None, [(4, 0.9), (5, 1), (6, 1), (8, 1)]),
    ("Chaveiro flexível TPU", 2, 25, 0, 50, [(2, 7), (7, 1)]),
    ("Caixa organizadora Gridfinity", 3, 90, 0, None, [(1, 35)]),
    ("Suporte de celular PLA", 2, 60, 0, None, [(0, 40), (8, 1)]),
]


def seed_demo(conn: sqlite3.Connection) -> None:
    material_ids = []
    for name, unit, qty, minimum, cost, supplier in MATERIALS:
        cur = conn.execute(
            "INSERT INTO materials (name, unit, min_stock, unit_cost, supplier) VALUES (?, ?, ?, ?, ?)",
            (name, unit, minimum, cost, supplier),
        )
        material_ids.append(cur.lastrowid)
        stock.move(conn, cur.lastrowid, qty, "ajuste", note="Estoque inicial (exemplo)")

    product_ids = []
    for name, labor, machine, extra, margin, recipe in PRODUCTS:
        cur = conn.execute(
            """INSERT INTO products (name, labor_minutes, machine_minutes, extra_cost, margin_pct)
               VALUES (?, ?, ?, ?, ?)""",
            (name, labor, machine, extra, margin),
        )
        product_ids.append(cur.lastrowid)
        conn.executemany(
            "INSERT INTO product_materials (product_id, material_id, quantity) VALUES (?, ?, ?)",
            [(cur.lastrowid, material_ids[i], q) for i, q in recipe],
        )

    # Quem trabalha: seg a sex 6h, sábado 4h. Uma impressora rodando até 18h por dia.
    conn.execute("INSERT INTO workers (name, weekly_hours) VALUES ('Eu', '[6, 6, 6, 6, 6, 4, 0]')")
    conn.execute("UPDATE settings SET value = '18' WHERE key = 'machine_hours_per_day'")

    customers = []
    for name, phone in [
        ("Ana Souza", "11987654321"),
        ("Escola Pequeno Mundo", "11912345678"),
        ("Carlos (Ateliê Silva)", ""),
    ]:
        customers.append(conn.execute(
            "INSERT INTO customers (name, phone) VALUES (?, ?)", (name, phone)
        ).lastrowid)

    today = date.today()
    orders = [
        # cliente, prazo (dias), status, itens [(produto, qtd)], pago
        (1, 6, "a_fazer", [(1, 120)], 300.0),
        (0, 2, "fazendo", [(2, 30), (4, 2)], 0.0),
        (2, -1, "fazendo", [(3, 12)], 150.0),
        (0, -4, "entregue", [(0, 20)], None),
    ]
    for cust, days, status, items, paid in orders:
        order_id = conn.execute(
            "INSERT INTO orders (customer_id, due_date) VALUES (?, ?)",
            (customers[cust], (today + timedelta(days=days)).isoformat()),
        ).lastrowid
        total = 0.0
        for p_index, qty in items:
            product = conn.execute("SELECT * FROM products WHERE id = ?", (product_ids[p_index],)).fetchone()
            b = pricing.product_breakdown(conn, product)
            recipe = [{"material_id": m, "quantity": q} for m, q in pricing.product_recipe(conn, product["id"])]
            conn.execute(
                """INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost,
                                            recipe_json, labor_minutes, machine_minutes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (order_id, product["id"], product["name"], qty, b.price, b.unit_cost, json.dumps(recipe),
                 product["labor_minutes"], product["machine_minutes"]),
            )
            total += qty * b.price
        if status != "a_fazer":
            stock.deduct_for_order(conn, order_id, force=True)
        conn.execute(
            "UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?",
            (status, today.isoformat() if status == "entregue" else None, order_id),
        )
        amount = round(total, 2) if paid is None else paid
        if amount > 0:
            conn.execute("INSERT INTO payments (order_id, amount) VALUES (?, ?)", (order_id, amount))
