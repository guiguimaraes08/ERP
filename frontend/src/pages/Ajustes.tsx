import { FolderOpen, History, KeyRound, Monitor, Moon, RefreshCw, Save, Smartphone, Sparkles, Sun } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type AppInfo, type AssistantConfig, type Settings } from '../api';
import { Button, Card, ErrorBox, Field, inputCls, Loading, PageHeader, toNum, useFeedback, useLoad } from '../ui';

type Theme = 'auto' | 'light' | 'dark';

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('erp-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function applyTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem('erp-theme');
    else localStorage.setItem('erp-theme', theme);
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export default function Ajustes({ onSaved }: { onSaved: () => void }) {
  const { data, error, reload } = useLoad<Settings>('/settings');
  const info = useLoad<AppInfo>('/info');
  const { toast, confirm, fail } = useFeedback();
  const [form, setForm] = useState({ business_name: '', labor_rate: '', machine_rate: '', default_margin: '' });
  const [theme, setTheme] = useState<Theme>(readTheme);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) {
      setForm({
        business_name: data.business_name,
        labor_rate: String(data.labor_rate),
        machine_rate: String(data.machine_rate),
        default_margin: String(data.default_margin),
      });
    }
  }, [data]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const payload = (patch: Partial<Settings> = {}) => ({
    business_name: form.business_name,
    labor_rate: toNum(form.labor_rate),
    machine_rate: toNum(form.machine_rate),
    default_margin: toNum(form.default_margin),
    allow_phone: data.allow_phone,
    auto_update: data.auto_update,
    ...patch,
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/settings', payload());
      toast('Ajustes salvos');
      onSaved();
    } catch (err) {
      fail(err);
    }
  };

  const togglePhone = async () => {
    try {
      await api.put('/settings', payload({ allow_phone: !data.allow_phone }));
      reload();
      toast(data.allow_phone ? 'Acesso pelo celular desligado' : 'Ligado! Feche e abra o programa de novo para valer');
    } catch (err) {
      fail(err);
    }
  };

  const toggleAutoUpdate = async () => {
    try {
      await api.put('/settings', payload({ auto_update: !data.auto_update }));
      reload();
      toast(data.auto_update ? 'Atualização automática desligada' : 'Atualização automática ligada');
    } catch (err) {
      fail(err);
    }
  };

  const saveBackup = async () => {
    // Dentro do programa: janela "Salvar como" do Windows. No navegador: download.
    if (window.pywebview) {
      try {
        const where = await window.pywebview.api.save_backup();
        if (where) toast(`Cópia salva em ${where}`);
      } catch (err) {
        fail(err);
      }
      return;
    }
    window.location.href = '/api/backup';
  };

  const restore = async (file: File) => {
    const ok = await confirm({
      title: 'Voltar esta cópia?',
      message: (
        <>
          Tudo o que está no sistema agora vai ser trocado pelo que está em <b>{file.name}</b>. Por segurança, o estado atual fica
          guardado na pasta <b>backups</b>.
        </>
      ),
      confirmLabel: 'Voltar a cópia',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.upload('/restore', file);
      toast('Cópia restaurada');
      setTimeout(() => {
        window.location.hash = '/inicio';
        window.location.reload();
      }, 700);
    } catch (err) {
      fail(err);
    }
  };

  const openFolder = async () => {
    try {
      await api.post('/open-folder');
    } catch (err) {
      fail(err);
    }
  };

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Ajustes" />

      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome do seu negócio">
            <input className={inputCls} required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Sua hora (R$)" hint="Quanto vale uma hora do seu trabalho">
              <input className={inputCls} inputMode="decimal" value={form.labor_rate} onChange={(e) => setForm({ ...form, labor_rate: e.target.value })} />
            </Field>
            <Field label="Hora de máquina (R$)" hint="Energia + desgaste (bico, mesa, peças)">
              <input className={inputCls} inputMode="decimal" value={form.machine_rate} onChange={(e) => setForm({ ...form, machine_rate: e.target.value })} />
            </Field>
            <Field label="Margem padrão (%)" hint="Quanto do preço é lucro">
              <input className={inputCls} inputMode="decimal" value={form.default_margin} onChange={(e) => setForm({ ...form, default_margin: e.target.value })} />
            </Field>
          </div>
          <p className="text-sm text-muted">
            Exemplo: uma impressora de 200 W ligada 1 hora gasta 0,2 kWh. Com a energia a R$ 0,90, são R$ 0,18 de luz. Some
            uns R$ 1 a R$ 2 de desgaste por hora. Mudar esses valores atualiza o custo de todos os produtos; pedidos já anotados não mudam.
          </p>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">Salvar ajustes</Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Seus dados</h2>
        <p className="text-sm text-muted mt-1">
          Ficam só neste computador; nada vai para a internet. Todo dia o sistema guarda sozinho uma cópia (as dos últimos 30 dias)
          na pasta <b className="text-ink">backups</b>. De vez em quando, salve uma cópia num pendrive.
        </p>
        {info.data && (
          <p className="text-xs text-muted mt-2 break-all">
            Pasta: <code className="text-ink">{info.data.data_dir}</code>
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="primary" onClick={saveBackup}>
            <Save className="w-4 h-4" /> Salvar cópia
          </Button>
          <Button onClick={() => fileInput.current?.click()}>
            <History className="w-4 h-4" /> Voltar uma cópia
          </Button>
          <Button variant="ghost" onClick={openFolder}>
            <FolderOpen className="w-4 h-4" /> Abrir pasta
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".db"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) restore(file);
            }}
          />
        </div>
      </Card>

      <AiSettings />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Smartphone className="w-4 h-4" /> Usar no celular
            </h2>
            <p className="text-sm text-muted mt-1">
              Abre o sistema no celular, conectado no mesmo Wi-Fi. Este computador precisa estar ligado e com o programa aberto.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={data.allow_phone}
            aria-label="Usar no celular"
            onClick={togglePhone}
            className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${data.allow_phone ? 'bg-primary' : 'bg-line'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${data.allow_phone ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {data.allow_phone &&
          (info.data?.phone_url ? (
            <div className="mt-4 rounded-lg bg-primary-soft p-4 flex flex-col sm:flex-row items-center gap-4">
              <img
                src="/api/phone-qr.svg"
                alt={`QR Code para abrir ${info.data.phone_url}`}
                className="w-44 h-44 rounded-lg bg-white p-1 shrink-0"
              />
              <div className="text-center sm:text-left">
                <div className="font-semibold">Aponte a câmera do celular para o código</div>
                <div className="text-sm text-muted mt-1">e toque no link que aparecer. Ou digite no navegador:</div>
                <div className="text-lg font-bold text-primary mt-1 break-all">{info.data.phone_url}</div>
                <div className="text-xs text-muted mt-2">Dica: no celular, salve na tela inicial para abrir como um aplicativo.</div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-warning font-medium">
              Feche e abra o programa de novo para ligar. Se o Windows perguntar sobre a rede, clique em “Permitir”.
            </p>
          ))}
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Aparência</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['auto', 'Automático', Monitor],
              ['light', 'Claro', Sun],
              ['dark', 'Escuro', Moon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => chooseTheme(value)}
              className={`h-16 rounded-lg border flex flex-col items-center justify-center gap-1 text-sm font-medium cursor-pointer transition-colors ${
                theme === value ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:text-ink'
              }`}
            >
              <Icon className="w-5 h-5" /> {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar sozinho ao abrir
            </h2>
            <p className="text-sm text-muted mt-1">
              Toda vez que o programa abre, ele procura uma versão nova no GitHub e, se tiver, instala antes de começar.
              Sem internet, abre normalmente.
            </p>
            {info.data && <p className="text-xs text-muted mt-2">Você está na versão {info.data.version}.</p>}
          </div>
          <button
            role="switch"
            aria-checked={data.auto_update}
            aria-label="Atualizar sozinho ao abrir"
            onClick={toggleAutoUpdate}
            className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors cursor-pointer ${data.auto_update ? 'bg-primary' : 'bg-line'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${data.auto_update ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </Card>
    </div>
  );
}

function AiSettings() {
  const { data } = useLoad<AssistantConfig>('/assistant/config');
  const { toast, fail } = useFeedback();
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setModel(data.model);
  }, [data]);

  if (!data) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/assistant/config', { model, ...(key.trim() ? { api_key: key.trim() } : {}) });
      setKey('');
      toast('Assistente configurado');
      if (key.trim()) test();
    } catch (err) {
      fail(err);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api.post<{ model: string }>('/assistant/test');
      toast(`Funcionando! Conectado ao ${r.model}`);
    } catch (err) {
      fail(err);
    } finally {
      setTesting(false);
    }
  };

  const removeKey = async () => {
    try {
      await api.put('/assistant/config', { model, api_key: '' });
      toast('Chave removida');
    } catch (err) {
      fail(err);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" /> Assistente com IA
      </h2>
      <p className="text-sm text-muted mt-1">
        Um chat que analisa seus pedidos, estoque, preços e agenda (botão <b className="text-ink">Assistente</b> no canto da tela).
        Usa a IA Claude, da Anthropic: precisa de internet e de uma chave da API.
      </p>
      <ol className="text-sm text-muted mt-3 space-y-1 list-decimal pl-5">
        <li>Entre em <a className="text-primary underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> e crie uma conta.</li>
        <li>Adicione créditos (paga pelo uso: cada pergunta custa centavos).</li>
        <li>Em <b>API Keys</b>, crie uma chave e cole aqui.</li>
      </ol>

      <form onSubmit={save} className="mt-4 space-y-3">
        <Field
          label="Chave da API"
          hint={data.configured ? <>Chave salva: <code>{data.key_hint}</code>. Para trocar, cole uma nova.</> : 'Começa com sk-ant-'}
        >
          <div className="relative">
            <KeyRound className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              autoComplete="off"
              className={`${inputCls} pl-9`}
              placeholder={data.configured ? '•••••••• (salva)' : 'sk-ant-...'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
        </Field>
        <Field label="Modelo" hint="O padrão é o mais inteligente. Os outros custam menos por pergunta.">
          <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
            {data.models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={!key.trim() && model === data.model}>Salvar</Button>
          {data.configured && (
            <>
              <Button onClick={test} disabled={testing}>{testing ? 'Testando…' : 'Testar conexão'}</Button>
              <Button variant="ghost" onClick={removeKey}>Remover chave</Button>
            </>
          )}
        </div>
      </form>
      <p className="text-xs text-muted mt-3">
        Privacidade: ao perguntar, sua pergunta e um resumo dos dados do sistema (pedidos, clientes, estoque, preços) são enviados
        à Anthropic para gerar a resposta. A chave fica guardada só neste computador, também dentro das cópias de segurança.
      </p>
    </Card>
  );
}
