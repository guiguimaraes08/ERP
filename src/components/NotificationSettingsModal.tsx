import React, { useState, useEffect } from 'react';
import { 
  NotificationSettings, 
  requestPushPermission, 
  sendPushNotification, 
  playIndustrialBeep 
} from '../utils/notifications';
import { 
  Bell, 
  BellRing, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Check, 
  X, 
  Send, 
  AlertTriangle,
  Radio,
  Sliders
} from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onUpdateSettings: (newSettings: NotificationSettings) => void;
  criticalItemsCount: number;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  criticalItemsCount,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const res = await requestPushPermission();
    setPermission(res);
    if (res === 'granted') {
      onUpdateSettings({ ...settings, enabled: true });
      playIndustrialBeep('nominal');
    }
  };

  const handleTestNotification = () => {
    if (settings.soundEnabled) {
      playIndustrialBeep('critical');
    }

    sendPushNotification('⚠️ Alerta ForgeFlow: Estoque Crítico!', {
      body: `Atenção: Existem ${criticalItemsCount || 2} matérias-primas abaixo do estoque mínimo de segurança no galpão.`,
      tag: 'forgeflow-stock-alert',
      requireInteraction: true,
    });

    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#11141A] border border-[#2D3748] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#222834] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Notificações Push & Alertas de Estoque
              </h3>
              <p className="text-xs text-neutral-400">
                Avisos automáticos mesmo com o navegador em segundo plano.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permission Status Box */}
        <div className="bg-[#090B0E] p-3.5 rounded-lg border border-[#222834] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-white block">
              Permissão Push do Sistema Operacional
            </span>
            <span className="text-[11px] text-neutral-400 font-mono mt-0.5 block">
              Status: {permission === 'granted' ? (
                <span className="text-emerald-400 font-bold">Autorizado no Navegador</span>
              ) : permission === 'denied' ? (
                <span className="text-red-400 font-bold">Bloqueado pelo Usuário</span>
              ) : (
                <span className="text-amber-400 font-bold">Pendente de Autorização</span>
              )}
            </span>
          </div>

          {permission !== 'granted' && (
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1.5 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-xs"
            >
              Habilitar Push
            </button>
          )}

          {permission === 'granted' && (
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Check className="w-4 h-4" />
              <span>Ativo</span>
            </div>
          )}
        </div>

        {/* Configuration Toggles */}
        <div className="space-y-3 text-xs">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-3 rounded bg-[#181C24] border border-[#222834]">
            <div>
              <span className="font-semibold text-white block">
                Disparar Alertas de Estoque em Tempo Real
              </span>
              <span className="text-neutral-400 text-[11px]">
                Notifica imediatamente quando um insumo atingir ou cruzar o estoque mínimo.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.alertOnCriticalStock}
              onChange={(e) => onUpdateSettings({ ...settings, alertOnCriticalStock: e.target.checked })}
              className="w-4 h-4 accent-[#F59E0B] rounded cursor-pointer"
            />
          </div>

          {/* Sound alert */}
          <div className="flex items-center justify-between p-3 rounded bg-[#181C24] border border-[#222834]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-[#11141A] text-neutral-300">
                {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#F59E0B]" /> : <VolumeX className="w-3.5 h-3.5" />}
              </div>
              <div>
                <span className="font-semibold text-white block">
                  Sinal Sonoro de Máquina Industrial
                </span>
                <span className="text-neutral-400 text-[11px]">
                  Bip de alerta de chão de fábrica via sintetizador Web Audio.
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => onUpdateSettings({ ...settings, soundEnabled: e.target.checked })}
              className="w-4 h-4 accent-[#F59E0B] rounded cursor-pointer"
            />
          </div>

          {/* Bottleneck Alert */}
          <div className="flex items-center justify-between p-3 rounded bg-[#181C24] border border-[#222834]">
            <div>
              <span className="font-semibold text-white block">
                Alertas de Sobrecarga de Posto de Trabalho
              </span>
              <span className="text-neutral-400 text-[11px]">
                Avisa quando a fila de impressão ou montagem ultrapassar 85% da capacidade semanal.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.alertOnBottleneck}
              onChange={(e) => onUpdateSettings({ ...settings, alertOnBottleneck: e.target.checked })}
              className="w-4 h-4 accent-[#F59E0B] rounded cursor-pointer"
            />
          </div>

          {/* Defect IPPM spike */}
          <div className="flex items-center justify-between p-3 rounded bg-[#181C24] border border-[#222834]">
            <div>
              <span className="font-semibold text-white block">
                Alerta de Refugo Anômalo (Qualidade)
              </span>
              <span className="text-neutral-400 text-[11px]">
                Notifica se uma ordem registrar taxa de defeito superior a 5% das peças do lote.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.alertOnProjectDefect}
              onChange={(e) => onUpdateSettings({ ...settings, alertOnProjectDefect: e.target.checked })}
              className="w-4 h-4 accent-[#F59E0B] rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-3 border-t border-[#222834] flex items-center justify-between">
          <button
            onClick={handleTestNotification}
            className="px-3 py-1.5 bg-[#181C24] hover:bg-[#222834] text-neutral-200 hover:text-white border border-[#2D3748] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {testSent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Send className="w-3.5 h-3.5 text-[#F59E0B]" />}
            <span>{testSent ? 'Disparado no SO!' : 'Testar Alerta Push'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#F59E0B] hover:bg-[#FBBF24] text-[#090B0E] rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Salvar Preferências
          </button>
        </div>
      </div>
    </div>
  );
};
