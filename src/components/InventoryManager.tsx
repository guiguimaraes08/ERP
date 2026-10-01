import React, { useState, useMemo } from 'react';
import { InventoryItem, ItemCategory, UnitType } from '../types';
import { formatBRL } from '../utils/calculations';
import { 
  Search, 
  Plus, 
  Filter, 
  AlertCircle, 
  Package, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ArrowUpDown,
  Layers,
  Box,
  Check,
  X
} from 'lucide-react';

interface InventoryManagerProps {
  items: InventoryItem[];
  onAddItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => Promise<void>;
  onUpdateStock: (id: string, delta: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onEditItem: (item: InventoryItem) => Promise<void>;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  items,
  onAddItem,
  onUpdateStock,
  onDeleteItem,
  onEditItem,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'cost' | 'leadTime'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal / Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '3d_printing' as ItemCategory,
    currentStock: 1000,
    minStock: 500,
    unit: 'g' as UnitType,
    unitCost: 0.12,
    supplier: '',
    location: '',
    leadTimeDays: 3,
  });

  const categories: { id: ItemCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'Todos os Insumos' },
    { id: '3d_printing', label: 'Impressão 3D' },
    { id: 'cordoes', label: 'Fitas & Cordões' },
    { id: 'ferragens', label: 'Ferragens & Fechos' },
    { id: 'consumiveis', label: 'Consumíveis & Bicos' },
    { id: 'embalagens', label: 'Embalagens' },
  ];

  // Filtering & Sorting
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesLowStock = !onlyLowStock || item.currentStock <= item.minStock;
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          item.name.toLowerCase().includes(term) ||
          item.sku.toLowerCase().includes(term) ||
          item.supplier.toLowerCase().includes(term) ||
          item.location.toLowerCase().includes(term);

        return matchesCategory && matchesLowStock && matchesSearch;
      })
      .sort((a, b) => {
        let compare = 0;
        if (sortBy === 'name') compare = a.name.localeCompare(b.name);
        else if (sortBy === 'stock') compare = a.currentStock - b.currentStock;
        else if (sortBy === 'cost') compare = a.unitCost - b.unitCost;
        else if (sortBy === 'leadTime') compare = a.leadTimeDays - b.leadTimeDays;

        return sortOrder === 'asc' ? compare : -compare;
      });
  }, [items, searchTerm, selectedCategory, onlyLowStock, sortBy, sortOrder]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      sku: `INS-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      category: '3d_printing',
      currentStock: 1000,
      minStock: 300,
      unit: 'g',
      unitCost: 0.12,
      supplier: '',
      location: 'Prateleira 1',
      leadTimeDays: 3,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      minStock: item.minStock,
      unit: item.unit,
      unitCost: item.unitCost,
      supplier: item.supplier,
      location: item.location,
      leadTimeDays: item.leadTimeDays,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    if (editingItem) {
      await onEditItem({
        ...editingItem,
        ...formData,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await onAddItem(formData);
    }
    setIsModalOpen(false);
  };

  const totalInventoryValue = useMemo(() => {
    return items.reduce((acc, item) => acc + item.currentStock * item.unitCost, 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter((item) => item.currentStock <= item.minStock).length;
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Top Controls: Search, Filter Tabs, Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11141A] p-3 rounded-lg border border-[#222834]">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por insumo, SKU, fornecedor ou gaveta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2">
          {/* Low Stock Toggle */}
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
              onlyLowStock
                ? 'bg-amber-950/40 text-amber-400 border-amber-800'
                : 'bg-[#181C24] text-neutral-400 border-[#222834] hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Apenas Críticos</span>
            {lowStockCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-amber-500/20 rounded">
                {lowStockCount}
              </span>
            )}
          </button>

          {/* Add New Item Button */}
          <button
            onClick={handleOpenAddModal}
            className="px-3.5 py-1.5 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Insumo</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer border ${
              selectedCategory === cat.id
                ? 'bg-[#181C24] text-white border-[#3B4556]'
                : 'bg-[#11141A] text-neutral-400 border-[#222834] hover:text-white hover:border-[#2D3748]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Summary Micro Bar */}
      <div className="flex items-center justify-between px-1 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span>{filteredItems.length} insumos listados</span>
          <span aria-hidden="true">·</span>
          <span>Valor imobilizado: <strong className="text-white font-mono">{formatBRL(totalInventoryValue)}</strong></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-neutral-500">Ordenar:</span>
          <button
            onClick={() => {
              if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('name'); setSortOrder('asc'); }
            }}
            className={`hover:text-white cursor-pointer ${sortBy === 'name' ? 'text-[#F59E0B]' : ''}`}
          >
            Nome
          </button>
          <button
            onClick={() => {
              if (sortBy === 'stock') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('stock'); setSortOrder('asc'); }
            }}
            className={`hover:text-white cursor-pointer ${sortBy === 'stock' ? 'text-[#F59E0B]' : ''}`}
          >
            Estoque
          </button>
          <button
            onClick={() => {
              if (sortBy === 'cost') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              else { setSortBy('cost'); setSortOrder('asc'); }
            }}
            className={`hover:text-white cursor-pointer ${sortBy === 'cost' ? 'text-[#F59E0B]' : ''}`}
          >
            Custo
          </button>
        </div>
      </div>

      {/* Dense Industrial Inventory Table */}
      <div className="border border-[#222834] rounded-lg overflow-hidden bg-[#11141A]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D1015] border-b border-[#222834] text-neutral-400">
              <tr>
                <th className="py-2.5 px-4 font-medium">SKU / Insumo</th>
                <th className="py-2.5 px-4 font-medium">Categoria</th>
                <th className="py-2.5 px-4 font-medium text-right">Estoque Atual</th>
                <th className="py-2.5 px-4 font-medium text-right">Mínimo</th>
                <th className="py-2.5 px-4 font-medium text-right">Custo Unitário</th>
                <th className="py-2.5 px-4 font-medium text-right">Total Imobilizado</th>
                <th className="py-2.5 px-4 font-medium">Localização & Fornecedor</th>
                <th className="py-2.5 px-4 font-medium text-center">Ajuste Rápido</th>
                <th className="py-2.5 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C222D]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400">
                    <Package className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                    <p className="font-medium text-white">Nenhum insumo encontrado</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {searchTerm ? 'Tente alterar os termos da busca.' : 'Cadastre sua primeira matéria-prima no botão acima.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.currentStock <= item.minStock;
                  const stockPercent = Math.min(100, Math.round((item.currentStock / Math.max(1, item.minStock * 2)) * 100));

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#141820] transition-colors group"
                    >
                      {/* Name & SKU */}
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-white group-hover:text-[#F59E0B] transition-colors">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-neutral-500 tracking-wider">
                          {item.sku}
                        </div>
                      </td>

                      {/* Category - Clean unboxed text with separator */}
                      <td className="py-2.5 px-4 text-neutral-400">
                        {item.category === '3d_printing' && 'Impressão 3D'}
                        {item.category === 'cordoes' && 'Fitas & Cordões'}
                        {item.category === 'ferragens' && 'Ferragens'}
                        {item.category === 'consumiveis' && 'Consumíveis'}
                        {item.category === 'embalagens' && 'Embalagens'}
                      </td>

                      {/* Current Stock */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`font-mono tabular-nums font-semibold ${
                              isLow ? 'text-amber-400' : 'text-neutral-200'
                            }`}
                          >
                            {item.currentStock.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {item.unit}
                          </span>
                        </div>
                        {/* Mini Visual Bar */}
                        <div className="w-16 h-1 bg-[#1F2736] rounded-full ml-auto mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Minimum Stock */}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-400">
                        {item.minStock.toLocaleString('pt-BR')} {item.unit}
                      </td>

                      {/* Unit Cost */}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-neutral-300">
                        {formatBRL(item.unitCost)}
                        <span className="text-[10px] text-neutral-500 ml-0.5">/{item.unit}</span>
                      </td>

                      {/* Total Imobilizado */}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white font-medium">
                        {formatBRL(item.currentStock * item.unitCost)}
                      </td>

                      {/* Location & Supplier */}
                      <td className="py-2.5 px-4 text-neutral-400">
                        <div className="truncate max-w-[150px]">{item.location || '—'}</div>
                        <div className="text-[11px] text-neutral-500 truncate max-w-[150px]">
                          {item.supplier}
                        </div>
                      </td>

                      {/* Quick Adjust Buttons */}
                      <td className="py-2.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-[#090B0E] p-0.5 rounded border border-[#222834]">
                          <button
                            onClick={() => onUpdateStock(item.id, item.unit === 'g' ? -50 : -10)}
                            className="px-1.5 py-0.5 text-neutral-400 hover:text-white hover:bg-[#181C24] rounded text-[11px] font-mono cursor-pointer transition-colors"
                            title={item.unit === 'g' ? '-50g' : '-10 un'}
                          >
                            {item.unit === 'g' ? '-50' : '-10'}
                          </button>
                          <span className="text-neutral-600 text-[10px]">|</span>
                          <button
                            onClick={() => onUpdateStock(item.id, item.unit === 'g' ? +100 : +20)}
                            className="px-1.5 py-0.5 text-neutral-400 hover:text-[#F59E0B] hover:bg-[#181C24] rounded text-[11px] font-mono cursor-pointer transition-colors"
                            title={item.unit === 'g' ? '+100g' : '+20 un'}
                          >
                            {item.unit === 'g' ? '+100' : '+20'}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#181C24] rounded transition-colors cursor-pointer"
                            title="Editar Insumo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-[#181C24] rounded transition-colors cursor-pointer"
                            title="Excluir Insumo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastro & Edição de Insumo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#11141A] border border-[#2D3748] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#222834] pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingItem ? 'Editar Insumo Industrial' : 'Novo Insumo no Estoque'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="3d_printing">Impressão 3D (Filamentos / Resinas)</option>
                    <option value="cordoes">Fitas & Cordões Têxteis</option>
                    <option value="ferragens">Ferragens, Mosquetões & Fechos</option>
                    <option value="consumiveis">Consumíveis & Bicos</option>
                    <option value="embalagens">Embalagens & Etiquetas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Nome do Insumo / Descrição
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Filamento PLA Cinza Espacial 1.75mm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Estoque Atual
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Unidade
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as UnitType })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  >
                    <option value="g">Gramas (g)</option>
                    <option value="kg">Quilos (kg)</option>
                    <option value="m">Metros (m)</option>
                    <option value="un">Unidades (un)</option>
                    <option value="rolo">Rolos</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Custo por Unidade (R$)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Tempo de Entrega (Lead Time em dias)
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white font-mono focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Ex: 3D Fila Brasil"
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Localização no Galpão / Oficina
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ex: Estufa A1 - Gaveta 2"
                    className="w-full px-3 py-1.5 text-xs bg-[#090B0E] border border-[#222834] rounded-md text-white focus:outline-none focus:border-[#F59E0B]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#222834] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white bg-[#181C24] hover:bg-[#222834] rounded-md transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-[#090B0E] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-md transition-colors cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
