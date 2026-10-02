export type Unit = 'g' | 'm' | 'un' | 'ml';
export type OrderStatus = 'a_fazer' | 'fazendo' | 'pronto' | 'entregue' | 'cancelado';

export interface Material {
  id: number;
  name: string;
  unit: Unit;
  stock: number;
  min_stock: number;
  unit_cost: number;
  supplier: string;
  notes: string;
  low: boolean;
  stock_value: number;
}

export interface Movement {
  id: number;
  delta: number;
  reason: 'compra' | 'pedido' | 'estorno' | 'ajuste';
  order_id: number | null;
  note: string;
  created_at: string;
}

export interface CostLine {
  material_id: number;
  name: string;
  unit: Unit;
  quantity: number;
  unit_cost: number;
  cost: number;
}

export interface CostBreakdown {
  materials_cost: number;
  labor_cost: number;
  machine_cost: number;
  extra_cost: number;
  unit_cost: number;
  margin_pct: number;
  suggested_price: number;
  price: number;
  price_is_custom: boolean;
  profit: number;
  real_margin_pct: number;
  lines: CostLine[];
}

export interface RecipeLine {
  material_id: number;
  quantity: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  labor_minutes: number;
  machine_minutes: number;
  extra_cost: number;
  margin_pct: number | null;
  price: number | null;
  materials: RecipeLine[];
  cost: CostBreakdown;
}

export type ProductInput = Omit<Product, 'id' | 'cost'>;

export interface Customer {
  id: number;
  name: string;
  phone: string;
  notes: string;
  orders_count: number;
  total_bought: number;
  balance: number;
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  labor_minutes: number;
  machine_minutes: number;
}

export interface Payment {
  id: number;
  amount: number;
  method: 'pix' | 'dinheiro' | 'cartao' | 'outro';
  paid_at: string;
}

export interface Shortage {
  material_id: number;
  name: string;
  unit: Unit;
  needed: number;
  stock: number;
  missing: number;
}

export interface Order {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  due_date: string | null;
  notes: string;
  discount: number;
  stock_deducted: number;
  delivered_at: string | null;
  created_at: string;
  items: OrderItem[];
  payments: Payment[];
  subtotal: number;
  total: number;
  cost: number;
  profit: number;
  paid: number;
  balance: number;
  late: boolean;
  shortages: Shortage[];
  forecast?: ScheduleJob | null;
}

export interface OrderInput {
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  due_date: string | null;
  notes: string;
  discount: number;
  items: {
    product_id: number | null;
    product_name?: string;
    quantity: number;
    unit_price: number | null;
    labor_minutes?: number | null;
  }[];
  force?: boolean;
}

export interface Settings {
  business_name: string;
  labor_rate: number;
  machine_rate: number;
  default_margin: number;
  allow_phone: boolean;
}

export interface AppInfo {
  version: string;
  data_dir: string;
  phone_url: string | null;
}

export interface UpdateStatus {
  current: string;
  latest: string | null;
  available: boolean;
  notes: string;
  can_install: boolean;
  page: string;
}

/** Existe quando a tela roda dentro da janela do programa (.exe). */
declare global {
  interface Window {
    pywebview?: { api: { save_backup: () => Promise<string | null>; restart: () => Promise<void> } };
  }
}

export interface OrderBrief {
  id: number;
  customer_name: string | null;
  status: OrderStatus;
  due_date: string | null;
  total: number;
  balance: number;
  late: boolean;
  items: string[];
}

export interface Dashboard {
  open_by_status: Record<'a_fazer' | 'fazendo' | 'pronto', number>;
  late: OrderBrief[];
  due_soon: OrderBrief[];
  to_receive: number;
  received_month: number;
  sold_month: number;
  profit_month: number;
  delivered_month: number;
  shortages: Shortage[];
  low_stock: { id: number; name: string; unit: Unit; stock: number; min_stock: number }[];
  will_be_late: ScheduleJob[];
  has_workers: boolean;
  is_empty: boolean;
}

/* ---------- Agenda ---------- */

export interface Worker {
  id: number;
  name: string;
  /** Horas em cada dia: [seg, ter, qua, qui, sex, sáb, dom] */
  weekly_hours: number[];
  active: boolean;
  week_total: number;
}

export interface WorkerException {
  id: number;
  worker_id: number | null;
  worker_name: string | null;
  start_date: string;
  end_date: string;
  hours: number;
  note: string;
}

export interface ScheduleJob {
  order_id: number | null;
  customer: string | null;
  items: string[];
  status: OrderStatus;
  due_date: string | null;
  labor_hours: number;
  machine_hours: number;
  start_date: string | null;
  finish_date: string | null;
  no_forecast: boolean;
  no_time: boolean;
  slack_days: number | null;
  late: boolean;
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  capacity: number;
  used: number;
  people: { name: string; hours: number }[];
  orders: { order_id: number | null; customer: string | null; hours: number }[];
}

export interface Schedule {
  today: string;
  jobs: ScheduleJob[];
  days: ScheduleDay[];
  machine_hours_per_day: number;
  has_capacity: boolean;
  summary: { orders: number; labor_hours: number; all_done: string | null; late: number };
}

export interface SchedulePreview extends ScheduleJob {
  has_capacity: boolean;
  /** Fica pronto até aqui sem atrasar ninguém (pedido no fim da fila). */
  safe_date: string | null;
  pushes_late: { order_id: number; customer: string | null; due_date: string | null; finish_date: string | null }[];
}

/** Erro da API com a mensagem já em português e, se houver, a lista do que falta. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public shortages: Shortage[] = [],
  ) {
    super(message);
  }
}

function describe(detail: unknown): { message: string; shortages: Shortage[] } {
  if (typeof detail === 'string') return { message: detail, shortages: [] };
  if (Array.isArray(detail)) {
    // Erro de validação do FastAPI: pega o primeiro campo.
    const first = detail[0] as { loc?: string[]; msg?: string } | undefined;
    const field = first?.loc?.slice(1).join('.') ?? '';
    return { message: `Confira o campo ${field}: ${first?.msg ?? 'valor inválido'}`, shortages: [] };
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const d = detail as { message: string; shortages?: Shortage[] };
    return { message: d.message, shortages: d.shortages ?? [] };
  }
  return { message: 'Algo deu errado', shortages: [] };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  const raw = body instanceof Blob;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined || raw ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não consegui falar com o servidor. Ele está rodando?', 0);
  }
  const data = res.status === 204 ? undefined : await res.json().catch(() => null);
  if (!res.ok) {
    const { message, shortages } = describe(data?.detail);
    throw new ApiError(message, res.status, shortages);
  }
  // Algo foi gravado: as telas em cache precisam se atualizar. Simulações não gravam nada.
  if (method !== 'GET' && !path.endsWith('/preview')) afterWrite?.();
  return data as T;
}

let afterWrite: (() => void) | null = null;

/** Chamado depois de toda gravação bem-sucedida (o cache de telas usa para se atualizar). */
export function onWrite(fn: () => void) {
  afterWrite = fn;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: Blob) => request<T>('POST', path, file),
};
