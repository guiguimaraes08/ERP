import React, { useMemo } from 'react';
import { InventoryItem, ProductionProject, MachineType } from '../types';
import { formatBRL } from '../utils/calculations';
import { 
  AlertTriangle, 
  Activity, 
  Layers, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  ShoppingCart,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface BottleneckPredictorProps {
  items: InventoryItem[];
  projects: ProductionProject[];
  onQuickRestock: (itemId: string, addQty: number) => Promise<void>;
}

export const BottleneckPredictor: React.FC<BottleneckPredictorProps> = ({
  items,
  projects,
  onQuickRestock,
}) => {
  // 1. Workstations Capacity Analysis
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'planejado' || p.status === 'em_producao');
  }, [projects]);

  const workstations = useMemo(() => {
    const list: {
      type: MachineType;
      name: string;
      capacityHoursWeekly: number;
      allocatedHours: number;
      activeJobs: number;
    }[] = [
      {
        type: 'impressora_3d',
        name: 'Bancada de Impressoras 3D (3 Máquinas)',
        capacityHoursWeekly: 120, // 3 máquinas x 40h
        allocatedHours: 0,
        activeJobs: 0,
      },
      {
        type: 'montagem_manual',
        name: 'Bancada de Montagem & Acabamento Manual',
        capacityHoursWeekly: 40,
        allocatedHours: 0,
        activeJobs: 0,
      },
      {
        type: 'prensa_termica',
        name: 'Prensa Térmica & Fitas / Cordões',
        capacityHoursWeekly: 30,
        allocatedHours: 0,
        activeJobs: 0,
      },
      {
        type: 'corte_laser',
        name: 'Corte e Gravação de Ponteiras',
        capacityHoursWeekly: 25,
        allocatedHours: 0,
        activeJobs: 0,
      },
    ];

    activeProjects.forEach(p => {
      const target = list.find(w => w.type === p.machineType) || list[0];
      target.allocatedHours += (p.estimatedMachineHours - (p.actualMachineHours || 0));
      target.activeJobs += 1;
    });

    return list;
  }, [activeProjects]);

  // 2. Raw Material Requirements & Deficit Projections
  const materialDemands = useMemo(() => {
    const demandMap: Record<string, { needed: number; ordersCount: number }> = {};

    activeProjects.forEach(proj => {
      proj.materialsUsed?.forEach(mat => {
        if (!demandMap[mat.itemId]) {
          demandMap[mat.itemId] = { needed: 0, ordersCount: 0 };
        }
        demandMap[mat.itemId].needed += mat.quantity;
        demandMap[mat.itemId].ordersCount += 1;
      });
    });

    return items.map(item => {
      const demand = demandMap[item.id] || { needed: 0, ordersCount: 0 };
      const projectedBalance = item.currentStock - demand.needed;
      const isDeficit = projectedBalance < 0;
      const isLowSafety = projectedBalance <= item.minStock;

      // Recommended purchase order quantity to cover demand + 1x minStock
      const suggestedReorder = isDeficit 
        ? Math.ceil(Math.abs(projectedBalance) + item.minStock)
        : (isLowSafety ? item.minStock : 0);

      return {
        item,
        committedDemand: demand.needed,
        ordersCount: demand.ordersCount,
        projectedBalance,
        isDeficit,
        isLowSafety,
        suggestedReorder,
      };
    }).filter(d => d.committedDemand > 0 || d.isLowSafety);
  }, [items, activeProjects]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#11141A] border border-[#222834] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-amber-500/10 text-[#F59E0B]">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Monitor de Gargalos Produtivos & Engenharia de Capacidade
            </h3>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            {activeProjects.length} ordens de fabricação ativas
          </span>
        </div>
        <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
          O algoritmo monitora em tempo real a taxa de ocupação das estações de trabalho e cruza o estoque atual de matérias-primas com o volume de ordens cadastradas, alertando sobre risco de paradas na linha antes de iniciarem.
        </p>
      </div>

      {/* Workstation Load & Capacity Heatmap */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
          1. Ocupação de Postos de Trabalho & Máquinas
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workstations.map((station) => {
            const usagePercent = Math.min(100, Math.round((station.allocatedHours / Math.max(1, station.capacityHoursWeekly)) * 100));
            const isHighLoad = usagePercent >= 80;
            const isCritical = usagePercent >= 95;

            return (
              <div
                key={station.type}
                className="bg-[#11141A] border border-[#222834] rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-white">{station.name}</h5>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {station.activeJobs} {station.activeJobs === 1 ? 'ordem em fila' : 'ordens em fila'}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      isCritical
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : isHighLoad
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-[#181C24] text-neutral-300'
                    }`}
                  >
                    {usagePercent}% carga
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>{station.allocatedHours.toFixed(1)}h alocadas</span>
                    <span>Capacidade: {station.capacityHoursWeekly}h/sem</span>
                  </div>
                  <div className="w-full h-2 bg-[#090B0E] rounded-full overflow-hidden border border-[#1C222D]">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isCritical ? 'bg-red-500' : isHighLoad ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* Technical Note */}
                <div className="text-[11px] text-neutral-400 flex items-center justify-between pt-1 border-t border-[#1C222D]">
                  <span>Status do Posto:</span>
                  <span className={isCritical ? 'text-red-400 font-medium' : isHighLoad ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
                    {isCritical ? '⚠️ Gargalo Crítico na Linha' : isHighLoad ? 'Carga Alta (Atenção ao Prazo)' : 'Operação Estável'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw Material Runway and Projections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            2. Previsão de Necessidade de Insumos & Runway de Produção
          </h4>
          <span className="text-xs text-neutral-500">
            Baseado em ordens planejadas e em andamento
          </span>
        </div>

        <div className="border border-[#222834] rounded-lg overflow-hidden bg-[#11141A]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D1015] border-b border-[#222834] text-neutral-400">
              <tr>
                <th className="py-2.5 px-4 font-medium">Insumo / Matéria-Prima</th>
                <th className="py-2.5 px-4 font-medium text-right">Estoque Físico</th>
                <th className="py-2.5 px-4 font-medium text-right">Demanda Comprometida</th>
                <th className="py-2.5 px-4 font-medium text-right">Saldo Projetado</th>
                <th className="py-2.5 px-4 font-medium">Lead Time Reposição</th>
                <th className="py-2.5 px-4 font-medium text-right">Ação Preditiva</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C222D]">
              {materialDemands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                    <span>Nenhum déficit de material previsto para a grade de produção atual.</span>
                  </td>
                </tr>
              ) : (
                materialDemands.map(({ item, committedDemand, projectedBalance, isDeficit, isLowSafety, suggestedReorder }) => (
                  <tr key={item.id} className="hover:bg-[#141820] transition-colors">
                    {/* Item */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{item.name}</div>
                      <div className="font-mono text-[11px] text-neutral-500">
                        {item.sku} · Fornecedor: {item.supplier}
                      </div>
                    </td>

                    {/* Físico */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-200">
                      {item.currentStock.toLocaleString('pt-BR')} {item.unit}
                    </td>

                    {/* Demanda */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-400">
                      {committedDemand.toLocaleString('pt-BR')} {item.unit}
                    </td>

                    {/* Saldo Projetado */}
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={`font-bold ${isDeficit ? 'text-red-400' : isLowSafety ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {projectedBalance > 0 ? `+${projectedBalance.toLocaleString('pt-BR')}` : projectedBalance.toLocaleString('pt-BR')} {item.unit}
                      </span>
                    </td>

                    {/* Lead time */}
                    <td className="py-3 px-4 text-neutral-400">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{item.leadTimeDays} dias de entrega</span>
                      </div>
                    </td>

                    {/* Ação de compra rápida */}
                    <td className="py-3 px-4 text-right">
                      {suggestedReorder > 0 ? (
                        <button
                          onClick={() => onQuickRestock(item.id, suggestedReorder)}
                          className="px-3 py-1 bg-[#181C24] hover:bg-[#F59E0B] hover:text-[#090B0E] text-white border border-[#2D3748] rounded text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Repor +{suggestedReorder}{item.unit}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-500">Estoque Suficiente</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
