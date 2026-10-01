import React, { useState } from 'react';
import { ProductionProject, InventoryItem, ProjectStatus, PriorityLevel, MachineType, MaterialUsage } from '../types';
import { calculateProjectFinancials, formatBRL } from '../utils/calculations';
import { 
  Plus, 
  Search, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertOctagon, 
  ChevronRight, 
  DollarSign, 
  Layers, 
  Cpu, 
  Trash2, 
  Play, 
  Check, 
  X,
  FileText
} from 'lucide-react';

interface ProjectsManagerProps {
  projects: ProductionProject[];
  inventoryItems: InventoryItem[];
  onAddProject: (project: Omit<ProductionProject, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => Promise<void>;
  onUpdateProjectStatus: (id: string, newStatus: ProjectStatus) => Promise<void>;
  onUpdateDefects: (id: string, goodParts: number, rejectedParts: number, defectReason: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({
  projects,
  inventoryItems,
  onAddProject,
  onUpdateProjectStatus,
  onUpdateDefects,
  onDeleteProject,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
  const [defectTarget, setDefectTarget] = useState<ProductionProject | null>(null);

  // Defect form
  const [defectForm, setDefectForm] = useState({
    goodParts: 0,
    rejectedParts: 0,
    defectReason: '',
  });

  // New Project Form
  const [newProjectForm, setNewProjectForm] = useState({
    code: `OF-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`,
    title: '',
    clientName: '',
    status: 'planejado' as ProjectStatus,
    priority: 'media' as PriorityLevel,
    batchSize: 100,
    machineType: 'impressora_3d' as MachineType,
    estimatedMachineHours: 10,
    actualMachineHours: 0,
    laborHours: 4,
    hourlyLaborRate: 35.0,
    hourlyMachineRate: 8.5,
    salePrice: 1200.0,
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    materials: [] as { itemId: string; quantity: number }[],
  });

  // Add material row in new project
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [materialQty, setMaterialQty] = useState(10);

  const handleAddMaterialToProject = () => {
    if (!selectedMaterialId || materialQty <= 0) return;
    const existingIndex = newProjectForm.materials.findIndex(m => m.itemId === selectedMaterialId);
    if (existingIndex >= 0) {
      const updated = [...newProjectForm.materials];
      updated[existingIndex].quantity += materialQty;
      setNewProjectForm({ ...newProjectForm, materials: updated });
    } else {
      setNewProjectForm({
        ...newProjectForm,
        materials: [...newProjectForm.materials, { itemId: selectedMaterialId, quantity: materialQty }]
      });
    }
    setSelectedMaterialId('');
    setMaterialQty(10);
  };

  const handleRemoveMaterialFromProject = (index: number) => {
    const updated = newProjectForm.materials.filter((_, i) => i !== index);
    setNewProjectForm({ ...newProjectForm, materials: updated });
  };

  const handleSubmitNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.title || !newProjectForm.clientName) return;

    // Build materialsUsed list
    const materialsUsed: MaterialUsage[] = newProjectForm.materials.map(m => {
      const item = inventoryItems.find(i => i.id === m.itemId);
      return {
        itemId: m.itemId,
        itemName: item ? item.name : 'Insumo',
        quantity: m.quantity,
        unit: item ? item.unit : 'un',
        cost: (item ? item.unitCost : 0) * m.quantity,
      };
    });

    await onAddProject({
      code: newProjectForm.code,
      title: newProjectForm.title,
      clientName: newProjectForm.clientName,
      status: newProjectForm.status,
      priority: newProjectForm.priority,
      batchSize: newProjectForm.batchSize,
      goodParts: 0,
      rejectedParts: 0,
      defectReason: '',
      machineType: newProjectForm.machineType,
      estimatedMachineHours: newProjectForm.estimatedMachineHours,
      actualMachineHours: 0,
      laborHours: newProjectForm.laborHours,
      hourlyLaborRate: newProjectForm.hourlyLaborRate,
      hourlyMachineRate: newProjectForm.hourlyMachineRate,
      salePrice: newProjectForm.salePrice,
      materialsUsed,
      deadline: newProjectForm.deadline,
    });

    setIsAddModalOpen(false);
  };

  const handleOpenDefectsModal = (project: ProductionProject) => {
    setDefectTarget(project);
    setDefectForm({
      goodParts: project.goodParts,
      rejectedParts: project.rejectedParts,
      defectReason: project.defectReason || '',
    });
    setIsDefectModalOpen(true);
  };

  const handleSaveDefects = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectTarget) return;

    await onUpdateDefects(
      defectTarget.id,
      defectForm.goodParts,
      defectForm.rejectedParts,
      defectForm.defectReason
    );
    setIsDefectModalOpen(false);
  };

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      p.title.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.clientName.toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'planejado':
        return <span className="text-neutral-400">· Planejado</span>;
      case 'em_producao':
        return <span className="text-sky-400 font-medium">● Em Produção</span>;
      case 'controle_qualidade':
        return <span className="text-amber-400 font-medium">▲ Controle de Qualidade</span>;
      case 'finalizado':
        return <span className="text-emerald-400 font-medium">✓ Finalizado</span>;
      case 'entregue':
        return <span className="text-purple-400 font-medium">★ Entregue</span>;
    }
  };

  const nextStatusMap: Record<ProjectStatus, ProjectStatus | null> = {
    planejado: 'em_producao',
    em_producao: 'controle_qualidade',
    controle_qualidade: 'finalizado',
    finalizado: 'entregue',
    entregue: null,
  };

  return (
    <div className="space-y-4">
      {/* Top Bar for Projects */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11141A] p-3 rounded-lg border border-[#222834]">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por ordem, cliente ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-[#181C24] border border-[#222834] rounded-md text-neutral-300 focus:outline-none focus:border-[#F59E0B]"
          >
            <option value="all">Todos os Status</option>
            <option value="planejado">Planejados</option>
            <option value="em_producao">Em Produção</option>
            <option value="controle_qualidade">Controle de Qualidade</option>
            <option value="finalizado">Finalizados</option>
            <option value="entregue">Entregues</option>
          </select>

          <button
            onClick={() => {
              setNewProjectForm({
                code: `OF-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`,
                title: '',
                clientName: '',
                status: 'planejado',
                priority: 'media',
                batchSize: 100,
                machineType: 'impressora_3d',
                estimatedMachineHours: 8,
                actualMachineHours: 0,
                laborHours: 3,
                hourlyLaborRate: 35.0,
                hourlyMachineRate: 8.5,
                salePrice: 950.0,
                deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                materials: [],
              });
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Ordem de Fabricação</span>
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredProjects.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 bg-[#11141A] border border-[#222834] rounded-lg">
            <FileText className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
            <p className="font-medium text-white">Nenhuma ordem de produção cadastrada</p>
            <p className="text-xs text-neutral-500 mt-1">
              Crie uma ordem de fabricação para monitorar custos, tempos e refugos em tempo real.
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const financials = calculateProjectFinancials(project);
            const totalParts = (project.goodParts || 0) + (project.rejectedParts || 0);
            const projectIppm = totalParts > 0 ? Math.round(((project.rejectedParts || 0) / totalParts) * 1_000_000) : 0;
            const nextStatus = nextStatusMap[project.status];

            return (
              <div
                key={project.id}
                className="bg-[#11141A] border border-[#222834] rounded-lg p-4 transition-all duration-150 hover:border-[#2D3748] space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1C222D] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#F59E0B]">
                        {project.code}
                      </span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-xs text-neutral-400">Cliente: <strong className="text-neutral-200">{project.clientName}</strong></span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-xs text-neutral-400">Entrega: <span className="font-mono">{project.deadline}</span></span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mt-1">
                      {project.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div>{getStatusBadge(project.status)}</div>
                    {nextStatus && (
                      <button
                        onClick={() => onUpdateProjectStatus(project.id, nextStatus)}
                        className="px-2.5 py-1 bg-[#181C24] hover:bg-[#222834] text-white border border-[#2D3748] rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title={`Avançar para: ${nextStatus}`}
                      >
                        <span>Avançar</span>
                        <ChevronRight className="w-3 h-3 text-[#F59E0B]" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                      title="Excluir Ordem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Industrial Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs bg-[#090B0E] p-3 rounded-md border border-[#1C222D]">
                  {/* Faturamento */}
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Preço de Venda</span>
                    <span className="font-mono font-bold text-white tabular-nums text-sm">
                      {formatBRL(project.salePrice)}
                    </span>
                  </div>

                  {/* Custo Total */}
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Custo Real Total</span>
                    <span className="font-mono font-semibold text-neutral-300 tabular-nums text-sm">
                      {formatBRL(financials.totalCost)}
                    </span>
                    <div className="text-[10px] text-neutral-500">
                      Mat: {formatBRL(financials.materialCost)}
                    </div>
                  </div>

                  {/* Lucro Líquido & Margem */}
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Lucro Líquido</span>
                    <span className={`font-mono font-bold tabular-nums text-sm ${financials.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatBRL(financials.netProfit)}
                    </span>
                    <div className="text-[10px] text-emerald-400/90 font-mono">
                      Margem: {financials.profitMarginPercent.toFixed(1)}%
                    </div>
                  </div>

                  {/* Lucro por Hora */}
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Lucro / Hora</span>
                    <span className="font-mono font-bold text-[#F59E0B] tabular-nums text-sm">
                      {formatBRL(financials.profitPerHour)}
                    </span>
                    <div className="text-[10px] text-neutral-500">
                      ROI: +{financials.roiPercent.toFixed(1)}%
                    </div>
                  </div>

                  {/* Tempos de Operação */}
                  <div>
                    <span className="text-neutral-500 block text-[11px]">Tempos Alocados</span>
                    <div className="font-mono text-neutral-200">
                      Máq: {project.actualMachineHours > 0 ? project.actualMachineHours : project.estimatedMachineHours}h
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      Mão de Obra: {project.laborHours}h
                    </div>
                  </div>

                  {/* Qualidade e Refugos */}
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 block text-[11px]">Peças & Refugo</span>
                      <button
                        onClick={() => handleOpenDefectsModal(project)}
                        className="text-[10px] text-[#F59E0B] hover:underline cursor-pointer"
                      >
                        Apontar
                      </button>
                    </div>
                    <div className="font-mono text-neutral-200">
                      Boas: {project.goodParts} / {project.batchSize}
                    </div>
                    <div className={`text-[10px] font-mono ${project.rejectedParts > 0 ? 'text-red-400' : 'text-neutral-500'}`}>
                      Refugo: {project.rejectedParts} un ({projectIppm.toLocaleString('pt-BR')} IPPM)
                    </div>
                  </div>
                </div>

                {/* Materials Used tags */}
                {project.materialsUsed && project.materialsUsed.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 pt-1">
                    <span className="text-neutral-500 shrink-0">BOM (Insumos):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {project.materialsUsed.map((m, idx) => (
                        <span key={idx} className="bg-[#181C24] px-2 py-0.5 rounded text-[11px] font-mono text-neutral-300 border border-[#222834]">
                          {m.itemName}: {m.quantity}{m.unit} ({formatBRL(m.cost)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Nova Ordem de Produção */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#11141A] border border-[#2D3748] rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="text-base font-semibold text-white">
                Cadastrar Ordem de Fabricação (OF)
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewProject} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Código OF
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectForm.code}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, code: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Empresa X / Cliente Final"
                    value={newProjectForm.clientName}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, clientName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Título do Projeto / Lote
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 100 Cordões c/ Mosquetão + Presilhas 3D"
                  value={newProjectForm.title}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, title: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Posto / Máquina
                  </label>
                  <select
                    value={newProjectForm.machineType}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, machineType: e.target.value as MachineType })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="impressora_3d">Impressora 3D (FDM / Resina)</option>
                    <option value="montagem_manual">Bancada de Montagem Manual</option>
                    <option value="prensa_termica">Prensa Térmica (Cordões / Transfer)</option>
                    <option value="corte_laser">Corte & Gravação Laser</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Tamanho do Lote (peças)
                  </label>
                  <input
                    type="number"
                    required
                    value={newProjectForm.batchSize}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, batchSize: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Prazo de Entrega
                  </label>
                  <input
                    type="date"
                    required
                    value={newProjectForm.deadline}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, deadline: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 bg-[#090B0E] p-3 rounded-md border border-[#222834]">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Horas Máquina Est.
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newProjectForm.estimatedMachineHours}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, estimatedMachineHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs bg-[#11141A] border border-[#222834] rounded text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Horas Mão de Obra
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newProjectForm.laborHours}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, laborHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs bg-[#11141A] border border-[#222834] rounded text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Taxa Hora M.O. (R$)
                  </label>
                  <input
                    type="number"
                    required
                    value={newProjectForm.hourlyLaborRate}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, hourlyLaborRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs bg-[#11141A] border border-[#222834] rounded text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                    Preço de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProjectForm.salePrice}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, salePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs bg-[#11141A] border border-[#222834] rounded text-white font-mono font-bold focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              {/* Bill of Materials (BOM) Picker */}
              <div className="border border-[#222834] rounded-lg p-3 space-y-2 bg-[#0E1117]">
                <span className="text-xs font-semibold text-neutral-300 block">
                  Vincular Insumos do Inventário (BOM)
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="">Selecione um insumo em estoque...</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.currentStock} {item.unit} disp. - {formatBRL(item.unitCost)}/{item.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="any"
                    value={materialQty}
                    onChange={(e) => setMaterialQty(parseFloat(e.target.value) || 0)}
                    placeholder="Qtd"
                    className="w-20 px-2 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono"
                  />

                  <button
                    type="button"
                    onClick={handleAddMaterialToProject}
                    className="px-3 py-1.5 bg-[#181C24] hover:bg-[#222834] text-white text-xs rounded-md border border-[#2D3748] cursor-pointer"
                  >
                    Adicionar
                  </button>
                </div>

                {/* Selected materials list */}
                {newProjectForm.materials.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {newProjectForm.materials.map((m, idx) => {
                      const item = inventoryItems.find(i => i.id === m.itemId);
                      const cost = (item?.unitCost || 0) * m.quantity;
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs bg-[#11141A] px-3 py-1.5 rounded border border-[#222834]">
                          <span className="text-white font-medium">{item?.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-neutral-300">
                              {m.quantity} {item?.unit} = {formatBRL(cost)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialFromProject(idx)}
                              className="text-neutral-500 hover:text-red-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-[#181C24] hover:bg-[#222834] rounded-md transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-[#090B0E] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Criar Ordem de Fabricação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Apontamento de Qualidade & Refugo */}
      {isDefectModalOpen && defectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#11141A] border border-[#2D3748] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="text-base font-semibold text-white">
                Apontamento de Produção & IPPM
              </h3>
              <button
                onClick={() => setIsDefectModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Ordem <strong className="text-white font-mono">{defectTarget.code}</strong> — Lote de {defectTarget.batchSize} peças.
            </p>

            <form onSubmit={handleSaveDefects} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-emerald-400 mb-1">
                    Peças Boas Aprovadas
                  </label>
                  <input
                    type="number"
                    required
                    value={defectForm.goodParts}
                    onChange={(e) => setDefectForm({ ...defectForm, goodParts: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-red-400 mb-1">
                    Peças Refugadas (Defeitos)
                  </label>
                  <input
                    type="number"
                    required
                    value={defectForm.rejectedParts}
                    onChange={(e) => setDefectForm({ ...defectForm, rejectedParts: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Causa do Defeito / Refugo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Warping no bocal, falha de extrusão, costura desfiada"
                  value={defectForm.defectReason}
                  onChange={(e) => setDefectForm({ ...defectForm, defectReason: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDefectModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-[#181C24] hover:bg-[#222834] rounded-md transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-[#090B0E] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  Salvar Apontamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
