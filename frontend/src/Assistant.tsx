import { MessageSquarePlus, Send, Sparkles, Square, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { go } from './App';
import type { AssistantConfig } from './api';
import { Button, useLoad } from './ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

const SUGGESTIONS = [
  'Como foi meu mês?',
  'O que preciso comprar esta semana?',
  'Quais produtos dão mais lucro por hora de trabalho?',
  'Algum pedido vai atrasar? O que eu faço?',
  'Estou cobrando barato em algum produto?',
];

/** Balão de conversa com a IA, disponível em todas as telas. */
export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const config = useLoad<AssistantConfig>(open ? '/assistant/config' : null);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 220);
  };

  const reset = () => {
    abort.current?.abort();
    setMessages([]);
    setBusy(false);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', content: question }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;

    const update = (content: string, error = false) =>
      setMessages((all) => [...all.slice(0, -1), { role: 'assistant', content, error }]);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        update(typeof data?.detail === 'string' ? data.detail : 'Não consegui falar com o assistente.', true);
        return;
      }
      // A resposta chega aos pedaços: mostra enquanto a IA escreve.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        update(text);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') update('Não consegui falar com o assistente. O programa está aberto?', true);
    } finally {
      setBusy(false);
    }
  };

  const configured = config.data?.configured;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fab-in fixed z-40 right-4 bottom-20 sm:bottom-6 sm:right-6 h-14 pl-4 pr-5 rounded-full bg-primary text-primary-fg shadow-lg flex items-center gap-2 font-semibold cursor-pointer hover:bg-primary-hover"
          aria-label="Abrir assistente"
        >
          <Sparkles className="w-5 h-5" /> <span className="hidden sm:inline">Assistente</span>
        </button>
      )}

      {open && (
        <section
          className={`chat-panel ${closing ? 'chat-panel-out' : ''} fixed z-50 inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-4 sm:w-[420px] bg-surface border border-line sm:rounded-2xl shadow-2xl flex flex-col`}
          aria-label="Assistente"
        >
          <header className="flex items-center gap-2 px-4 py-3 border-b border-line">
            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">Assistente</div>
              <div className="text-xs text-muted truncate">Analisa os dados do seu negócio</div>
            </div>
            {messages.length > 0 && (
              <button onClick={reset} className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-2 cursor-pointer" title="Nova conversa" aria-label="Nova conversa">
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            )}
            <button onClick={close} className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-2 cursor-pointer" aria-label="Fechar assistente">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {config.data && !configured ? (
              <div className="text-center py-8 px-2">
                <p className="font-semibold">Falta configurar a IA</p>
                <p className="text-sm text-muted mt-1">
                  Para conversar, cole uma chave da API da Anthropic em Ajustes. Leva 2 minutos.
                </p>
                <Button variant="primary" className="mt-4" onClick={() => (close(), go('ajustes'))}>
                  Configurar agora
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-2">
                <p className="text-sm text-muted mb-3">
                  Pergunte o que quiser sobre seus pedidos, estoque, preços e agenda. Algumas ideias:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm rounded-xl border border-line px-3 py-2.5 hover:border-primary/50 hover:bg-primary-soft/40 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`msg-in flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-primary text-primary-fg rounded-br-md'
                        : m.error
                          ? 'bg-danger-soft text-danger rounded-bl-md'
                          : 'bg-surface-2 rounded-bl-md'
                    }`}
                  >
                    {m.role === 'assistant' && !m.content ? (
                      <span className="typing" aria-label="Pensando">
                        <i /><i /><i />
                      </span>
                    ) : m.role === 'assistant' ? (
                      <RichText text={m.content} />
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={listEnd} />
          </div>

          {configured !== false && (
            <form
              className="border-t border-line p-3 flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <textarea
                className="flex-1 resize-none max-h-32 min-h-10 px-3 py-2 rounded-xl border border-line bg-surface text-[15px] focus:outline-none focus:border-primary"
                rows={1}
                placeholder="Escreva sua pergunta…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              {busy ? (
                <Button onClick={() => abort.current?.abort()} aria-label="Parar resposta" className="h-10 w-10 !px-0">
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={!input.trim()} aria-label="Enviar" className="h-10 w-10 !px-0">
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </form>
          )}
        </section>
      )}
    </>
  );
}

/** Markdown bem simples: parágrafos, listas com "-" ou "1." e **negrito**. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ''))}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}
