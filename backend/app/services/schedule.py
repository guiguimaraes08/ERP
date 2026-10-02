"""Agenda: quantas horas cada dia tem e quando cada pedido fica pronto.

Como a fila é montada:
- Entram os pedidos "a fazer" e "fazendo". Os que já estão "fazendo" vêm
  primeiro; depois, o prazo mais perto primeiro. Sem prazo vai para o fim.
- Cada dia, as horas de trabalho de quem trabalha naquele dia vão sendo
  gastas na ordem da fila (hoje conta inteiro).
- Se as máquinas estiverem configuradas (horas por dia), elas têm uma fila
  própria na mesma ordem e trabalham em paralelo com as pessoas: o pedido
  fica pronto quando as duas partes acabam.

É uma previsão: pedido "fazendo" conta como se faltasse ele inteiro.
"""

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import date, timedelta

HORIZON_DAYS = 366
DAYS_SHOWN_MIN = 14
DAYS_SHOWN_MAX = 62
EPS = 1e-6
WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def parse_week(raw: str) -> list[float]:
    try:
        hours = [float(h) for h in json.loads(raw)]
    except (TypeError, ValueError):
        return [0.0] * 7
    return hours if len(hours) == 7 else [0.0] * 7


@dataclass
class Job:
    order_id: int | None          # None = pedido novo, ainda não salvo (simulação)
    customer: str | None
    items: list[str]
    status: str
    due: date | None
    labor_h: float
    machine_h: float
    # Preenchido pela simulação (índice do dia a partir de hoje).
    start: int | None = None
    finish: int | None = None
    never: bool = False           # não cabe no horizonte (falta horário de trabalho)
    days: dict[int, float] = field(default_factory=dict)  # dia -> horas de trabalho

    def sort_key(self) -> tuple:
        started = 0 if self.status == "fazendo" else 1
        return (started, self.due or date.max, self.order_id if self.order_id is not None else float("inf"))


def daily_capacity(conn: sqlite3.Connection, start: date, days: int) -> list[dict]:
    """Horas de trabalho de cada dia, somando as pessoas e aplicando folgas/exceções."""
    workers = conn.execute("SELECT id, name, weekly_hours FROM workers WHERE active = 1 ORDER BY id").fetchall()
    end = start + timedelta(days=days - 1)
    exceptions = conn.execute(
        """SELECT worker_id, start_date, end_date, hours FROM worker_exceptions
           WHERE end_date >= ? AND start_date <= ? ORDER BY id""",
        (start.isoformat(), end.isoformat()),
    ).fetchall()
    weeks = {w["id"]: parse_week(w["weekly_hours"]) for w in workers}

    result = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        iso = day.isoformat()
        people = []
        for w in workers:
            hours = weeks[w["id"]][day.weekday()]
            for exc in exceptions:  # a exceção mais recente vence
                if exc["start_date"] <= iso <= exc["end_date"] and exc["worker_id"] in (None, w["id"]):
                    hours = exc["hours"]
            if hours > 0:
                people.append({"name": w["name"], "hours": hours})
        result.append({"date": iso, "hours": sum(p["hours"] for p in people), "people": people})
    return result


def load_jobs(conn: sqlite3.Connection) -> list[Job]:
    rows = conn.execute(
        """SELECT o.id, o.status, o.due_date, c.name AS customer,
                  COALESCE(SUM(i.quantity * i.labor_minutes), 0) / 60.0 AS labor_h,
                  COALESCE(SUM(i.quantity * i.machine_minutes), 0) / 60.0 AS machine_h,
                  GROUP_CONCAT(i.product_name, ' · ') AS items
           FROM orders o
           LEFT JOIN customers c ON c.id = o.customer_id
           LEFT JOIN order_items i ON i.order_id = o.id
           WHERE o.status IN ('a_fazer', 'fazendo')
           GROUP BY o.id"""
    ).fetchall()
    return [
        Job(
            order_id=r["id"],
            customer=r["customer"],
            items=(r["items"] or "").split(" · ") if r["items"] else [],
            status=r["status"],
            due=date.fromisoformat(r["due_date"]) if r["due_date"] else None,
            labor_h=r["labor_h"],
            machine_h=r["machine_h"],
        )
        for r in rows
    ]


def _run_queue(jobs: list[Job], capacity: list[float], attr: str, track_days: bool) -> dict[int, tuple[int | None, int | None]]:
    """Gasta a capacidade de cada dia na ordem da fila.
    Devolve, por posição na fila: (primeiro dia, último dia), ou (None, None) se não precisa disso,
    ou (dia, -1) se não terminou dentro do horizonte."""
    remaining = [getattr(j, attr) for j in jobs]
    result: dict[int, tuple[int | None, int | None]] = {
        i: (None, None) for i, need in enumerate(remaining) if need <= EPS
    }
    queue = [i for i, need in enumerate(remaining) if need > EPS]
    first: dict[int, int] = {}
    pos = 0
    for day, cap in enumerate(capacity):
        left = cap
        while left > EPS and pos < len(queue):
            i = queue[pos]
            take = min(left, remaining[i])
            first.setdefault(i, day)
            if track_days:
                jobs[i].days[day] = jobs[i].days.get(day, 0) + take
            remaining[i] -= take
            left -= take
            if remaining[i] <= EPS:
                result[i] = (first[i], day)
                pos += 1
        if pos >= len(queue):
            break
    for i in queue[pos:]:
        result[i] = (first.get(i), -1)
    return result


def simulate(conn: sqlite3.Connection, extra: Job | None = None, exclude_order: int | None = None,
             today: date | None = None) -> dict:
    today = today or date.today()
    caps = daily_capacity(conn, today, HORIZON_DAYS)
    row = conn.execute("SELECT value FROM settings WHERE key = 'machine_hours_per_day'").fetchone()
    machine_per_day = float(row["value"]) if row else 0.0

    jobs = [j for j in load_jobs(conn) if j.order_id != exclude_order]
    if extra is not None:
        jobs.append(extra)
    jobs.sort(key=Job.sort_key)

    labor = _run_queue(jobs, [c["hours"] for c in caps], "labor_h", track_days=True)
    machine = (
        _run_queue(jobs, [machine_per_day] * HORIZON_DAYS, "machine_h", track_days=False)
        if machine_per_day > 0
        else {}
    )

    for i, job in enumerate(jobs):
        parts = [labor[i]] + ([machine[i]] if i in machine else [])
        ends = [end for _, end in parts if end is not None]
        starts = [start for start, _ in parts if start is not None]
        job.never = -1 in ends
        job.finish = None if job.never else max(ends, default=0)
        job.start = min(starts, default=0)

    def iso(offset: int | None) -> str | None:
        return None if offset is None else (today + timedelta(days=offset)).isoformat()

    out_jobs = []
    for job in jobs:
        finish_date = today + timedelta(days=job.finish) if job.finish is not None else None
        slack = (job.due - finish_date).days if job.due and finish_date else None
        out_jobs.append({
            "order_id": job.order_id,
            "customer": job.customer,
            "items": job.items,
            "status": job.status,
            "due_date": job.due.isoformat() if job.due else None,
            "labor_hours": round(job.labor_h, 2),
            "machine_hours": round(job.machine_h, 2),
            "start_date": iso(job.start),
            "finish_date": iso(job.finish),
            "no_forecast": job.never,
            "no_time": job.labor_h <= EPS and job.machine_h <= EPS,
            "slack_days": slack,
            "late": job.never or (slack is not None and slack < 0),
        })

    last_day = max((j.finish for j in jobs if j.finish is not None), default=0)
    shown = min(max(last_day + 1, DAYS_SHOWN_MIN), DAYS_SHOWN_MAX)
    days = []
    for d in range(shown):
        entries = [
            {"order_id": j.order_id, "customer": j.customer, "hours": round(j.days[d], 2)}
            for j in jobs if d in j.days
        ]
        used = sum(e["hours"] for e in entries)
        days.append({
            "date": caps[d]["date"],
            "weekday": WEEKDAYS[(today + timedelta(days=d)).weekday()],
            "capacity": round(caps[d]["hours"], 2),
            "used": round(used, 2),
            "people": caps[d]["people"],
            "orders": entries,
        })

    return {
        "today": today.isoformat(),
        "jobs": out_jobs,
        "days": days,
        "machine_hours_per_day": machine_per_day,
        "has_capacity": any(c["hours"] > 0 for c in caps[:28]),
        "summary": {
            "orders": len(jobs),
            "labor_hours": round(sum(j.labor_h for j in jobs), 1),
            "all_done": iso(last_day) if jobs and not any(j.never for j in jobs) else None,
            "late": sum(1 for j in out_jobs if j["late"]),
        },
    }


def forecast_by_order(conn: sqlite3.Connection) -> dict[int, dict]:
    """Previsão de cada pedido aberto, para mostrar nas listas."""
    return {j["order_id"]: j for j in simulate(conn)["jobs"]}
