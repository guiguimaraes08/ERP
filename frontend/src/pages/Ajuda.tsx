import { BookOpen, Download, Search, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Markdown, { slug } from '../Markdown';
import { Button, Card, ErrorBox, inputCls, Loading, useLoad } from '../ui';

interface ManualData {
  markdown: string;
  has_pdf: boolean;
}

interface Section {
  title: string;
  body: string; // markdown da seção, com o título
}

/** Divide o manual nas seções "## " para o índice e a busca. */
function sections(markdown: string): { intro: string; list: Section[] } {
  const parts = markdown.split(/\n(?=## )/);
  const [intro, ...rest] = parts;
  return {
    intro: intro.replace(/^# .*\n/, '').trim(),
    list: rest.map((body) => ({ title: body.match(/^## (.*)/)?.[1] ?? '', body })),
  };
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Abre o assistente (o balão no canto), já com uma pergunta escrita. */
export function askAssistant(question = '') {
  window.dispatchEvent(new CustomEvent('nexos:ask', { detail: question }));
}

export default function Ajuda() {
  const { data, error } = useLoad<ManualData>('/manual');
  const [query, setQuery] = useState('');

  const parsed = useMemo(() => (data ? sections(data.markdown) : null), [data]);
  const visible = useMemo(() => {
    if (!parsed) return [];
    const q = normalize(query.trim());
    if (!q) return parsed.list;
    // Na busca, cada seção mostra só os blocos (subtítulos) que têm o termo.
    return parsed.list
      .map((s) => {
        const blocks = s.body.split(/\n(?=### )/);
        const hits = blocks.filter((b) => normalize(b).includes(q));
        return hits.length ? { title: s.title, body: hits[0].startsWith('## ') ? hits.join('\n') : `## ${s.title}\n\n${hits.join('\n')}` } : null;
      })
      .filter((s): s is Section => s !== null);
  }, [parsed, query]);

  if (error) return <ErrorBox message={error} />;
  if (!data || !parsed) return <Loading />;

  const goTo = (title: string) => document.getElementById(slug(title))?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
      {/* Índice (computador) */}
      <nav className="hidden lg:block sticky top-8 self-start" aria-label="Índice do manual">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Neste manual</div>
        <ul className="space-y-0.5 text-sm">
          {parsed.list.map((s) => (
            <li key={s.title}>
              <button onClick={() => goTo(s.title)} className="text-left w-full px-2 py-1.5 rounded-md text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Ajuda
            </h1>
            <p className="text-muted">O manual do Nexos ERP. Funciona sem internet.</p>
          </div>
          <div className="flex gap-2">
            {data.has_pdf && (
              <a href="/api/manual/pdf" download className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-line bg-surface hover:bg-surface-2 text-[15px] font-medium">
                <Download className="w-4 h-4" /> PDF
              </a>
            )}
            <Button variant="primary" onClick={() => askAssistant()}>
              <Sparkles className="w-4 h-4" /> Perguntar ao assistente
            </Button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputCls} pl-9 pr-9`}
            placeholder="Buscar no manual: estoque, prazo, cópia, celular…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer" aria-label="Limpar busca">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Índice (celular): atalhos em linha */}
        {!query && (
          <div className="lg:hidden flex gap-1.5 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 pb-2 mb-2">
            {parsed.list.map((s) => (
              <button key={s.title} onClick={() => goTo(s.title)} className="h-8 px-3 rounded-full border border-line text-sm whitespace-nowrap text-muted cursor-pointer">
                {s.title}
              </button>
            ))}
          </div>
        )}

        <Card className="p-5 sm:p-8">
          {!query && <Markdown text={parsed.intro} />}
          {visible.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted">Nada no manual com “{query}”.</p>
              <Button className="mt-3" onClick={() => askAssistant(`No manual não achei sobre "${query}". Pode me explicar?`)}>
                <Sparkles className="w-4 h-4" /> Perguntar ao assistente
              </Button>
            </div>
          ) : (
            visible.map((s) => <Markdown key={s.title} text={s.body} />)
          )}
        </Card>
      </div>
    </div>
  );
}
