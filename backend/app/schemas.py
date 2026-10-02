from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Unit = Literal["g", "m", "un", "ml"]
OrderStatus = Literal["a_fazer", "fazendo", "pronto", "entregue", "cancelado"]


def _strip(value: str) -> str:
    return value.strip() if isinstance(value, str) else value


class MaterialIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    unit: Unit
    min_stock: float = Field(default=0, ge=0)
    unit_cost: float = Field(default=0, ge=0)
    supplier: str = Field(default="", max_length=150)
    notes: str = Field(default="", max_length=500)
    # Só usado na criação: estoque que você já tem hoje.
    initial_stock: float = Field(default=0, ge=0)

    _clean = field_validator("name", "supplier", "notes")(_strip)


class PurchaseIn(BaseModel):
    packages: float = Field(gt=0, description="Quantos pacotes/carretéis/rolos")
    package_size: float = Field(gt=0, description="Quanto vem em cada um, na unidade do insumo")
    package_price: float = Field(ge=0, description="Preço de cada pacote")
    supplier: str = Field(default="", max_length=150)
    purchased_at: date | None = None


class AdjustIn(BaseModel):
    """Informe new_stock (contei e tenho X) ou delta (perdi/achei X)."""
    new_stock: float | None = Field(default=None, ge=0)
    delta: float | None = None
    note: str = Field(default="", max_length=200)


class RecipeLine(BaseModel):
    material_id: int
    quantity: float = Field(gt=0)


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=500)
    labor_minutes: float = Field(default=0, ge=0)
    machine_minutes: float = Field(default=0, ge=0)
    extra_cost: float = Field(default=0, ge=0)
    margin_pct: float | None = Field(default=None, ge=0, lt=95)
    price: float | None = Field(default=None, ge=0)
    materials: list[RecipeLine] = Field(default_factory=list)

    _clean = field_validator("name", "description")(_strip)


class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(default="", max_length=30)
    notes: str = Field(default="", max_length=500)

    _clean = field_validator("name", "phone", "notes")(_strip)


class OrderItemIn(BaseModel):
    product_id: int | None = None
    # Item avulso (sem produto cadastrado) precisa de nome e preço.
    product_name: str | None = Field(default=None, max_length=150)
    quantity: float = Field(gt=0)
    unit_price: float | None = Field(default=None, ge=0)
    # Tempo por unidade. Vazio = o do produto (item avulso: 0).
    labor_minutes: float | None = Field(default=None, ge=0)
    machine_minutes: float | None = Field(default=None, ge=0)


class OrderIn(BaseModel):
    customer_id: int | None = None
    # Atalho: cria o cliente na hora se ele ainda não existir.
    customer_name: str | None = Field(default=None, max_length=150)
    customer_phone: str | None = Field(default=None, max_length=30)
    due_date: date | None = None
    notes: str = Field(default="", max_length=1000)
    discount: float = Field(default=0, ge=0)
    items: list[OrderItemIn] = Field(min_length=1)
    force: bool = False


class StatusIn(BaseModel):
    status: OrderStatus
    force: bool = False


class PaymentIn(BaseModel):
    amount: float = Field(gt=0)
    method: Literal["pix", "dinheiro", "cartao", "outro"] = "pix"
    paid_at: date | None = None


class SettingsIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=100)
    labor_rate: float = Field(ge=0)
    machine_rate: float = Field(ge=0)
    default_margin: float = Field(ge=0, lt=95)
    allow_phone: bool = False


class WorkerIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    # Horas em cada dia: [seg, ter, qua, qui, sex, sáb, dom]
    weekly_hours: list[float] = Field(min_length=7, max_length=7)
    active: bool = True

    _clean = field_validator("name")(_strip)

    @field_validator("weekly_hours")
    @classmethod
    def _hours_in_day(cls, hours: list[float]) -> list[float]:
        if any(h < 0 or h > 24 for h in hours):
            raise ValueError("cada dia precisa ter entre 0 e 24 horas")
        return hours


class WorkerExceptionIn(BaseModel):
    worker_id: int | None = None  # vazio = vale para todo mundo
    start_date: date
    end_date: date | None = None  # vazio = só o dia de início
    hours: float = Field(default=0, ge=0, le=24)  # 0 = folga
    note: str = Field(default="", max_length=150)


class SchedulePreviewIn(BaseModel):
    """Pedido ainda não salvo, para perguntar "quando fica pronto?"."""
    items: list[OrderItemIn] = Field(min_length=1)
    due_date: date | None = None
    order_id: int | None = None  # editando um pedido: tira a versão salva da fila


class MachineHoursIn(BaseModel):
    machine_hours_per_day: float = Field(ge=0, le=24 * 20)
