import pytest


def stock_of(client, material_id):
    return next(m for m in client.get("/api/materials").json() if m["id"] == material_id)["stock"]


def new_order(client, product_id, qty, **extra):
    return client.post("/api/orders", json={
        "customer_name": "Ana", "items": [{"product_id": product_id, "quantity": qty}], **extra,
    })


# --- Preço -----------------------------------------------------------------

def test_custo_e_preco_sugerido(client, cordao):
    # labor_rate padrão = 25 R$/h → 6 min = 2,50
    cost = cordao["product"]["cost"]
    assert cost["materials_cost"] == pytest.approx(0.9 + 1.5)
    assert cost["labor_cost"] == pytest.approx(2.5)
    assert cost["unit_cost"] == pytest.approx(4.9)
    # margem de 50% sobre o preço → custo ÷ 0,5
    assert cost["suggested_price"] == pytest.approx(9.8)
    assert cost["price"] == pytest.approx(9.8)


def test_zero_e_valor_valido_nao_vira_padrao(client, cordao):
    client.put("/api/settings", json={
        "business_name": "X", "labor_rate": 0, "machine_rate": 0, "default_margin": 0,
    })
    cost = client.get(f"/api/products/{cordao['product']['id']}").json()["cost"]
    assert cost["labor_cost"] == 0
    preview = client.post("/api/products/preview", json={"name": "p", "extra_cost": 3, "margin_pct": 0}).json()
    assert preview["suggested_price"] == pytest.approx(3)


def test_compra_atualiza_estoque_e_custo_medio(client, cordao):
    fita = cordao["fita"]  # 100 m a R$ 1,00
    r = client.post(f"/api/materials/{fita['id']}/purchases", json={
        "packages": 2, "package_size": 50, "package_price": 100,  # 100 m a R$ 2,00
    })
    assert r.status_code == 201
    data = r.json()
    assert data["stock"] == pytest.approx(200)
    assert data["unit_cost"] == pytest.approx(1.5)


# --- Estoque x pedidos -----------------------------------------------------

def test_pedido_novo_nao_mexe_no_estoque(client, cordao):
    assert new_order(client, cordao["product"]["id"], 10).status_code == 201
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(100)


def test_comecar_baixa_e_cancelar_devolve(client, cordao):
    order = new_order(client, cordao["product"]["id"], 10).json()
    client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo"})
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(91)
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(40)

    # Avançar de novo não baixa duas vezes.
    client.post(f"/api/orders/{order['id']}/status", json={"status": "pronto"})
    client.post(f"/api/orders/{order['id']}/status", json={"status": "entregue"})
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(91)

    client.post(f"/api/orders/{order['id']}/status", json={"status": "cancelado"})
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(100)
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(50)


def test_excluir_pedido_devolve_material(client, cordao):
    order = new_order(client, cordao["product"]["id"], 5).json()
    client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo"})
    assert client.delete(f"/api/orders/{order['id']}").status_code == 204
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(50)


def test_falta_material_bloqueia_mas_pode_forcar(client, cordao):
    order = new_order(client, cordao["product"]["id"], 60).json()  # precisa 60 mosquetões, tem 50
    assert order["shortages"][0]["missing"] == pytest.approx(10)

    r = client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo"})
    assert r.status_code == 409
    assert r.json()["detail"]["shortages"][0]["name"] == "Mosquetão"
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(50)  # nada saiu

    r = client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo", "force": True})
    assert r.status_code == 200
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(-10)


def test_editar_pedido_em_andamento_reajusta_estoque(client, cordao):
    pid = cordao["product"]["id"]
    order = new_order(client, pid, 10).json()
    client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo"})
    r = client.put(f"/api/orders/{order['id']}", json={
        "customer_id": order["customer_id"], "items": [{"product_id": pid, "quantity": 4}],
    })
    assert r.status_code == 200
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(46)


def test_mudar_receita_nao_altera_pedido_antigo(client, cordao):
    pid = cordao["product"]["id"]
    order = new_order(client, pid, 10).json()
    client.put(f"/api/products/{pid}", json={
        "name": "Cordão", "materials": [{"material_id": cordao["fita"]["id"], "quantity": 2}],
    })
    client.post(f"/api/orders/{order['id']}/status", json={"status": "fazendo"})
    # Usa a receita de quando o pedido foi feito (0,9 m + 1 mosquetão).
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(91)
    assert stock_of(client, cordao["mosq"]["id"]) == pytest.approx(40)


# --- Dinheiro ----------------------------------------------------------------

def test_pagamentos_e_saldo(client, cordao):
    order = new_order(client, cordao["product"]["id"], 10, discount=8).json()
    assert order["total"] == pytest.approx(90)  # 10 × 9,80 − 8
    order = client.post(f"/api/orders/{order['id']}/payments", json={"amount": 40}).json()
    assert order["balance"] == pytest.approx(50)
    assert client.get("/api/dashboard").json()["to_receive"] == pytest.approx(50)


def test_painel_so_conta_faturamento_de_pedido_entregue(client, cordao):
    order = new_order(client, cordao["product"]["id"], 10).json()
    dash = client.get("/api/dashboard").json()
    assert dash["sold_month"] == 0
    client.post(f"/api/orders/{order['id']}/status", json={"status": "entregue"})
    dash = client.get("/api/dashboard").json()
    assert dash["sold_month"] == pytest.approx(98)
    assert dash["profit_month"] == pytest.approx(98 - 49)


def test_falta_no_painel_nao_conta_duas_vezes(client, cordao):
    pid = cordao["product"]["id"]
    started = new_order(client, pid, 45).json()
    client.post(f"/api/orders/{started['id']}/status", json={"status": "fazendo"})  # sobra 5 mosquetões
    new_order(client, pid, 4)  # precisa 4: dá
    assert client.get("/api/dashboard").json()["shortages"] == []


def test_item_avulso(client):
    r = client.post("/api/orders", json={
        "items": [{"product_name": "Conserto", "quantity": 1, "unit_price": 30}],
    })
    assert r.status_code == 201
    assert r.json()["total"] == 30


def test_demo_e_backup(client):
    assert client.post("/api/demo").status_code == 201
    assert client.post("/api/demo").status_code == 409
    r = client.get("/api/backup")
    assert r.status_code == 200
    assert r.content[:16] == b"SQLite format 3\x00"


# --- Cópia de segurança --------------------------------------------------------

def test_restaurar_copia(client, cordao):
    copia = client.get("/api/backup").content
    client.post(f"/api/materials/{cordao['fita']['id']}/adjust", json={"new_stock": 1})
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(1)

    assert client.post("/api/restore", content=copia).status_code == 200
    assert stock_of(client, cordao["fita"]["id"]) == pytest.approx(100)


def test_restaurar_recusa_arquivo_errado(client):
    r = client.post("/api/restore", content=b"isso nao e um banco")
    assert r.status_code == 422


def test_opcao_celular(client):
    body = {"business_name": "X", "labor_rate": 1, "machine_rate": 1, "default_margin": 30, "allow_phone": True}
    assert client.put("/api/settings", json=body).json()["allow_phone"] is True
