import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

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
