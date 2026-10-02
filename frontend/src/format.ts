import type { OrderStatus, Unit } from './api';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const money = (v: number) => brl.format(v);
export const qty = (v: number) => num.format(v);

/** Custo por unidade pequena (R$ 0,11/g) ainda fica legível: mostra até 4 casas. */
export const unitMoney = (v: number) =>
  v > 0 && v < 1
    ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
    : money(v);

export const UNIT_LABEL: Record<Unit, string> = {
  g: 'gramas',
  m: 'metros',
  un: 'unidades',
  ml: 'mililitros',
};

/** "2.400 g" fica melhor como "2,4 kg"; o mesmo para ml → L. */
export function amount(v: number, unit: Unit): string {
  if (unit === 'g' && Math.abs(v) >= 1000) return `${qty(v / 1000)} kg`;
  if (unit === 'ml' && Math.abs(v) >= 1000) return `${qty(v / 1000)} L`;
  return `${qty(v)} ${unit}`;
}

export const STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  a_fazer: { label: 'A fazer', tone: 'neutral' },
  fazendo: { label: 'Fazendo', tone: 'info' },
  pronto: { label: 'Pronto', tone: 'success' },
  entregue: { label: 'Entregue', tone: 'muted' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
};

/** Próximo passo natural do pedido, com o texto do botão. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  a_fazer: { to: 'fazendo', label: 'Começar' },
  fazendo: { to: 'pronto', label: 'Ficou pronto' },
  pronto: { to: 'entregue', label: 'Entregar' },
};

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Hoje", "Amanhã", "em 3 dias", "há 2 dias" — mais rápido de ler que a data. */
export function relativeDue(iso: string | null): string {
  if (!iso) return 'Sem prazo';
  const [y, m, d] = iso.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days < 0) return `Há ${-days} dias`;
  if (days <= 6) return `Em ${days} dias`;
  return shortDate(iso);
}

export function whatsappLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
