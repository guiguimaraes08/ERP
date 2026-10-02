import { MessageCircle, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { api, type Customer } from '../api';
import { money, whatsappLink } from '../format';
import {
  Button, Card, EmptyState, ErrorBox, Field, inputCls, Loading, Modal, PageHeader, useFeedback, useLoad,
} from '../ui';

export default function Clientes() {
  const { data, error, reload } = useLoad<Customer[]>('/customers');
  const { toast, confirm, fail } = useFeedback();
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((c) => !term || `${c.name} ${c.phone}`.toLowerCase().includes(term));
  }, [data, search]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const remove = async (c: Customer) => {
    const ok = await confirm({
      title: `Apagar ${c.name}?`,
      message: c.orders_count ? 'Os pedidos dele continuam no sistema, só sem o nome do cliente.' : 'Essa pessoa sai da sua lista de clientes.',
      confirmLabel: 'Apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/customers/${c.id}`);
      toast('Cliente apagado');
      reload();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        action={<Button variant="primary" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> Novo cliente</Button>}
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="Nenhum cliente ainda"
          text="Os clientes também são cadastrados sozinhos quando você anota um pedido com um nome novo."
        />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={`${inputCls} pl-9`} placeholder="Buscar por nome ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((c) => {
              const wa = whatsappLink(c.phone, `Oi ${c.name.split(' ')[0]}!`);
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-sm text-muted">{c.phone || 'Sem telefone'}</div>
                    </div>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-success-soft text-success" aria-label={`WhatsApp de ${c.name}`}>
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  <div className="text-sm mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <span><span className="text-muted">Pedidos</span> <b className="num">{c.orders_count}</b></span>
                    <span><span className="text-muted">Comprou</span> <b className="num">{money(c.total_bought)}</b></span>
                    {c.balance > 0.009 && <span className="text-warning font-medium">deve {money(c.balance)}</span>}
                  </div>
                  {c.notes && <p className="text-sm text-muted mt-2">{c.notes}</p>}
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-line">
                    <Button size="sm" onClick={() => setEditing(c)}><Pencil className="w-4 h-4" /> Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label={`Apagar ${c.name}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <CustomerForm customer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), reload())} />
      )}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const { toast, fail } = useFeedback();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [notes, setNotes] = useState(customer?.notes ?? '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = { name, phone, notes };
      if (customer) await api.put(`/customers/${customer.id}`, body);
      else await api.post('/customers', body);
      toast('Cliente salvo');
      onSaved();
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Modal
      title={customer ? 'Editar cliente' : 'Novo cliente'}
      onClose={onClose}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" form="customer-form">Salvar</Button></>}
    >
      <form id="customer-form" onSubmit={save} className="space-y-4">
        <Field label="Nome"><input className={inputCls} required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="WhatsApp" hint="Com DDD. Vira um botão para mandar mensagem.">
          <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 98765-4321" />
        </Field>
        <Field label="Anotações"><textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
