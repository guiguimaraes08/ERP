import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ERP_DB_PATH", str(tmp_path / "test.db"))
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def cordao(client):
    """Fita (m) + mosquetão (un) e um produto 'Cordão' que usa 0,9 m + 1 un."""
    fita = client.post("/api/materials", json={
        "name": "Fita", "unit": "m", "unit_cost": 1.0, "initial_stock": 100,
    }).json()
    mosq = client.post("/api/materials", json={
        "name": "Mosquetão", "unit": "un", "unit_cost": 1.5, "initial_stock": 50,
    }).json()
    product = client.post("/api/products", json={
        "name": "Cordão", "labor_minutes": 6, "margin_pct": 50,
        "materials": [
            {"material_id": fita["id"], "quantity": 0.9},
            {"material_id": mosq["id"], "quantity": 1},
        ],
    }).json()
    return {"fita": fita, "mosq": mosq, "product": product}
