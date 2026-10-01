import React, { useState } from 'react';
import { InventoryItem, ProductionProject } from '../types';
import { 
  generatePythonScript, 
  generateSqlInserts, 
  triggerDownload 
} from '../utils/sqliteExport';
import { 
  Database, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Code, 
  FileText, 
  ShieldCheck, 
  Play
} from 'lucide-react';

interface SqliteExportModalProps {
  items: InventoryItem[];
  projects: ProductionProject[];
}

export const SqliteExportModal: React.FC<SqliteExportModalProps> = ({ items, projects }) => {
  const [activeTab, setActiveTab] = useState<'python' | 'sql' | 'runner'>('python');
  const [copied, setCopied] = useState(false);
  const [simulatedQueryResult, setSimulatedQueryResult] = useState<string>('');
  const [selectedSampleQuery, setSelectedSampleQuery] = useState<'kpis' | 'low_stock' | 'projects'>('kpis');

  const pythonCode = generatePythonScript(items, projects);
  const sqlCode = generateSqlInserts(items, projects);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPython = () => {
    triggerDownload(pythonCode, 'export_factory_sqlite.py', 'text/x-python');
  };

  const handleDownloadSql = () => {
    triggerDownload(sqlCode, 'factory_database.sql', 'application/sql');
  };

  const handleDownloadJson = () => {
    const data = JSON.stringify({ items, projects, exportedAt: new Date().toISOString() }, null, 2);
    triggerDownload(data, 'forgeflow_backup.json', 'application/json');
  };

  const runSimulatedQuery = (queryType: 'kpis' | 'low_stock' | 'projects') => {
    setSelectedSampleQuery(queryType);
    if (queryType === 'kpis') {
      const totalRev = projects.reduce((acc, p) => acc + p.salePrice, 0);
      const totalHours = projects.reduce((acc, p) => acc + p.laborHours + p.actualMachineHours, 0);
      const totalParts = projects.reduce((acc, p) => acc + (p.goodParts + p.rejectedParts), 0);
      const totalRefugo = projects.reduce((acc, p) => acc + p.rejectedParts, 0);
      const ippm = totalParts > 0 ? Math.round((totalRefugo / totalParts) * 1_000_000) : 0;

      setSimulatedQueryResult(
`[sqlite3 forgeflow_fabrica.db]
SELECT 
    COUNT(*) as total_ordens,
    SUM(sale_price) as faturamento_total,
    ROUND(AVG(actual_machine_hours), 2) as media_horas_maquina,
    ${ippm} as ippm_calculado
FROM production_projects;

RESULTADO:
┌──────────────┬───────────────────┬─────────────────────┬────────────────┐
│ total_ordens │ faturamento_total │ media_horas_maquina │ ippm_calculado │
├──────────────┼───────────────────┼─────────────────────┼────────────────┤
│ ${String(projects.length).padEnd(12)} │ R$ ${totalRev.toFixed(2).padEnd(14)} │ ${(totalHours / Math.max(1, projects.length)).toFixed(2).padEnd(19)} │ ${String(ippm).padEnd(14)} │
└──────────────┴───────────────────┴─────────────────────┴────────────────┘
Linhas afetadas: 1 | Tempo de execução local: 0.8ms`
      );
    } else if (queryType === 'low_stock') {
      const lowItems = items.filter(i => i.currentStock <= i.minStock);
      const rows = lowItems.map(i => `| ${i.sku.padEnd(18)} | ${i.name.slice(0, 30).padEnd(30)} | ${String(i.currentStock).padStart(6)} ${i.unit.padEnd(3)} | ${String(i.minStock).padStart(6)} ${i.unit.padEnd(3)} | ${String(i.leadTimeDays).padStart(4)} dias |`).join('\n');

      setSimulatedQueryResult(
`[sqlite3 forgeflow_fabrica.db]
SELECT sku, name, current_stock, min_stock, lead_time_days
FROM inventory_items
WHERE current_stock <= min_stock;

RESULTADO:
┌────────────────────┬────────────────────────────────┬──────────────┬──────────────┬───────────┐
│ sku                │ name                           │ atual        │ minimo       │ lead time │
├────────────────────┼────────────────────────────────┼──────────────┼──────────────┼───────────┤
${rows || '│ Nenhum insumo em estado crítico no momento.                                               │'}
└────────────────────┴────────────────────────────────┴──────────────┴──────────────┴───────────┘
${lowItems.length} registros retornados da base local SQLite.`
      );
    } else {
      const rows = projects.map(p => `| ${p.code.padEnd(12)} | ${p.clientName.slice(0, 20).padEnd(20)} | ${p.status.padEnd(18)} | R$ ${p.salePrice.toFixed(2).padStart(9)} |`).join('\n');
      setSimulatedQueryResult(
`[sqlite3 forgeflow_fabrica.db]
SELECT code, client_name, status, sale_price FROM production_projects ORDER BY deadline ASC;

RESULTADO:
┌──────────────┬──────────────────────┬────────────────────┬───────────┐
│ code         │ client_name          │ status             │ preco     │
├──────────────┼──────────────────────┼────────────────────┼───────────┤
${rows}
└──────────────┴──────────────────────┴────────────────────┴───────────┘
Total de ${projects.length} ordens de fabricação.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro card */}
      <div className="bg-[#11141A] border border-[#222834] rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Exportador SQLite Local & Script Python
              </h3>
              <p className="text-xs text-neutral-400">
                Garantia de 100% de privacidade e autonomia com banco de dados em arquivo local na fábrica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPython}
              className="px-3 py-1.5 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Script Python (.py)</span>
            </button>
            <button
              onClick={handleDownloadSql}
              className="px-3 py-1.5 bg-[#181C24] hover:bg-[#222834] text-white border border-[#2D3748] text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Dump SQL (.sql)</span>
            </button>
          </div>
        </div>

        {/* 3-Step Local Execution Tutorial */}
        <div className="bg-[#090B0E] p-3 rounded border border-[#222834] text-xs font-mono text-neutral-300 space-y-1">
          <div className="text-neutral-500 font-sans font-medium text-[11px] mb-1">
            Como executar localmente na sua máquina (sem internet / air-gapped):
          </div>
          <div><span className="text-[#F59E0B]">$</span> python3 export_factory_sqlite.py</div>
          <div className="text-neutral-500"># 1. Cria automaticamente o banco 'forgeflow_fabrica.db'</div>
          <div className="text-neutral-500"># 2. Insere todos os seus {items.length} insumos e {projects.length} ordens de fabricação</div>
          <div className="text-neutral-500"># 3. Imprime o relatório de Lucro/Hora, ROI e IPPM no terminal</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222834] pb-2">
        <button
          onClick={() => setActiveTab('python')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'python'
              ? 'bg-[#181C24] text-white border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Script Python Standalone</span>
        </button>

        <button
          onClick={() => setActiveTab('sql')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'sql'
              ? 'bg-[#181C24] text-white border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>Esquema SQL & DDL</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('runner');
            if (!simulatedQueryResult) runSimulatedQuery('kpis');
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'runner'
              ? 'bg-[#181C24] text-white border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Simulador de Consultas SQLite</span>
        </button>
      </div>

      {/* Code / Content Area */}
      {activeTab === 'python' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Arquivo: <strong className="text-white font-mono">export_factory_sqlite.py</strong></span>
            <button
              onClick={() => handleCopy(pythonCode)}
              className="px-2.5 py-1 bg-[#181C24] hover:bg-[#222834] text-neutral-300 hover:text-white rounded border border-[#222834] flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
            </button>
          </div>
          <pre className="bg-[#090B0E] p-4 rounded-lg border border-[#222834] font-mono text-xs text-neutral-300 overflow-x-auto max-h-[480px] leading-relaxed">
            {pythonCode}
          </pre>
        </div>
      )}

      {activeTab === 'sql' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Arquivo: <strong className="text-white font-mono">factory_database.sql</strong></span>
            <button
              onClick={() => handleCopy(sqlCode)}
              className="px-2.5 py-1 bg-[#181C24] hover:bg-[#222834] text-neutral-300 hover:text-white rounded border border-[#222834] flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar DDL'}</span>
            </button>
          </div>
          <pre className="bg-[#090B0E] p-4 rounded-lg border border-[#222834] font-mono text-xs text-neutral-300 overflow-x-auto max-h-[480px] leading-relaxed">
            {sqlCode}
          </pre>
        </div>
      )}

      {activeTab === 'runner' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Executar consulta teste:</span>
            <button
              onClick={() => runSimulatedQuery('kpis')}
              className={`px-3 py-1 text-xs rounded border cursor-pointer ${
                selectedSampleQuery === 'kpis'
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                  : 'bg-[#11141A] text-neutral-400 border-[#222834] hover:text-white'
              }`}
            >
              Métricas & IPPM
            </button>
            <button
              onClick={() => runSimulatedQuery('low_stock')}
              className={`px-3 py-1 text-xs rounded border cursor-pointer ${
                selectedSampleQuery === 'low_stock'
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                  : 'bg-[#11141A] text-neutral-400 border-[#222834] hover:text-white'
              }`}
            >
              Insumos Críticos
            </button>
            <button
              onClick={() => runSimulatedQuery('projects')}
              className={`px-3 py-1 text-xs rounded border cursor-pointer ${
                selectedSampleQuery === 'projects'
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40'
                  : 'bg-[#11141A] text-neutral-400 border-[#222834] hover:text-white'
              }`}
            >
              Fila de Ordens
            </button>
          </div>

          <pre className="bg-[#090B0E] p-4 rounded-lg border border-[#222834] font-mono text-xs text-emerald-400 overflow-x-auto max-h-[450px] leading-relaxed">
            {simulatedQueryResult}
          </pre>
        </div>
      )}
    </div>
  );
};
