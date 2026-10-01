// Notification & Audio Alert Manager for Factory Operations

export interface NotificationSettings {
  enabled: boolean;
  alertOnCriticalStock: boolean;
  alertOnBottleneck: boolean;
  alertOnProjectDefect: boolean;
  soundEnabled: boolean;
  minIntervalMinutes: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  alertOnCriticalStock: true,
  alertOnBottleneck: true,
  alertOnProjectDefect: true,
  soundEnabled: true,
  minIntervalMinutes: 30,
};

// Synthesize an industrial warning sound using Web Audio API (zero external mp3 dependencies)
export function playIndustrialBeep(type: 'warning' | 'critical' | 'nominal' = 'warning') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'critical') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'warning') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (err) {
    console.warn('AudioContext não disponível ou restrito por interação do usuário:', err);
  }
}

// Request Native Desktop / Mobile Push Notification Permission
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    alert('Seu navegador atual não suporta a Web Notification API.');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

// Send native notification
export function sendPushNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        badge: 'https://cdn-icons-png.flaticon.com/512/3067/3067443.png',
        icon: 'https://cdn-icons-png.flaticon.com/512/3067/3067443.png',
        ...options,
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('Erro ao disparar notificação push nativa:', e);
    }
  }
}
