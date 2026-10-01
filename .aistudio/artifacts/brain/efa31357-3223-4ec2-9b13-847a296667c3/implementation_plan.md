# ForgeFlow Industrial ERP — Sistema de Gestão de Produção, Inventário e Faturamento

Plataforma de alta densidade operacional e estética industrial (Dark Mode padrão Linear/Raycast) projetada para controle integrado de manufatura híbrida — especializada em impressão 3D, confecção de cordões/acessórios e manufatura sob encomenda —, integrando controle de matérias-primas, projetos, faturamento com ROI/lucro por hora, detecção de gargalos produtivos e cálculo de IPPM.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisões Alinhadas na Fase 1:**
> - **Segmento de Atuação:** Foco prioritário na operação de Impressão 3D e expansão flexível para manufatura personalizada (cordões têxteis, produtos sob encomenda, corte, montagem e acabamento manual).
> - **Infraestrutura de Dados:** Inicialização estruturada com **Banco de Dados Google (Firebase Firestore & Auth)** com sincronização em tempo real e utilitário local de espelhamento/exportação em formato compatível com **Python e SQLite**.
> - **Direção Visual:** *Dark Mode Industrial* de alta densidade no padrão estético Linear e Raycast, com números tabulares verticais, paleta de alto contraste sem ruídos e microinterações táteis.

---

### [PLANO] — Arquitetura de Design & UX (Staff Design Engineer)

1. **Objetivo da interface:**
   Resolver o atrito operacional de pequenos e médios fabricantes e makers (impressão 3D, cordões, montagens customizadas) que operam múltiplos projetos simultaneamente. A tela resolve a rastreabilidade instantânea entre: custo real de insumos (gramas de filamento, metros de cordão, fechos, energia) + tempo de máquina + valor da mão de obra direta vs. preço cobrado e faturamento, permitindo saber se a operação está dando lucro real por hora gasta e onde a produção trava.
2. **Referência de estilo:**
   - *Linear App:* Densidade de listagens, atalhos de teclado rápidos, separadores de 1px sutis e paleta dark sem estridência.
   - *Raycast:* Acabamento refinado de componentes, estados de foco luminosos controlados e feedback tátil de ações industriais.
3. **Sistema de grid e spacing:**
   - Grid atômico baseado em múltiplos de 4px (`4, 8, 12, 16, 20, 24, 32, 48, 64px`).
   - Layout de tela inteira (baseline 1440px): Sidebar técnica de 260px fixa com navegação contextual, barra de comando superior de 56px e viewport de dados com padding de 24px (`p-6`).
4. **Escala tipográfica:**
   - Fontes: `Cabinet Grotesk / Plus Jakarta Sans` para títulos e comandos + `JetBrains Mono / font-mono tabular-nums` para todas as grandezas físicas (gramas, metros, horas, tolerâncias) e financeiras (R$, %, IPPM).
   - Escala modular (razão 1.25):
     - Display / Kicker: 24px / 28px (`font-semibold tracking-tight`)
     - H2 / Seções: 18px / 24px (`font-medium tracking-tight`)
     - Corpo / Controles: 14px / 20px (`font-normal`)
     - Metadados e Tabela: 12px / 16px (`font-medium`)
     - Micro-legenda: 11px / 14px (`font-normal tracking-wide`)
5. **Paleta de cores (Tokens exatos):**
   - Canvas Neutro (60%): `#090B0E` (fundo principal com leve frieza industrial)
   - Superfícies e Cards (30%): `#11141A` (cards primários) e `#181C24` (superfícies elevadas e dropdowns)
   - Bordas e Divisores: `#222834` (1px sólido com opacidade controlada)
   - Acento Industrial Primário (10%): `#F59E0B` (Laranja/Âmbar usinagem) — Hover: `#FBBF24`, Active: `#D97706`, Focus ring: `rgba(245, 158, 11, 0.25)`
   - Semântica de Estado:
     - Nominal / Operação Estável: `#10B981` (Esmeralda técnico)
     - Gargalo / Atenção de Insumo: `#F59E0B` (Âmbar)
     - Falha Crítica / Estoque Zerado / Sucata: `#EF4444` (Rubi industrial)
     - Fluxo / Máquina Ativa: `#38BDF8` (Ciano de precisão)
6. **Hierarquia visual e fluxo do olho:**
   - Âncora 1 (Topo): Faixa de pulso operacional com 4 KPIs condensados (Lucro/Hora atual, ROI ponderado, IPPM - Defeitos por Milhão, e Gargalo de Produção identificado).
   - Âncora 2 (Centro-Navegação): Barra de comando com busca em tempo real (`Ctrl/Cmd + K`), filtros rápidos por categoria (Filamentos 3D, Insumos Cordões, Ferragens, Embalagens) e alternador de visão (Inventário, Projetos/Ordens, Faturamento e Simulador Preditivo).
   - Âncora 3 (Tabela e Ação): Grade de alta densidade com ações rápidas na linha (entrada rápida, baixa, histórico de lotes) e painel lateral (Drawer) deslizante para edição aprofundada sem perda de visão global.
7. **Componentes, estados e motion:**
   - Componentes: TopBar técnica, KPI Strip, Barra de Filtros Multifatoriais, Tabela de Inventário Tabular, Visualizador de Fórmulas de Custo (BOM - Bill of Materials), Modal de Cadastro Rápido, Drawer de Detalhamento e Exportador SQLite/Python.
   - Estados: `default`, `hover`, `active`, `focus-visible`, `loading-skeleton` (linhas correspondentes exatas sem layout shift), `empty-state` orientado à ação com botão de seed industrial.
   - Motion: Curva customizada `cubic-bezier(0.16, 1, 0.3, 1)`, durações de 120ms (botões) a 220ms (gavetas laterais e abas).
8. **Neutralização de vícios de "cara de IA":**
   - Sem gradientes arroxeados ou azuis pastéis genéricos;
   - Sem cards com cantos excessivos de 24px com sombras flutuantes descontextualizadas;
   - Sem tags de status em formato de cápsula estática ("pills") espalhadas; status exibido com texto tipográfico limpo e ponto de status discreto;
   - Vocabulário e regras reais de chão de fábrica: densidade do carretel (g/cm³), tempo de fatiamento vs. impressão real, taxa de falha (IPPM), custo de hora-homem e depreciação horária de bico e mesa.

---

### 1. Visão Geral e Módulos do Sistema

O **ForgeFlow ERP** foi desenhado especificamente para quem fabrica:
- **Gestão de Inventário em Tempo Real:** Registro com rastreabilidade de bobinas de filamento (PLA, PETG, ABS, TPU), cordões sintéticos em rolos (metros), ponteiras/mosquetões (unidades) e consumíveis de pós-processamento.
- **Engenharia de Custos & Composição (BOM):** Cálculo dinâmico do custo unitário somando:
  $$\text{Custo Total} = \text{Custo dos Materiais} + (\text{Tempo de Máquina} \times \text{Taxa Horária}) + (\text{Mão de Obra} \times \text{Valor Hora}) + \text{Depreciação/Energia}$$
- **Painel de Métricas Industriais:**
  - *Lucro Médio por Hora Operada (R$/h):* Margem líquida dividida pelas horas produtivas totais.
  - *ROI Real Atual (%):* Retorno sobre o investimento em maquinário, ferramentas e estoque imobilizado.
  - *IPPM (Índice de Peças Defeituosas por Milhão):* Indicador global de qualidade industrial:
    $$\text{IPPM} = \left(\frac{\text{Peças Reprovadas / Descartadas}}{\text{Total de Peças Produzidas}}\right) \times 1.000.000$$
  - *Tempo Médio de Operação (TMO):* Ciclo médio de produção por tipo de lote.
  - *Detector de Gargalos Produtivos:* Alerta preditivo que cruza a fila de ordens ativas com a capacidade das máquinas e o estoque de insumos disponíveis.
- **Exportador para Python & SQLite Local:**
  - Exportação com 1 clique de um script executável em Python (`export_db.py`) e do arquivo de esquema SQL que recria a base SQLite localmente em segundos, garantindo autonomia e privacidade de dados.

---

### 2. Arquitetura de Dados e Integração

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ForgeFlow Industrial UI                         │
│  (Tailwind CSS v4 + React 19 + Lucide Icons + Motion + Tabular Nums)   │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
       Real-Time Sync State              Local SQLite Sync & Python
                    │                               │
┌───────────────────▼───────────┐       ┌───────────▼────────────────────┐
│   Google Firebase Service     │       │   Local Offline Cache & Script │
│   - Firestore Collections     │       │   - SQLite DDL & Insert Export │
│   - Google Auth / Session     │       │   - Python Standalone Runner   │
│   - Real-Time Listeners       │       │   - Backup JSON/CSV completo   │
└───────────────────────────────┘       └────────────────────────────────┘
```

#### Entidades Principais:
1. `inventory_items`: Insumos e matérias-primas (ID, nome, código SKU, categoria, quantidade atual, estoque mínimo, unidade de medida, custo unitário, fornecedor, histórico de reposição).
2. `production_projects`: Ordens de fabricação e projetos (ID, título, cliente, status, data de entrega, lista de materiais consumidos, horas de máquina estimadas/reais, horas de mão de obra direta, preço final de venda).
3. `operations_log`: Registro de execuções de máquina e apontamento de produção (ID, projeto, máquina, tempo de início/fim, peças boas, peças rejeitadas, causa de refugo para cálculo de IPPM).
4. `financial_ledger`: Faturamento, custos diretos, custos fixos absorvidos, margem de contribuição e retorno calculado.
5. `clients`: Cadastro de clientes atendidos com histórico de pedidos e faturamento acumulado.

---

### 3. Fases de Execução da Próxima Etapa

1. **Configuração e Provisão do Banco Google Firebase:**
   - Iniciar o fluxo com a ferramenta de configuração `show_aistudio_ui` / `set_up_firebase`, gerando a infraestrutura de dados e regras de segurança para Firestore.
2. **Desenvolvimento da Camada de Componentes:**
   - Estrutura base de Layout Industrial com TopBar e navegação semântica.
   - Componente de Métricas e KPIs (Lucro/Hora, ROI, IPPM, TMO, Gargalos).
   - Tabela de Inventário de Alta Densidade com busca instantânea, ordenação e filtros avançados por status e tipo de matéria-prima.
   - Drawer de Cadastro e Movimentação com cálculo de custo automático.
   - Módulo de Ordens de Fabricação & Projetos com árvore de insumos (BOM).
   - Centro de Exportação com visualizador e download do script Python + SQLite local.
3. **Validação e Compilação:**
   - Verificação rigorosa com `compile_applet` e testes de fluxo interativo.
