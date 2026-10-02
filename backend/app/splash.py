"""Tela de abertura (janela sem bordas) mostrada enquanto o programa procura
atualização e liga o servidor. O run.py fala com ela por setStatus() e leave()."""

SPLASH_HTML = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  :root { --bg: #0c0b0a; --ink: #f4efe9; --muted: #9c938a; --accent: #fb923c; }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; overflow: hidden; user-select: none; cursor: default; }
  body {
    display: grid; place-items: center; color: var(--ink);
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: radial-gradient(120% 90% at 50% 38%, #22180f 0%, var(--bg) 62%);
  }
  .glow {
    position: absolute; inset: 0; opacity: 0;
    background: radial-gradient(38% 28% at 50% 44%, rgba(251, 146, 60, .20), transparent 70%);
    animation: fade 1.8s .2s ease-out forwards;
  }

  /* Coluna da marca: o subtítulo estica até a largura exata de NEXOS. */
  .mark { position: relative; display: inline-flex; flex-direction: column; margin-top: -28px; }
  .title { display: flex; gap: .2em; font-size: 108px; font-weight: 900; line-height: .9; }
  .title span {
    display: inline-block; opacity: 0; transform: translateY(30px); filter: blur(12px);
    animation: rise 1s cubic-bezier(.2, .8, .2, 1) forwards;
  }
  .title span:nth-child(1) { animation-delay: .10s; }
  .title span:nth-child(2) { animation-delay: .19s; }
  .title span:nth-child(3) { animation-delay: .28s; }
  .title span:nth-child(4) { animation-delay: .37s; }
  .title span:nth-child(5) { animation-delay: .46s; }
  .rule {
    height: 2px; margin: 18px 0 12px; transform: scaleX(0);
    background: linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent);
    animation: grow 1s .8s cubic-bezier(.2, .8, .2, 1) forwards;
  }
  .sub { display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; color: var(--muted); }
  .sub span { opacity: 0; transform: translateY(6px); animation: rise .5s ease-out forwards; }

  .status {
    position: absolute; left: 0; right: 0; bottom: 38px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    font-size: 13px; color: var(--muted); opacity: 0; animation: fade .6s 1.3s forwards;
  }
  .bar { width: 240px; height: 3px; border-radius: 3px; background: rgba(255, 255, 255, .08); overflow: hidden; }
  .bar i { display: block; height: 100%; width: 35%; border-radius: 3px; background: var(--accent); animation: sweep 1.3s ease-in-out infinite; }
  .bar.known i { animation: none; transition: width .25s ease-out; }
  .ver { position: absolute; right: 16px; bottom: 12px; font-size: 11px; color: #5d564f; }

  body.leaving .mark, body.leaving .status, body.leaving .glow { animation: out .38s ease-in forwards; }

  @keyframes rise { to { opacity: 1; transform: none; filter: none; } }
  @keyframes grow { to { transform: scaleX(1); } }
  @keyframes fade { to { opacity: 1; } }
  @keyframes sweep { from { transform: translateX(-110%); } to { transform: translateX(320%); } }
  @keyframes out { to { opacity: 0; transform: scale(1.05); filter: blur(4px); } }
  @media (prefers-reduced-motion: reduce) { * { animation-duration: .01s !important; animation-delay: 0s !important; } }
</style>
</head>
<body>
  <div class="glow"></div>
  <div class="mark">
    <div class="title"><span>N</span><span>E</span><span>X</span><span>O</span><span>S</span></div>
    <div class="rule"></div>
    <div class="sub" id="sub"></div>
  </div>
  <div class="status"><div id="status">Iniciando…</div><div class="bar" id="bar"><i id="fill"></i></div></div>
  <div class="ver">versão __VERSION__</div>
<script>
  // Uma letra por elemento: "justify space-between" espalha até a largura de NEXOS.
  const sub = document.getElementById('sub');
  [...'Enterprise Resource Planning'].forEach((c, i) => {
    const s = document.createElement('span');
    s.textContent = c === ' ' ? '\\u00a0' : c;
    s.style.animationDelay = (1.0 + i * 0.022) + 's';
    sub.appendChild(s);
  });
  function setStatus(text, pct) {
    document.getElementById('status').textContent = text;
    const bar = document.getElementById('bar'), fill = document.getElementById('fill');
    if (pct === null || pct === undefined) { bar.classList.remove('known'); fill.style.width = '35%'; }
    else { bar.classList.add('known'); fill.style.width = Math.round(pct * 100) + '%'; }
  }
  function leave() { document.body.classList.add('leaving'); }
</script>
</body>
</html>
"""


def splash_html(version: str) -> str:
    return SPLASH_HTML.replace("__VERSION__", version)
