import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { api, ApiError, onWrite } from './api';
import type { Tone } from './format';

/* ---------- Carregamento de dados ---------- */

// Cache das telas: ao abrir uma tela, ela aparece na hora com o que já foi
// carregado e se atualiza por baixo. Por isso a transição desliza a tela pronta,
// e não um "Carregando…".
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();
const latest = new Map<string, number>();

function notify(path: string) {
  listeners.get(path)?.forEach((fn) => fn());
}

/** Busca de novo e avisa quem está mostrando. Resposta atrasada não sobrescreve uma mais nova. */
export function refresh(path: string): Promise<void> {
  const n = (latest.get(path) ?? 0) + 1;
  latest.set(path, n);
  return api.get<unknown>(path).then((data) => {
    if (latest.get(path) !== n) return;
    cache.set(path, data);
    notify(path);
  });
}

/** Carrega em segundo plano o que ainda não está no cache. */
export function prefetch(paths: string[]) {
  for (const p of paths) if (!cache.has(p)) refresh(p).catch(() => {});
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
onWrite(() => {
  // Depois de gravar algo, tudo o que está no cache pode ter mudado (estoque, agenda, painel…).
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    for (const p of cache.keys()) refresh(p).catch(() => {});
  }, 120);
});

export function useLoad<T>(path: string | null) {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    const set = listeners.get(path) ?? new Set();
    listeners.set(path, set);
    set.add(rerender);
    refresh(path)
      .then(() => setError(null))
      .catch((e: Error) => setError(e.message));
    return () => {
      set.delete(rerender);
    };
  }, [path]);

  const data = path && cache.has(path) ? (cache.get(path) as T) : null;
  const reload = useCallback(() => {
    if (path) refresh(path).catch((e: Error) => setError(e.message));
  }, [path]);
  const setData = useCallback(
    (value: T) => {
      if (!path) return;
      cache.set(path, value);
      notify(path);
    },
    [path],
  );
  return { data, error: data ? null : error, reload, setData };
}

/* ---------- Transições ---------- */

export type SlideDirection = 'forward' | 'back' | 'none';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Troca de tela deslizando: a nova entra pelo lado (direita = avançar, esquerda = voltar)
 * por cima da antiga, que recua um pouco. Usa a View Transitions API; sem ela, só troca.
 * `scope` = 'page' (área principal inteira) ou 'tab' (só o conteúdo de uma aba).
 */
export function slide(direction: SlideDirection, update: () => void, scope: 'page' | 'tab' = 'page') {
  if (direction === 'none' || reducedMotion() || !document.startViewTransition) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.slide = `${scope}-${direction}`;
  const transition = document.startViewTransition(() => flushSync(update));
  transition.finished.finally(() => {
    if (root.dataset.slide === `${scope}-${direction}`) delete root.dataset.slide;
  });
}

/** Campos numéricos guardam texto no formulário; aceita vírgula ("1,5"). */
export function toNum(value: string): number {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function toNumOrNull(value: string): number | null {
  return value.trim() === '' ? null : toNum(value);
}

/* ---------- Botões e campos ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'h-8 px-3 text-sm gap-1.5' : 'h-10 px-4 text-[15px] gap-2';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputCls =
  'w-full h-10 px-3 rounded-lg border border-line bg-surface text-ink text-[15px] placeholder:text-muted/70 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

/* ---------- Blocos visuais ---------- */

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  muted: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-xl ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="py-12 px-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-muted text-sm mt-1 max-w-sm mx-auto">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg bg-danger-soft text-danger px-3 py-2 text-sm">{message}</div>;
}

export function Loading() {
  return <div className="py-16 text-center text-muted">Carregando…</div>;
}

/* ---------- Janela (modal) ---------- */

/**
 * Animação de saída: o React tira a janela da tela na hora, então deixamos uma
 * cópia visual dela (e do fundo escuro) descendo por 200 ms e depois some.
 * Assim todo jeito de fechar (X, Cancelar, Salvar, Esc) anima igual.
 */
function leaveWithGhost(dialog: HTMLDialogElement) {
  if (reducedMotion() || !dialog.open) return;
  const rect = dialog.getBoundingClientRect();
  const backdrop = document.createElement('div');
  backdrop.className = 'ghost-backdrop';
  const ghost = document.createElement('div');
  ghost.className = `${dialog.className} sheet-ghost`;
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '60',
    pointerEvents: 'none',
  });
  dialog.childNodes.forEach((child) => ghost.appendChild(child.cloneNode(true)));
  document.body.append(backdrop, ghost);
  setTimeout(() => {
    backdrop.remove();
    ghost.remove();
  }, 220);
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog) leaveWithGhost(dialog);
      dialog?.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`sheet m-0 sm:m-auto mt-auto w-full max-w-none sm:max-w-lg ${wide ? 'sm:max-w-3xl' : ''} max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-surface text-ink border border-line p-0 shadow-2xl`}
    >
      <div className="flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2 cursor-pointer" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}

/* ---------- Avisos e confirmação ---------- */

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface Feedback {
  toast: (message: string, tone?: 'success' | 'danger') => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Mostra o erro da API como aviso. Devolve o erro para quem precisar tratar. */
  fail: (err: unknown) => ApiError | null;
}

const FeedbackContext = createContext<Feedback | null>(null);

export function useFeedback(): Feedback {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback fora do FeedbackProvider');
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: 'success' | 'danger' }[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const toast = useCallback((message: string, tone: 'success' | 'danger' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'danger' ? 6000 : 3000);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const fail = useCallback(
    (err: unknown) => {
      const apiErr = err instanceof ApiError ? err : null;
      toast(err instanceof Error ? err.message : 'Algo deu errado', 'danger');
      return apiErr;
    },
    [toast],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm, fail }}>
      {children}
      {pending && (
        <Modal
          title={pending.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button onClick={() => close(false)}>Voltar</Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {pending.confirmLabel ?? 'Confirmar'}
              </Button>
            </>
          }
        >
          <div className="text-[15px]">{pending.message}</div>
        </Modal>
      )}
      <div className="fixed z-50 bottom-20 sm:bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-32px)] sm:w-auto sm:max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in rounded-lg px-4 py-3 text-sm font-medium shadow-lg border ${
              t.tone === 'danger' ? 'bg-danger-soft text-danger border-danger/30' : 'bg-surface text-ink border-line'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}
