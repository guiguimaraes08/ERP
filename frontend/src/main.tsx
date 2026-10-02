import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import type {} from './api'; // tipos globais (window.pywebview)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// No navegador/celular o fade-in começa assim que a tela monta; no programa, quem chama é o run.py.
declare global {
  interface Window {
    __nexosReveal?: () => void;
  }
}
if (!/[?&]desktop=1/.test(window.location.search)) requestAnimationFrame(() => window.__nexosReveal?.());

// Dentro do programa: a barra de título do Windows acompanha o tema claro/escuro.
function syncTitleBar() {
  window.pywebview?.api?.set_title_bar?.(document.documentElement.classList.contains('dark')).catch(() => {});
}
window.addEventListener('pywebviewready', syncTitleBar);
new MutationObserver(syncTitleBar).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
