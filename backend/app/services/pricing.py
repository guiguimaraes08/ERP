"""Custo de um produto e preço sugerido.

custo unitário = materiais + (min. de trabalho / 60 × R$/h) + (min. de máquina / 60 × R$/h) + extras
preço sugerido = custo ÷ (1 − margem)   → margem calculada sobre o preço de venda
"""

import sqlite3
from dataclasses import asdict, dataclass, field


def get_settings(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings")}


def _float_setting(settings: dict[str, str], key: str, default: float) -> float:
    try:
        return float(settings.get(key, default))
    except (TypeError, ValueError):
        return default


def suggested_price(unit_cost: float, margin_pct: float) -> float:
    margin = min(max(margin_pct, 0.0), 94.99) / 100
    return round(unit_cost / (1 - margin), 2)


@dataclass
class CostLine:
    material_id: int
    name: str
    unit: str
    quantity: float
    unit_cost: float
    cost: float


@dataclass
class CostBreakdown:
    materials_cost: float
    labor_cost: float
    machine_cost: float
    extra_cost: float
    unit_cost: float
    margin_pct: float
    suggested_price: float
    price: float            # preço praticado (o fixado no produto ou o sugerido)
    price_is_custom: bool
    profit: float           # lucro por unidade no preço praticado
    real_margin_pct: float
    lines: list[CostLine] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def calculate(
    conn: sqlite3.Connection,
    *,
    materials: list[tuple[int, float]],
    labor_minutes: float,
    machine_minutes: float,
    extra_cost: float,
    margin_pct: float | None,
    price: float | None,
) -> CostBreakdown:
    settings = get_settings(conn)
    labor_rate = _float_setting(settings, "labor_rate", 0)
    machine_rate = _float_setting(settings, "machine_rate", 0)
    # `is None` e não `or`: margem 0 e preço 0 são escolhas válidas.
    margin = margin_pct if margin_pct is not None else _float_setting(settings, "default_margin", 40)

    lines: list[CostLine] = []
    for material_id, qty in materials:
        row = conn.execute(
            "SELECT name, unit, unit_cost FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if row is None:
            continue
        lines.append(
            CostLine(
                material_id=material_id,
                name=row["name"],
                unit=row["unit"],
                quantity=qty,
                unit_cost=row["unit_cost"],
                cost=round(qty * row["unit_cost"], 4),
            )
        )

    materials_cost = sum(line.cost for line in lines)
    labor_cost = labor_minutes / 60 * labor_rate
    machine_cost = machine_minutes / 60 * machine_rate
    unit_cost = materials_cost + labor_cost + machine_cost + extra_cost

    suggested = suggested_price(unit_cost, margin)
    effective = price if price is not None else suggested
    profit = effective - unit_cost
    real_margin = (profit / effective * 100) if effective > 0 else 0.0

    return CostBreakdown(
        materials_cost=round(materials_cost, 2),
        labor_cost=round(labor_cost, 2),
        machine_cost=round(machine_cost, 2),
        extra_cost=round(extra_cost, 2),
        unit_cost=round(unit_cost, 2),
        margin_pct=margin,
        suggested_price=suggested,
        price=round(effective, 2),
        price_is_custom=price is not None,
        profit=round(profit, 2),
        real_margin_pct=round(real_margin, 1),
        lines=lines,
    )


def product_recipe(conn: sqlite3.Connection, product_id: int) -> list[tuple[int, float]]:
    rows = conn.execute(
        "SELECT material_id, quantity FROM product_materials WHERE product_id = ?",
        (product_id,),
    ).fetchall()
    return [(r["material_id"], r["quantity"]) for r in rows]


def product_breakdown(conn: sqlite3.Connection, product: sqlite3.Row) -> CostBreakdown:
    return calculate(
        conn,
        materials=product_recipe(conn, product["id"]),
        labor_minutes=product["labor_minutes"],
        machine_minutes=product["machine_minutes"],
        extra_cost=product["extra_cost"],
        margin_pct=product["margin_pct"],
        price=product["price"],
    )
