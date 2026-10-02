import { Boxes, CalendarDays, ClipboardList, Home, Package, Settings as SettingsIcon, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import type { Settings } from './api';
import Agenda from './pages/Agenda';
import Ajustes from './pages/Ajustes';
import Clientes from './pages/Clientes';
import Estoque from './pages/Estoque';
import Inicio from './pages/Inicio';
import Pedidos from './pages/Pedidos';
import Produtos from './pages/Produtos';
import { FeedbackProvider, prefetch, slide, useLoad, type SlideDirection } from './ui';
import UpdateBanner from './UpdateBanner';

export type Route = 'inicio' | 'pedidos' | 'agenda' | 'produtos' | 'estoque' | 'clientes' | 'ajustes';

const NAV: { route: Route; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { route: 'inicio', label: 'Início', icon: Home },
  { route: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { route: 'agenda', label: 'Agenda', icon: CalendarDays },
  { route: 'produtos', label: 'Produtos', icon: Package },
  { route: 'estoque', label: 'Estoque', icon: Boxes },
  { route: 'clientes', label: 'Clientes', icon: Users },
  { route: 'ajustes', label: 'Ajustes', icon: SettingsIcon },
];

/** Rota no hash (#/pedidos?status=a_fazer): o botão voltar do navegador funciona. */
function readHash(): { route: Route; params: URLSearchParams } {
  const [path, query] = window.location.hash.replace(/^#\/?/, '').split('?');
  const route = NAV.some((n) => n.route === path) ? (path as Route) : 'inicio';
  return { route, params: new URLSearchParams(query) };
}

export function go(route: Route, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  window.location.hash = `/${route}${query}`;
}

export default function App() {
  const [location, setLocation] = useState(readHash);
  const current = useRef(location);
  const settings = useLoad<Settings>('/settings');

  useEffect(() => {
    // Trocar de tela desliza: para a direita quem fica depois no menu, para a esquerda quem fica antes.
    const order = (r: Route) => NAV.findIndex((n) => n.route === r);
    const onChange = () => {
      const next = readHash();
      const from = order(current.current.route);
      const to = order(next.route);
      const direction: SlideDirection = to > from ? 'forward' : to < from ? 'back' : 'none';
      current.current = next;
      slide(direction, () => {
        setLocation(next);
        window.scrollTo(0, 0);
      });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    // Deixa todas as telas carregadas: assim elas já entram prontas, sem "Carregando…".
    const t = setTimeout(() => {
      prefetch([
        '/dashboard', '/orders?status=abertos', '/schedule', '/products', '/materials',
        '/customers', '/workers', '/workers/exceptions', '/info', '/update',
      ]);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (settings.data) document.title = settings.data.business_name;
  }, [settings.data]);

  const { route, params } = location;

  return (
    <FeedbackProvider>
      <div className="min-h-screen sm:flex">
        {/* Menu lateral (computador) */}
        <aside className="side-nav hidden sm:flex sm:flex-col w-60 shrink-0 border-r border-line bg-surface sticky top-0 h-screen px-3 py-5">
          <div className="px-3 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Nexos ERP</div>
            <div className="font-bold text-lg leading-tight truncate">{settings.data?.business_name ?? '…'}</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ route: r, label, icon: Icon }) => (
              <a
                key={r}
                href={`#/${r}`}
                className={`flex items-center gap-3 px-3 h-10 rounded-lg text-[15px] font-medium transition-colors ${
                  route === r ? 'bg-primary-soft text-primary' : 'text-muted hover:text-ink hover:bg-surface-2'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </a>
            ))}
          </nav>
          <p className="mt-auto px-3 text-xs text-muted">Seus dados ficam só neste computador.</p>
        </aside>

        <main className="page-area flex-1 min-w-0 px-4 sm:px-8 pt-5 sm:pt-8 pb-28 sm:pb-12 max-w-5xl">
          <UpdateBanner />
          {route === 'inicio' && <Inicio settings={settings.data} />}
          {route === 'pedidos' && <Pedidos initialStatus={params.get('status')} openId={params.get('id')} />}
          {route === 'agenda' && <Agenda initialTab={params.get('aba')} />}
          {route === 'produtos' && <Produtos />}
          {route === 'estoque' && <Estoque initialFilter={params.get('filtro')} />}
          {route === 'clientes' && <Clientes />}
          {route === 'ajustes' && <Ajustes onSaved={settings.reload} />}
        </main>

        {/* Barra inferior (celular) */}
        <nav className="tab-bar sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line grid grid-cols-7 pb-[env(safe-area-inset-bottom)]">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <a
              key={r}
              href={`#/${r}`}
              className={`flex flex-col items-center justify-center gap-0.5 h-16 text-[10px] font-medium ${
                route === r ? 'text-primary' : 'text-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </a>
          ))}
        </nav>
      </div>
    </FeedbackProvider>
  );
}
