import { Boxes, History, Pencil, Plus, Search, ShoppingCart, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { api, type Material, type Movement, type Unit } from '../api';
import { amount, money, qty, UNIT_LABEL, unitMoney } from '../format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Loading, Modal, PageHeader,
  toNum, useFeedback, useLoad,
} from '../ui';

/** Tamanho de embalagem mais comum por unidade, para já vir preenchido. */
const DEFAULT_PACKAGE: Record<Unit, string> = { g: '1000', m: '50', un: '100', ml: '1000' };
const PACKAGE_HINT: Record<Unit, string> = {
  g: 'Ex.: carretel de 1 kg = 1000',
  m: 'Ex.: rolo de 50 m = 50',
  un: 'Ex.: pacote com 100 = 100',
  ml: 'Ex.: frasco de 1 L = 1000',
};

export default function Estoque({ initialFilter }: { initialFilter: string | null }) {
  const { data, error, reload } = useLoad<Material[]>('/materials');
  const { toast, confirm, fail } = useFeedback();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(initialFilter === 'baixo');
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [buying, setBuying] = useState<Material | null>(null);
  const [adjusting, setAdjusting] = useState<Material | null>(null);
  const [history, setHistory] = useState<Material | null>(null);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter(
      (m) => (!onlyLow || m.low) && (!term || `${m.name} ${m.supplier}`.toLowerCase().includes(term)),
    );
  }, [data, search, onlyLow]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const lowCount = data.filter((m) => m.low).length;
  const totalValue = data.reduce((acc, m) => acc + m.stock_value, 0);

  const archive = async (m: Material) => {
    const ok = await confirm({
      title: 'Remover insumo?',
      message: <>“{m.name}” sai da lista. O histórico de compras e pedidos continua guardado.</>,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/materials/${m.id}`);
      toast('Insumo removido');
      reload();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle={data.length ? `${data.length} insumos · ${money(totalValue)} parados no estoque` : undefined}
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> Novo insumo
          </Button>
        }
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<Boxes className="w-6 h-6" />}
          title="Nenhum insumo ainda"
          text="Cadastre o que você usa para produzir: filamento, fita, fecho, embalagem… com quanto você paga."
          action={<Button variant="primary" onClick={() => setEditing('new')}>Cadastrar insumo</Button>}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className={`${inputCls} pl-9`}
                placeholder="Buscar insumo ou fornecedor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => setOnlyLow(!onlyLow)} className={onlyLow ? '!bg-warning-soft !text-warning !border-warning/40' : ''}>
              Acabando {lowCount > 0 && <Badge tone="warning">{lowCount}</Badge>}
            </Button>
          </div>

          <div className="space-y-2">
            {list.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      {m.name}
                      {m.stock <= 0 ? <Badge tone="danger">Acabou</Badge> : m.low && <Badge tone="warning">Acabando</Badge>}
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      {unitMoney(m.unit_cost)} por {m.unit}
                      {m.unit === 'g' && m.unit_cost > 0 && <> · {money(m.unit_cost * 1000)} o kg</>}
                      {m.supplier && <> · {m.supplier}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-bold num ${m.stock <= 0 ? 'text-danger' : m.low ? 'text-warning' : ''}`}>
                      {amount(m.stock, m.unit)}
                    </div>
                    <div className="text-xs text-muted">mínimo {amount(m.min_stock, m.unit)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3 -mb-1">
                  <Button size="sm" variant="primary" onClick={() => setBuying(m)}>
                    <ShoppingCart className="w-4 h-4" /> Comprei
                  </Button>
                  <Button size="sm" onClick={() => setAdjusting(m)}>
                    <SlidersHorizontal className="w-4 h-4" /> Contar / ajustar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setHistory(m)}>
                    <History className="w-4 h-4" /> Histórico
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                    <Pencil className="w-4 h-4" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archive(m)} aria-label={`Remover ${m.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {list.length === 0 && <p className="text-center text-muted py-8">Nada encontrado.</p>}
          </div>
        </>
      )}

      {editing && (
        <MaterialForm
          material={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => (setEditing(null), reload())}
        />
      )}
      {buying && <PurchaseForm material={buying} onClose={() => setBuying(null)} onSaved={() => (setBuying(null), reload())} />}
      {adjusting && <AdjustForm material={adjusting} onClose={() => setAdjusting(null)} onSaved={() => (setAdjusting(null), reload())} />}
      {history && <HistoryModal material={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function MaterialForm({ material, onClose, onSaved }: { material: Material | null; onClose: () => void; onSaved: () => void }) {
  const { toast, fail } = useFeedback();
  const [name, setName] = useState(material?.name ?? '');
  const [unit, setUnit] = useState<Unit>(material?.unit ?? 'g');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState(material ? String(material.min_stock) : '');
  const [supplier, setSupplier] = useState(material?.supplier ?? '');
  // O custo é informado como "paguei X por Y": ninguém pensa em R$ por grama.
  const [packPrice, setPackPrice] = useState(material ? String(+(material.unit_cost * toNum(DEFAULT_PACKAGE[material.unit])).toFixed(2)) : '');
  const [packSize, setPackSize] = useState(DEFAULT_PACKAGE[material?.unit ?? 'g']);
  const [saving, setSaving] = useState(false);

  const unitCost = toNum(packSize) > 0 ? toNum(packPrice) / toNum(packSize) : 0;

  const changeUnit = (u: Unit) => {
    setUnit(u);
    setPackSize(DEFAULT_PACKAGE[u]);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name, unit, supplier,
      min_stock: toNum(minStock),
      unit_cost: unitCost,
      initial_stock: toNum(stock),
      notes: material?.notes ?? '',
    };
    try {
      if (material) await api.put(`/materials/${material.id}`, body);
      else await api.post('/materials', body);
      toast(material ? 'Insumo atualizado' : 'Insumo cadastrado');
      onSaved();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={material ? 'Editar insumo' : 'Novo insumo'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="material-form" disabled={saving}>Salvar</Button>
        </>
      }
    >
      <form id="material-form" onSubmit={save} className="space-y-4">
        <Field label="Nome">
          <input className={inputCls} required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Filamento PLA preto" />
        </Field>
        <Field label="Você controla em">
          <select className={inputCls} value={unit} onChange={(e) => changeUnit(e.target.value as Unit)}>
            {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
              <option key={u} value={u}>{UNIT_LABEL[u]} ({u})</option>
            ))}
          </select>
        </Field>

        <div className="rounded-lg bg-surface-2 p-3">
          <div className="text-sm font-medium mb-2">Quanto custa</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paguei (R$)">
              <input className={inputCls} inputMode="decimal" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} placeholder="110,00" />
            </Field>
            <Field label={`Por quantos ${unit}`} hint={PACKAGE_HINT[unit]}>
              <input className={inputCls} inputMode="decimal" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
            </Field>
          </div>
          <div className="text-sm text-muted mt-2">
            = <b className="text-ink">{unitMoney(unitCost)}</b> por {unit}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!material && (
            <Field label={`Quanto tem hoje (${unit})`}>
              <input className={inputCls} inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </Field>
          )}
          <Field label={`Avisar quando ficar abaixo de (${unit})`}>
            <input className={inputCls} inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Fornecedor (opcional)">
          <input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function PurchaseForm({ material, onClose, onSaved }: { material: Material; onClose: () => void; onSaved: () => void }) {
  const { toast, fail } = useFeedback();
  const [packages, setPackages] = useState('1');
  const [packSize, setPackSize] = useState(DEFAULT_PACKAGE[material.unit]);
  const [packPrice, setPackPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const addQty = toNum(packages) * toNum(packSize);
  const total = toNum(packages) * toNum(packPrice);
  const current = Math.max(material.stock, 0);
  const newCost = current + addQty > 0 ? (current * material.unit_cost + total) / (current + addQty) : 0;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/materials/${material.id}/purchases`, {
        packages: toNum(packages), package_size: toNum(packSize), package_price: toNum(packPrice),
      });
      toast(`Entrou ${amount(addQty, material.unit)} de ${material.name}`);
      onSaved();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Comprei: ${material.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="purchase-form" disabled={saving || addQty <= 0}>Registrar compra</Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantos">
            <input className={inputCls} inputMode="decimal" autoFocus value={packages} onChange={(e) => setPackages(e.target.value)} />
          </Field>
          <Field label={`de (${material.unit})`}>
            <input className={inputCls} inputMode="decimal" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
          </Field>
          <Field label="R$ cada">
            <input className={inputCls} inputMode="decimal" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} placeholder="0,00" />
          </Field>
        </div>
        <p className="text-sm text-muted">{PACKAGE_HINT[material.unit]}</p>
        <Card className="p-3 text-sm space-y-1 bg-surface-2">
          <Row label="Entra no estoque" value={amount(addQty, material.unit)} />
          <Row label="Total pago" value={money(total)} />
          <Row label="Estoque depois" value={amount(material.stock + addQty, material.unit)} />
          <Row label={`Custo médio por ${material.unit}`} value={`${unitMoney(material.unit_cost)} → ${unitMoney(newCost)}`} />
        </Card>
      </form>
    </Modal>
  );
}

function AdjustForm({ material, onClose, onSaved }: { material: Material; onClose: () => void; onSaved: () => void }) {
  const { toast, fail } = useFeedback();
  const [count, setCount] = useState(String(+material.stock.toFixed(3)));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const diff = toNum(count) - material.stock;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/materials/${material.id}/adjust`, { new_stock: toNum(count), note });
      toast('Estoque ajustado');
      onSaved();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Contar: ${material.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="adjust-form" disabled={saving}>Salvar contagem</Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={save} className="space-y-4">
        <p className="text-sm text-muted">
          O sistema acha que tem <b className="text-ink">{amount(material.stock, material.unit)}</b>. Quanto tem de verdade?
        </p>
        <Field label={`Quantidade real (${material.unit})`}>
          <input className={inputCls} inputMode="decimal" autoFocus value={count} onChange={(e) => setCount(e.target.value)} />
        </Field>
        {Math.abs(diff) > 1e-9 && (
          <p className={`text-sm font-medium ${diff < 0 ? 'text-danger' : 'text-success'}`}>
            {diff < 0 ? 'Sai' : 'Entra'} {amount(Math.abs(diff), material.unit)}
          </p>
        )}
        <Field label="Motivo (opcional)">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: peça perdida, sobra de teste" />
        </Field>
      </form>
    </Modal>
  );
}

const REASON: Record<Movement['reason'], string> = {
  compra: 'Compra',
  pedido: 'Usado em pedido',
  estorno: 'Devolvido',
  ajuste: 'Ajuste',
};

function HistoryModal({ material, onClose }: { material: Material; onClose: () => void }) {
  const { data, error } = useLoad<Movement[]>(`/materials/${material.id}/movements`);
  return (
    <Modal title={`Histórico: ${material.name}`} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      {!data ? (
        <Loading />
      ) : data.length === 0 ? (
        <p className="text-muted">Nenhum movimento ainda.</p>
      ) : (
        <ul className="divide-y divide-line -my-2">
          {data.map((mv) => (
            <li key={mv.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">
                  {REASON[mv.reason]}
                  {mv.order_id && <a className="text-primary ml-1" href={`#/pedidos?id=${mv.order_id}`}>#{mv.order_id}</a>}
                </div>
                <div className="text-muted truncate">
                  {new Date(mv.created_at.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {mv.note && ` · ${mv.note}`}
                </div>
              </div>
              <span className={`num font-semibold whitespace-nowrap ${mv.delta < 0 ? 'text-danger' : 'text-success'}`}>
                {mv.delta > 0 ? '+' : '−'}{qty(Math.abs(mv.delta))} {material.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-medium num text-right">{value}</span>
    </div>
  );
}
