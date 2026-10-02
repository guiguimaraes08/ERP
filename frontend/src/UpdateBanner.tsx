import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type UpdateStatus } from './api';
import { Button, useFeedback } from './ui';

/** Aviso de versão nova no GitHub, com atualização em um clique dentro do programa. */
export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast, confirm, fail } = useFeedback();

  useEffect(() => {
    // Sem internet a API só responde "não tem"; nada aparece.
    api.get<UpdateStatus>('/update').then(setStatus).catch(() => {});
  }, []);

  if (!status?.available || hidden) return null;

  const update = async () => {
    const ok = await confirm({
      title: `Atualizar para a versão ${status.latest}?`,
      message: (
        <div className="space-y-3">
          <p>O programa baixa a versão nova e abre de novo sozinho. Seus dados não mudam.</p>
          {status.notes && (
            <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
              <div className="font-semibold mb-1">O que mudou</div>
              {status.notes}
            </div>
          )}
        </div>
      ),
      confirmLabel: 'Atualizar agora',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post('/update/install');
      if (window.pywebview) {
        toast('Pronto! Abrindo a versão nova…');
        await window.pywebview.api.restart();
      } else {
        toast('Versão nova baixada. Feche e abra o programa.');
        setHidden(true);
      }
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <div className="fade-in mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
      <Download className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-[180px]">
        <div className="font-semibold">Tem versão nova: {status.latest}</div>
        <div className="text-sm text-muted">Você está na {status.current}.</div>
      </div>
      {status.can_install ? (
        <Button variant="primary" onClick={update} disabled={busy}>
          {busy ? 'Baixando… (pode levar um minutinho)' : 'Atualizar agora'}
        </Button>
      ) : (
        <a href={status.page} target="_blank" rel="noreferrer" className="text-primary font-medium underline">
          Ver no GitHub
        </a>
      )}
      {!busy && (
        <button onClick={() => setHidden(true)} className="p-1.5 rounded-lg text-muted hover:text-ink cursor-pointer" aria-label="Lembrar depois">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
