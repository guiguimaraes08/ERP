from datetime import date, timedelta

import pytest

from app.db import connect, init_db
from app.services import schedule

SEGUNDA = date(2026, 10, 5)


def sim(**kwargs):
    conn = connect()
    try:
        return schedule.simulate(conn, today=SEGUNDA, **kwargs)
    finally:
        conn.close()


def job(result, order_id):
    return next(j for j in result["jobs"] if j["order_id"] == order_id)


@pytest.fixture
def produto_1h(client):
    """Produto que leva 1 hora de trabalho por unidade."""
    return client.post("/api/products", json={"name": "Peça", "labor_minutes": 60, "price": 10}).json()


@pytest.fixture
def jose(client):
    # 8h de segunda a sexta, 4h no sábado, domingo de folga
    return client.post("/api/workers", json={"name": "José", "weekly_hours": [8, 8, 8, 8, 8, 4, 0]}).json()


def pedido(client, product_id, qty, due=None):
    return client.post("/api/orders", json={
        "customer_name": f"Cliente {qty}", "due_date": due,
        "items": [{"product_id": product_id, "quantity": qty}],
    }).json()


def test_horas_por_dia_com_folga_e_feriado(client, jose):
    client.post("/api/workers", json={"name": "Maria", "weekly_hours": [4, 4, 4, 4, 4, 0, 0]})
    client.post("/api/workers/exceptions", json={"worker_id": jose["id"], "start_date": "2026-10-06", "hours": 0})
    client.post("/api/workers/exceptions", json={"start_date": "2026-10-07", "hours": 2, "note": "meio feriado"})
    conn = connect()
    caps = [d["hours"] for d in schedule.daily_capacity(conn, SEGUNDA, 7)]
    conn.close()
    #        seg ter qua (todos 2h) qui sex sáb dom
    assert caps == [12, 4, 4, 12, 12, 4, 0]


def test_fila_pelo_prazo_mais_perto(client, jose, produto_1h):
    longe = pedido(client, produto_1h["id"], 10, "2026-10-20")
    perto = pedido(client, produto_1h["id"], 6, "2026-10-08")
    r = sim()
    assert job(r, perto["id"])["finish_date"] == "2026-10-05"   # 6h cabem na segunda
    assert job(r, longe["id"])["start_date"] == "2026-10-05"    # usa as 2h que sobram
    assert job(r, longe["id"])["finish_date"] == "2026-10-06"   # 2h + 8h na terça
    assert r["days"][0]["used"] == pytest.approx(8)


def test_pedido_em_andamento_vem_primeiro(client, jose, produto_1h):
    urgente = pedido(client, produto_1h["id"], 8, "2026-10-06")
    andamento = pedido(client, produto_1h["id"], 8, "2026-10-30")
    client.post(f"/api/orders/{andamento['id']}/status", json={"status": "fazendo"})
    r = sim()
    assert job(r, andamento["id"])["finish_date"] == "2026-10-05"
    assert job(r, urgente["id"])["finish_date"] == "2026-10-06"


def test_avisa_atraso(client, jose, produto_1h):
    o = pedido(client, produto_1h["id"], 20, "2026-10-06")  # 20h, só tem 16h até terça
    r = sim()
    j = job(r, o["id"])
    assert j["finish_date"] == "2026-10-07"
    assert j["late"] is True and j["slack_days"] == -1
    assert r["summary"]["late"] == 1


def test_fim_de_semana_conta_as_horas_do_sabado(client, jose, produto_1h):
    o = pedido(client, produto_1h["id"], 44)  # seg-sex 40h + sábado 4h
    assert job(sim(), o["id"])["finish_date"] == "2026-10-10"


def test_sem_ninguem_cadastrado_nao_tem_previsao(client, produto_1h):
    o = pedido(client, produto_1h["id"], 1)
    r = sim()
    assert r["has_capacity"] is False
    assert job(r, o["id"])["no_forecast"] is True and job(r, o["id"])["finish_date"] is None


def test_maquina_em_paralelo(client, jose):
    impressao = client.post("/api/products", json={"name": "Vaso", "machine_minutes": 120, "labor_minutes": 6}).json()
    client.put("/api/schedule/settings", json={"machine_hours_per_day": 10})
    o = pedido(client, impressao["id"], 10)  # 20h de máquina, 1h de trabalho
    j = job(sim(), o["id"])
    assert j["machine_hours"] == pytest.approx(20)
    assert j["finish_date"] == "2026-10-06"  # a máquina é o gargalo: 10h + 10h


def test_cancelado_e_pronto_saem_da_fila(client, jose, produto_1h):
    o = pedido(client, produto_1h["id"], 5)
    client.post(f"/api/orders/{o['id']}/status", json={"status": "pronto", "force": True})
    assert sim()["jobs"] == []


def test_simular_pedido_novo(client, produto_1h):
    # 8h todo dia, para o resultado não depender do dia da semana em que o teste roda.
    client.post("/api/workers", json={"name": "Ana", "weekly_hours": [8] * 7})
    hoje = date.today()
    existente = pedido(client, produto_1h["id"], 8, hoje.isoformat())  # ocupa o dia inteiro, em dia
    r = client.post("/api/schedule/preview", json={
        "items": [{"product_id": produto_1h["id"], "quantity": 4}],
        "due_date": (hoje - timedelta(days=1)).isoformat(),  # mais urgente: passa na frente
    }).json()
    assert r["order_id"] is None and r["labor_hours"] == pytest.approx(4)
    assert r["finish_date"] == hoje.isoformat()
    assert [p["order_id"] for p in r["pushes_late"]] == [existente["id"]]
    # No fim da fila ele não atrapalha ninguém: fica para amanhã.
    assert r["safe_date"] == (hoje + timedelta(days=1)).isoformat()


def test_item_avulso_com_tempo(client, jose):
    o = client.post("/api/orders", json={"items": [
        {"product_name": "Conserto", "quantity": 1, "unit_price": 50, "labor_minutes": 90},
    ]}).json()
    assert job(sim(), o["id"])["labor_hours"] == pytest.approx(1.5)


def test_banco_antigo_ganha_tempo_dos_produtos(client, produto_1h):
    o = pedido(client, produto_1h["id"], 3)
    conn = connect()
    with conn:
        conn.execute("ALTER TABLE order_items DROP COLUMN labor_minutes")
        conn.execute("ALTER TABLE order_items DROP COLUMN machine_minutes")
    conn.close()
    init_db()
    conn = connect()
    row = conn.execute("SELECT labor_minutes FROM order_items WHERE order_id = ?", (o["id"],)).fetchone()
    conn.close()
    assert row["labor_minutes"] == 60


def test_horas_invalidas(client):
    r = client.post("/api/workers", json={"name": "X", "weekly_hours": [25, 0, 0, 0, 0, 0, 0]})
    assert r.status_code == 422
