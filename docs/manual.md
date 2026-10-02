# Manual do Nexos ERP

**PRESTADOR:** Guilherme Guimarães — Founder, Nexos Solutions  
**CLIENTE:** Seu Marcio — Nexos ERP, controle de produção  

Manual de uso do sistema, versão 2.4.0. Escrito em 2 de outubro de 2026.

Este manual também fica dentro do programa, na aba **Ajuda**, e o **Assistente** consegue consultá-lo para responder dúvidas de uso.

## Antes de começar: o que o sistema não faz

Começamos pelo que o Nexos ERP **não** faz, para não haver surpresa depois.

- **Não emite nota fiscal**, não faz contabilidade e não calcula impostos. Ele não substitui o contador.
- **Os dados ficam num computador só.** Não existe sincronização entre dois computadores. Para usar em outra máquina, é preciso levar uma cópia de segurança.
- **Não tem senha.** Quem usar o computador vê tudo. Se o acesso pelo celular estiver ligado, quem estiver no mesmo Wi-Fi também consegue abrir.
- **A agenda é uma previsão**, não uma garantia. Ela calcula pelas horas que você cadastrar. Se o trabalho real demorar mais, a data real muda.
- **O Assistente com IA é opcional e pago à parte**, direto para a empresa que faz a IA (Google ou Anthropic). Ele também precisa de internet.
- **As cópias automáticas ficam no mesmo computador.** Se o computador quebrar ou for roubado, elas vão junto. Por isso, salve uma cópia num pendrive de vez em quando.
- Na primeira vez que abrir o instalador, o Windows pode mostrar o aviso **"O Windows protegeu o computador"**. Isso acontece porque o programa não tem assinatura digital paga. Clique em **Mais informações** e depois em **Executar assim mesmo**.

## Instalação

- **1.** Baixe o instalador. Digite no navegador: github.com/guiguimaraes08/ERP/releases/latest/download/Instalar-Nexos-ERP.exe
- **2.** Dê dois cliques no arquivo baixado e clique em **Avançar** até o fim.
- **3.** O instalador baixa a versão mais nova, cria um ícone na Área de Trabalho e no menu Iniciar, e oferece abrir o programa.

O instalador tem 2 MB. O programa que ele baixa tem 29 MB. Não precisa de senha de administrador.

**Sem internet?** Existe a versão "offline" do instalador (30 MB), que já leva o programa dentro e pode ir num pendrive.

## Como o programa abre

Ao abrir, aparece a tela escura com **NEXOS** e "Enterprise Resource Planning". Nela o programa faz duas coisas:

- **1.** **Procura atualização.** Se houver uma versão nova, ele baixa (com uma barrinha de progresso), se troca sozinho e abre de novo já atualizado. Sem internet, ele pula esta etapa e abre normalmente.
- **2.** **Prepara o sistema** e mostra a tela principal.

A tela de abertura fica pelo menos 2,6 segundos, o tempo da animação. Para fechar o programa, feche a janela como qualquer outro.

Se você clicar no ícone com o programa já aberto, ele não abre outra cópia: só traz a janela aberta para a frente.

## Primeiros passos, na ordem certa

A ordem abaixo não é enfeite. Cada passo usa o que foi cadastrado no anterior.

| Passo | O que fazer | Por que nesta ordem |
| --- | --- | --- |
| 1 | **Ajustes**: o nome do negócio, quanto vale a sua hora e a hora de máquina | O custo de todo produto usa esses dois valores. Se ficarem errados, todos os preços sugeridos saem errados. |
| 2 | **Estoque**: cada insumo, com quanto você paga | O produto é feito de insumos. Sem eles, não há receita. |
| 3 | **Produtos**: a receita de cada um | O pedido puxa preço, custo e tempo do produto. |
| 4 | **Agenda, aba Horários**: quem trabalha e quantas horas por dia | Sem horário, a agenda não consegue prever quando os pedidos ficam prontos. |
| 5 | **Pedidos**: o dia a dia | Com os passos anteriores feitos, o pedido já vem com preço, custo, baixa de estoque e previsão de entrega. |

Quer conhecer antes de cadastrar? Na tela Início, com o sistema vazio, clique em **Ver com dados de exemplo**.

## As telas, uma por uma

### Início

**O que é:** o resumo do negócio num lugar só.

**Para que serve:** saber, de uma olhada, o que precisa de atenção hoje.

**O que mostra:**
- **A receber:** o total dos pedidos que ainda não foram pagos por inteiro. Pedido cancelado não entra.
- **Recebido no mês:** os pagamentos que você lançou neste mês.
- **Vendido e Lucro no mês:** contam **só os pedidos entregues** neste mês. Pedido que ainda não foi entregue não entra no faturamento.
- Os pedidos **atrasados**, os que **vencem nos próximos 3 dias** e os que **vão atrasar pela agenda**.
- O que **vai faltar de material** para os pedidos que ainda não começaram, e o que está **abaixo do mínimo** no estoque.

### Estoque

**O que é:** a lista de tudo o que você usa para produzir: filamento, fita, fecho, embalagem.

**Para que serve:** saber quanto tem, quanto custa e quando comprar.

**Como usar:**
- **Novo insumo:** diga o nome, se você controla em gramas, metros, unidades ou mililitros, e quanto paga ("paguei R$ 110 por 1000 g"). O sistema calcula o custo por grama sozinho.
- **Comprei:** registre a compra ("2 carretéis de 1000 g a R$ 130 cada"). O estoque aumenta e o custo vira a média do que você tem.
- **Contar / ajustar:** quando contar o estoque de verdade, digite quanto tem. O sistema acerta a diferença e anota o motivo.
- **Histórico:** mostra cada entrada e saída, inclusive de qual pedido saiu o material.

**Exemplo real** (calculado pelo próprio sistema): você tinha 1000 g de PLA a R$ 0,11 o grama e comprou mais 2000 g a R$ 0,13. O estoque passa a 3000 g e o custo médio passa a R$ 0,1233 por grama.

### Produtos

**O que é:** a ficha de cada coisa que você vende, com a receita de **uma** unidade.

**Para que serve:** saber quanto cada peça custa de verdade e quanto cobrar.

**Como usar:**
- **1.** Dê o nome e adicione os insumos com a quantidade de uma unidade.
- **2.** Diga quantos minutos do **seu trabalho** e quantos minutos de **máquina** cada unidade leva.
- **3.** Ao lado, a calculadora **Quanto cobrar** mostra o custo e o **preço sugerido** pela margem que você quer. Você pode usar o preço sugerido ou digitar um preço fixo.

**Exemplo real:** um chaveiro com 15 g de PLA, 10 minutos de trabalho e 40 minutos de impressora, com a hora a R$ 25 e a máquina a R$ 2 por hora:

| Parte | Valor |
| --- | --- |
| Insumos (15 g) | R$ 1,85 |
| Seu trabalho (10 min) | R$ 4,17 |
| Máquina (40 min) | R$ 1,33 |
| **Custo por unidade** | **R$ 7,35** |
| **Preço sugerido com margem de 40%** | **R$ 12,25** |
| Sobra por unidade | R$ 4,90 |

**Margem de 40%** quer dizer que 40% do preço de venda é lucro: R$ 4,90 é 40% de R$ 12,25.

Se o preço que você digitar ficar abaixo do custo, o produto aparece com o aviso vermelho **Preço abaixo do custo**.

### Pedidos

**O que é:** cada encomenda, com cliente, itens, prazo e pagamentos.

**Para que serve:** não esquecer nenhum pedido, saber quem ainda deve e controlar o material.

**Como usar:**
- **Novo pedido:** escolha ou digite o cliente (cliente novo é cadastrado sozinho), o prazo e os itens. O preço já vem do produto, e dá para mudar. Para algo fora do catálogo, use **Item avulso**.
- Enquanto você preenche, aparece **quando o pedido fica pronto pela agenda**. Se não der tempo até o prazo, o sistema avisa e oferece o botão **Combinar entrega para…** com uma data que não atrasa os outros pedidos.
- O pedido anda em etapas: **A fazer, Fazendo, Pronto, Entregue**. Os botões **Começar**, **Ficou pronto** e **Entregar** passam de uma etapa para a outra.
- **Recebi:** lance o sinal, uma parte ou o total, por Pix, dinheiro ou cartão. O sistema mostra quanto falta.
- **WhatsApp:** se o cliente tem telefone, o botão abre o WhatsApp com a mensagem pronta ("Seu pedido está pronto…").

**Quando o material sai do estoque:** quando você clica em **Começar**, e não antes. Se o pedido for cancelado ou excluído, o material **volta** para o estoque.

**Exemplo real:** um pedido de 30 chaveiros. Antes de começar havia 3000 g de PLA. Ao clicar em Começar, ficaram 2550 g (30 × 15 g). Ao cancelar, voltou a 3000 g.

Se faltar material para começar, o sistema avisa o que falta. Se você já tem o material e só não registrou, pode seguir assim mesmo; o estoque fica negativo até você contar.

Mudar o preço ou a receita de um produto **não muda os pedidos já anotados**: cada pedido guarda os números do dia em que foi feito.

### Agenda

**O que é:** a previsão de quando cada pedido fica pronto, pelas horas de trabalho de cada dia.

**Para que serve:** combinar prazos que você consegue cumprir e ver antes quais pedidos vão atrasar.

**Como usar:**
- Aba **Horários:** cadastre quem trabalha e quantas horas em cada dia da semana. Há atalhos, como "Seg a sex 8h" e "Seg a sex 6h + sáb 4h". Em **Folgas e dias diferentes**, anote feriado, viagem ou um dia com menos horas, para uma pessoa ou para todo mundo. Em **Máquinas**, diga quantas horas por dia as máquinas rodam (deixe 0 para não considerar).
- Aba **Fila:** mostra a ordem de produção. Primeiro vem o que já está sendo feito; depois, o prazo mais perto. Cada pedido mostra quando começa, quando fica pronto e se tem folga ou vai atrasar.
- Aba **Dia a dia:** mostra quanto de cada dia já está ocupado e por quais pedidos, e quanto sobra livre.

**Exemplo real:** José trabalha 8 horas de segunda a sexta e 4 horas no sábado. Na segunda-feira chegam dois pedidos:

| Pedido | Trabalho | Prazo | Fica pronto | Situação |
| --- | --- | --- | --- | --- |
| 50 chaveiros | 8h20 | terça 06/10 | terça 06/10 | No limite |
| 100 chaveiros | 16h40 | quarta 07/10 | quinta 08/10 | Atrasa 1 dia |

Com isso, dá para avisar o cliente do segundo pedido antes, ou combinar a quinta-feira desde o início.

**Limites da previsão:** um pedido "fazendo" conta como se faltasse ele inteiro (o sistema não sabe quanto já foi feito); o dia de hoje conta inteiro, mesmo que já seja de noite; e as horas de todas as pessoas são somadas, sem dizer quem faz qual pedido.

### Clientes

**O que é:** a lista de quem compra de você.

**Para que serve:** ver quantos pedidos cada um fez, quanto comprou e quanto ainda deve, e mandar mensagem pelo WhatsApp.

### Ajustes

- **Nome do negócio, sua hora, hora de máquina e margem padrão.**
- **Seus dados:** mostra a pasta onde tudo fica (Documentos, pasta Nexos ERP). Tem os botões **Salvar cópia** (escolha um pendrive ou outra pasta), **Voltar uma cópia** e **Abrir pasta**.
- **Assistente com IA:** onde se cola a chave da IA (ver adiante).
- **Usar no celular:** liga o acesso pelo celular (ver adiante).
- **Atualizar sozinho ao abrir:** vem ligado. Se desligar, as versões novas aparecem como um aviso no topo, com o botão **Atualizar agora**.
- **Aparência:** claro, escuro ou automático.

### Ajuda

**O que é:** este manual, dentro do programa. Funciona sem internet.

**Como chegar:** no computador, **Ajuda** fica no pé do menu da esquerda. No celular, em **Ajustes**, botão **Manual de uso**. O Assistente também tem um botão que abre o manual.

**Como usar:** o índice leva direto a cada parte. A busca mostra só os trechos com a palavra procurada (por exemplo, "cópia" ou "prazo"). O botão **PDF** baixa este mesmo manual para imprimir, e o botão **Perguntar ao assistente** abre a conversa com a IA.

### Assistente com IA

**O que é:** o botão **Assistente**, no canto da tela, abre uma conversa com uma inteligência artificial que lê os dados do sistema.

**Para que serve:** perguntar em português comum sobre o negócio e também sobre como usar o sistema, porque ele lê este manual. Por exemplo: "Como foi meu mês?", "O que preciso comprar esta semana?", "Quais produtos dão mais lucro por hora?", "Estou cobrando barato em algum produto?".

**O que precisa:** uma chave de API de uma destas duas empresas. Em **Ajustes, Assistente com IA**, escolha o modelo; o passo a passo e o link mudam conforme a empresa.

| Empresa | Modelos | Onde criar a chave |
| --- | --- | --- |
| Google | Gemini 2.5 Flash | aistudio.google.com/apikey |
| Anthropic | Claude Opus 5.5, Sonnet 5.5, Haiku 4.5 | console.anthropic.com |

Depois de colar a chave, clique em **Salvar** e em **Testar conexão**. Cada empresa tem a sua chave: trocar de modelo não apaga a da outra.

**Quanto custa:** cada empresa cobra pelo uso, no painel dela. Junto com cada pergunta vão o manual e um resumo dos dados: medido com os dados de exemplo, isso dá **cerca de 8 mil "tokens"** (pedaços de texto) por pergunta, sendo uns 6 mil só do manual. O valor sobe conforme o negócio acumula pedidos e conforme o tamanho da resposta. Os valores abaixo são **estimativas**.

- **Claude Opus 5.5** (US$ 4 por milhão de tokens enviados, US$ 20 por milhão de resposta): perto de **5 a 7 centavos de dólar** na primeira pergunta. O sistema pede à Anthropic para guardar a parte fixa (manual e instruções) por alguns minutos; pelo preço publicado, as perguntas seguintes nesse intervalo ficariam perto de **1 a 3 centavos**. Essa economia ainda não foi conferida numa conta real.
- **Gemini 2.5 Flash:** o Google cobra pelo uso e costuma ter uma faixa gratuita. Confira o preço atual em ai.google.dev/pricing. No teste real, o Google não reaproveitou o manual entre uma pergunta e outra: as duas perguntas mandaram os 8 mil tokens inteiros.

**Privacidade:** ao perguntar, a pergunta, o manual e um resumo dos dados (pedidos, nomes de clientes, estoque, preços) são enviados à empresa da IA escolhida (Google ou Anthropic) para gerar a resposta. As chaves ficam gravadas só neste computador, e também dentro das cópias de segurança.

**O que ela não faz:** a IA só lê e sugere. Ela não altera nada no sistema. Ela pode errar: confira os números importantes nas telas do próprio sistema.

### Usar no celular

- **1.** Em **Ajustes, Usar no celular**, ligue a chave.
- **2.** Feche e abra o programa de novo. Se o Windows perguntar sobre a rede, clique em **Permitir**.
- **3.** Volte em Ajustes: aparece um **QR Code**. Aponte a câmera do celular, que precisa estar no mesmo Wi-Fi, e toque no link.
- **4.** No celular, use "Adicionar à tela inicial" para virar um ícone.

O computador precisa estar ligado e com o programa aberto. Não há senha: use só no Wi-Fi de casa.

## Vantagens, e como cada uma foi conferida

Cada vantagem abaixo foi conferida no próprio sistema, versão 2.3.0, antes de entrar neste manual. "Teste automático" quer dizer uma verificação que roda sozinha e confere o resultado; são 49 no total, e todas passaram em 2 de outubro de 2026.

| Vantagem | Como foi conferida |
| --- | --- |
| Funciona sem internet | Conferido no programa montado: as telas não carregam nada de fora. Só a atualização (GitHub) e o Assistente (Google ou Anthropic) usam internet. |
| Seus dados ficam no seu computador | Conferido no código: o banco é um arquivo em Documentos, pasta Nexos ERP. Exceção: o resumo enviado ao Assistente, se você usar. |
| Cópia de segurança automática, uma por dia, guardando 30 dias | Conferido ao abrir o programa: a cópia do dia foi criada na pasta backups. Teste automático da cópia e da restauração. |
| Calcula o custo real e sugere o preço | Teste automático e o exemplo do chaveiro acima (custo R$ 7,35, preço R$ 12,25). |
| Custo médio a cada compra | Teste automático e o exemplo do PLA acima (R$ 0,1233 por grama). |
| O material sai do estoque uma vez só, ao começar, e volta ao cancelar ou excluir | Testes automáticos e o exemplo dos 30 chaveiros acima (3000 g, 2550 g, 3000 g). |
| Avisa o que vai faltar de material, sem contar duas vezes | Testes automáticos. |
| Faturamento conta só pedido entregue; "a receber" desconta pagamentos | Testes automáticos e conferência no Início (R$ 1.637,50 nos dados do exemplo). |
| Agenda prevê a entrega e avisa atraso | Testes automáticos e o exemplo do José acima. |
| Sugere um prazo que não atrasa os outros pedidos | Teste automático. |
| Atualiza sozinho ao abrir | Testado com dois programas reais: a versão 2.3.0 encontrou a 2.3.1, baixou, trocou e abriu já atualizada em 7 segundos (arquivo no próprio computador; pela internet, o tempo depende da conexão, 29 MB). |
| Não fica baixando de novo se uma versão vier com defeito | Teste automático. |
| Abre o celular por QR Code | Teste automático: o QR só existe com o acesso pelo celular ligado. |
| Assistente responde sobre o negócio com os números do sistema | Conversa real com o Gemini 2.5 Flash nos dados de exemplo: "Como foi meu mês?" voltou com vendido R$ 181,80, lucro R$ 72,80, recebido R$ 631,80 e a receber R$ 1.037,62, os mesmos números do Início. Cada resposta levou cerca de 2,4 segundos. |
| Assistente tira dúvida de uso pelo manual | Conversa real com o Gemini: "Como eu registro uma compra de filamento?" foi respondida com a aba Estoque e o botão Comprei, como no manual. |
| Manual dentro do programa, sem internet | Teste automático: a aba Ajuda recebe o manual e o PDF vem do próprio programa. |
| Assistente com erros claros (chave errada, sem internet, sem créditos) | Testes automáticos para Google e Anthropic, e um teste real com chave inválida da Anthropic, que voltou "A chave da API não foi aceita". O Claude ainda não foi testado numa conversa real, por falta de chave. |

## Resumo das telas

| Tela | Use para |
| --- | --- |
| Início | Ver o que precisa de atenção hoje e como está o mês |
| Pedidos | Anotar encomendas, mudar a etapa, lançar pagamentos, avisar pelo WhatsApp |
| Agenda | Cadastrar horários e ver quando cada pedido fica pronto |
| Produtos | Montar a receita e descobrir quanto cobrar |
| Estoque | Registrar compras, contar o estoque, ver o histórico |
| Clientes | Ver quem compra e quem deve |
| Ajustes | Valores da hora, cópias de segurança, IA, celular, atualização |
| Assistente | Perguntar sobre o negócio e sobre como usar o sistema |
| Ajuda | Ler este manual dentro do programa, sem internet |

## O que o sistema faz e o que depende de você

| O sistema faz | Depende de você |
| --- | --- |
| Calcula custo e preço sugerido | Cadastrar o preço real dos insumos e o tempo real de cada produto |
| Baixa e devolve o material dos pedidos | Clicar em Começar e Cancelar na hora certa, e contar o estoque de vez em quando |
| Prevê a entrega | Manter os horários e as folgas em dia |
| Faz uma cópia de segurança por dia | Salvar uma cópia fora do computador (pendrive, nuvem) |
| Mostra quanto falta receber | Lançar cada pagamento recebido |
| Se atualiza sozinho | Abrir o programa com internet de vez em quando |
| Responde perguntas com IA | Ter conta e chave no Google ou na Anthropic, pagar o uso, e conferir os números importantes |

## O que este manual não promete

- **Lucro e prazos não são garantidos.** O sistema faz as contas com os números que você cadastra. Número errado na entrada gera resultado errado na saída.
- **A previsão da agenda é estimativa.** Ela não sabe de imprevisto, máquina quebrada ou pedido que demorou mais que o normal.
- **O custo da IA é estimado.** O valor real é o cobrado pela empresa da IA e aparece no painel dela.
- **Atualizações dependem do GitHub e da internet.** Se um deles estiver fora do ar, o programa abre na versão que já está instalada.
- **A cópia de segurança só protege se existir fora do computador.** As cópias automáticas ficam no mesmo disco.

## Problemas comuns

**O programa não abre e aparece "O Windows protegeu o computador".**  
Clique em Mais informações e depois em Executar assim mesmo. Só precisa na primeira vez.

**Mudei de computador. Como levo meus dados?**  
No computador antigo: Ajustes, Salvar cópia, num pendrive. No novo: instale, abra, vá em Ajustes, Voltar uma cópia, e escolha o arquivo do pendrive.

**Fiz besteira e quero voltar ao dia anterior.**  
Em Ajustes, Abrir pasta, entre em backups: há uma cópia por dia. Use Voltar uma cópia e escolha a do dia certo. O estado atual é guardado antes, por segurança.

**O estoque está diferente do real.**  
No Estoque, use Contar / ajustar e digite a quantidade real. O Histórico mostra de onde veio a diferença.

**A agenda diz que vai atrasar.**  
Veja a aba Fila: dá para combinar outro prazo com o cliente, anotar um sábado a mais em Folgas e dias diferentes, ou começar antes o pedido que está atrasando.

**O Assistente diz que a chave não foi aceita.**  
Confira se a chave foi colada inteira em Ajustes, Assistente com IA, se o modelo escolhido é da mesma empresa da chave, e se a conta tem créditos ou limite de uso.
