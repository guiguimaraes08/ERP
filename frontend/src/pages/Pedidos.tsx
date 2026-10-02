import { ClipboardList, MessageCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Order, type OrderStatus, type Shortage } from '../api';
import { amount, dayLabel, money, NEXT_STEP, qty, relativeDue, shortDate, STATUS, todayIso, whatsappLink } from '../format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Loading, Modal, PageHeader,
  toNum, useFeedback, useLoad,
} from '../ui';
import { forecastBadge } from './Agenda';
import PedidoForm from './PedidoForm';

const FILTERS: { id: string; label: string }[] = [
  { id: 'abertos', label: 'Em aberto' },
  { id: 'a_fazer', label: 'A fazer' },
  { id: 'fazendo', label: 'Fazendo' },
  { id: 'pronto', label: 'Prontos' },
  { id: 'entregue', label: 'Entregues' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
];

/**
 * Muda o status; se faltar material, pergunta se quer seguir assim mesmo.
 * Devolve o pedido atualizado, ou null se a pessoa desistiu ou deu erro.
 */
export function useChangeStatus() {
  const { toast, confirm, fail } = useFeedback();
  return async (order: Order, to: OrderStatus): Promise<Order | null> => {
    const send = (force: boolean) => api.post<Order>(`/orders/${order.id}/status`, { status: to, force });
    try {
      const updated = await send(false);
      toast(`Pedido #${order.id}: ${STATUS[to].label}`);
      return updated;
    } catch (err) {
      if (err instanceof ApiError && err.shortages.length) {
        const ok = await confirm({
          title: 'Falta material',
          message: <ShortageList shortages={err.shortages} intro="Para fazer esse pedido, falta:" outro="Se você já tem o material e só não registrou, pode seguir. O estoque vai ficar negativo até você ajustar." />,
          confirmLabel: 'Seguir assim mesmo',
        });
        if (!ok) return null;
        try {
          const updated = await send(true);
          toast(`Pedido #${order.id}: ${STATUS[to].label}`);
          return updated;
        } catch (e) {
          fail(e);
          return null;
        }
      }
      fail(err);
      return null;
    }
  };
}

export function ShortageList({ shortages, intro, outro }: { shortages: Shortage[]; intro: string; outro?: string }) {
  return (
    <div className="space-y-2">
      <p>{intro}</p>
      <ul className="rounded-lg bg-warning-soft px-3 py-2 text-sm divide-y divide-warning/20">
        {shortages.map((s) => (
          <li key={s.material_id} className="py-1 flex justify-between gap-3">
            <span>{s.name}</span>
            <span className="num font-semibold whitespace-nowrap">
              faltam {amount(s.missing, s.unit)} <span className="font-normal text-muted">(tem {amount(s.stock, s.unit)})</span>
            </span>
          </li>
        ))}
      </ul>
      {outro && <p className="text-sm text-muted">{outro}</p>}
    </div>
  );
}

export default function Pedidos({ initialStatus, openId }: { initialStatus: string | null; openId: string | null }) {
  const [filter, setFilter] = useState(initialStatus ?? 'abertos');
  const query = filter === 'todos' ? '' : `?status=${filter}`;
  const { data, error, reload } = useLoad<Order[]>(`/orders${query}`);
  const [detailId, setDetailId] = useState<number | null>(openId ? Number(openId) : null);
  const [form, setForm] = useState<Order | 'new' | null>(null);
  const changeStatus = useChangeStatus();

  useEffect(() => {
    if (initialStatus) setFilter(initialStatus);
  }, [initialStatus]);
  useEffect(() => {
    if (openId) setDetailId(Number(openId));
  }, [openId]);

  const closeDetail = () => {
    setDetailId(null);
    if (window.location.hash.includes('id=')) window.history.replaceState(null, '', '#/pedidos');
  };

  const advance = async (order: Order) => {
    const step = NEXT_STEP[order.status];
    if (step && (await changeStatus(order, step.to))) reload();
  };

  return (
    <div>
      <PageHeader
        title="Pedidos"
        action={
          <Button variant="primary" onClick={() => setForm('new')}>
            <Plus className="w-4 h-4" /> Novo pedido
          </Button>
        }
      />

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap pb-1 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`h-9 px-3.5 rounded-full text-sm font-medium whitespace-nowrap border transition-colors cursor-pointer ${
              filter === f.id ? 'bg-ink text-bg border-ink' : 'bg-surface border-line text-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox message={error} />}
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title={filter === 'abertos' ? 'Nenhum pedido em aberto' : 'Nenhum pedido aqui'}
          text="Anote um pedido com o cliente, o que ele quer e o prazo. O preço já vem do produto."
          action={<Button variant="primary" onClick={() => setForm('new')}>Anotar pedido</Button>}
        />
      ) : (
        <div className="space-y-2">
          {data.map((o) => {
            const step = NEXT_STEP[o.status];
            return (
              <Card key={o.id} className="p-4 hover:border-primary/40 transition-colors">
                <button className="w-full text-left cursor-pointer" onClick={() => setDetailId(o.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted text-sm num">#{o.id}</span>
                        <span className="font-semibold">{o.customer_name ?? 'Sem cliente'}</span>
                        <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                      </div>
                      <div className="text-sm text-muted mt-1 truncate">
                        {o.items.map((i) => `${qty(i.quantity)}× ${i.product_name}`).join(', ')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold num">{money(o.total)}</div>
                      {o.balance > 0.009 ? (
                        <div className="text-xs text-warning font-medium">falta {money(o.balance)}</div>
                      ) : (
                        o.status !== 'cancelado' && <div className="text-xs text-success font-medium">pago</div>
                      )}
                    </div>
                  </div>
                </button>
                {(o.status !== 'entregue' && o.status !== 'cancelado') && (
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
                    <span className={`text-sm ${o.late ? 'text-danger font-semibold' : 'text-muted'}`}>
                      {o.late ? 'Atrasado · ' : ''}{relativeDue(o.due_date)}
                      {o.forecast?.finish_date && !o.late && (
                        <span className={o.forecast.late ? 'text-danger font-medium' : ''}>
                          {' · '}fica pronto {dayLabel(o.forecast.finish_date)}{o.forecast.late ? ' (vai atrasar)' : ''}
                        </span>
                      )}
                      {o.shortages.length > 0 && <span className="text-warning font-medium"> · falta material</span>}
                    </span>
                    {step && (
                      <Button size="sm" variant={o.status === 'pronto' ? 'primary' : 'secondary'} onClick={() => advance(o)}>
                        {step.label}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {detailId !== null && (
        <OrderDetail
          id={detailId}
          onClose={closeDetail}
          onChanged={reload}
          onEdit={(o) => (closeDetail(), setForm(o))}
        />
      )}
      {form && (
        <PedidoForm
          order={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={(o) => {
            setForm(null);
            reload();
            setDetailId(o.id);
          }}
        />
      )}
    </div>
  );
}

const METHOD_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', outro: 'Outro' } as const;

function OrderDetail({ id, onClose, onChanged, onEdit }: { id: number; onClose: () => void; onChanged: () => void; onEdit: (o: Order) => void }) {
  const { data: order, error, setData } = useLoad<Order>(`/orders/${id}`);
  const { toast, confirm, fail } = useFeedback();
  const changeStatus = useChangeStatus();
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<keyof typeof METHOD_LABEL>('pix');
  const [payDate, setPayDate] = useState(todayIso());

  useEffect(() => {
    if (order) setPayAmount(order.balance > 0 ? String(order.balance) : '');
  }, [order?.balance]);

  if (error) return <Modal title={`Pedido #${id}`} onClose={onClose}><ErrorBox message={error} /></Modal>;
  if (!order) return <Modal title={`Pedido #${id}`} onClose={onClose}><Loading /></Modal>;

  const update = (o: Order | null) => {
    if (!o) return;
    setData(o);
    onChanged();
  };

  const setStatus = async (to: OrderStatus) => update(await changeStatus(order, to));

  const addPayment = async (e: FormEvent) => {
    e.preventDefault();
    try {
      update(await api.post<Order>(`/orders/${order.id}/payments`, { amount: toNum(payAmount), method: payMethod, paid_at: payDate }));
      toast('Pagamento registrado');
    } catch (err) {
      fail(err);
    }
  };

  const removePayment = async (paymentId: number) => {
    if (!(await confirm({ title: 'Apagar pagamento?', message: 'Esse valor volta a ficar "a receber".', confirmLabel: 'Apagar', danger: true }))) return;
    try {
      update(await api.del<Order>(`/orders/${order.id}/payments/${paymentId}`));
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Excluir pedido #${order.id}?`,
      message: order.stock_deducted
        ? 'O material que já tinha saído do estoque volta para ele. Pagamentos registrados também são apagados.'
        : 'Pagamentos registrados também são apagados. Se o cliente desistiu, prefira "Cancelado" para manter o histórico.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/orders/${order.id}`);
      toast('Pedido excluído');
      onChanged();
      onClose();
    } catch (err) {
      fail(err);
    }
  };

  const items = order.items.map((i) => `${qty(i.quantity)}× ${i.product_name}`).join(', ');
  const firstName = (order.customer_name ?? '').split(' ')[0];
  const message =
    order.status === 'pronto'
      ? `Oi ${firstName}! Seu pedido (${items}) está pronto! 🎉${order.balance > 0 ? ` Falta pagar ${money(order.balance)}.` : ''}`
      : `Oi ${firstName}! Sobre seu pedido (${items})`;
  const wa = whatsappLink(order.customer_phone, message);
  const step = NEXT_STEP[order.status];

  return (
    <Modal
      title={`Pedido #${order.id}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={remove} className="mr-auto"><Trash2 className="w-4 h-4" /> Excluir</Button>
          <Button onClick={() => onEdit(order)}><Pencil className="w-4 h-4" /> Editar</Button>
          {step && <Button variant="primary" onClick={() => setStatus(step.to)}>{step.label}</Button>}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-lg">{order.customer_name ?? 'Sem cliente'}</div>
            <div className={`text-sm ${order.late ? 'text-danger font-semibold' : 'text-muted'}`}>
              {order.due_date ? `Entrega ${shortDate(order.due_date)} (${relativeDue(order.due_date).toLowerCase()})` : 'Sem prazo'}
              {order.late && ' · atrasado'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-success-soft text-success text-sm font-medium">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            )}
            <select
              className={`${inputCls} h-9 w-auto text-sm`}
              value={order.status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              aria-label="Status"
            >
              {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        {order.forecast && (
          <a
            href="#/agenda"
            className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${order.forecast.late ? 'bg-danger-soft text-danger' : 'bg-info-soft text-info'}`}
          >
            <span>
              {order.forecast.finish_date
                ? <>Pela agenda, fica pronto <b>{dayLabel(order.forecast.finish_date)}</b></>
                : 'Sem previsão: cadastre os horários de trabalho na Agenda'}
            </span>
            <span className="font-semibold whitespace-nowrap">{forecastBadge(order.forecast).label}</span>
          </a>
        )}

        {order.shortages.length > 0 && (
          <ShortageList shortages={order.shortages} intro="Atenção: para começar este pedido falta material." />
        )}

        <div>
          <ul className="divide-y divide-line border-y border-line">
            {order.items.map((i) => (
              <li key={i.id} className="py-2 flex justify-between gap-3 text-[15px]">
                <span>{qty(i.quantity)}× {i.product_name} <span className="text-muted text-sm">({money(i.unit_price)})</span></span>
                <span className="num font-medium">{money(i.quantity * i.unit_price)}</span>
              </li>
            ))}
          </ul>
          <div className="text-sm space-y-1 mt-2">
            {order.discount > 0 && (
              <div className="flex justify-between text-muted"><span>Desconto</span><span className="num">− {money(order.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="num">{money(order.total)}</span></div>
            <div className="flex justify-between text-muted"><span>Custo estimado</span><span className="num">{money(order.cost)}</span></div>
            <div className={`flex justify-between ${order.profit < 0 ? 'text-danger' : 'text-success'}`}><span>Sobra</span><span className="num font-medium">{money(order.profit)}</span></div>
          </div>
          {order.notes && <p className="mt-3 text-sm bg-surface-2 rounded-lg px-3 py-2 whitespace-pre-wrap">{order.notes}</p>}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="font-semibold">Pagamentos</h3>
            <span className={`text-sm font-medium ${order.balance > 0.009 ? 'text-warning' : 'text-success'}`}>
              {order.balance > 0.009 ? `Falta ${money(order.balance)}` : order.status === 'cancelado' ? '' : 'Tudo pago'}
            </span>
          </div>
          {order.payments.length > 0 && (
            <ul className="mb-3 space-y-1">
              {order.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm bg-surface-2 rounded-lg px-3 py-2">
                  <span>{shortDate(p.paid_at)} · {METHOD_LABEL[p.method]}</span>
                  <span className="flex items-center gap-2">
                    <b className="num">{money(p.amount)}</b>
                    <button onClick={() => removePayment(p.id)} className="text-muted hover:text-danger cursor-pointer" aria-label="Apagar pagamento"><X className="w-4 h-4" /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {order.status !== 'cancelado' && order.balance > 0.009 && (
            <form onSubmit={addPayment} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-2 items-end">
              <Field label="Valor (R$)">
                <input className={inputCls} inputMode="decimal" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </Field>
              <Field label="Como">
                <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value as keyof typeof METHOD_LABEL)}>
                  {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Quando">
                <input type="date" className={inputCls} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary">Recebi</Button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
