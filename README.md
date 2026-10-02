# Nexos ERP

Controle de produção para quem fabrica em casa: impressão 3D, cordões, chaveiros, acessórios sob encomenda.
É **um programa só (`Nexos ERP.exe`)**, que roda no computador sem internet e sem instalar nada.

- **Estoque**: cadastre o insumo dizendo "paguei R$ 110 por 1000 g"; o sistema calcula o custo por grama. Cada compra atualiza o custo médio.
- **Produtos**: monte a receita uma vez (insumos + minutos de trabalho + minutos de máquina). O sistema mostra o custo e **sugere o preço**.
- **Pedidos**: cliente, itens, prazo, pagamentos (sinal, parcial, total) e botão de WhatsApp. O material sai do estoque quando você **começa** o pedido e volta se cancelar.
- **Agenda**: diga quem trabalha e quantas horas em cada dia (ex.: seg–sex 8h, sábado 4h) e as folgas. O sistema monta a
  fila pelos prazos e mostra quando cada pedido fica pronto, o que vai atrasar e quanto do dia está livre. Ao anotar um
  pedido ele já diz "fica pronto por volta de qua 08/10" e sugere um prazo seguro para combinar com o cliente.
- **Assistente com IA**: botão no canto da tela abre um chat que analisa os pedidos, estoque, preços e agenda
  ("como foi meu mês?", "o que preciso comprar?", "estou cobrando barato?"). Também tira dúvidas de uso, porque lê o manual. Usa o Gemini (Google) ou o Claude (Anthropic): precisa de
  internet e de uma chave da API (Ajustes → Assistente com IA). A pergunta, o manual e um resumo dos dados vão para a
  empresa da IA escolhida.
- **Início**: o que está atrasado, o que vence em 3 dias, quanto tem a receber, quanto entrou no mês e o que vai faltar de material.

---

## Para quem vai usar

O passo a passo completo, com exemplos e as vantagens conferidas, está na aba **Ajuda** do programa e em **docs/Manual do Nexos ERP.pdf**.

1. Baixe o instalador: **https://github.com/guiguimaraes08/ERP/releases/latest/download/Instalar-Nexos-ERP.exe**
2. Dê dois cliques e vá em **Avançar** até o fim. Ele baixa a versão mais nova e cria o ícone na Área de Trabalho.
3. Para usar, clique no ícone **Nexos ERP**. Para fechar, feche a janela, como qualquer programa.

**Se o Windows mostrar "O Windows protegeu o computador":** clique em **Mais informações → Executar assim mesmo**.
Aparece porque o programa não tem assinatura digital paga.

**Sem internet?** Use o instalador *offline* (pendrive). Ou copie só o `Nexos ERP.exe` e abra direto: ele funciona sem instalar.

**Atualizações:** toda vez que o programa abre, a tela de abertura procura uma versão nova no GitHub; se tiver, ela
baixa (com barra de progresso) e o programa reabre já atualizado. Sem internet, abre normalmente. Dá para desligar em
**Ajustes → Atualizar sozinho ao abrir**; nesse caso aparece um aviso no topo com o botão **Atualizar agora**.

**Seus dados** ficam em `Documentos\Nexos ERP`. Atualizar, reinstalar ou desinstalar não apaga nada.
- Todo dia o programa guarda sozinho uma cópia na pasta `backups` (as dos últimos 30 dias).
- Em **Ajustes → Salvar cópia** você grava uma cópia onde quiser (pendrive, Google Drive…).
- Em **Ajustes → Voltar uma cópia** você restaura uma cópia, por exemplo num computador novo.

**No celular:** em **Ajustes → Usar no celular**, ligue a chave e abra o programa de novo. Aparece um **QR Code**: aponte
a câmera do celular, no mesmo Wi-Fi, e toque no link. No celular dá para "Adicionar à tela inicial" e ele vira um ícone.
Se o Windows perguntar sobre a rede, clique em **Permitir**. Não há senha: qualquer pessoa no seu Wi-Fi consegue abrir.

---

## Para quem desenvolve

Requisitos: Python 3.11+ e Node.js 20+.

```bash
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd frontend && npm install && npm run build && cd ..
.venv/Scripts/python run.py              # abre a janela do programa
.venv/Scripts/python run.py --navegador  # ou no navegador
```

Rodando do código, os dados ficam em `data/` dentro do projeto (no `.exe`, em Documentos).
Para apontar para outra pasta: variável `ERP_DATA_DIR`.

### Gerar o programa e os instaladores

```bash
.venv/Scripts/pip install -r backend/requirements-build.txt
.venv/Scripts/python build.py
```

Sai tudo em `dist/` (os instaladores só se o [Inno Setup 6](https://jrsoftware.org/isdl.php) estiver instalado):

| Arquivo | Para quê |
|---|---|
| `Nexos ERP.exe` | o programa: um arquivo só, com Python, servidor e tela dentro (~17 MB) |
| `Nexos-ERP.exe` | o mesmo, com o nome que a atualização automática e o instalador procuram na Release |
| `Instalar-Nexos-ERP.exe` | instalador pequeno que baixa a última versão do GitHub |
| `Instalar-Nexos-ERP-offline.exe` | instalador com o programa dentro |

### Manual

A fonte é `docs/manual.md`. Dela saem a aba Ajuda, o que o Assistente lê e o PDF. Depois de editar, gere o PDF de novo
(gerador de documentos da Nexos) e rode o `build.py`, que coloca os dois dentro do .exe.

### Publicar uma versão nova

1. Suba o número em `backend/app/__init__.py` (`__version__`).
2. `python build.py`.
3. Crie uma Release no GitHub com a tag `vX.Y.Z` e anexe **`Nexos-ERP.exe`** e os dois instaladores.
   O texto da Release aparece para o usuário em "O que mudou".

Os programas instalados avisam a versão nova sozinhos. O link do instalador no topo deste README sempre baixa a última.

### Mexendo na tela com recarga automática

```bash
# terminal 1: API
cd backend && ../.venv/Scripts/python -m uvicorn app.main:app --reload --port 8765
# terminal 2: tela (Vite repassa /api para a 8765)
cd frontend && npm run dev
```

Abra http://localhost:5173. Documentação da API: http://127.0.0.1:8765/docs.

### Testes

```bash
cd backend && ../.venv/Scripts/python -m pytest
```

### Estrutura

```
run.py                 abre o programa: tela de abertura, atualização, servidor e janela (pywebview)
build.py               gera o .exe (PyInstaller) e os instaladores (Inno Setup)
installer/NexosERP.iss script do instalador
assets/icone.ico       ícone do programa
backend/app/
  main.py              FastAPI: rotas /api + serve a tela
  db.py                SQLite, pasta dos dados, backup automático
  schemas.py           validação de entrada
  services/pricing.py  custo do produto e preço sugerido
  services/stock.py    baixa, estorno e falta de material
  services/updates.py  atualização automática pelas Releases do GitHub
  services/schedule.py agenda: horas por dia, fila de pedidos e previsão de entrega
  services/assistant.py assistente com IA: resumo dos dados + conversa com o Claude (SDK anthropic)
  routers/             materials, products, orders, customers, system
  seed.py              dados de exemplo
  splash.py            tela de abertura (NEXOS / Enterprise Resource Planning)
backend/tests/         regras de negócio (estoque, preço, pagamento, backup)
frontend/src/
  api.ts  format.ts  ui.tsx
  pages/               Início, Pedidos, Agenda, Produtos, Estoque, Clientes, Ajustes
```

### Regras que valem a pena saber

- **Preço sugerido** = custo ÷ (1 − margem). Margem de 40% significa que 40% do preço de venda é lucro.
- **Pedido guarda uma "foto" do produto**: mudar preço ou receita depois não altera pedidos já anotados.
- **Estoque** baixa uma vez só (ao entrar em "Fazendo", "Pronto" ou "Entregue"). Voltar para "A fazer", cancelar ou excluir devolve exatamente o que saiu.
- **Falta de material** bloqueia o início do pedido, mas dá para seguir assim mesmo (o estoque fica negativo até contar/ajustar).
- **Vendido no mês** conta só pedidos entregues; **recebido** conta só pagamentos registrados.
- **Agenda**: a fila tem primeiro os pedidos "fazendo", depois o prazo mais perto (sem prazo vai para o fim). As horas de
  cada dia (soma das pessoas, com folgas e exceções) vão sendo gastas na ordem da fila; hoje conta inteiro. As máquinas,
  se configuradas, têm fila própria em paralelo, e o pedido fica pronto quando as duas partes acabam. O tempo vem dos
  minutos de trabalho/máquina do produto, congelados no pedido. Pedido "fazendo" conta como se faltasse ele inteiro.
- **Assistente**: a cada pergunta o backend monta uma "foto" dos dados (`build_snapshot`) e chama o Claude com
  streaming (`claude-opus-5-5` por padrão, `effort: medium`, `fallbacks: "default"`). A chave fica na tabela
  `settings` (`ai_api_key`) e só pode ser trocada pelo próprio computador. A IA só lê, não altera nada.
- Insumos e produtos são **arquivados**, não apagados, para o histórico continuar fazendo sentido.
