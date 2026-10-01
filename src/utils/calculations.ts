import { InventoryItem, ProductionProject, IndustrialKpis } from '../types';

export interface ProjectCostBreakdown {
  materialCost: number;
  machineCost: number;
  laborCost: number;
  totalCost: number;
  netProfit: number;
  profitMarginPercent: number;
  profitPerHour: number;
  roiPercent: number;
}

export function calculateProjectFinancials(project: ProductionProject): ProjectCostBreakdown {
  // 1. Material cost
  const materialCost = project.materialsUsed?.reduce((acc, m) => acc + (m.cost || 0), 0) || 0;

  // 2. Machine operating & depreciation cost
  const machineHours = project.actualMachineHours > 0 ? project.actualMachineHours : project.estimatedMachineHours;
  const machineCost = machineHours * (project.hourlyMachineRate || 8.5);

  // 3. Direct labor cost
  const laborCost = (project.laborHours || 0) * (project.hourlyLaborRate || 35.0);

  // 4. Totals
  const totalCost = materialCost + machineCost + laborCost;
  const netProfit = project.salePrice - totalCost;
  const profitMarginPercent = project.salePrice > 0 ? (netProfit / project.salePrice) * 100 : 0;
  
  // Total human + fraction of machine supervision time
  const effectiveHours = Math.max(0.5, (project.laborHours || 0) + machineHours * 0.25);
  const profitPerHour = netProfit / effectiveHours;

  const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    materialCost,
    machineCost,
    laborCost,
    totalCost,
    netProfit,
    profitMarginPercent,
    profitPerHour,
    roiPercent,
  };
}

export function calculateFactoryKpis(
  items: InventoryItem[],
  projects: ProductionProject[]
): IndustrialKpis {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalLaborHours = 0;
  let totalMachineHours = 0;
  let totalProducedParts = 0;
  let totalRejectedParts = 0;

  projects.forEach((proj) => {
    const fin = calculateProjectFinancials(proj);
    totalRevenue += proj.salePrice;
    totalCost += fin.totalCost;
    totalLaborHours += proj.laborHours || 0;
    totalMachineHours += proj.actualMachineHours > 0 ? proj.actualMachineHours : proj.estimatedMachineHours;

    // Defect & IPPM tracking
    const partsInProject = (proj.goodParts || 0) + (proj.rejectedParts || 0);
    if (partsInProject > 0) {
      totalProducedParts += partsInProject;
      totalRejectedParts += (proj.rejectedParts || 0);
    }
  });

  const netProfit = totalRevenue - totalCost;
  const overallRoi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  
  const totalEffectiveHours = Math.max(1, totalLaborHours + totalMachineHours * 0.25);
  const averageProfitPerHour = netProfit / totalEffectiveHours;

  const finishedOrActive = projects.filter(p => p.status !== 'planejado');
  const averageOperationTimeHours = finishedOrActive.length > 0
    ? totalMachineHours / finishedOrActive.length
    : 0;

  // Global IPPM (Índice de Peças Defeituosas por Milhão)
  // Se ainda não houve peças produzidas ou 0 defeitos, calcula proporcional
  const globalIppm = totalProducedParts > 0
    ? Math.round((totalRejectedParts / totalProducedParts) * 1_000_000)
    : 0;

  const activeOrdersCount = projects.filter(
    (p) => p.status === 'em_producao' || p.status === 'planejado' || p.status === 'controle_qualidade'
  ).length;

  const lowStockItemsCount = items.filter((item) => item.currentStock <= item.minStock).length;

  // Bottleneck Detection Logic:
  // 1. Check material shortage for active/planned projects
  const activeProjects = projects.filter((p) => p.status === 'planejado' || p.status === 'em_producao');
  let criticalMaterialDeficit: { item: InventoryItem; deficit: number; needed: number } | null = null;

  items.forEach((item) => {
    let needed = 0;
    activeProjects.forEach((proj) => {
      proj.materialsUsed?.forEach((mat) => {
        if (mat.itemId === item.id) {
          needed += mat.quantity;
        }
      });
    });

    if (needed > item.currentStock) {
      const deficit = needed - item.currentStock;
      if (!criticalMaterialDeficit || deficit > criticalMaterialDeficit.deficit) {
        criticalMaterialDeficit = { item, deficit, needed };
      }
    }
  });

  // 2. Check 3D Printer queue load
  const printerHoursQueued = activeProjects
    .filter((p) => p.machineType === 'impressora_3d')
    .reduce((acc, p) => acc + (p.estimatedMachineHours - (p.actualMachineHours || 0)), 0);

  let primaryBottleneck: IndustrialKpis['primaryBottleneck'];

  if (criticalMaterialDeficit) {
    primaryBottleneck = {
      resource: `${(criticalMaterialDeficit as any).item.name}`,
      type: 'material',
      utilizationPercent: Math.min(100, Math.round(((criticalMaterialDeficit as any).needed / Math.max(1, (criticalMaterialDeficit as any).item.currentStock)) * 100)),
      description: `Déficit de ${(criticalMaterialDeficit as any).deficit} ${(criticalMaterialDeficit as any).item.unit} para atender às ordens ativas. Reposição necessária em ${(criticalMaterialDeficit as any).item.leadTimeDays} dias.`,
      severity: 'critico'
    };
  } else if (printerHoursQueued > 24) {
    primaryBottleneck = {
      resource: 'Bancada de Impressoras 3D',
      type: 'machine',
      utilizationPercent: 92,
      description: `${printerHoursQueued.toFixed(1)}h de fatiamento acumuladas na fila de impressão. Risco de atraso em entregas curtas.`,
      severity: 'alerta'
    };
  } else {
    primaryBottleneck = {
      resource: 'Fluxo Operacional Equilibrado',
      type: 'labor',
      utilizationPercent: 68,
      description: 'Capacidade produtiva e estoques de insumos atendem com folga à demanda atual.',
      severity: 'normal'
    };
  }

  return {
    totalRevenue,
    totalCost,
    netProfit,
    overallRoi,
    averageProfitPerHour,
    averageOperationTimeHours,
    globalIppm,
    activeOrdersCount,
    lowStockItemsCount,
    primaryBottleneck,
  };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
