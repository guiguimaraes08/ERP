import { InventoryItem, ProductionProject } from '../types';

export function generateSqlSchema(): string {
  return `-- ====================================================================
-- FORGEFLOW INDUSTRIAL ERP - SQLITE SCHEMA DEFINITION
-- Base de dados local para privacidade e autonomia industrial
-- ====================================================================

PRAGMA foreign_keys = ON;

-- 1. TABELA DE ITENS DE INVENTÁRIO E MATÉRIAS-PRIMAS
CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('3d_printing', 'cordoes', 'ferragens', 'embalagens', 'consumiveis')),
    current_stock REAL NOT NULL DEFAULT 0.0 CHECK(current_stock >= 0),
    min_stock REAL NOT NULL DEFAULT 0.0 CHECK(min_stock >= 0),
    unit TEXT NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0 CHECK(unit_cost >= 0),
    supplier TEXT,
    location TEXT,
    lead_time_days INTEGER DEFAULT 3,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE ORDENS DE FABRICAÇÃO E PROJETOS
CREATE TABLE IF NOT EXISTS production_projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('planejado', 'em_producao', 'controle_qualidade', 'finalizado', 'entregue')),
    priority TEXT NOT NULL DEFAULT 'media' CHECK(priority IN ('baixa', 'media', 'alta', 'urgente')),
    batch_size INTEGER NOT NULL CHECK(batch_size >= 0),
    good_parts INTEGER NOT NULL DEFAULT 0 CHECK(good_parts >= 0),
    rejected_parts INTEGER NOT NULL DEFAULT 0 CHECK(rejected_parts >= 0),
    defect_reason TEXT,
    machine_type TEXT NOT NULL,
    estimated_machine_hours REAL NOT NULL DEFAULT 0.0,
    actual_machine_hours REAL NOT NULL DEFAULT 0.0,
    labor_hours REAL NOT NULL DEFAULT 0.0,
    hourly_labor_rate REAL NOT NULL DEFAULT 35.0,
    hourly_machine_rate REAL NOT NULL DEFAULT 8.5,
    sale_price REAL NOT NULL DEFAULT 0.0 CHECK(sale_price >= 0),
    materials_json TEXT, -- JSON array de insumos consumidos
    deadline DATE,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. VIEW: ANÁLISE DE RENTABILIDADE E ROI POR PROJETO
CREATE VIEW IF NOT EXISTS vw_project_financials AS
SELECT 
    id,
    code,
    title,
    client_name,
    status,
    sale_price,
    ROUND((actual_machine_hours * hourly_machine_rate) + (labor_hours * hourly_labor_rate), 2) AS estimated_operational_cost,
    ROUND(sale_price - ((actual_machine_hours * hourly_machine_rate) + (labor_hours * hourly_labor_rate)), 2) AS gross_profit,
    CASE 
        WHEN (good_parts + rejected_parts) > 0 
        THEN ROUND((CAST(rejected_parts AS REAL) / (good_parts + rejected_parts)) * 1000000.0, 0)
        ELSE 0 
    END AS project_ippm
FROM production_projects;

-- 4. VIEW: ALERTA DE REPOSIÇÃO DE INSUMOS
CREATE VIEW IF NOT EXISTS vw_reorder_alerts AS
SELECT 
    sku,
    name,
    category,
    current_stock,
    min_stock,
    unit,
    unit_cost,
    ROUND((min_stock - current_stock), 2) AS deficit,
    supplier,
    lead_time_days
FROM inventory_items
WHERE current_stock <= min_stock;
`;
}

export function generateSqlInserts(items: InventoryItem[], projects: ProductionProject[]): string {
  let sql = generateSqlSchema() + '\n-- DADOS ATUAIS SINCRONIZADOS\nBEGIN TRANSACTION;\n\n';

  items.forEach((item) => {
    const escName = item.name.replace(/'/g, "''");
    const escSku = item.sku.replace(/'/g, "''");
    const escSup = (item.supplier || '').replace(/'/g, "''");
    const escLoc = (item.location || '').replace(/'/g, "''");
    sql += `INSERT OR REPLACE INTO inventory_items (id, sku, name, category, current_stock, min_stock, unit, unit_cost, supplier, location, lead_time_days, owner_id, created_at, updated_at) VALUES ('${item.id}', '${escSku}', '${escName}', '${item.category}', ${item.currentStock}, ${item.minStock}, '${item.unit}', ${item.unitCost}, '${escSup}', '${escLoc}', ${item.leadTimeDays || 3}, '${item.ownerId}', '${item.createdAt}', '${item.updatedAt}');\n`;
  });

  sql += '\n';

  projects.forEach((proj) => {
    const escTitle = proj.title.replace(/'/g, "''");
    const escClient = proj.clientName.replace(/'/g, "''");
    const escDefect = (proj.defectReason || '').replace(/'/g, "''");
    const matsJson = JSON.stringify(proj.materialsUsed || []).replace(/'/g, "''");

    sql += `INSERT OR REPLACE INTO production_projects (id, code, title, client_name, status, priority, batch_size, good_parts, rejected_parts, defect_reason, machine_type, estimated_machine_hours, actual_machine_hours, labor_hours, hourly_labor_rate, hourly_machine_rate, sale_price, materials_json, deadline, owner_id, created_at, updated_at) VALUES ('${proj.id}', '${proj.code}', '${escTitle}', '${escClient}', '${proj.status}', '${proj.priority}', ${proj.batchSize}, ${proj.goodParts || 0}, ${proj.rejectedParts || 0}, '${escDefect}', '${proj.machineType}', ${proj.estimatedMachineHours}, ${proj.actualMachineHours || 0}, ${proj.laborHours || 0}, ${proj.hourlyLaborRate || 35}, ${proj.hourlyMachineRate || 8.5}, ${proj.salePrice}, '${matsJson}', '${proj.deadline}', '${proj.ownerId}', '${proj.createdAt}', '${proj.updatedAt}');\n`;
  });

  sql += '\nCOMMIT;\n';
  return sql;
}

export function generatePythonScript(items: InventoryItem[], projects: ProductionProject[]): string {
  const jsonData = JSON.stringify({ items, projects }, null, 2);

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ForgeFlow Industrial ERP - Gerenciador Local SQLite & Python
Desenvolvido para garantir 100% de privacidade e autonomia no chão de fábrica.
Usa apenas a biblioteca padrão (sqlite3 e json), sem dependências externas.
"""

import sqlite3
import json
import os
from datetime import datetime

DB_FILE = "forgeflow_fabrica.db"

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    current_stock REAL NOT NULL DEFAULT 0.0,
    min_stock REAL NOT NULL DEFAULT 0.0,
    unit TEXT NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0.0,
    supplier TEXT,
    location TEXT,
    lead_time_days INTEGER DEFAULT 3,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS production_projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    batch_size INTEGER NOT NULL,
    good_parts INTEGER NOT NULL DEFAULT 0,
    rejected_parts INTEGER NOT NULL DEFAULT 0,
    defect_reason TEXT,
    machine_type TEXT NOT NULL,
    estimated_machine_hours REAL NOT NULL DEFAULT 0.0,
    actual_machine_hours REAL NOT NULL DEFAULT 0.0,
    labor_hours REAL NOT NULL DEFAULT 0.0,
    hourly_labor_rate REAL NOT NULL DEFAULT 35.0,
    hourly_machine_rate REAL NOT NULL DEFAULT 8.5,
    sale_price REAL NOT NULL DEFAULT 0.0,
    materials_json TEXT,
    deadline TEXT,
    owner_id TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);
"""

# Dados exportados do ForgeFlow ERP
INITIAL_DATA = json.loads('''${jsonData}''')

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript(SCHEMA_SQL)
    
    # Sincroniza Itens
    for item in INITIAL_DATA.get("items", []):
        cursor.execute("""
            INSERT OR REPLACE INTO inventory_items 
            (id, sku, name, category, current_stock, min_stock, unit, unit_cost, supplier, location, lead_time_days, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item["id"], item["sku"], item["name"], item["category"],
            item["currentStock"], item["minStock"], item["unit"], item["unitCost"],
            item.get("supplier", ""), item.get("location", ""), item.get("leadTimeDays", 3),
            item.get("ownerId", "factory-owner"), item.get("createdAt", ""), item.get("updatedAt", "")
        ))

    # Sincroniza Projetos
    for proj in INITIAL_DATA.get("projects", []):
        cursor.execute("""
            INSERT OR REPLACE INTO production_projects
            (id, code, title, client_name, status, priority, batch_size, good_parts, rejected_parts, defect_reason, machine_type, estimated_machine_hours, actual_machine_hours, labor_hours, hourly_labor_rate, hourly_machine_rate, sale_price, materials_json, deadline, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            proj["id"], proj["code"], proj["title"], proj["clientName"],
            proj["status"], proj["priority"], proj["batchSize"], proj.get("goodParts", 0),
            proj.get("rejectedParts", 0), proj.get("defectReason", ""), proj["machineType"],
            proj.get("estimatedMachineHours", 0), proj.get("actualMachineHours", 0),
            proj.get("laborHours", 0), proj.get("hourlyLaborRate", 35.0), proj.get("hourlyMachineRate", 8.5),
            proj["salePrice"], json.dumps(proj.get("materialsUsed", [])), proj.get("deadline", ""),
            proj.get("ownerId", "factory-owner"), proj.get("createdAt", ""), proj.get("updatedAt", "")
        ))
    
    conn.commit()
    conn.close()
    print(f"[OK] Banco SQLite inicializado com sucesso em '{DB_FILE}'!")

def print_dashboard_kpis():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Total faturado e custos
    cursor.execute("""
        SELECT 
            SUM(sale_price) as faturamento_total,
            SUM((actual_machine_hours * hourly_machine_rate) + (labor_hours * hourly_labor_rate)) as custo_operacional,
            SUM(labor_hours) as horas_mao_obra,
            SUM(actual_machine_hours) as horas_maquina,
            SUM(good_parts) as pecas_boas,
            SUM(rejected_parts) as pecas_refugadas
        FROM production_projects
    """)
    row = cursor.fetchone()
    
    fat = row["faturamento_total"] or 0
    custo_op = row["custo_operacional"] or 0
    h_mo = row["horas_mao_obra"] or 0
    h_maq = row["horas_maquina"] or 0
    boas = row["pecas_boas"] or 0
    refugo = row["pecas_refugadas"] or 0
    total_pecas = boas + refugo

    ippm = int((refugo / total_pecas) * 1_000_000) if total_pecas > 0 else 0
    lucro_estimado = fat - custo_op
    roi = (lucro_estimado / custo_op * 100) if custo_op > 0 else 0
    lucro_hora = lucro_estimado / max(1, (h_mo + h_maq * 0.25))

    print("\\n" + "="*60)
    print("      FORGEFLOW - PAINEL INDUSTRIAL DE PERFORMANCE")
    print("="*60)
    print(f"  Faturamento Total:     R$ {fat:,.2f}")
    print(f"  Custos Operacionais:   R$ {custo_op:,.2f}")
    print(f"  Lucro Operacional:     R$ {lucro_estimado:,.2f}")
    print(f"  ROI da Produção:       {roi:.1f}%")
    print(f"  Lucro Médio por Hora:  R$ {lucro_hora:,.2f}/h")
    print(f"  Qualidade (IPPM):      {ippm:,} refugos por milhão")
    print(f"  Horas de Máquina:      {h_maq:.1f}h | Horas Mão de Obra: {h_mo:.1f}h")
    print("="*60)

    # Alertas de Estoque Baixo
    cursor.execute("""
        SELECT sku, name, current_stock, min_stock, unit, lead_time_days 
        FROM inventory_items 
        WHERE current_stock <= min_stock
    """)
    alertas = cursor.fetchall()
    if alertas:
        print(f"\\n⚠️  [ALERTA DE REPOSIÇÃO - {len(alertas)} ITENS EM NÍVEL CRÍTICO]:")
        for a in alertas:
            print(f"   - {a['name']} ({a['sku']}): {a['current_stock']} {a['unit']} (Mínimo: {a['min_stock']} {a['unit']}) | Lead time: {a['lead_time_days']} dias")
    else:
        print("\\n✅ Todos os insumos estão acima do estoque mínimo de segurança.")

    conn.close()

if __name__ == "__main__":
    init_db()
    print_dashboard_kpis()
`;
}

export function triggerDownload(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
