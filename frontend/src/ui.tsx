import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';
import type { Tone } from './format';

/* ---------- Carregamento de dados ---------- */

export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    api
      .get<T>(path)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
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
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`fade-in m-0 sm:m-auto mt-auto w-full max-w-none sm:max-w-lg ${wide ? 'sm:max-w-3xl' : ''} max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-surface text-ink border border-line p-0 shadow-2xl`}
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
            className={`fade-in rounded-lg px-4 py-3 text-sm font-medium shadow-lg border ${
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
