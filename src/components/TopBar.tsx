import React from 'react';
import { Database, ShieldCheck, User, LogIn, LogOut, RefreshCw, Cpu, Bell } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface TopBarProps {
  activeTab: 'overview' | 'inventory' | 'projects' | 'bottlenecks' | 'sqlite';
  setActiveTab: (tab: 'overview' | 'inventory' | 'projects' | 'bottlenecks' | 'sqlite') => void;
  currentUser: FirebaseUser | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncing: boolean;
  onResetData: () => void;
  onOpenNotifications: () => void;
  criticalCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onLogin,
  onLogout,
  isSyncing,
  onResetData,
  onOpenNotifications,
  criticalCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#222834] bg-[#090B0E]/95 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-[#181C24] border border-[#222834] flex items-center justify-center text-[#F59E0B]">
          <Cpu className="w-4 h-4 text-[#F59E0B]" />
        </div>
        <button
          onClick={() => setActiveTab('overview')}
          className="text-left group cursor-pointer focus-visible:outline-none"
        >
          <span className="text-base font-bold tracking-tight text-white group-hover:text-[#F59E0B] transition-colors">
            ForgeFlow
          </span>
          <span className="text-xs text-neutral-400 font-mono ml-2">ERP Industrial</span>
        </button>
      </div>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden lg:flex items-center gap-1 bg-[#11141A] p-1 rounded-lg border border-[#222834]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#181C24] text-white shadow-xs border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white hover:bg-[#151921]'
          }`}
        >
          Painel Geral
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-[#181C24] text-white shadow-xs border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white hover:bg-[#151921]'
          }`}
        >
          Inventário & Insumos
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'projects'
              ? 'bg-[#181C24] text-white shadow-xs border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white hover:bg-[#151921]'
          }`}
        >
          Ordens & Faturamento
        </button>

        <button
          onClick={() => setActiveTab('bottlenecks')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'bottlenecks'
              ? 'bg-[#181C24] text-white shadow-xs border border-[#2D3748]'
              : 'text-neutral-400 hover:text-white hover:bg-[#151921]'
          }`}
        >
          Gargalos & Previsão
        </button>

        <button
          onClick={() => setActiveTab('sqlite')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'sqlite'
              ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
              : 'text-neutral-400 hover:text-[#F59E0B] hover:bg-[#151921]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Exportar SQLite / Python</span>
        </button>
      </nav>

      {/* Zone 3: Primary Actions & User Info */}
      <div className="flex items-center gap-3">
        {/* Push Notification & Stock Alerts Button */}
        <button
          onClick={onOpenNotifications}
          title="Configurações de Notificações Push & Alertas"
          className="relative p-2 text-neutral-400 hover:text-white hover:bg-[#181C24] rounded-md transition-colors border border-transparent hover:border-[#222834] cursor-pointer"
        >
          <Bell className="w-4 h-4 text-neutral-300" />
          {criticalCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        {/* Reset / Demo seed tool */}
        <button
          onClick={onResetData}
          title="Recarregar Dados Semente de Demonstração"
          className="p-2 text-neutral-400 hover:text-white hover:bg-[#181C24] rounded-md transition-colors border border-transparent hover:border-[#222834]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#F59E0B]' : ''}`} />
        </button>

        {/* Database Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#11141A] border border-[#222834] text-xs text-neutral-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] text-neutral-400">Google Firestore</span>
        </div>

        {/* Auth Section */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#222834]">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Usuário'}
                  className="w-6 h-6 rounded-full border border-[#222834]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#181C24] text-neutral-300 flex items-center justify-center text-xs">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="text-xs text-neutral-300 font-medium max-w-[120px] truncate">
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-[#181C24] rounded-md transition-colors"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#181C24] hover:bg-[#222834] text-white text-xs font-medium rounded-md border border-[#2D3748] transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Login Google</span>
          </button>
        )}
      </div>
    </header>
  );
};
