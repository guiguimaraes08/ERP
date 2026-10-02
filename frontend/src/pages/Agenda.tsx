import { CalendarDays, CalendarOff, Clock, Plus, Printer, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { go } from '../App';
import { api, type Schedule, type ScheduleDay, type ScheduleJob, type Worker, type WorkerException } from '../api';
import { dayLabel, hours, relativeDue, STATUS, todayIso, type Tone } from '../format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Loading, PageHeader,
  slide, toNum, useFeedback, useLoad,
} from '../ui';

type Tab = 'fila' | 'dias' | 'horarios';
const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Selo de prazo: folga, no limite, atraso… */
export function forecastBadge(job: ScheduleJob): { tone: Tone; label: string } {
  if (job.no_time) return { tone: 'warning', label: 'Sem tempo cadastrado' };
  if (job.no_forecast) return { tone: 'danger', label: 'Sem previsão' };
  if (job.slack_days === null) return { tone: 'muted', label: 'Sem prazo' };
  if (job.slack_days < 0) return { tone: 'danger', label: `Atrasa ${plural(-job.slack_days, 'dia', 'dias')}` };
  if (job.slack_days === 0) return { tone: 'warning', label: 'No limite' };
  return { tone: 'success', label: `Folga de ${plural(job.slack_days, 'dia', 'dias')}` };
}

export default function Agenda({ initialTab }: { initialTab: string | null }) {
  const { data, error, reload } = useLoad<Schedule>('/schedule');
  const [tab, setTab] = useState<Tab>(initialTab === 'horarios' || initialTab === 'dias' ? initialTab : 'fila');

  useEffect(() => {
    if (initialTab === 'horarios' || initialTab === 'dias' || initialTab === 'fila') setTab(initialTab);
  }, [initialTab]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const { summary } = data;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'fila', label: 'Fila' },
    { id: 'dias', label: 'Dia a dia' },
    { id: 'horarios', label: 'Horários' },
  ];

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Quando cada pedido fica pronto, pelas horas de trabalho de cada dia" />

      {data.has_capacity && summary.orders > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
          <Card className="p-3 sm:p-4">
            <div className="text-sm text-muted">Na fila</div>
            <div className="text-lg sm:text-xl font-bold num mt-0.5">{summary.orders}</div>
            <div className="text-xs text-muted">{summary.orders === 1 ? 'pedido' : 'pedidos'} · {hours(summary.labor_hours)}</div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-sm text-muted">Tudo pronto</div>
            <div className="text-lg sm:text-xl font-bold mt-0.5">{summary.all_done ? dayLabel(summary.all_done) : '—'}</div>
            <div className="text-xs text-muted">{summary.all_done ? relativeDue(summary.all_done).toLowerCase() : 'sem previsão'}</div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="text-sm text-muted">Vão atrasar</div>
            <div className={`text-lg sm:text-xl font-bold num mt-0.5 ${summary.late ? 'text-danger' : 'text-success'}`}>{summary.late}</div>
            <div className="text-xs text-muted">{summary.late ? 'veja na fila' : 'tudo dentro do prazo'}</div>
          </Card>
        </div>
      )}

      <div className="flex gap-1 p-1 mb-4 rounded-xl bg-surface-2 border border-line overflow-x-auto [scrollbar-width:none]" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              const from = tabs.findIndex((x) => x.id === tab);
              const to = tabs.findIndex((x) => x.id === t.id);
              slide(to > from ? 'forward' : to < from ? 'back' : 'none', () => setTab(t.id), 'tab');
            }}
            className={`flex-1 h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
              tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-panel">
      {tab !== 'horarios' && !data.has_capacity ? (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="Falta dizer quando você trabalha"
          text="Cadastre quem trabalha e quantas horas em cada dia da semana. Com isso a agenda calcula quando cada pedido fica pronto."
          action={<Button variant="primary" onClick={() => setTab('horarios')}>Cadastrar horários</Button>}
        />
      ) : tab === 'fila' ? (
        <Queue schedule={data} />
      ) : tab === 'dias' ? (
        <Days days={data.days} today={data.today} />
      ) : (
        <Hours machineHours={data.machine_hours_per_day} onChanged={reload} />
      )}
      </div>
    </div>
  );
}

/* ---------- Fila ---------- */

function dayIndex(today: string, iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000);
}

function Queue({ schedule }: { schedule: Schedule }) {
  const { jobs, days, today } = schedule;
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="w-6 h-6" />}
        title="Nenhum pedido na fila"
        text="Pedidos “a fazer” e “fazendo” aparecem aqui, na ordem em que vão ser feitos."
      />
    );
  }
  const n = days.length;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted mb-3">
        Ordem de produção: primeiro o que já está sendo feito, depois o prazo mais perto. Toque num pedido para abrir.
      </p>
      {jobs.map((job, pos) => {
        const badge = forecastBadge(job);
        const start = job.start_date ? Math.max(0, dayIndex(today, job.start_date)) : null;
        const end = job.finish_date ? dayIndex(today, job.finish_date) : null;
        const due = job.due_date ? dayIndex(today, job.due_date) : null;
        return (
          <Card key={job.order_id ?? 'novo'} className="p-4 hover:border-primary/40 transition-colors">
            <button className="w-full text-left cursor-pointer" onClick={() => go('pedidos', { id: String(job.order_id) })}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-surface-2 text-xs font-bold flex items-center justify-center num">{pos + 1}</span>
                    <span className="font-semibold">#{job.order_id} {job.customer ?? 'Sem cliente'}</span>
                    {job.status === 'fazendo' && <Badge tone={STATUS.fazendo.tone}>Fazendo</Badge>}
                  </div>
                  <div className="text-sm text-muted mt-1 truncate">{job.items.join(', ')}</div>
                </div>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>

              <div className={`grid grid-cols-2 gap-2 mt-3 text-sm ${job.machine_hours > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                <Info label="Trabalho" value={hours(job.labor_hours)} />
                {job.machine_hours > 0 && <Info label="Máquina" value={hours(job.machine_hours)} />}
                <Info label="Começa" value={job.start_date ? dayLabel(job.start_date) : '—'} />
                <Info label="Fica pronto" value={job.finish_date ? dayLabel(job.finish_date) : '—'} strong />
                <Info label="Prazo" value={job.due_date ? dayLabel(job.due_date) : 'sem prazo'} />
              </div>

              {/* Linha do tempo: barra = dias de trabalho, traço = prazo */}
              {start !== null && end !== null && (
                <div className="relative h-2 mt-3 rounded-full bg-surface-2" aria-hidden>
                  <div
                    className={`absolute inset-y-0 rounded-full ${job.late ? 'bg-danger' : 'bg-primary'}`}
                    style={{ left: `${(start / n) * 100}%`, width: `${(Math.max(1, Math.min(end, n - 1) - start + 1) / n) * 100}%` }}
                  />
                  {due !== null && due < n && (
                    <div
                      className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink"
                      style={{ left: due < 0 ? '0' : `calc(${((due + 1) / n) * 100}% - 1px)` }}
                      title="Prazo"
                    />
                  )}
                </div>
              )}
              {job.no_time && (
                <p className="text-xs text-warning mt-2">
                  Os produtos deste pedido estão sem minutos de trabalho. Preencha nos Produtos para a previsão ficar certa.
                </p>
              )}
            </button>
          </Card>
        );
      })}
      <p className="text-xs text-muted pt-2">
        A barra mostra os dias em que o pedido vai ser feito; o traço escuro é o prazo. Pedido “fazendo” conta como se faltasse ele inteiro.
      </p>
    </div>
  );
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={strong ? 'font-semibold' : ''}>{value}</div>
    </div>
  );
}

/* ---------- Dia a dia ---------- */

function Days({ days, today }: { days: ScheduleDay[]; today: string }) {
  return (
    <div className="space-y-2">
      {days.map((d) => {
        const off = d.capacity <= 0;
        const pct = off ? 0 : Math.min(100, (d.used / d.capacity) * 100);
        const free = Math.max(d.capacity - d.used, 0);
        return (
          <Card key={d.date} className={`p-3 sm:p-4 ${d.date === today ? 'border-primary/50' : ''} ${off ? 'opacity-70' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs uppercase text-muted font-semibold">{d.weekday}</div>
                <div className="text-lg font-bold num leading-tight">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</div>
                {d.date === today && <div className="text-[10px] font-bold text-primary">HOJE</div>}
              </div>
              <div className="flex-1 min-w-0">
                {off ? (
                  <div className="text-sm text-muted flex items-center gap-1.5"><CalendarOff className="w-4 h-4" /> Folga</div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm mb-1.5 gap-2">
                      <span className="text-muted truncate">{d.people.map((p) => `${p.name} ${hours(p.hours)}`).join(' · ')}</span>
                      <span className="whitespace-nowrap">
                        <b className="num">{hours(d.used)}</b><span className="text-muted"> de {hours(d.capacity)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 99.9 ? 'bg-primary' : 'bg-primary/60'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.orders.map((o) => (
                        <a key={o.order_id} href={`#/pedidos?id=${o.order_id}`} className="text-xs rounded-md bg-surface-2 px-2 py-1 hover:text-primary">
                          #{o.order_id} {o.customer ?? ''} · <b>{hours(o.hours)}</b>
                        </a>
                      ))}
                      {free > 0.01 && <span className="text-xs rounded-md bg-success-soft text-success px-2 py-1">livre {hours(free)}</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Horários ---------- */

const PRESETS: { label: string; week: number[] }[] = [
  { label: 'Seg a sex 8h', week: [8, 8, 8, 8, 8, 0, 0] },
  { label: 'Seg a sex 6h + sáb 4h', week: [6, 6, 6, 6, 6, 4, 0] },
  { label: 'Só fim de semana 4h', week: [0, 0, 0, 0, 0, 4, 4] },
  { label: 'Todo dia 4h', week: [4, 4, 4, 4, 4, 4, 4] },
];

function Hours({ machineHours, onChanged }: { machineHours: number; onChanged: () => void }) {
  const workers = useLoad<Worker[]>('/workers');
  const exceptions = useLoad<WorkerException[]>('/workers/exceptions');
  const [adding, setAdding] = useState(false);

  const changed = () => {
    workers.reload();
    exceptions.reload();
    onChanged();
  };

  if (!workers.data || !exceptions.data) return <Loading />;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-lg">Quem trabalha</h2>
            <p className="text-sm text-muted">Quantas horas por dia cada pessoa dedica à produção.</p>
          </div>
          {!adding && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <UserPlus className="w-4 h-4" /> Adicionar pessoa
            </Button>
          )}
        </div>
        <div className="space-y-3">
          {adding && (
            <WorkerCard
              worker={null}
              onDone={() => {
                setAdding(false);
                changed();
              }}
              onCancel={() => setAdding(false)}
            />
          )}
          {workers.data.map((w) => (
            <WorkerCard key={w.id} worker={w} onDone={changed} />
          ))}
          {workers.data.length === 0 && !adding && (
            <Card className="p-5 text-center text-muted text-sm">Ninguém cadastrado ainda.</Card>
          )}
        </div>
      </section>

      <ExceptionsSection workers={workers.data} items={exceptions.data} onChanged={changed} />
      <MachineSection initial={machineHours} onChanged={onChanged} />
    </div>
  );
}

function WorkerCard({ worker, onDone, onCancel }: { worker: Worker | null; onDone: () => void; onCancel?: () => void }) {
  const { toast, confirm, fail } = useFeedback();
  const [name, setName] = useState(worker?.name ?? '');
  const [week, setWeek] = useState<string[]>((worker?.weekly_hours ?? [8, 8, 8, 8, 8, 0, 0]).map(String));
  const [active, setActive] = useState(worker?.active ?? true);
  const [saving, setSaving] = useState(false);

  const total = week.reduce((acc, h) => acc + toNum(h), 0);
  const dirty =
    !worker || name !== worker.name || active !== worker.active || week.some((h, i) => toNum(h) !== worker.weekly_hours[i]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name, weekly_hours: week.map(toNum), active };
      if (worker) await api.put(`/workers/${worker.id}`, body);
      else await api.post('/workers', body);
      toast(worker ? 'Horário salvo' : `${name} adicionado(a)`);
      onDone();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!worker) return;
    if (!(await confirm({ title: `Tirar ${worker.name}?`, message: 'As horas dessa pessoa saem da agenda.', confirmLabel: 'Tirar', danger: true }))) return;
    try {
      await api.del(`/workers/${worker.id}`);
      onDone();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Card className={`p-4 ${!active ? 'opacity-70' : ''}`}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Nome" className="flex-1 min-w-[160px]">
            <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Zé" autoFocus={!worker} />
          </Field>
          <label className="flex items-center gap-2 h-10 text-sm cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
            Trabalhando
          </label>
        </div>

        <div>
          <div className="text-sm font-medium mb-1.5">Horas em cada dia</div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK.map((label, i) => (
              <label key={label} className="text-center">
                <span className={`block text-xs mb-1 ${i >= 5 ? 'text-primary font-semibold' : 'text-muted'}`}>{label}</span>
                <input
                  className={`${inputCls} px-1 text-center num ${toNum(week[i]) === 0 ? 'text-muted' : ''}`}
                  inputMode="decimal"
                  aria-label={`Horas na ${label}`}
                  value={week[i]}
                  onChange={(e) => setWeek(week.map((h, j) => (j === i ? e.target.value : h)))}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-muted mr-1">Atalhos:</span>
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.label}
                onClick={() => setWeek(p.week.map(String))}
                className="text-xs rounded-full border border-line px-2.5 py-1 text-muted hover:text-ink hover:border-primary/50 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-sm text-muted">
            Total: <b className="text-ink num">{hours(total)}</b> por semana
          </span>
          <div className="flex gap-2">
            {worker ? (
              <Button variant="ghost" size="sm" onClick={remove} aria-label={`Tirar ${worker.name}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={onCancel}>Cancelar</Button>
            )}
            <Button size="sm" variant="primary" type="submit" disabled={saving || !dirty}>
              {worker ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function ExceptionsSection({ workers, items, onChanged }: { workers: Worker[]; items: WorkerException[]; onChanged: () => void }) {
  const { toast, fail } = useFeedback();
  const [who, setWho] = useState('');
  const [from, setFrom] = useState(todayIso(1));
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'folga' | 'horas'>('folga');
  const [h, setH] = useState('4');
  const [note, setNote] = useState('');

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/workers/exceptions', {
        worker_id: who ? Number(who) : null,
        start_date: from,
        end_date: to || null,
        hours: mode === 'folga' ? 0 : toNum(h),
        note,
      });
      toast('Anotado na agenda');
      setNote('');
      setTo('');
      onChanged();
    } catch (err) {
      fail(err);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/workers/exceptions/${id}`);
      onChanged();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <section>
      <h2 className="font-semibold text-lg">Folgas e dias diferentes</h2>
      <p className="text-sm text-muted mb-3">Feriado, viagem, consulta médica, um sábado a mais… vale só para esses dias.</p>

      {items.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {items.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 text-sm bg-surface border border-line rounded-lg px-3 py-2">
              <span className="min-w-0">
                <b>{x.worker_name ?? 'Todo mundo'}</b>
                {' · '}
                {x.start_date === x.end_date ? dayLabel(x.start_date) : `${dayLabel(x.start_date)} até ${dayLabel(x.end_date)}`}
                {' · '}
                {x.hours === 0 ? <span className="text-danger font-medium">folga</span> : <span>{hours(x.hours)}</span>}
                {x.note && <span className="text-muted"> · {x.note}</span>}
              </span>
              <button onClick={() => remove(x.id)} className="text-muted hover:text-danger cursor-pointer shrink-0" aria-label="Apagar">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4">
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <Field label="Quem">
            <select className={inputCls} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Todo mundo</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="O que">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as 'folga' | 'horas')}>
              <option value="folga">Folga</option>
              <option value="horas">Outro horário</option>
            </select>
          </Field>
          <Field label="De">
            <input type="date" className={inputCls} required value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até (opcional)">
            <input type="date" className={inputCls} min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {mode === 'horas' && (
            <Field label="Horas nesse dia">
              <input className={inputCls} inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
            </Field>
          )}
          <Field label="Motivo (opcional)" className={mode === 'horas' ? 'sm:col-span-2' : 'col-span-2 sm:col-span-3'}>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: feriado, viagem" />
          </Field>
          <Button type="submit" variant="primary" className="col-span-2 sm:col-span-1">
            <Plus className="w-4 h-4" /> Anotar
          </Button>
        </form>
      </Card>
    </section>
  );
}

function MachineSection({ initial, onChanged }: { initial: number; onChanged: () => void }) {
  const { toast, fail } = useFeedback();
  const [value, setValue] = useState(String(initial));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/schedule/settings', { machine_hours_per_day: toNum(value) });
      toast('Máquinas salvas');
      onChanged();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <section>
      <h2 className="font-semibold text-lg flex items-center gap-2"><Printer className="w-5 h-5" /> Máquinas</h2>
      <p className="text-sm text-muted mb-3">
        Impressora e outras máquinas rodam sozinhas, em paralelo com o seu trabalho. Diga quantas horas por dia elas rodam,
        somando todas. Ex.: 2 impressoras ligadas 10h = 20h. Deixe 0 para a agenda não considerar máquinas.
      </p>
      <Card className="p-4">
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <Field label="Horas de máquina por dia" className="w-48">
            <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" disabled={toNum(value) === initial}>Salvar</Button>
        </form>
      </Card>
    </section>
  );
}
