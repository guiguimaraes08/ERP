import React from 'react';
import { IndustrialKpis } from '../types';
import { formatBRL } from '../utils/calculations';
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, ShieldAlert, DollarSign } from 'lucide-react';

interface KpiMetricsStripProps {
  kpis: IndustrialKpis;
  onNavigateToBottlenecks?: () => void;
}

export const KpiMetricsStrip: React.FC<KpiMetricsStripProps> = ({ kpis, onNavigateToBottlenecks }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Lucro Médio por Hora */}
      <div className="bg-[#11141A] border border-[#222834] rounded-lg p-4 transition-all duration-150 hover:border-[#2D3748]">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span className="font-medium tracking-wide">Lucro Médio / Hora</span>
          <div className="p-1 rounded bg-[#181C24] text-[#F59E0B]">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {formatBRL(kpis.averageProfitPerHour)}
          </span>
          <span className="text-xs text-neutral-400 font-mono">/hora</span>
        </div>
        <div className="mt-2 text-xs text-neutral-400 flex items-center justify-between border-t border-[#1C222D] pt-2">
          <span>Margem líquida global</span>
          <span className="font-mono tabular-nums text-emerald-400 font-medium">
            {kpis.totalRevenue > 0 ? ((kpis.netProfit / kpis.totalRevenue) * 100).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      {/* 2. ROI Atual Operacional */}
      <div className="bg-[#11141A] border border-[#222834] rounded-lg p-4 transition-all duration-150 hover:border-[#2D3748]">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span className="font-medium tracking-wide">ROI Atual Operacional</span>
          <div className="p-1 rounded bg-[#181C24] text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            +{kpis.overallRoi.toFixed(1)}%
          </span>
          <span className="text-xs text-neutral-400 font-mono">retorno</span>
        </div>
        <div className="mt-2 text-xs text-neutral-400 flex items-center justify-between border-t border-[#1C222D] pt-2">
          <span>Lucro Líquido Real</span>
          <span className="font-mono tabular-nums text-white font-medium">
            {formatBRL(kpis.netProfit)}
          </span>
        </div>
      </div>

      {/* 3. Qualidade & IPPM */}
      <div className="bg-[#11141A] border border-[#222834] rounded-lg p-4 transition-all duration-150 hover:border-[#2D3748]">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span className="font-medium tracking-wide">Qualidade Industrial (IPPM)</span>
          <div className="p-1 rounded bg-[#181C24] text-sky-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tabular-nums text-white">
            {kpis.globalIppm.toLocaleString('pt-BR')}
          </span>
          <span className="text-xs text-neutral-400 font-mono">PPM refugo</span>
        </div>
        <div className="mt-2 text-xs text-neutral-400 flex items-center justify-between border-t border-[#1C222D] pt-2">
          <span>Tempo Médio / Ordem</span>
          <span className="font-mono tabular-nums text-neutral-300 font-medium">
            {kpis.averageOperationTimeHours.toFixed(1)}h ciclo
          </span>
        </div>
      </div>

      {/* 4. Gargalo Ativo Detectado */}
      <div 
        onClick={onNavigateToBottlenecks}
        className={`bg-[#11141A] border rounded-lg p-4 transition-all duration-150 cursor-pointer ${
          kpis.primaryBottleneck.severity === 'critico'
            ? 'border-red-900/60 hover:border-red-600 bg-red-950/10'
            : kpis.primaryBottleneck.severity === 'alerta'
            ? 'border-amber-900/60 hover:border-amber-500 bg-amber-950/10'
            : 'border-[#222834] hover:border-[#2D3748]'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span className="font-medium tracking-wide">Detector de Gargalos</span>
          <div className={`p-1 rounded ${
            kpis.primaryBottleneck.severity === 'critico'
              ? 'bg-red-500/10 text-red-400'
              : kpis.primaryBottleneck.severity === 'alerta'
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-[#181C24] text-neutral-400'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold text-white truncate max-w-[190px]">
            {kpis.primaryBottleneck.resource}
          </span>
          <span className="text-xs font-mono font-medium text-amber-400">
            {kpis.primaryBottleneck.utilizationPercent}% carga
          </span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400 line-clamp-1">
          {kpis.primaryBottleneck.description}
        </p>
      </div>
    </div>
  );
};
