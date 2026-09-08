---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-09-07
owner: willians
---

# Índice — Jocley Grill

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-jocley-lanchonete/` com sufixo `-jocley-lanchonete`.
Código-fonte real em `lanchonete-sistema/` (fora do Obsidian).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-jocley-lanchonete]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado; explica a origem do sistema como combinação deliberada de vilamill-sistema + sistema-thieco |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-jocley-lanchonete]] | @pm | Contexto de lanchonete sem PDV nem CMV calculado, problema de segregação de acesso por papel, hipótese de reaproveitar dois sistemas irmãos, escopo e métricas |
| [[requisitos-funcionais-jocley-lanchonete]] | @pm | 132 RFs em 17 módulos: autenticação/RBAC, PDV (mesas+balcão, quantidade na venda **com digitação e Enter**, **Fechar comanda/solicita conta separado de Finalizar — só o caixa finaliza; ao Fechar, a comanda completa sai automaticamente na impressora do Caixa, com retorno visível se falhar**), pedidos (**edição de preço de item restrita ao caixa**), cardápio (**categorias configuráveis** + flag "enviar para cozinha" que já vem desmarcada por categoria sem preparo), CMV, estoque (com valor total + filtro oculto pra não-ADMIN, entrada rápida de estoque e rendimento do insumo no custo efetivo), KDS (filtro por mesa + exclusão de item sem preparo + **card com número da mesa/comanda e nome do cliente** + ficha de produção/bebida segmentada Cozinha/Caixa, enfileirada e impressa por um Agente no PC do caixa + reimpressão manual), cupom térmico (com **nome do cliente**, **CSS escurecido pra sair legível** e **correção de duplicação em comandas longas**), financeiro, inteligência financeira (Calculadora de Metas + **gráfico de Pico de Horário com drill-down por horário: ticket médio, nº de comandas e formas de pagamento ao clicar na barra**), despesas (com **nome do cliente + filtro**), lançamentos (com **coluna cliente + reimpressão de cupom**), gestão de time, configurações (Taxas de Delivery + WhatsApp real via Evolution API + aba Impressoras Cozinha/Caixa + **abas Mesas e Categorias do Cardápio configuráveis**), usuários, tratamento e registro de erros, permissões granulares por usuário (**que desde 2026-09-06 também governam a autorização de API das rotas de gestão, não só a visibilidade da aba**) |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-jocley-lanchonete]] | @architect | Stack (Next.js 15 + Prisma + PostgreSQL + NextAuth v5 + SWR + Recharts + Docker + Nginx/Certbot em produção + `node-thermal-printer` para as fichas de Cozinha/Caixa), camadas, fluxos de dados (abertura de comanda, **Fechar/solicitar conta separado de Finalizar com pagamento**, cálculo de CMV com custo efetivo por rendimento, entrada rápida de estoque, **ficha de pedido consolidada por "Confirmar Pedido" (não mais por item) segmentada Cozinha/Caixa + ficha de conta**, para o Agente de Impressão), segurança (RBAC de página no middleware + **autorização de API por permissão granular** — `guardPermissao()`/`guardPermissaoQualquer()` desde 2026-09-06, `guardGestor()`/`guardAdmin()` removidos; `guardCaixa()` mantido por papel pra separação atendente/caixa + guard de identidade `devmaster` + tratamento de erro), integração com Evolution API (WhatsApp) via rede Docker `orbita_shared` + impressoras de Cozinha (rede) e Caixa (**rede ou USB local**, fila + Agente de Impressão no PC do caixa), deploy em produção (VPS compartilhada, `jocleygrill.online`, via `docker compose build/up`), histórico de versão (v1.0 a v1.40) |
| [[modelo-de-dados-jocley-lanchonete]] | @data-engineer | 21 entidades com schema Prisma real (User com 5 roles + conta `devmaster` oculta + permissões granulares opcionais, Order com tipo MESA/BALCAO + nome do cliente + **`contaSolicitada`/`contaSolicitadaEm`/`contaSolicitadaPor`**, ContadorComanda, Product com categoria string livre alimentada por lista configurável, RecipeItem, Ingredient com rendimento percentual (custo efetivo), OrderItem com **`enviadoImpressaoEm`** (controla a ficha consolidada do "Confirmar Pedido"), Table (mesas criáveis/removíveis em Configurações), TaxaPagamento com bandeira opcional, TaxaDelivery por canal, Despesa recorrente + nome do cliente, Funcionario/Feedback/PlanoAcao/Sugestao, ConfiguracaoGeral (telefone WhatsApp + **`categorias_cardapio`** com flag "vai para a cozinha" por categoria), ErrorLog, **Impressora** (papéis `PRODUCAO_COZINHA`/`CAIXA`, conexão `REDE`/`USB_LOCAL`) + **FilaImpressao** (fila consumida pelo Agente de Impressão no PC do caixa, rede ou USB local)), ENUMs, regras de cálculo de CMV, taxa e Calculadora de Metas |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-jocley-lanchonete]] | @ux-design-expert | 5 princípios de design (cores claras de restaurante, papel define o que se vê), tokens de cor de marca (`brand-primary` laranja queimado, `brand-accent` dourado), voz e governança |
| [[ui-kit-jocley-lanchonete]] | @ux-design-expert | Inventário de Sidebar/Navbar role-aware, MesaGrid, ComandaItens, PagamentoSplitDialog, KdsBoard, CardapioCalculoTable, templates de todas as 17 telas |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-jocley-lanchonete]] | @ux-design-expert | Pesquisa a partir do briefing direto do cliente (áudio transcrito), jornadas de Atendente/Admin/Supervisor, arquitetura de navegação por papel, fluxos de comanda/CMV/criação de usuário, testes que revelaram os dois bugs corrigidos na mesma sessão |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-jocley-lanchonete]] | @pm / todos | 43 decisões cronológicas: bootstrap do schema, PDV core, cardápio+estoque+CMV, KDS, dashboard financeiro, taxa afetando Receita Líquida, Inteligência Financeira, despesas recorrentes, gestão de time, configurações, correção do bloqueio de API dos papéis operacionais, correção do redirect de login para porta errada, papéis Supervisor/Atendente + Usuários, taxa por bandeira de cartão, rebranding "Jocley Grill" + repositório Git próprio, Taxas de Delivery + Calculadora de Metas, card de valor total + filtro no Estoque (com correção de bug de hidratação), sistema de tratamento e registro de erros + conta `devmaster`, push para o GitHub, deploy em produção na VPS compartilhada + domínio jocleygrill.online, correção de build (pasta `public/` ausente), correção de conflito de porta do Postgres (configurável via `POSTGRES_HOST_PORT`), cardápio real cadastrado (dois cardápios) + favicon provisório, dez melhorias operacionais (KDS filtrado, quantidade na venda, estoque oculto, permissões granulares, WhatsApp real via Evolution API), correção de rede Docker pro WhatsApp alcançar a Evolution API (rede `orbita_shared`), correções pós-deploy do WhatsApp (DDI automático, botão Desconectar, campo de dias da periodicidade, disparo respeitando a periodicidade), rendimento do insumo + custo efetivo no CMV, PDV lista todos os produtos + entrada rápida de estoque + ficha técnica do Espeto de Contrafilé + categorias canônicas do cardápio, correção do erro de sessão quebrada da Evolution (sendMessage undefined) + esclarecimento dos cards de WhatsApp em Configurações, troca da porta default do Postgres local (5434→5436), Enter para salvar nos formulários de Produtos/Insumos/Despesas/Usuários, rodapé "Fechar Comanda" alinhado à coluna de itens no desktop, primeira forma de pagamento pré-preenchida com o total + correção do botão "Adicionar forma de pagamento", confirmação da estratégia de impressão (cozinha só no KDS, sem ficha física) + código curto da comanda no cupom térmico, **"Nome do Cliente" em Despesas e Lançamentos + reimpressão de cupom pela aba Lançamentos**, **porta fixa 3002 para o dev server local**, **impressão de rede ESC/POS da ficha de produção na Cozinha (reverte "só KDS") + aba Impressoras em Configurações + correção do cupom claro do Caixa**, **impressão da Cozinha: de socket direto para fila (`FilaImpressao`) + Agente de Impressão no PC do caixa**, **segmentação de impressão Cozinha/Caixa (com USB local) + separação Fechar (atendente)/Finalizar (caixa) + edição de preço/desconto restrita ao caixa + correção do cupom duplicado (`position:fixed`→`absolute`) + Enter/quantidade digitável no lançamento de item**, **ficha de pedido consolidada ("Confirmar Pedido", uma folha por rodada em vez de picada por item) + retorno visível de sucesso/falha da impressão**, **correção de fuso horário na impressão + letra maior no item**, **confirmação do Agente atualizado no PC do caixa + correção de dados de 12 bebidas cadastradas indo pra Cozinha**, **visual "fast-food ticket" (estilo McDonald's) nas fichas ESC/POS** |

---

## Ordem de leitura recomendada

```
system-creation-jocley-lanchonete
        ↓
   prd-jocley-lanchonete
        ↓
requisitos-funcionais-jocley-lanchonete
        ↓
arquitetura-jocley-lanchonete  ←→  design-system-jocley-lanchonete
        ↓                                  ↓
modelo-de-dados-jocley-lanchonete       ui-kit-jocley-lanchonete
        ↓                                  ↓
        └────── ux-flows-jocley-lanchonete ┘
                        ↓
        registro-de-decisoes-jocley-lanchonete (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-jocley-lanchonete  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-jocley-lanchonete  ←  regra de negócio alterada
  - arquitetura-jocley-lanchonete            ←  decisão técnica estrutural (ex: nova migration)
  - modelo-de-dados-jocley-lanchonete        ←  entidade ou campo alterado no schema Prisma
  - design-system-jocley-lanchonete          ←  cor semântica ou padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes de texto, linting) não precisam atualizar estes documentos.

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| ~~Deploy em produção (VPS)~~ | **feito em 2026-08-03** — VPS compartilhada (`2.24.93.178`), domínio `jocleygrill.online`, Nginx+Certbot, ver v1.19 na arquitetura e decisão "Deploy em produção" no registro |
| ~~Worker/cron de disparo de notificações~~ | **feito em 2026-08-04** — `src/instrumentation.ts` + `src/lib/notificacoes-dispatcher.ts`, envio real via Evolution API (WhatsApp), ver v1.23/v1.25 na arquitetura e decisões "Dez melhorias operacionais" e "Correções pós-deploy" no registro. Limitação conhecida registrada na Seção 6 da arquitetura: agendador em processo `setInterval`, não escala para múltiplas réplicas do app |
| Backup automatizado do banco de produção | deploy feito, mas sem rotina de backup do Postgres da VPS até este índice — mesma lacuna que outros sistemas da mesma VPS podem ter; avaliar `pg_dump` agendado (cron) ou snapshot do volume Docker antes do primeiro mês de operação real |
| Migration real aplicada só no deploy, nunca via `prisma migrate dev` local | a migration `20260803140000_add_kds_flag_and_permissoes` (2026-08-04) foi escrita manualmente e nunca rodou contra um banco de verdade antes do deploy na VPS — ambiente de trabalho não tinha Docker/Postgres acessível (WSL sem integração Docker Desktop). Funcionou porque o `Dockerfile` já roda `prisma migrate deploy` automaticamente no start do container, mas é um risco a evitar: preferir ambiente com banco acessível pra rodar `prisma migrate dev` de verdade antes de mudanças de schema futuras |
| `ui-kit-jocley-lanchonete` — telas ainda sem uso real da equipe validando | sistema está em produção desde 2026-08-03, com uso real confirmado em 2026-08-04 (10 melhorias vieram de feedback direto de uma semana de operação) — ainda falta reclassificar formalmente como "validado em produção" neste índice |
| `design-system-jocley-lanchonete` — logo da marca | cliente **já forneceu** arte de marca (imagem de cardápio com o logo "Jocley Grill — BBQ & Espetos": chama estilizada, paleta preto/dourado) — o sistema ganhou um favicon provisório em texto ("JG", cores da marca) em 2026-08-03, mas a arte real (chama) ainda não foi integrada à UI. Em 2026-08-23, a opção de logo-imagem no cupom térmico (`<img src="/logo.png">` com fallback automático pro texto) foi implementada e depois descartada a pedido do cliente — se a arte real for integrada no futuro, o padrão de fallback já testado pode ser reaproveitado |
| Preço das 6 bebidas cadastradas em R$ 0,00 | cardápio real cadastrado em 2026-08-03 não trazia preço de bebida explícito — cliente precisa preencher pela tela de Produtos antes de vender (ver decisão "Cardápio real cadastrado") |
| Rotina de expurgo de `ErrorLog` | tabela cresce indefinidamente, sem TTL nem limite — avaliar se precisa antes do volume de produção real |
| ~~**Alcance de rede: impressora de rede da Cozinha ↔ servidor Next.js**~~ | **resolvido em 2026-09-02 pela abordagem fila + agente** (escolha do cliente entre 3 opções). O servidor não fala mais direto com a impressora: renderiza a ficha em bytes ESC/POS, grava em `FilaImpressao`, e um **Agente de Impressão** (`agente-impressao/`, Node puro, sem deps) rodando **no PC do caixa** faz polling em `/api/impressao/fila` (Bearer `IMPRESSAO_AGENT_TOKEN`), imprime na impressora da LAN e confirma. Direção invertida: agente→VPS é saída HTTPS (passa por qualquer NAT), agente→impressora é rede local. Migration `20260903015245_add_fila_impressao`. Falta: docs de arquitetura (linha abaixo) + confirmar em produção com a impressora real |
| ~~Docs da refatoração fila + agente (2026-09-03) — pendente~~ | **feito em 2026-09-03** — `registro-de-decisoes` (entrada "Impressão da Cozinha: de socket direto para fila + Agente"), `arquitetura` (v1.33 + Seção 1/3/4/5), `modelo-de-dados` (`FilaImpressao`, `StatusFilaImpressao`, `Impressora.agenteVistoEm`), `requisitos-funcionais` (RF-110/RF-111/RF-114 reescritos, RF-116 + RN-058/RN-059/RN-060 novos), `playbook-devops` (seção reescrita + runbook de instalação do agente). Falta só: **confirmar em produção com a impressora real** e a passada de Camada 3/4 (linha abaixo) |
| **Config do Agente de Impressão no PC do caixa (Windows)** | entrega dos 4 arquivos de `agente-impressao/` é **via WhatsApp pro cliente** — ele baixa na máquina do caixa e segue o `README.md`, que é um **runbook completo e offline-first**: PARTE 1 monta um "kit" numa máquina com internet (instalador `.msi` do Node LTS + a pasta + o token + nssm opcional), e o resto (instalar Node, criar `.env`, cadastrar IP em Configurações → Impressoras, teste manual, rodar como Agendador de Tarefas ou serviço nssm, tabela de erros comuns) roda **sem internet no PC do caixa** — a única exigência de rede é o PC alcançar `https://jocleygrill.online` e estar no mesmo Wi-Fi da impressora. Sem `npm install` (zero dependências). **Desempenho da máquina não é fator:** o agente é um processo Node minúsculo (polling de 3s, decodifica ~300 bytes base64, abre um socket TCP, escreve, fecha) — sem escrita em disco além do log opcional, ~40–60 MB de RAM, CPU ~zero. HD vs SSD é irrelevante; no máximo o Node demora alguns segundos a mais pra subir no boot numa máquina lenta, o que não importa pra um processo de vida longa. **Pré-requisito real:** reserva de DHCP no roteador pro IP da impressora não mudar |
| **Deploy dos commits de 2026-09-02 (`aadd0ae`, `c5ed041`, `c2b6672`, `ea08cff`, `604eae4` + a refatoração fila/agente ainda não commitada) na VPS** | migrations `20260902120000_add_cliente_nome_despesa`, `20260902214752_add_impressora` e `20260903015245_add_fila_impressao` aplicadas só no banco de dev; prod aplica no boot do container (`CMD` roda `prisma migrate deploy`). **Antes do deploy:** setar `IMPRESSAO_AGENT_TOKEN` no `.env` da VPS (`openssl rand -hex 32`), senão as rotas `/api/impressao/*` retornam 503. Cliente faria o deploy normal — confirmar |
| `ui-kit` / `ux-flows` sem a aba Impressoras (com status do agente), o modal de reimpressão de cupom (Lançamentos) e os botões de reimpressão do KDS | telas/fluxos novos de 2026-09-02 ainda não refletidos nos artefatos de Camada 3/4 |
| `ui-kit-jocley-lanchonete` / `ux-flows-jocley-lanchonete` sem atualização desde as 10 melhorias de 2026-08-04 | seletor de quantidade, filtro de mesa no KDS, matriz de permissões e campo de telefone WhatsApp são telas/fluxos novos ainda não documentados nesses dois artefatos de Camada 3/4 — o `ModalEntrada` de estoque (2026-08-07) também entra nessa lista |
| ~~Deploy do commit `7abd46c`/`1b56d7f` (2026-08-07) na VPS de produção~~ | **confirmado feito, em 2026-08-13** — ao rodar `git pull` na VPS pra deploy do fix de Enter, o `git log` mostrou que a VPS já estava em `3896ddb` (2026-08-11) antes do pull desta sessão, ou seja, esses dois commits (e o de troca de porta, `1e15d06`) já tinham sido deployados em algum momento entre 08-07 e 08-11, sem registro formal aqui até agora |
| ~~Commit + push da correção de WhatsApp (2026-08-10, v1.28) + confirmação do deploy via `scp`~~ | **resolvido — nunca precisou do `scp`.** Os 3 arquivos ficaram sem commit até o fim daquela sessão, mas acabaram entrando (como trabalho de sessão anterior não versionado, mesmo padrão do rendimento do insumo em 08-07) no commit `3896ddb` de 2026-08-11 ("fechamento de comanda...") — confirmado via `git log -p --follow` mostrando `statusInstanciaWhatsApp` introduzido exatamente nesse commit. Já estava em produção antes desta sessão de 2026-08-13 |
| ~~Deploy dos commits `d8202fb`/`0ca4071`/`a5550d9` (2026-08-13: alinhamento do rodapé "Fechar Comanda", primeira forma de pagamento pré-preenchida + correção do botão "Adicionar forma de pagamento") na VPS de produção~~ | **confirmado feito, em 2026-08-13** — cliente rodou o `git pull && docker compose build app && docker compose up -d --force-recreate app` e confirmou direto no sistema (`jocleygrill.online`) |
| ~~Deploy da segmentação Cozinha/Caixa + Fechar/Finalizar (`b913ffa`) na VPS de produção~~ | **confirmado feito, em 2026-09-05** — `docker compose up -d --build` rodado pelo cliente; migration `20260905180000_add_caixa_printer_conta_solicitada` confirmada aplicada e colunas novas (`Order.contaSolicitada*`, `Impressora.tipo`/`compartilhamento`) confirmadas via `psql` direto no container do banco (`docker compose exec db sh -c 'psql -U "$POSTGRES_USER" ...'` — o usuário do Postgres nesta VPS **não** é o "postgres" default, é customizado via `.env`, então `psql -U postgres` falha com "role does not exist") |
| ~~Agente de Impressão atualizado + impressora USB do Caixa compartilhada no PC do caixa~~ | **confirmado feito, em 2026-09-06** — agente atualizado (baixado de `public/agente-impressao.zip`), reiniciado via **Agendador de Tarefas** (esse PC não usa `nssm` — ver nota no Playbook DevOps), impressora USB compartilhada no Windows e cadastrada em Configurações → Impressoras → Impressora do Caixa. Teste de impressão confirmado funcionando |
| ~~12 produtos de bebida cadastrados com `enviaParaCozinha=true` (iam pra Cozinha em vez do Caixa)~~ | **corrigido em 2026-09-06** — `Água`, `caipirinha vodka`, `Coca-Cola`, `Coca Zero`, `Fanta Laranja`, `Guaraná`, `Guaraná Zero`, `Heineken`, `Original`, `Balde de Original`, `Fanta uva`, `suco` corrigidos via `UPDATE` direto no Postgres de produção. Não é bug de código (RF-110/RN-064 sempre roteou certo pelo campo) — era o cadastro desses produtos específicos. Ver Registro de Decisões 2026-09-06 |
| **Validação física do visual novo das fichas (estilo fast-food, v1.37)** | deployado em 2026-09-06 (commit `77a3025`), mas o cliente ainda não confirmou o resultado na impressora de verdade ("vai testar depois") — sem impressora térmica disponível no ambiente de trabalho pra conferir antes do deploy. Se vier ajuste (tamanho, negrito, etc.), é só no `imprimirNomeItem()`/constantes `ALTURA_*` em `lib/impressao.ts` |
| **"Combo Batata + Refrigerante" não avisa o Caixa sobre o refrigerante** | produto único que mistura item de Cozinha (batata) e de Caixa (refrigerante) — `enviaParaCozinha` é um campo por produto, não dá pra rotear o mesmo item pros dois destinos. Cliente ciente, optou por não separar em dois itens de cardápio por enquanto (2026-09-06) |
| `ui-kit`/`ux-flows` sem a segmentação Cozinha/Caixa, os botões "Fechar"/"Finalizar" separados e o card "Impressora do Caixa" (Rede/USB local) em Configurações | telas/fluxos novos de 2026-09-05 ainda não refletidos nos artefatos de Camada 3/4 |
| ~~Commit + deploy da ficha de pedido consolidada ("Confirmar Pedido")~~ | **confirmado feito, em 2026-09-05** — commit `a0f664d`, `docker compose up -d --build` na VPS, migration `20260905190000_add_enviado_impressao_em` aplicada no boot (log confirmado) |
| **Reenvio manual de bebidas/Caixa se o "Confirmar Pedido" falhar pro grupo Caixa** | o KDS só reenvia itens de Cozinha (`{itemId}`/`{orderId}`, filtra `enviaParaCozinha=true`); se a ficha da Caixa falhar (impressora offline, por exemplo), os itens já ficam marcados como enviados (RN-068) e não há botão hoje pra reprocessar só esse grupo — só lançando um item novo (que dispara outro "Confirmar Pedido", mas sem reincluir os que já falharam). Lacuna conhecida, não resolvida nesta sessão por estar fora do pedido original |
| **Deploy da v1.38 (`d15ae54`), v1.39 (`3b8aa6a`) e v1.40 (`5371a17`) na VPS de produção** | commits na `main` em 2026-09-06/07 (mesas/categorias configuráveis + autorização de API por permissão; nome do cliente no KDS + retorno da conta ao Fechar; drill-down por horário no Pico de Horário). **Nenhuma migration** — categorias moram em `ConfiguracaoGeral`. Sobe no próximo `git pull && docker compose up -d --build` da VPS. Confirmar |
| `ui-kit`/`ux-flows` sem as abas **Mesas** e **Categorias do Cardápio** em Configurações, o nome do cliente no card do KDS e o aviso âmbar do "Fechar Comanda" | telas/fluxos novos de 2026-09-06 ainda não refletidos nos artefatos de Camada 3/4 |
| **Categoria é string livre no `Product`** | remover/renomear uma categoria em Configurações não toca nos produtos que já a usavam — eles ficam com a string antiga e aparecem como opção "solta" no formulário. Sem migração de dados nem alerta. Aceito como está (2026-09-06); virar FK/tabela seria o caminho "certo" se isso incomodar |
