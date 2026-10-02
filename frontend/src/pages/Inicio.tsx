import { AlertTriangle, ArrowRight, CalendarClock, CalendarDays, Clock, PackageX, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { go } from '../App';
import { api, type Dashboard, type OrderBrief, type Settings } from '../api';
import { amount, dayLabel, money, relativeDue, STATUS } from '../format';
import { Badge, Button, Card, ErrorBox, Loading, useFeedback, useLoad } from '../ui';

export default function Inicio({ settings }: { settings: Settings | null }) {
  const { data, error, reload } = useLoad<Dashboard>('/dashboard');
  const { toast, fail } = useFeedback();
  const [loadingDemo, setLoadingDemo] = useState(false);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      await api.post('/demo');
      toast('Exemplo carregado. Fique à vontade para mexer!');
      reload();
    } catch (e) {
      fail(e);
    } finally {
      setLoadingDemo(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const month = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}!</h1>
        <p className="text-muted">{settings?.business_name}</p>
      </div>

      {data.is_empty && (
        <Card className="p-5 sm:p-6 border-primary/30 bg-primary-soft/40">
          <h2 className="text-lg font-semibold">Vamos começar?</h2>
          <ol className="mt-3 space-y-2 text-[15px]">
            <li><b>1.</b> Cadastre seus <a className="text-primary font-medium underline" href="#/estoque">insumos</a> (filamento, fita, fecho…) com quanto você paga.</li>
            <li><b>2.</b> Monte seus <a className="text-primary font-medium underline" href="#/produtos">produtos</a>: o sistema calcula o custo e sugere o preço.</li>
            <li><b>3.</b> Anote os <a className="text-primary font-medium underline" href="#/pedidos">pedidos</a>. O material sai do estoque quando você começa a fazer.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => go('estoque')}>Cadastrar meu primeiro insumo</Button>
            <Button onClick={loadDemo} disabled={loadingDemo}>
              <Sparkles className="w-4 h-4" /> Ver com dados de exemplo
            </Button>
          </div>
        </Card>
      )}

      {!data.is_empty && !data.has_workers && (
        <a href="#/agenda?aba=horarios" className="flex items-center gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-info">
          <Clock className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-sm">
            <b>Novo: Agenda.</b> Diga quantas horas por dia você trabalha e o sistema mostra quando cada pedido fica pronto.
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </a>
      )}

      {data.will_be_late.length > 0 && (
        <Card className="p-4 border-danger/40">
          <h3 className="font-semibold flex items-center justify-between gap-2 mb-3">
            <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-danger" /> Pela agenda, vão atrasar</span>
            <a href="#/agenda" className="text-sm text-primary font-medium">Ver agenda</a>
          </h3>
          <ul className="divide-y divide-line">
            {data.will_be_late.map((j) => (
              <li key={j.order_id}>
                <a href={`#/pedidos?id=${j.order_id}`} className="py-2 flex items-center justify-between gap-3 text-sm hover:text-primary">
                  <span className="min-w-0">
                    <span className="font-medium">#{j.order_id} {j.customer ?? 'Sem cliente'}</span>
                    <span className="block text-muted truncate">{j.items.join(', ')}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-danger font-medium">
                      {j.finish_date ? `pronto ${dayLabel(j.finish_date)}` : 'sem previsão'}
                    </span>
                    <span className="block text-xs text-muted">prazo {dayLabel(j.due_date)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Dinheiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="A receber" value={money(data.to_receive)} hint="de pedidos ainda não pagos" tone={data.to_receive > 0 ? 'warning' : undefined} />
        <Stat label={`Recebido em ${month}`} value={money(data.received_month)} hint="pagamentos que entraram" />
        <Stat label={`Vendido em ${month}`} value={money(data.sold_month)} hint={`${data.delivered_month} pedido(s) entregue(s)`} />
        <Stat label={`Lucro em ${month}`} value={money(data.profit_month)} hint="vendido − custo dos entregues" tone={data.profit_month < 0 ? 'danger' : 'success'} />
      </div>

      {/* Pedidos em aberto */}
      <div className="grid grid-cols-3 gap-3">
        {(['a_fazer', 'fazendo', 'pronto'] as const).map((s) => (
          <a key={s} href={`#/pedidos?status=${s}`} className="group">
            <Card className="p-4 group-hover:border-primary/50 transition-colors">
              <div className="text-3xl font-bold num">{data.open_by_status[s]}</div>
              <div className="text-sm text-muted flex items-center gap-1">
                {STATUS[s].label} <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          </a>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <OrderList
          title="Atrasados"
          icon={<AlertTriangle className="w-4 h-4 text-danger" />}
          orders={data.late}
          empty="Nenhum pedido atrasado."
        />
        <OrderList
          title="Entregar nos próximos 3 dias"
          icon={<CalendarClock className="w-4 h-4 text-info" />}
          orders={data.due_soon}
          empty="Nada com prazo apertado."
        />

        <Card className="p-4">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <PackageX className="w-4 h-4 text-warning" /> Vai faltar para os pedidos “a fazer”
          </h3>
          {data.shortages.length === 0 ? (
            <p className="text-sm text-muted">O estoque dá conta dos pedidos que ainda não começaram.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.shortages.map((s) => (
                <li key={s.material_id} className="py-2 flex justify-between gap-3 text-sm">
                  <span>{s.name}</span>
                  <span className="text-danger font-medium num whitespace-nowrap">faltam {amount(s.missing, s.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold flex items-center justify-between gap-2 mb-3">
            <span className="flex items-center gap-2"><PackageX className="w-4 h-4 text-warning" /> Estoque acabando</span>
            {data.low_stock.length > 0 && (
              <a href="#/estoque?filtro=baixo" className="text-sm text-primary font-medium">Ver estoque</a>
            )}
          </h3>
          {data.low_stock.length === 0 ? (
            <p className="text-sm text-muted">Tudo acima do mínimo.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.low_stock.map((m) => (
                <li key={m.id} className="py-2 flex justify-between gap-3 text-sm">
                  <span>{m.name}</span>
                  <span className="num whitespace-nowrap">
                    <b className={m.stock <= 0 ? 'text-danger' : 'text-warning'}>{amount(m.stock, m.unit)}</b>
                    <span className="text-muted"> / mín. {amount(m.min_stock, m.unit)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'warning' | 'success' | 'danger' }) {
  const color = tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : '';
  return (
    <Card className="p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold num mt-1 ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{hint}</div>
    </Card>
  );
}

function OrderList({ title, icon, orders, empty }: { title: string; icon: ReactNode; orders: OrderBrief[]; empty: string }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold flex items-center gap-2 mb-3">{icon} {title}</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id}>
              <a href={`#/pedidos?id=${o.id}`} className="py-2 flex items-center justify-between gap-3 text-sm hover:text-primary">
                <span className="min-w-0">
                  <span className="font-medium">#{o.id} {o.customer_name ?? 'Sem cliente'}</span>
                  <span className="block text-muted truncate">{o.items.join(', ')}</span>
                </span>
                <span className="text-right shrink-0">
                  <Badge tone={o.late ? 'danger' : 'info'}>{relativeDue(o.due_date)}</Badge>
                  <span className="block text-xs text-muted mt-0.5">{STATUS[o.status].label}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
