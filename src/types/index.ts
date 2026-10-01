export type ItemCategory = 
  | '3d_printing' 
  | 'cordoes' 
  | 'ferragens' 
  | 'embalagens' 
  | 'consumiveis';

export type UnitType = 'g' | 'kg' | 'm' | 'un' | 'rolo' | 'kit';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ItemCategory;
  currentStock: number;
  minStock: number;
  unit: UnitType;
  unitCost: number; // Em R$
  supplier: string;
  location: string;
  leadTimeDays: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = 
  | 'planejado' 
  | 'em_producao' 
  | 'controle_qualidade' 
  | 'finalizado' 
  | 'entregue';

export type PriorityLevel = 'baixa' | 'media' | 'alta' | 'urgente';

export type MachineType = 
  | 'impressora_3d' 
  | 'prensa_termica' 
  | 'corte_laser' 
  | 'montagem_manual';

export interface MaterialUsage {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: UnitType;
  cost: number;
}

export interface ProductionProject {
  id: string;
  code: string; // Ex: OF-2026-001
  title: string;
  clientName: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  batchSize: number; // Peças totais no lote
  goodParts: number; // Peças boas
  rejectedParts: number; // Peças refugadas
  defectReason: string;
  machineType: MachineType;
  estimatedMachineHours: number;
  actualMachineHours: number;
  laborHours: number; // Horas de mão de obra direta
  hourlyLaborRate: number; // R$/hora técnico (ex: 35.00)
  hourlyMachineRate: number; // R$/hora máquina amortização + energia (ex: 8.50)
  salePrice: number; // Preço de venda cobrado do cliente
  materialsUsed?: MaterialUsage[];
  deadline: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IndustrialKpis {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  overallRoi: number; // %
  averageProfitPerHour: number; // R$/h
  averageOperationTimeHours: number; // Horas médias por ordem
  globalIppm: number; // Peças por milhão de refugos
  activeOrdersCount: number;
  lowStockItemsCount: number;
  primaryBottleneck: {
    resource: string;
    type: 'machine' | 'material' | 'labor';
    utilizationPercent: number;
    description: string;
    severity: 'normal' | 'alerta' | 'critico';
  };
}
