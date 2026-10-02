import { Calculator, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api, type CostBreakdown, type Material, type Product, type ProductInput, type Settings } from '../api';
import { money, unitMoney } from '../format';
import {
  Badge, Button, Card, EmptyState, ErrorBox, Field, inputCls, Loading, Modal, PageHeader,
  toNum, toNumOrNull, useFeedback, useLoad,
} from '../ui';

export default function Produtos() {
  const { data, error, reload } = useLoad<Product[]>('/products');
  const { toast, confirm, fail } = useFeedback();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const archive = async (p: Product) => {
    const ok = await confirm({
      title: 'Remover produto?',
      message: <>“{p.name}” sai da lista. Pedidos antigos continuam com ele.</>,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/products/${p.id}`);
      toast('Produto removido');
      reload();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="O que você vende, com a receita de cada um"
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="w-4 h-4" /> Novo produto
          </Button>
        }
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="Nenhum produto ainda"
          text="Monte a receita uma vez (quanto de cada insumo e quanto tempo leva) e o sistema calcula o custo e sugere o preço."
          action={<Button variant="primary" onClick={() => setEditing('new')}>Criar produto</Button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.map((p) => {
            const c = p.cost;
            const losing = c.profit < 0;
            return (
              <Card key={p.id} className="p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {losing ? <Badge tone="danger">Preço abaixo do custo</Badge> : c.price_is_custom && c.price < c.suggested_price && <Badge tone="warning">Abaixo do sugerido</Badge>}
                </div>
                {p.description && <p className="text-sm text-muted mt-0.5">{p.description}</p>}
                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                  <div>
                    <div className="text-muted text-xs">Custa</div>
                    <div className="font-semibold num">{money(c.unit_cost)}</div>
                  </div>
                  <div>
                    <div className="text-muted text-xs">Vende por</div>
                    <div className="font-semibold num text-primary">{money(c.price)}</div>
                  </div>
                  <div>
                    <div className="text-muted text-xs">Sobra</div>
                    <div className={`font-semibold num ${losing ? 'text-danger' : 'text-success'}`}>
                      {money(c.profit)} <span className="text-xs font-normal text-muted">({c.real_margin_pct}%)</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted mt-2">
                  {c.lines.map((l) => l.name).join(' · ') || 'Sem insumos na receita'}
                </div>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-line">
                  <Button size="sm" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => archive(p)} aria-label={`Remover ${p.name}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => (setEditing(null), reload())}
        />
      )}
    </div>
  );
}

interface Line {
  material_id: string;
  quantity: string;
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { toast, fail } = useFeedback();
  const materials = useLoad<Material[]>('/materials');
  const settings = useLoad<Settings>('/settings');

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [lines, setLines] = useState<Line[]>(
    product?.materials.map((m) => ({ material_id: String(m.material_id), quantity: String(m.quantity) })) ?? [],
  );
  const [labor, setLabor] = useState(product ? String(product.labor_minutes) : '');
  const [machine, setMachine] = useState(product ? String(product.machine_minutes) : '');
  const [extra, setExtra] = useState(product ? String(product.extra_cost) : '');
  const [margin, setMargin] = useState(product?.margin_pct != null ? String(product.margin_pct) : '');
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
  const [preview, setPreview] = useState<CostBreakdown | null>(null);
  const [saving, setSaving] = useState(false);

  const body: ProductInput = {
    name: name || '—',
    description,
    labor_minutes: toNum(labor),
    machine_minutes: toNum(machine),
    extra_cost: toNum(extra),
    margin_pct: toNumOrNull(margin),
    price: toNumOrNull(price),
    materials: lines
      .filter((l) => l.material_id && toNum(l.quantity) > 0)
      .map((l) => ({ material_id: Number(l.material_id), quantity: toNum(l.quantity) })),
  };
  const bodyKey = JSON.stringify(body);

  // Calculadora ao vivo: pergunta ao servidor (a mesma conta que vale no pedido).
  useEffect(() => {
    const t = setTimeout(() => {
      api.post<CostBreakdown>('/products/preview', JSON.parse(bodyKey)).then(setPreview).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [bodyKey]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...body, name };
      if (product) await api.put(`/products/${product.id}`, payload);
      else await api.post('/products', payload);
      toast(product ? 'Produto atualizado' : 'Produto criado');
      onSaved();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const materialList = materials.data ?? [];
  const usedIds = new Set(lines.map((l) => l.material_id));
  const s = settings.data;

  return (
    <Modal
      wide
      title={product ? `Editar: ${product.name}` : 'Novo produto'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form="product-form" disabled={saving}>Salvar produto</Button>
        </>
      }
    >
      <form id="product-form" onSubmit={save} className="grid md:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">
          <Field label="Nome">
            <input className={inputCls} required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Cordão azul com mosquetão" />
          </Field>
          <Field label="Descrição (opcional)">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          <div>
            <div className="text-sm font-medium mb-1.5">Receita: o que vai em <b>uma</b> unidade</div>
            {materialList.length === 0 && materials.data && (
              <p className="text-sm text-muted mb-2">
                Você ainda não tem insumos. <a href="#/estoque" className="text-primary underline" onClick={onClose}>Cadastre no estoque</a>.
              </p>
            )}
            <div className="space-y-2">
              {lines.map((line, idx) => {
                const mat = materialList.find((m) => String(m.id) === line.material_id);
                return (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      className={`${inputCls} flex-1 min-w-0`}
                      value={line.material_id}
                      onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, material_id: e.target.value } : l)))}
                    >
                      <option value="">Escolha o insumo…</option>
                      {materialList.map((m) => (
                        <option key={m.id} value={m.id} disabled={usedIds.has(String(m.id)) && String(m.id) !== line.material_id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <div className="relative w-28 shrink-0">
                      <input
                        className={`${inputCls} pr-9`}
                        inputMode="decimal"
                        placeholder="Qtd"
                        value={line.quantity}
                        onChange={(e) => setLines(lines.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{mat?.unit}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger-soft cursor-pointer"
                      aria-label="Tirar da receita"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLines([...lines, { material_id: '', quantity: '' }])}>
              <Plus className="w-4 h-4" /> Adicionar insumo
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Seu trabalho (min)" hint={s ? `R$ ${s.labor_rate}/h` : undefined}>
              <input className={inputCls} inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Máquina (min)" hint={s ? `R$ ${s.machine_rate}/h` : undefined}>
              <input className={inputCls} inputMode="decimal" value={machine} onChange={(e) => setMachine(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Outros custos (R$)" hint="por unidade">
              <input className={inputCls} inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0,00" />
            </Field>
          </div>
          <p className="text-xs text-muted -mt-2">Os valores por hora ficam em Ajustes.</p>
        </div>

        {/* Calculadora */}
        <div className="md:sticky md:top-0 self-start">
          <Card className="p-4 bg-surface-2">
            <div className="font-semibold flex items-center gap-2 mb-3"><Calculator className="w-4 h-4 text-primary" /> Quanto cobrar</div>
            {preview ? (
              <div className="space-y-1.5 text-sm">
                <CostRow label="Insumos" value={preview.materials_cost} />
                <CostRow label="Seu trabalho" value={preview.labor_cost} />
                <CostRow label="Máquina" value={preview.machine_cost} />
                {preview.extra_cost > 0 && <CostRow label="Outros" value={preview.extra_cost} />}
                <div className="flex justify-between pt-2 border-t border-line font-semibold">
                  <span>Custo por unidade</span>
                  <span className="num">{money(preview.unit_cost)}</span>
                </div>

                <Field label="Margem que você quer (%)" className="pt-3" hint={`Vazio = padrão de ${s?.default_margin ?? 40}%`}>
                  <input className={inputCls} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder={String(s?.default_margin ?? 40)} />
                </Field>
                <div className="flex justify-between items-baseline pt-1">
                  <span>Preço sugerido</span>
                  <span className="text-lg font-bold text-primary num">{money(preview.suggested_price)}</span>
                </div>

                <Field label="Ou cobre um preço fixo (R$)" className="pt-2" hint="Deixe vazio para usar o sugerido">
                  <input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={unitMoney(preview.suggested_price).replace('R$', '').trim()} />
                </Field>
                <div className={`rounded-lg px-3 py-2 mt-2 ${preview.profit < 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`}>
                  Sobra <b className="num">{money(preview.profit)}</b> por unidade ({preview.real_margin_pct}%)
                </div>
              </div>
            ) : (
              <Loading />
            )}
          </Card>
        </div>
      </form>
    </Modal>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="num text-ink">{money(value)}</span>
    </div>
  );
}
