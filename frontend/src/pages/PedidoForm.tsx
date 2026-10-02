import { CalendarCheck, Plus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Customer, type Order, type OrderInput, type Product, type SchedulePreview } from '../api';
import { dayLabel, hours, money, todayIso } from '../format';
import { Button, Field, inputCls, Loading, Modal, toNum, useFeedback, useLoad } from '../ui';
import { ShortageList } from './Pedidos';

interface Line {
  product: string; // id do produto, ou 'avulso'
  name: string;
  quantity: string;
  price: string; // vazio = preço do produto
  minutes: string; // item avulso: minutos de trabalho por unidade
}

const AVULSO = 'avulso';
const EMPTY_LINE: Line = { product: '', name: '', quantity: '1', price: '', minutes: '' };

export default function PedidoForm({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: (o: Order) => void }) {
  const products = useLoad<Product[]>('/products');
  const customers = useLoad<Customer[]>('/customers');
  const { toast, confirm, fail } = useFeedback();

  const [customerName, setCustomerName] = useState(order?.customer_name ?? '');
  const [phone, setPhone] = useState('');
  const [dueDate, setDueDate] = useState(order ? order.due_date ?? '' : todayIso(7));
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [discount, setDiscount] = useState(order?.discount ? String(order.discount) : '');
  const [lines, setLines] = useState<Line[]>(
    order?.items.map((i) => ({
      product: i.product_id ? String(i.product_id) : AVULSO,
      name: i.product_name,
      quantity: String(i.quantity),
      price: String(i.unit_price),
      minutes: i.product_id ? '' : String(i.labor_minutes || ''),
    })) ?? [{ ...EMPTY_LINE }],
  );
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);

  // Previsão ao vivo: "se eu aceitar este pedido agora, quando fica pronto?"
  const showForecast = !order || order.status === 'a_fazer' || order.status === 'fazendo';
  const previewKey = JSON.stringify({
    items: lines
      .filter((l) => l.product && toNum(l.quantity) > 0)
      .map((l) =>
        l.product === AVULSO
          ? { product_id: null, product_name: l.name || 'Item', quantity: toNum(l.quantity), unit_price: 0, labor_minutes: toNum(l.minutes) }
          : { product_id: Number(l.product), quantity: toNum(l.quantity) },
      ),
    due_date: dueDate || null,
    order_id: order?.id ?? null,
  });
  useEffect(() => {
    const body = JSON.parse(previewKey);
    if (!showForecast || body.items.length === 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api.post<SchedulePreview>('/schedule/preview', body).then(setPreview).catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [previewKey, showForecast]);

  if (!products.data || !customers.data) {
    return <Modal title={order ? `Editar pedido #${order.id}` : 'Novo pedido'} onClose={onClose}><Loading /></Modal>;
  }
  const productList = products.data;
  const existing = customers.data.find((c) => c.name.toLowerCase() === customerName.trim().toLowerCase());

  const productOf = (line: Line) => productList.find((p) => String(p.id) === line.product);
  const priceOf = (line: Line) => (line.price.trim() !== '' ? toNum(line.price) : productOf(line)?.cost.price ?? 0);
  const subtotal = lines.reduce((acc, l) => acc + toNum(l.quantity) * priceOf(l), 0);
  const cost = lines.reduce((acc, l) => acc + toNum(l.quantity) * (productOf(l)?.cost.unit_cost ?? 0), 0);
  const total = Math.max(subtotal - toNum(discount), 0);

  const setLine = (idx: number, patch: Partial<Line>) => setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const save = async (e: FormEvent, force = false) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.product && toNum(l.quantity) > 0);
    if (valid.length === 0) {
      toast('Adicione pelo menos um item', 'danger');
      return;
    }
    const body: OrderInput = {
      customer_id: existing?.id ?? null,
      customer_name: existing ? undefined : customerName.trim() || undefined,
      customer_phone: existing ? undefined : phone,
      due_date: dueDate || null,
      notes,
      discount: toNum(discount),
      items: valid.map((l) =>
        l.product === AVULSO
          ? { product_id: null, product_name: l.name, quantity: toNum(l.quantity), unit_price: toNum(l.price), labor_minutes: toNum(l.minutes) }
          : { product_id: Number(l.product), quantity: toNum(l.quantity), unit_price: l.price.trim() !== '' ? toNum(l.price) : null },
      ),
      force,
    };
    setSaving(true);
    try {
      const saved = order ? await api.put<Order>(`/orders/${order.id}`, body) : await api.post<Order>('/orders', body);
      toast(order ? 'Pedido atualizado' : `Pedido #${saved.id} anotado`);
      onSaved(saved);
    } catch (err) {
      // Editar um pedido em andamento pode pedir mais material do que tem.
      if (err instanceof ApiError && err.shortages.length) {
        const ok = await confirm({
          title: 'Falta material',
          message: <ShortageList shortages={err.shortages} intro="Com essa mudança, falta:" />,
          confirmLabel: 'Salvar assim mesmo',
        });
        if (ok) return save(e, true);
      } else {
        fail(err);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={order ? `Editar pedido #${order.id}` : 'Novo pedido'}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-sm">
            Total <b className="num text-base">{money(total)}</b>
            {cost > 0 && <span className="text-muted"> · sobra {money(total - cost)}</span>}
          </span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="order-form" disabled={saving}>Salvar pedido</Button>
        </>
      }
    >
      <form id="order-form" onSubmit={(e) => save(e)} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Cliente" hint={customerName.trim() && !existing ? 'Cliente novo: vai ser cadastrado' : undefined}>
            <input className={inputCls} list="customer-list" autoFocus value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome (opcional)" />
            <datalist id="customer-list">
              {customers.data.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </Field>
          {customerName.trim() && !existing ? (
            <Field label="WhatsApp (opcional)">
              <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 98765-4321" />
            </Field>
          ) : (
            <Field label="Entregar até">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          )}
          {customerName.trim() && !existing && (
            <Field label="Entregar até">
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          )}
        </div>

        <div>
          <div className="text-sm font-medium mb-1.5">O que o cliente quer</div>
          {productList.length === 0 && (
            <p className="text-sm text-muted mb-2">
              Dica: cadastre seus <a href="#/produtos" className="text-primary underline" onClick={onClose}>produtos</a> para o preço e o material virem sozinhos. Por enquanto, use “item avulso”.
            </p>
          )}
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const product = productOf(line);
              return (
                <div key={idx} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_120px_auto] gap-2 items-start p-2 sm:p-0 rounded-lg bg-surface-2 sm:bg-transparent">
                  <div className="col-span-1 space-y-2">
                    <select className={inputCls} value={line.product} onChange={(e) => setLine(idx, { product: e.target.value, price: '' })}>
                      <option value="">Escolha…</option>
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} · {money(p.cost.price)}</option>
                      ))}
                      <option value={AVULSO}>Item avulso (sem receita)</option>
                    </select>
                    {line.product === AVULSO && (
                      <div className="grid grid-cols-[1fr_130px] gap-2">
                        <input className={inputCls} required placeholder="Descrição do item" value={line.name} onChange={(e) => setLine(idx, { name: e.target.value })} />
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          aria-label="Minutos de trabalho por unidade"
                          placeholder="min de trabalho"
                          title="Minutos de trabalho por unidade (para a agenda)"
                          value={line.minutes}
                          onChange={(e) => setLine(idx, { minutes: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                    className="sm:order-last p-2 h-10 rounded-lg text-muted hover:text-danger hover:bg-danger-soft cursor-pointer"
                    aria-label="Tirar item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="col-span-2 sm:col-span-1 grid grid-cols-2 sm:contents gap-2">
                    <input className={inputCls} inputMode="decimal" aria-label="Quantidade" placeholder="Qtd" value={line.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} />
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      aria-label="Preço por unidade"
                      required={line.product === AVULSO}
                      placeholder={product ? money(product.cost.price) : 'R$ cada'}
                      value={line.price}
                      onChange={(e) => setLine(idx, { price: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            <Plus className="w-4 h-4" /> Mais um item
          </Button>
        </div>

        {preview && <Forecast preview={preview} dueDate={dueDate} onUseDate={setDueDate} onClose={onClose} />}

        <div className="grid sm:grid-cols-[160px_1fr] gap-3">
          <Field label="Desconto (R$)">
            <input className={inputCls} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Observações">
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cor, nome para gravar, endereço…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function Forecast({ preview, dueDate, onUseDate, onClose }: {
  preview: SchedulePreview;
  dueDate: string;
  onUseDate: (iso: string) => void;
  onClose: () => void;
}) {
  if (!preview.has_capacity) {
    return (
      <p className="text-sm rounded-lg bg-surface-2 px-3 py-2 text-muted">
        Quer saber quando fica pronto? Cadastre os horários de trabalho na{' '}
        <a href="#/agenda?aba=horarios" className="text-primary underline" onClick={onClose}>Agenda</a>.
      </p>
    );
  }
  if (preview.no_time) {
    return (
      <p className="text-sm rounded-lg bg-warning-soft text-warning px-3 py-2">
        Esses produtos estão sem minutos de trabalho cadastrados, então a agenda não consegue prever a entrega.
      </p>
    );
  }
  if (preview.no_forecast || !preview.finish_date) {
    return (
      <p className="text-sm rounded-lg bg-danger-soft text-danger px-3 py-2">
        Não cabe na agenda: as horas de trabalho cadastradas não dão conta. Confira os horários na Agenda.
      </p>
    );
  }

  const late = preview.late && !!dueDate;
  const suggest = preview.safe_date && (late || !dueDate || preview.pushes_late.length > 0) ? preview.safe_date : null;

  return (
    <div className={`rounded-lg px-3 py-3 text-sm space-y-2 ${late ? 'bg-danger-soft' : 'bg-info-soft'}`}>
      <div className={`flex items-start gap-2 ${late ? 'text-danger' : 'text-info'}`}>
        <CalendarCheck className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Pela agenda, fica pronto <b>{dayLabel(preview.finish_date)}</b> ({hours(preview.labor_hours)} de trabalho
          {preview.machine_hours > 0 && <> + {hours(preview.machine_hours)} de máquina</>}).
          {late && <> Não dá tempo até {dayLabel(dueDate)}.</>}
        </span>
      </div>
      {preview.pushes_late.length > 0 && (
        <p className="text-warning">
          Com esse prazo ele passa na frente e atrasa:{' '}
          {preview.pushes_late.map((p) => `#${p.order_id} ${p.customer ?? ''}`.trim()).join(', ')}.
        </p>
      )}
      {suggest && suggest !== dueDate && (
        <Button size="sm" onClick={() => onUseDate(suggest)}>
          Combinar entrega para {dayLabel(suggest)}
        </Button>
      )}
    </div>
  );
}
