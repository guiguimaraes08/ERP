"""Assistente com IA (Claude): conversa sobre o negócio usando os dados do sistema.

A cada pergunta, o sistema monta uma "foto" atual (pedidos, estoque, produtos,
agenda, vendas dos últimos meses) e manda junto. A IA só lê: não altera nada.
Precisa de internet e de uma chave da API da Anthropic (Ajustes → Assistente).
"""

import json
import sqlite3
from datetime import date

import anthropic

from . import pricing, schedule

# Modelos oferecidos em Ajustes. O padrão é o mais capaz; a escolha de economizar é do usuário.
MODELS = {
    "claude-opus-5-5": {"label": "Claude Opus 5.5 · mais inteligente (padrão)", "effort": True, "fallbacks": True},
    "claude-sonnet-5-5": {"label": "Claude Sonnet 5.5 · mais rápido e barato", "effort": True, "fallbacks": True},
    "claude-haiku-4-5": {"label": "Claude Haiku 4.5 · o mais barato", "effort": False, "fallbacks": False},
}
DEFAULT_MODEL = "claude-opus-5-5"
MAX_HISTORY = 40

SYSTEM_PROMPT = """Você é o assistente do Nexos ERP, um sistema de controle de produção para quem fabrica em casa \
(impressão 3D, cordões, chaveiros, acessórios sob encomenda). Você conversa com o dono do negócio, uma pessoa \
sem formação técnica.

Como responder:
- Português do Brasil, simples e direto, frases curtas. Explique termos como margem e custo quando ajudar.
- Baseie-se nos dados do sistema que vêm a seguir (uma foto de agora). Não invente números: se algo não está nos \
dados, diga que o sistema não tem essa informação.
- Valores em reais (R$ 1.234,56), datas como 05/10.
- Quando sugerir algo, diga onde fazer no sistema: abas Início, Pedidos, Agenda, Produtos, Estoque, Clientes e \
Ajustes. Você não consegue alterar nada no sistema, só analisar e sugerir.
- Formatação: parágrafos curtos, listas simples com "- " e **negrito** para o mais importante. Sem tabelas e sem \
títulos grandes.

Como o sistema calcula:
- Custo por unidade = insumos da receita + minutos de trabalho × valor da hora + minutos de máquina × valor da \
hora de máquina + outros custos. Preço sugerido = custo ÷ (1 − margem).
- O material sai do estoque quando o pedido começa ("fazendo") e volta se for cancelado.
- A agenda faz primeiro os pedidos "fazendo" e depois os de prazo mais perto, gastando as horas de trabalho de \
cada dia; "fica pronto" é uma previsão.
- "Vendido no mês" conta só pedidos entregues; "recebido" conta pagamentos registrados."""


class AssistantError(Exception):
    """Erro já com mensagem amigável para mostrar na tela."""


def get_config(conn: sqlite3.Connection) -> tuple[str, str]:
    s = pricing.get_settings(conn)
    model = s.get("ai_model") or DEFAULT_MODEL
    return s.get("ai_api_key", ""), model if model in MODELS else DEFAULT_MODEL


def key_hint(key: str) -> str | None:
    return f"{key[:7]}…{key[-4:]}" if len(key) > 12 else None


def make_client(api_key: str) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key, timeout=120.0, max_retries=2)


def friendly_error(exc: Exception) -> str:
    if isinstance(exc, anthropic.AuthenticationError):
        return "A chave da API não foi aceita. Confira em Ajustes → Assistente."
    if isinstance(exc, anthropic.PermissionDeniedError):
        return "Essa chave não tem permissão para usar este modelo."
    if isinstance(exc, anthropic.NotFoundError):
        return "Modelo não encontrado para essa chave. Escolha outro em Ajustes → Assistente."
    if isinstance(exc, anthropic.RateLimitError):
        return "Muitas perguntas seguidas (ou o limite da conta acabou). Espere um pouco e tente de novo."
    if isinstance(exc, anthropic.APIConnectionError):
        return "Sem conexão com a internet. O assistente precisa de internet para funcionar."
    if isinstance(exc, anthropic.APIStatusError):
        if exc.status_code >= 500:
            return "O serviço da IA está instável agora. Tente de novo daqui a pouco."
        if exc.status_code == 402 or "credit" in str(exc).lower():
            return "A conta da Anthropic está sem créditos. Adicione créditos em console.anthropic.com."
        return f"A IA recusou o pedido ({exc.status_code})."
    return "Algo deu errado ao falar com a IA."


# --- Foto do negócio ----------------------------------------------------------------

def _money(v: float) -> float:
    return round(v, 2)


def build_snapshot(conn: sqlite3.Connection) -> dict:
    """Resumo dos dados para a IA. Só leitura; nada de dados de pagamento além de valores."""
    from ..routers.orders import order_summary  # import tardio: evita ciclo
    from ..routers.system import dashboard

    s = pricing.get_settings(conn)
    dash = dashboard(conn)
    sched = schedule.simulate(conn)
    forecast = {j["order_id"]: j for j in sched["jobs"]}

    open_orders = []
    for r in conn.execute("SELECT id FROM orders WHERE status IN ('a_fazer', 'fazendo', 'pronto') ORDER BY due_date IS NULL, due_date"):
        o = order_summary(conn, r["id"])
        f = forecast.get(o["id"]) or {}
        open_orders.append({
            "pedido": o["id"], "cliente": o["customer_name"], "status": o["status"], "prazo": o["due_date"],
            "itens": [f'{i["quantity"]:g}x {i["product_name"]} a R$ {i["unit_price"]:.2f}' for i in o["items"]],
            "total": o["total"], "custo": o["cost"], "lucro": o["profit"], "falta_receber": o["balance"],
            "atrasado": o["late"], "previsao_pronto": f.get("finish_date"), "vai_atrasar": f.get("late"),
            "horas_trabalho": f.get("labor_hours"), "falta_material": [x["name"] for x in o["shortages"]],
        })

    # Vendas entregues nos últimos 12 meses, por mês e por produto.
    since = date(date.today().year - 1, date.today().month, 1).isoformat()
    monthly: dict[str, dict] = {}
    by_product: dict[str, dict] = {}
    for r in conn.execute("SELECT id, delivered_at FROM orders WHERE status = 'entregue' AND delivered_at >= ?", (since,)):
        o = order_summary(conn, r["id"])
        m = monthly.setdefault(r["delivered_at"][:7], {"pedidos": 0, "vendido": 0.0, "lucro": 0.0})
        m["pedidos"] += 1
        m["vendido"] += o["total"]
        m["lucro"] += o["profit"]
        for i in o["items"]:
            p = by_product.setdefault(i["product_name"], {"unidades": 0.0, "vendido": 0.0, "lucro": 0.0})
            p["unidades"] += i["quantity"]
            p["vendido"] += i["quantity"] * i["unit_price"]
            p["lucro"] += i["quantity"] * (i["unit_price"] - i["unit_cost"])

    products = []
    for r in conn.execute("SELECT * FROM products WHERE archived = 0 ORDER BY name"):
        c = pricing.product_breakdown(conn, r)
        minutes = r["labor_minutes"] or 0
        products.append({
            "produto": r["name"], "custo": c.unit_cost, "preco": c.price, "lucro_unidade": c.profit,
            "margem_pct": c.real_margin_pct, "min_trabalho": r["labor_minutes"], "min_maquina": r["machine_minutes"],
            "lucro_por_hora_de_trabalho": _money(c.profit / minutes * 60) if minutes else None,
            "receita": [f"{line.quantity:g} {line.unit} {line.name}" for line in c.lines],
        })

    materials = [
        {"insumo": r["name"], "estoque": round(r["stock"], 2), "unidade": r["unit"], "minimo": r["min_stock"],
         "custo_por_unidade": round(r["unit_cost"], 4), "fornecedor": r["supplier"] or None}
        for r in conn.execute("SELECT * FROM materials WHERE archived = 0 ORDER BY name")
    ]
    customers = [
        dict(r) for r in conn.execute(
            """SELECT c.name AS cliente, COUNT(o.id) AS pedidos
               FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelado'
               GROUP BY c.id ORDER BY pedidos DESC LIMIT 30"""
        )
    ]

    return {
        "hoje": date.today().isoformat(),
        "negocio": s.get("business_name"),
        "ajustes": {"valor_hora_trabalho": s.get("labor_rate"), "valor_hora_maquina": s.get("machine_rate"),
                    "margem_padrao_pct": s.get("default_margin")},
        "mes_atual": {"a_receber": dash["to_receive"], "recebido": dash["received_month"],
                      "vendido_entregue": dash["sold_month"], "lucro_entregue": dash["profit_month"],
                      "pedidos_entregues": dash["delivered_month"]},
        "pedidos_em_aberto": open_orders,
        "agenda": {"resumo": sched["summary"], "horas_maquina_por_dia": sched["machine_hours_per_day"],
                   "tem_horario_cadastrado": sched["has_capacity"],
                   "proximos_dias": [{"dia": d["date"], "horas": d["capacity"], "ocupado": d["used"]} for d in sched["days"][:14]]},
        "falta_material_para_pedidos_a_fazer": dash["shortages"],
        "estoque_baixo": [m["name"] for m in dash["low_stock"]],
        "vendas_por_mes": {k: {kk: _money(vv) if isinstance(vv, float) else vv for kk, vv in v.items()} for k, v in sorted(monthly.items())},
        "vendas_por_produto_12_meses": {k: {kk: _money(vv) for kk, vv in v.items()} for k, v in sorted(by_product.items(), key=lambda kv: -kv[1]["vendido"])},
        "produtos": products,
        "insumos": materials,
        "clientes": customers,
    }


# --- Conversa ------------------------------------------------------------------------

def request_params(model: str, snapshot: dict, messages: list[dict]) -> dict:
    caps = MODELS[model]
    params: dict = {
        "model": model,
        "max_tokens": 32000,
        "system": [
            # Instruções fixas primeiro (cacheáveis), dados do momento depois.
            {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": "Dados do sistema agora (JSON):\n" + json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
             "cache_control": {"type": "ephemeral"}},
        ],
        "messages": messages[-MAX_HISTORY:],
    }
    if caps["effort"]:
        params["output_config"] = {"effort": "medium"}
    if caps["fallbacks"]:
        # Se o filtro de segurança recusar por engano, a própria API tenta de novo em outro modelo.
        params["betas"] = ["server-side-fallback-2026-07-01"]
        params["fallbacks"] = "default"
    return params


def clean_history(messages: list[dict]) -> list[dict]:
    """Só texto, papéis alternados, começando e terminando no usuário."""
    out: list[dict] = []
    for m in messages:
        role, text = m.get("role"), str(m.get("content", "")).strip()
        if role not in ("user", "assistant") or not text:
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n\n" + text
        else:
            out.append({"role": role, "content": text})
    while out and out[0]["role"] != "user":
        out.pop(0)
    if not out or out[-1]["role"] != "user":
        raise AssistantError("Escreva uma pergunta.")
    return out
