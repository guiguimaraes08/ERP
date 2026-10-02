import json
import sqlite3
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..schemas import MachineHoursIn, SchedulePreviewIn, WorkerExceptionIn, WorkerIn
from ..services import schedule

router = APIRouter(prefix="/api", tags=["agenda"])


def _worker(row: sqlite3.Row) -> dict:
    data = dict(row)
    data["weekly_hours"] = schedule.parse_week(row["weekly_hours"])
    data["active"] = bool(row["active"])
    data["week_total"] = round(sum(data["weekly_hours"]), 1)
    return data


def _get_worker(conn: sqlite3.Connection, worker_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM workers WHERE id = ?", (worker_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Pessoa não encontrada")
    return row


# --- Quem trabalha ----------------------------------------------------------------

@router.get("/workers")
def list_workers(conn: sqlite3.Connection = Depends(get_db)):
    return [_worker(r) for r in conn.execute("SELECT * FROM workers ORDER BY id")]


@router.post("/workers", status_code=201)
def create_worker(body: WorkerIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        cur = conn.execute(
            "INSERT INTO workers (name, weekly_hours, active) VALUES (?, ?, ?)",
            (body.name, json.dumps(body.weekly_hours), int(body.active)),
        )
    return _worker(_get_worker(conn, cur.lastrowid))


@router.put("/workers/{worker_id}")
def update_worker(worker_id: int, body: WorkerIn, conn: sqlite3.Connection = Depends(get_db)):
    _get_worker(conn, worker_id)
    with conn:
        conn.execute(
            "UPDATE workers SET name = ?, weekly_hours = ?, active = ? WHERE id = ?",
            (body.name, json.dumps(body.weekly_hours), int(body.active), worker_id),
        )
    return _worker(_get_worker(conn, worker_id))


@router.delete("/workers/{worker_id}", status_code=204)
def delete_worker(worker_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _get_worker(conn, worker_id)
    with conn:
        conn.execute("DELETE FROM workers WHERE id = ?", (worker_id,))


# --- Folgas e dias diferentes -------------------------------------------------------

@router.get("/workers/exceptions")
def list_exceptions(conn: sqlite3.Connection = Depends(get_db)):
    """Só as que ainda valem (de hoje em diante)."""
    rows = conn.execute(
        """SELECT e.*, w.name AS worker_name FROM worker_exceptions e
           LEFT JOIN workers w ON w.id = e.worker_id
           WHERE e.end_date >= ? ORDER BY e.start_date, e.id""",
        (date.today().isoformat(),),
    ).fetchall()
    return [dict(r) for r in rows]


@router.post("/workers/exceptions", status_code=201)
def create_exception(body: WorkerExceptionIn, conn: sqlite3.Connection = Depends(get_db)):
    if body.worker_id is not None:
        _get_worker(conn, body.worker_id)
    end = body.end_date or body.start_date
    if end < body.start_date:
        raise HTTPException(422, "O último dia não pode ser antes do primeiro")
    with conn:
        cur = conn.execute(
            "INSERT INTO worker_exceptions (worker_id, start_date, end_date, hours, note) VALUES (?, ?, ?, ?, ?)",
            (body.worker_id, body.start_date.isoformat(), end.isoformat(), body.hours, body.note.strip()),
        )
    return {"id": cur.lastrowid}


@router.delete("/workers/exceptions/{exception_id}", status_code=204)
def delete_exception(exception_id: int, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        cur = conn.execute("DELETE FROM worker_exceptions WHERE id = ?", (exception_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Não encontrado")


# --- Agenda -------------------------------------------------------------------------

@router.get("/schedule")
def get_schedule(conn: sqlite3.Connection = Depends(get_db)):
    return schedule.simulate(conn)


@router.post("/schedule/preview")
def preview(body: SchedulePreviewIn, conn: sqlite3.Connection = Depends(get_db)):
    """Se eu aceitar este pedido agora, quando ele fica pronto?"""
    labor = machine = 0.0
    names = []
    for item in body.items:
        product = None
        if item.product_id is not None:
            product = conn.execute("SELECT * FROM products WHERE id = ?", (item.product_id,)).fetchone()
        unit_labor = item.labor_minutes if item.labor_minutes is not None else (product["labor_minutes"] if product else 0)
        unit_machine = item.machine_minutes if item.machine_minutes is not None else (product["machine_minutes"] if product else 0)
        labor += item.quantity * unit_labor / 60
        machine += item.quantity * unit_machine / 60
        names.append(product["name"] if product else (item.product_name or "Item"))

    job = schedule.Job(order_id=None, customer=None, items=names, status="a_fazer",
                       due=body.due_date, labor_h=labor, machine_h=machine)
    result = schedule.simulate(conn, extra=job, exclude_order=body.order_id)
    mine = next(j for j in result["jobs"] if j["order_id"] is None)
    # Quem atrasa por causa deste pedido (estava em dia sem ele)?
    before = {j["order_id"]: j for j in schedule.simulate(conn, exclude_order=body.order_id)["jobs"]}
    pushed = [
        {"order_id": j["order_id"], "customer": j["customer"], "due_date": j["due_date"], "finish_date": j["finish_date"]}
        for j in result["jobs"]
        if j["order_id"] is not None and j["late"] and not before.get(j["order_id"], {}).get("late")
    ]
    # Data segura para combinar: o pedido no fim da fila, sem passar na frente de ninguém.
    last = schedule.Job(order_id=None, customer=None, items=names, status="a_fazer",
                        due=None, labor_h=labor, machine_h=machine)
    safe = next(j for j in schedule.simulate(conn, extra=last, exclude_order=body.order_id)["jobs"] if j["order_id"] is None)
    return mine | {"has_capacity": result["has_capacity"], "pushes_late": pushed, "safe_date": safe["finish_date"]}


@router.put("/schedule/settings")
def set_machine_hours(body: MachineHoursIn, conn: sqlite3.Connection = Depends(get_db)):
    with conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('machine_hours_per_day', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (str(body.machine_hours_per_day),),
        )
    return {"machine_hours_per_day": body.machine_hours_per_day}
