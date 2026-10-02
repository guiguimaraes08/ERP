import { Fragment, type ReactNode } from 'react';

/**
 * Markdown simples, sem biblioteca: títulos, parágrafos, tópicos ("- "), tabelas,
 * **negrito**, *itálico*, `código` e quebra de linha com dois espaços no fim.
 * Usado no manual (aba Ajuda) e nas respostas do assistente.
 */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="px-1 rounded bg-surface-2 text-[0.92em]">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <i key={i}>{part.slice(1, -1)}</i>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Texto com quebras forçadas ("  " no fim da linha) viram <br>. */
function lines(text: string): ReactNode {
  const rows = text.split(/ {2,}\n/);
  return rows.map((row, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(row.replace(/\n/g, ' '))}
    </Fragment>
  ));
}

const HEADING: Record<number, string> = {
  1: 'text-2xl font-bold tracking-tight mt-2',
  2: 'text-xl font-bold tracking-tight mt-8 pt-2 scroll-mt-4',
  3: 'text-lg font-semibold mt-6 text-primary scroll-mt-4',
  4: 'font-semibold mt-4',
};

export default function Markdown({ text, compact = false }: { text: string; compact?: boolean }) {
  const src = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  const key = () => out.length;

  while (i < src.length) {
    const line = src[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level + (compact ? 2 : 0), 6)}` as 'h1';
      out.push(
        <Tag key={key()} id={compact ? undefined : slug(heading[2])} className={compact ? 'font-semibold' : HEADING[level]}>
          {inline(heading[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < src.length && src[i].trim().startsWith('|')) {
        const cells = src[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={key()} className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>{head.map((c, j) => <th key={j} className="text-left font-semibold px-3 py-2">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k} className="border-t border-line align-top">
                  {r.map((c, j) => <td key={j} className="px-3 py-2">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const item = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (item.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < src.length && (item.test(src[i]) || numbered.test(src[i]) || (/^\s{2,}\S/.test(src[i]) && items.length))) {
        if (item.test(src[i]) || numbered.test(src[i])) items.push(src[i].replace(ordered ? numbered : item, ''));
        else items[items.length - 1] += '\n' + src[i].trim();
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={key()} className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 marker:text-muted`}>
          {items.map((it, k) => <li key={k}>{lines(it)}</li>)}
        </Tag>,
      );
      continue;
    }

    // Parágrafo: junta linhas até uma em branco ou outro bloco.
    const para: string[] = [];
    while (i < src.length && src[i].trim() && !/^(#{1,4}\s|\||\s*[-*•]\s|\s*\d+[.)]\s)/.test(src[i])) {
      para.push(src[i]);
      i++;
    }
    out.push(<p key={key()}>{lines(para.join('\n'))}</p>);
  }

  return <div className={compact ? 'space-y-2' : 'space-y-3 leading-relaxed'}>{out}</div>;
}
