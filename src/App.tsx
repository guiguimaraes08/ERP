import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser,
  signInAnonymously
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType, testConnection } from './firebase';
import { InventoryItem, ProductionProject } from './types';
import { INITIAL_INVENTORY_ITEMS, INITIAL_PRODUCTION_PROJECTS } from './data/seedData';
import { calculateFactoryKpis, formatBRL } from './utils/calculations';
import { TopBar } from './components/TopBar';
import { KpiMetricsStrip } from './components/KpiMetricsStrip';
import { InventoryManager } from './components/InventoryManager';
import { ProjectsManager } from './components/ProjectsManager';
import { BottleneckPredictor } from './components/BottleneckPredictor';
import { SqliteExportModal } from './components/SqliteExportModal';
import { RevenueTrendChart } from './components/RevenueTrendChart';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { 
  NotificationSettings, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  sendPushNotification, 
  playIndustrialBeep 
} from './utils/notifications';
import { 
  Layers, 
  Plus, 
  ArrowRight, 
  AlertTriangle, 
  Package, 
  FileText, 
  Cpu, 
  Database,
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'projects' | 'bottlenecks' | 'sqlite'>('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Application Data State
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    const local = localStorage.getItem('forgeflow_inventory');
    return local ? JSON.parse(local) : INITIAL_INVENTORY_ITEMS;
  });

  const [productionProjects, setProductionProjects] = useState<ProductionProject[]>(() => {
    const local = localStorage.getItem('forgeflow_projects');
    return local ? JSON.parse(local) : INITIAL_PRODUCTION_PROJECTS;
  });

  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('forgeflow_notifications');
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_SETTINGS;
  });

  // Local storage synchronization fallback
  useEffect(() => {
    localStorage.setItem('forgeflow_inventory', JSON.stringify(inventoryItems));
  }, [inventoryItems]);

  useEffect(() => {
    localStorage.setItem('forgeflow_projects', JSON.stringify(productionProjects));
  }, [productionProjects]);

  useEffect(() => {
    localStorage.setItem('forgeflow_notifications', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Automated notification on critical stock dip
  useEffect(() => {
    if (!notificationSettings.enabled || !notificationSettings.alertOnCriticalStock) return;

    const criticals = inventoryItems.filter(i => i.currentStock <= i.minStock);
    if (criticals.length > 0) {
      const lastAlertTime = parseInt(sessionStorage.getItem('last_stock_alert') || '0', 10);
      const now = Date.now();
      // Throttle alerts so they don't spam (minimum 5 minutes between automatic checks)
      if (now - lastAlertTime > 5 * 60 * 1000) {
        sessionStorage.setItem('last_stock_alert', String(now));
        
        if (notificationSettings.soundEnabled) {
          playIndustrialBeep('warning');
        }

        sendPushNotification('ForgeFlow: Insumos em Nível Crítico!', {
          body: `${criticals.length} matérias-primas atingiram o nível de segurança. ${criticals[0].name}: ${criticals[0].currentStock} ${criticals[0].unit} restantes.`,
          tag: 'forgeflow-stock-status',
        });
      }
    }
  }, [inventoryItems, notificationSettings]);

  // Firebase Auth & Connection Test
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Listeners (when authenticated)
  useEffect(() => {
    if (!currentUser) return;

    setIsSyncing(true);

    // Listen to inventory_items
    const inventoryCol = collection(db, 'inventory_items');
    const unsubInventory = onSnapshot(
      inventoryCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: InventoryItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data.ownerId === currentUser.uid) {
              loaded.push({ id: d.id, ...data } as InventoryItem);
            }
          });
          if (loaded.length > 0) {
            setInventoryItems(loaded);
          }
        }
        setIsSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'inventory_items');
      }
    );

    // Listen to production_projects
    const projectsCol = collection(db, 'production_projects');
    const unsubProjects = onSnapshot(
      projectsCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const loaded: ProductionProject[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data.ownerId === currentUser.uid) {
              loaded.push({ id: d.id, ...data } as ProductionProject);
            }
          });
          if (loaded.length > 0) {
            setProductionProjects(loaded);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'production_projects');
      }
    );

    return () => {
      unsubInventory();
      unsubProjects();
    };
  }, [currentUser]);

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.warn('Login com Google cancelado ou com restrição de popup, tentando login anônimo de teste...');
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error('Falha no login:', e);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Deseja recarregar os dados industriais de demonstração (3D + Cordões)?')) {
      setInventoryItems(INITIAL_INVENTORY_ITEMS);
      setProductionProjects(INITIAL_PRODUCTION_PROJECTS);
      localStorage.setItem('forgeflow_inventory', JSON.stringify(INITIAL_INVENTORY_ITEMS));
      localStorage.setItem('forgeflow_projects', JSON.stringify(INITIAL_PRODUCTION_PROJECTS));
    }
  };

  // Inventory Mutations
  const handleAddItem = async (
    itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>
  ) => {
    const id = `item-${Date.now()}`;
    const ownerId = currentUser ? currentUser.uid : 'factory-owner';
    const newItem: InventoryItem = {
      ...itemData,
      id,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setInventoryItems((prev) => [newItem, ...prev]);

    if (currentUser) {
      try {
        await setDoc(doc(db, 'inventory_items', id), newItem);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `inventory_items/${id}`);
      }
    }
  };

  const handleUpdateStock = async (id: string, delta: number) => {
    const item = inventoryItems.find((i) => i.id === id);
    if (!item) return;

    const newStock = Math.max(0, item.currentStock + delta);
    const updated = { ...item, currentStock: newStock, updatedAt: new Date().toISOString() };

    setInventoryItems((prev) => prev.map((i) => (i.id === id ? updated : i)));

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'inventory_items', id), {
          currentStock: newStock,
          updatedAt: updated.updatedAt,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `inventory_items/${id}`);
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    setInventoryItems((prev) => prev.filter((i) => i.id !== id));

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'inventory_items', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `inventory_items/${id}`);
      }
    }
  };

  const handleEditItem = async (item: InventoryItem) => {
    setInventoryItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));

    if (currentUser) {
      try {
        await setDoc(doc(db, 'inventory_items', item.id), item);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `inventory_items/${item.id}`);
      }
    }
  };

  // Projects Mutations
  const handleAddProject = async (
    projectData: Omit<ProductionProject, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>
  ) => {
    const id = `proj-${Date.now()}`;
    const ownerId = currentUser ? currentUser.uid : 'factory-owner';
    const newProject: ProductionProject = {
      ...projectData,
      id,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setProductionProjects((prev) => [newProject, ...prev]);

    // Automatically deduct materials from inventory
    if (newProject.materialsUsed && newProject.materialsUsed.length > 0) {
      newProject.materialsUsed.forEach((mat) => {
        handleUpdateStock(mat.itemId, -mat.quantity);
      });
    }

    if (currentUser) {
      try {
        await setDoc(doc(db, 'production_projects', id), newProject);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `production_projects/${id}`);
      }
    }
  };

  const handleUpdateProjectStatus = async (id: string, newStatus: ProductionProject['status']) => {
    const updated = productionProjects.map((p) =>
      p.id === id ? { ...p, status: newStatus, updatedAt: new Date().toISOString() } : p
    );
    setProductionProjects(updated);

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'production_projects', id), {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `production_projects/${id}`);
      }
    }
  };

  const handleUpdateDefects = async (
    id: string,
    goodParts: number,
    rejectedParts: number,
    defectReason: string
  ) => {
    const updated = productionProjects.map((p) =>
      p.id === id
        ? {
            ...p,
            goodParts,
            rejectedParts,
            defectReason,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    setProductionProjects(updated);

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'production_projects', id), {
          goodParts,
          rejectedParts,
          defectReason,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `production_projects/${id}`);
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProductionProjects((prev) => prev.filter((p) => p.id !== id));

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'production_projects', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `production_projects/${id}`);
      }
    }
  };

  // Factory KPIs computation
  const kpis = useMemo(() => {
    return calculateFactoryKpis(inventoryItems, productionProjects);
  }, [inventoryItems, productionProjects]);

  return (
    <div className="min-h-screen bg-[#090B0E] text-[#F3F4F6] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Bar with 3-Zone Contract */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isSyncing={isSyncing}
        onResetData={handleResetData}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        criticalCount={kpis.lowStockItemsCount}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Strip */}
        <KpiMetricsStrip
          kpis={kpis}
          onNavigateToBottlenecks={() => setActiveTab('bottlenecks')}
        />

        {/* Tab 1: Overview Panel */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Actions & Bottleneck Alert */}
            {kpis.primaryBottleneck.severity !== 'normal' && (
              <div 
                onClick={() => setActiveTab('bottlenecks')}
                className="bg-amber-950/20 border border-amber-900/60 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-amber-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Alerta do Detector de Gargalo
                    </h4>
                    <p className="text-sm font-medium text-white">
                      {kpis.primaryBottleneck.resource} — {kpis.primaryBottleneck.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <span>Resolver no Monitor</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* 7-Day Revenue Trend Chart (Recharts) */}
            <RevenueTrendChart projects={productionProjects} />

            {/* Split Grid: Ordens Ativas + Estoque Crítico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: Ordens de Produção em Andamento */}
              <div className="bg-[#11141A] border border-[#222834] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1C222D] pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-white">
                      Ordens de Fabricação Recentes
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs text-[#F59E0B] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Todas ({productionProjects.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {productionProjects.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="bg-[#090B0E] p-3 rounded-md border border-[#1C222D] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#F59E0B]">{p.code}</span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-neutral-300 font-medium">{p.clientName}</span>
                        </div>
                        <div className="text-neutral-400 mt-0.5 line-clamp-1">{p.title}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-semibold text-white">
                          {formatBRL(p.salePrice)}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {p.batchSize} peças · {p.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Insumos que Requerem Atenção */}
              <div className="bg-[#11141A] border border-[#222834] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1C222D] pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Insumos em Nível Crítico / Reposição
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="text-xs text-[#F59E0B] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Abrir Inventário</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {inventoryItems
                    .filter((item) => item.currentStock <= item.minStock)
                    .slice(0, 4)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#090B0E] p-3 rounded-md border border-amber-900/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{item.name}</div>
                          <div className="font-mono text-[11px] text-neutral-500">
                            {item.sku} · Fornecedor: {item.supplier}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono tabular-nums text-amber-400 font-bold">
                            {item.currentStock} {item.unit}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            Mínimo: {item.minStock} {item.unit}
                          </div>
                        </div>
                      </div>
                    ))}

                  {inventoryItems.filter((i) => i.currentStock <= i.minStock).length === 0 && (
                    <div className="py-6 text-center text-xs text-neutral-400">
                      <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                      <span>Todos os insumos estão operando acima do nível de segurança.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Export CTA to local SQLite/Python */}
            <div className="bg-[#11141A] border border-[#222834] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded bg-[#181C24] text-[#F59E0B] border border-[#222834]">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Autonomia e Privacidade Total na Fábrica
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Exporte todo o banco para SQLite local e gere o script executável em Python sem dependências com 1 clique.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('sqlite')}
                className="px-4 py-2 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer shadow-xs active:scale-[0.98]"
              >
                Gerar Arquivos SQLite & Python
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Inventory Manager */}
        {activeTab === 'inventory' && (
          <InventoryManager
            items={inventoryItems}
            onAddItem={handleAddItem}
            onUpdateStock={handleUpdateStock}
            onDeleteItem={handleDeleteItem}
            onEditItem={handleEditItem}
          />
        )}

        {/* Tab 3: Projects & Orders Manager */}
        {activeTab === 'projects' && (
          <ProjectsManager
            projects={productionProjects}
            inventoryItems={inventoryItems}
            onAddProject={handleAddProject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onUpdateDefects={handleUpdateDefects}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {/* Tab 4: Bottleneck Predictor */}
        {activeTab === 'bottlenecks' && (
          <BottleneckPredictor
            items={inventoryItems}
            projects={productionProjects}
            onQuickRestock={handleUpdateStock}
          />
        )}

        {/* Tab 5: Local SQLite & Python Exporter */}
        {activeTab === 'sqlite' && (
          <SqliteExportModal
            items={inventoryItems}
            projects={productionProjects}
          />
        )}
      </main>

      {/* Industrial Footer */}
      <footer className="border-t border-[#222834] bg-[#090B0E] py-4 px-6 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-400">ForgeFlow ERP</span>
          <span aria-hidden="true">·</span>
          <span>Manufatura 3D & Cordões Customizados</span>
          <span aria-hidden="true">·</span>
          <span>Google Firestore + SQLite Sync</span>
        </div>
        <div className="font-mono text-[11px] text-neutral-600">
          Versão Operacional 1.0 · Latência Local: 0ms
        </div>
      </footer>

      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        settings={notificationSettings}
        onUpdateSettings={setNotificationSettings}
        criticalItemsCount={kpis.lowStockItemsCount}
      />
    </div>
  );
}
