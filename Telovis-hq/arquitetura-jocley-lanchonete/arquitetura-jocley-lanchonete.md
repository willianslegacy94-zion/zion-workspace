---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-09-07
owner: willians
---

# Arquitetura Técnica — Jocley Grill

> Referência: [[prd-jocley-lanchonete]] | [[requisitos-funcionais-jocley-lanchonete]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | Mesma base do vilamill-sistema — full-stack em uma codebase, API Routes + React, deploy simples com output standalone | Breaking changes do App Router vs. Pages Router — curva de aprendizado para padrões antigos |
| UI | React 19 + TypeScript 5 | Tipagem estática, consistência com os dois sistemas de referência | Exige compilação |
| Estilo | Tailwind CSS 4 (CSS-first, sem `tailwind.config.js`) | Utility-first, tokens de marca centralizados em `@theme` no `globals.css` (evolução consciente do padrão do vilamill, que tinha hex hardcoded espalhado pelo código) | — |
| ORM | Prisma 6.4 | Schema declarativo, migrations versionadas, type safety automático | Cada mudança de schema exige migration |
| Banco de dados | PostgreSQL 16 (Docker; porta no host configurável via `POSTGRES_HOST_PORT`, default 5434) | Mesmo padrão dos dois sistemas de referência. Porta deixou de ser fixa em `docker-compose.yml` (era 5434 no dev local) porque a mesma imagem/compose roda também na VPS compartilhada, onde 5434 já está ocupada pelo `lane-confeitaria` — a VPS define `POSTGRES_HOST_PORT=5435` só no próprio `.env`, dev local continua em 5434 sem precisar de nada extra | Se um terceiro projeto entrar na mesma VPS e também tentar 5434/5435, repetir o padrão: nova porta só via `.env` da VPS, nunca hardcoded no compose |
| Autenticação | NextAuth v5 (beta), Credentials provider + bcryptjs | Mesmo padrão do vilamill — JWT, sem sessão em banco | v5 ainda em beta |
| Data fetching | SWR 2.4 | Polling automático (2–5s conforme a tela) sem flicker, mesmo padrão dos dois sistemas de referência | Depende de JS no cliente |
| Gráficos | Recharts 2.12 | Único componente novo em relação ao vilamill (que não usa gráficos) — necessário para o gráfico de pico de horário e a curva de projeção/break-even da Inteligência Financeira, reaproveitando o conceito do sistema-thieco | — |
| Impressão de pedido/conta (ficha de produção/bebida + ficha de conta) — fila + agente desde 2026-09-03; **segmentada Cozinha/Caixa + USB local** desde 2026-09-05; **ficha consolidada por "Confirmar Pedido" (não mais por item)** desde a mesma data | `node-thermal-printer` 4.6.1 só pra **montar** os bytes ESC/POS (`getBuffer()`, `characterSet` PC860); a fila `FilaImpressao` no Postgres; um **Agente de Impressão** (`agente-impressao/`, Node puro sem deps) rodando no PC do caixa, atendendo 2 impressoras (`PapelImpressora`: `PRODUCAO_COZINHA`, `CAIXA`) | A impressora Wi-Fi da Cozinha não imprime bem pelo diálogo do SO (`window.print()`) **e** o container na VPS não roteia até o IP privado da LAN do restaurante — mesma limitação vale pra qualquer impressão disparada de um dispositivo que não seja a própria máquina de destino (ex.: celular da atendente). Solução: o servidor renderiza a ficha e grava em `FilaImpressao`; o agente no PC do caixa faz polling (`/api/impressao/fila`, Bearer token) e imprime — via socket TCP (`tipo=REDE`) ou via `copy /b` pro compartilhamento de impressora do Windows (`tipo=USB_LOCAL`, `\\localhost\<compartilhamento>`) quando a impressora do Caixa é ligada por cabo USB direto no PC, sem IP próprio — e confirma. Lançar um item só marca `enviadoImpressaoEm=null` (pendente); quem enfileira de fato é o botão explícito **"Confirmar Pedido"**, que junta tudo que está pendente numa ficha só por destino e espera a confirmação do agente antes de responder — resolve o cupom saindo picado (1 folha por item) e a falta de retorno visível de que imprimiu. `node-thermal-printer` fica em `serverExternalPackages` no `next.config.ts`. **O cupom de pagamento do Caixa (fechamento) continua via `window.print()`** | Três caminhos de impressão: cupom de pagamento do Caixa (browser), fila (servidor grava, Cozinha ou Caixa) e agente (PC do caixa imprime, rede ou USB local). Dependência operacional nova: o agente precisa estar rodando e, se a impressora do Caixa for USB, precisa estar compartilhada no Windows; env `IMPRESSAO_AGENT_TOKEN` na VPS |
| Infraestrutura (dev) | Docker Compose | Banco isolado por container, mesmo padrão dos sistemas de referência | — |
| Deploy (produção, desde 2026-08-03) | Docker multi-stage + Next.js standalone + Nginx (reverse proxy) + Certbot (SSL) em VPS compartilhada (`2.24.93.178`, mesma VPS do vilamill-sistema/sistema-thieco/lane-confeitaria/academia-sandro) | Mesmo Dockerfile do vilamill, adaptado; domínio próprio `jocleygrill.online` (cliente já possuía domínio+VPS) | App e Postgres publicados só em `127.0.0.1` (nunca `0.0.0.0`) — só o Nginx do host fala com os containers, mesmo padrão de segurança já aplicado ao vilamill-sistema em 2026-07-05 |

---

## 2. Camadas do sistema

```
[Browser — React 19 + SWR]
         ↓  ↑  (fetch / polling 2-5s)
[Next.js 15 App Router]
   ├── [Route Handlers — /api/*]   ← lógica de negócio
   ├── [Server Components]         ← rendering inicial (auth, redirecionamento por role)
   └── [Middleware NextAuth]       ← autenticação + RBAC de página
         ↓  ↑  (Prisma Client)
[PostgreSQL 16]
```

**Browser (Client Components):** telas operacionais (mesas, balcão, comanda, KDS, financeiro) renderizadas no cliente. SWR gerencia polling e cache local, mutações via `fetch` + `mutate()`.

**Next.js App Router:** Route Handlers (`src/app/api/*/route.ts`) são o backend REST. Server Components fazem o rendering inicial e o redirecionamento por role (`page.tsx` da Início, por exemplo). Middleware roda em Edge Runtime antes de qualquer handler.

**Middleware (`src/middleware.ts`):** valida sessão; para páginas, aplica allowlist de rota por role (`ROTAS_COZINHA`, `ROTAS_ATENDENTE`, `ROTAS_CAIXA`, `ROTAS_SUPERVISOR`); para `/api/*`, deixa passar após confirmar sessão válida — a restrição de escrita sensível é responsabilidade do próprio route handler (ver Seção 5).

**Prisma Client + PostgreSQL:** ORM com type safety total. `Decimal` para todo valor monetário/quantidade. `cuid()` como estratégia de ID em todas as entidades, exceto `Table.numero` (Int único, visível ao operador) e `ContadorComanda.data` (string `YYYY-MM-DD` como chave primária).

---

## 3. Fluxo de dados

**Abertura de mesa:**
```
[POST /api/orders {tipo: "MESA", mesaId}]
→ [Middleware valida sessão]
→ [Route Handler: transaction — prisma.order.create + prisma.table.update(OCUPADA)]
→ [Response 201]
→ [SWR invalida cache de /api/tables → grid atualiza em até 3s]
```

**Abertura de comanda de balcão (numeração diária):**
```
[POST /api/orders {tipo: "BALCAO"}]
→ [lib/contador-comanda.ts: upsert atômico em ContadorComanda WHERE data = hoje(SP), increment ultimoNumero]
→ [prisma.order.create com numero = contador.ultimoNumero]
→ [Response 201]
```

**Fechar comanda (solicita a conta — desde 2026-09-05):**
```
[POST /api/orders/[id]/solicitar-conta]  ← qualquer papel operacional, tipicamente ATENDENTE pelo celular
→ [valida paymentStatus == PENDENTE e items.length > 0]
→ [transaction: Order.update(contaSolicitada=true, contaSolicitadaEm, contaSolicitadaPor) + (se MESA) Table.update(CONTA)]
→ [void enfileirarFichaConta(...) — renderiza a ficha de conta (itens+total, sem forma de pagamento) e grava em FilaImpressao, papel=CAIXA]
→ [Response 200]
   (idempotente: se já estava contaSolicitada, só reenfileira a impressão)

  → daqui pra frente, POST/PATCH/DELETE em .../items* bloqueiam com 403 se o papel logado for ATENDENTE
    (CAIXA/SUPERVISOR/ADMIN continuam podendo editar itens normalmente)
```

**Finalizar comanda com split payment + bandeira (renomeado de "Fechar" em 2026-09-05 — restrito ao Caixa):**
```
[POST /api/orders/[id]/close { pagamentos: [{forma, valor, bandeira?}], desconto }]
→ [guardCaixa() — 403 se role não for ADMIN/SUPERVISOR/CAIXA]
→ [valida soma dos pagamentos == total - desconto, tolerância 0.01]
→ [lib/pagamentos.ts: resolverPagamentos() — forma primária = maior valor; pagamentosSplit só se houver >1 forma]
→ [lib/taxas.ts: calcularTaxaAplicada() — busca TaxaPagamento por forma+bandeira, cai para forma+null se não houver taxa específica]
→ [transaction:
     1. prisma.order.update (FECHADO, closedAt, formaPagamento, pagamentosSplit, taxaTotal)
     2. se tipo MESA: prisma.table.update (LIVRE)
     3. para cada item: se produto tem ficha técnica, decrementa Ingredient.quantidadeAtual + cria MovimentacaoEstoque(VENDA);
        senão, se trackInventory, decrementa Product.estoque
        + (desde 2026-09-29) para cada OrderItem.componentes (ex.: espetos escolhidos na Jantinha), mesma baixa pela
          ficha técnica do produto escolhido × componente.quantidade × item.quantidade
     4. para cada pagamento NOTA > 0: cria NotaCliente(orderId, clienteNome, valor)
   ]
→ [Response 200]
→ [CupomImpressao dispara window.print() no client (máquina do Caixa) — DadosCupom inclui clienteNome e o CSS escurecido desde 2026-09-02; position:absolute desde 2026-09-05 (era fixed, causava duplicação em cupom de mais de 1 página, ver Seção 4)]
```

**Lançamento de item — só marca pendente, não imprime mais sozinho (mudou ainda em 2026-09-05, no mesmo dia da segmentação):**
```
[POST /api/orders/[id]/items { productId, quantidade, opcionaisSel?, observacoes? }]
→ [desde 2026-09-29: valida os grupos de opcionais no servidor — obrigatórios preenchidos e, nos grupos
   "por categoria" (Jantinha → Espetos Tradicionais/Premium), exatamente N produtos ATIVOS daquela categoria
   (400 com mensagem se não bater); resolve os nomes escolhidos em OrderItem.componentes [{productId, nome, quantidade}]]
→ [custoUnit = ficha técnica do produto + custo real dos componentes escolhidos (lib/cmv.ts custoUnitarioDoItem)]
→ [item criado com enviadoImpressaoEm=null + recalcularTotalPedido]
→ [Response 201]   — SEM nenhum enfileiramento aqui (era fire-and-forget antes; saía picado, 1 ficha por item)
```

**Confirmar Pedido — ficha consolidada por destino + espera a confirmação do Agente (novo em 2026-09-05):**
```
[POST /api/orders/[id]/confirmar-pedido]
→ [busca OrderItem WHERE orderId E enviadoImpressaoEm IS NULL]
→ [se vazio: responde { enviados: 0 } — nada pra fazer]
→ [agrupa por destino: Product.enviaParaCozinha=true → PRODUCAO_COZINHA ("PEDIDO - COZINHA")
                        Product.enviaParaCozinha=false → CAIXA ("PEDIDO - BAR / BEBIDAS")]
→ [por grupo não vazio: renderFichaPedido(...) — UMA ficha com todos os itens do grupo — e enfileirarImpressao(papel)]
→ [marca OrderItem.enviadoImpressaoEm=now() pros itens dos grupos que enfileiraram com sucesso
     (falha ao enfileirar → item NÃO marcado, tenta de novo no próximo Confirmar Pedido)]
→ [aguardarConfirmacaoJob(jobId) em paralelo pra cada grupo, até ~12s — mesmo padrão do "Testar impressão"]
→ [Response { ok, enviados, resultados: [{destino, status: IMPRESSO|ERRO|PENDENTE, erro?}] }]
   — a tela mostra esse resultado por destino, então quem lançou vê se saiu de verdade ou não

[Salvaguarda: "Fechar Comanda" (solicitar-conta) e "Finalizar Comanda" (close) chamam este
 mesmo endpoint silenciosamente antes de prosseguir, caso reste algo não confirmado]

  Agente de Impressão (PC do caixa, loop ~3s, atende os dois papéis):
  [GET /api/impressao/fila  (Authorization: Bearer IMPRESSAO_AGENT_TOKEN)]
  → [servidor: atualiza Impressora.agenteVistoEm (Cozinha + Caixa); expira jobs PENDENTE > 30min → ERRO+ErrorLog; devolve pendentes]
  → [agente: por job.tipo — REDE: socket TCP job.ip:job.porta, escreve os bytes | USB_LOCAL: grava bytes em arquivo temp e `copy /b` pro compartilhamento `\\localhost\job.compartilhamento`]
  → [PATCH /api/impressao/fila/[id] { resultado: "ok" | "erro", code?, mensagem? }]
     ok → IMPRESSO   |   erro → tentativas++ (≥3 → ERRO + ErrorLog com alvo (IP:porta ou compartilhamento) + código)

[Reimpressão manual: POST /api/kds/reimprimir { itemId } — ficha avulsa de 1 item |
 { orderId } — desde 2026-09-05 também consolida numa ficha só, mesma renderFichaPedido]
[/api/impressao/* é isento do gate de sessão do middleware — auth só pelo token (guardAgenteImpressao)]
```

**Cálculo de CMV (recalculo automático):**
```
[POST/PATCH/DELETE em /api/recipe-items (PATCH { id, quantidade } desde 2026-09-29 — edita só a quantidade),
 ou Ingredient.custoUnitario/rendimentoPercentual, ou Product.opcionais/categoria/ativo/custo manual]
→ [lib/cmv.ts: recalculateProductCost(productId) ou recalculateProductsByIngredient(ingredientId)]
→ [custoEfetivo = custoUnitario / (rendimentoPercentual / 100), se rendimento < 100 — corrige perda de limpeza/aparas]
→ [Product.costPrice = Σ (recipeItem.quantidade × custoEfetivo do insumo)
                     + Σ por grupo "por categoria" (quantidade exigida × MÉDIA do costPrice dos produtos ativos da categoria),
   pulando produtos com costPriceManual=true]
→ [cascata de 1 nível: recalcula os produtos cujos opcionais puxam da categoria do produto alterado
   (mudou o Espeto de Carne → recalcula as Jantinhas de Espetos Tradicionais)]
→ [tela: selo de saúde do CMV (custo ÷ preço; saudável 28–35%) + simulador de preço por CMV-alvo — lib/cmv-calc.ts]
```

**Entrada rápida de estoque (desde 2026-08-07):**
```
[POST /api/ingredients/[id]/entrada { quantidade, custoUnitario? }]
→ [valida quantidade > 0, senão 400]
→ [transaction: Ingredient.update (quantidadeAtual increment, custoUnitario opcional) + MovimentacaoEstoque.create (tipo ENTRADA)]
→ [se custoUnitario mudou: recalculateProductsByIngredient(id)]
→ [Response 200 com o insumo atualizado]
```

**Dashboard financeiro / Inteligência Financeira:**
```
[GET /api/financeiro/summary?periodo=hoje|7dias|mes|custom]
→ [lib/periodo.ts: resolverIntervalo() — resolve o intervalo sempre em America/Sao_Paulo]
→ [lib/financeiro.ts: buscarPedidosFechados() + calcularResumoFinanceiro()]
→ [Response: receitaBruta, cmv, taxaTotal, receitaLiquida, despesas, resultado, ticketMedio, pedidosFechados, mesasAbertas]
```

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Notas |
|---|---|---|---|---|
| Browser ↔ Next.js API | consumo interno | REST/JSON via fetch | NextAuth session cookie (JWT) | SWR gerencia polling e cache |
| Next.js ↔ PostgreSQL | consumo interno | Prisma Client (TCP) | `DATABASE_URL` no `.env` | Container `jocley-lanchonete-db`, porta 5434 no host em dev local, 5435 na VPS (`POSTGRES_HOST_PORT`, ver Seção 1) |
| Browser ↔ Nginx (VPS) | acesso público | HTTPS (TLS 1.2/1.3, Let's Encrypt via Certbot, renovação automática) | — | `jocleygrill.online` e `www.jocleygrill.online`; Nginx faz proxy_pass para `127.0.0.1:3001` (container app) |
| Maquininha de cartão | nenhuma | — | — | Forma de pagamento e bandeira são registradas manualmente pelo operador — sem integração real, como no vilamill |
| Impressora do Caixa — cupom de **pagamento** (fechamento/finalização) | nenhuma (via SO) | — | — | `window.print()` + CSS `@media print` — o navegador do dispositivo do Caixa precisa ter a impressora (cabeada) configurada como padrão ou selecionável no diálogo. CSS reescrito em 2026-09-02 para sair preto sólido/fonte grossa (`.cupom-termico`, ver v1.32); `.print-area` corrigido de `position:fixed` para `position:absolute` em 2026-09-05 — `fixed` era repetido em toda página impressa (spec de mídia paginada), causando cupom duplicado/triplicado em comandas longas |
| Impressoras de rede/Cozinha e Caixa (ficha de produção/bebida + ficha de conta) — **fila + Agente desde 2026-09-03; Caixa e USB local desde 2026-09-05** | Next.js → `FilaImpressao` (INSERT) → **Agente** (PC do caixa) → impressora | agente↔servidor: HTTPS + Bearer `IMPRESSAO_AGENT_TOKEN`; agente↔impressora: ESC/POS cru sobre socket TCP 9100 (`tipo=REDE`) **ou**, novo em 2026-09-05, `copy /b` pro compartilhamento de impressora do Windows (`tipo=USB_LOCAL`, `\\localhost\<compartilhamento>` — impressora ligada por cabo USB direto no PC do caixa, sem IP próprio) | agente↔servidor: token compartilhado. impressora: nenhuma | O servidor **não** abre socket nem toca em USB: `src/lib/impressao.ts` renderiza os bytes (`getBuffer()`) e grava em `FilaImpressao` com o `papel` (`PRODUCAO_COZINHA` ou `CAIXA`) e o `tipo` de conexão certos. O **Agente de Impressão** (`agente-impressao/`, Node puro, roda no PC do caixa como Tarefa Agendada/serviço) faz polling em `GET /api/impressao/fila`, imprime (rede ou USB local) e confirma em `PATCH /api/impressao/fila/[id]`. Resolve o pré-requisito de rede (VPS não alcança IP privado da LAN nem USB do PC do caixa) — ver Registro de Decisões 2026-09-03 e 2026-09-05. Job PENDENTE > 30 min é descartado. Runbook de instalação no Playbook DevOps e em `agente-impressao/README.md` (seção "PASSO 5B" cobre o compartilhamento USB) |
| WhatsApp (notificações agendadas) | saída (Next.js → Evolution API) | REST/JSON (`POST /message/sendText/{instance}`) | header `apikey` (`EVOLUTION_API_KEY`) | Evolution API self-hosted (`evoapicloud/evolution-api`, container `evolution_api`, mesma VPS compartilhada), instância dedicada `jocley-grill` — não reaproveita nenhuma das instâncias de outros clientes já rodando na mesma Evolution API (thieco, academia-sandro, lane-confeitaria). Container do app conectado à rede Docker externa `orbita_shared` para falar com `evolution_api:8080` (porta interna) — a porta publicada no host (`127.0.0.1:8081`) só aceita loopback, nem `host.docker.internal` alcança. Ver Registro de Decisões (2026-08-04) para o troubleshooting completo |

---

## 5. Fronteiras de segurança

- **Autenticação:** NextAuth v5 via Credentials provider — username (campo `email`) + bcryptjs hash. Sessão JWT, `AUTH_SECRET`/`AUTH_URL`/`NEXTAUTH_URL` no `.env`
- **Autorização de página:** middleware em Edge Runtime aplica allowlist de rota por role antes de qualquer página renderizar
- **Autorização de API por permissão granular (defesa em profundidade — reescrita em 2026-09-06):** `src/lib/api-guard.ts` expõe `guardPermissao(chave)` e `guardPermissaoQualquer(chaves[])` — equivalente de API ao `requirePermissao()` das páginas: ADMIN sempre passa; qualquer outro passa se tiver a chave de permissão (pelo padrão do papel ou por override configurado pelo ADMIN). Aplicado em toda rota de escrita de Produtos (`produtos`), Insumos (`estoque`), Ficha Técnica (`produtos` **ou** `cmv` — abre pelos dois lugares), Configurações → WhatsApp (`configuracoes.notificacoes`) / Impressoras (`configuracoes.impressoras`) / Categorias (`configuracoes.categorias`), Mesas (`/api/tables*` → `configuracoes.mesas`) e Notas (`notas`). Necessário porque o middleware por si só libera todas as rotas `/api/*` para qualquer role autenticado (ver Decisão "Correção do bloqueio de API para papéis operacionais"). **`guardGestor()` e `guardAdmin()` (checagem por papel puro) foram removidos** nesta data — o princípio passou a ser "quem tem a permissão pode usar a funcionalidade, independente do papel" (ver Registro de Decisões 2026-09-06)
- **`guardCaixa()` (desde 2026-09-05, mantido por papel de propósito):** checa `role === ADMIN || role === SUPERVISOR || role === CAIXA` — protege a finalização de comanda com pagamento (`POST /api/orders/[id]/close`), a alteração de preço de item (`PATCH /api/orders/[id]/items/[itemId]` quando o body inclui `precoUnit`) e a aplicação de desconto fora do fechamento (`PATCH /api/orders/[id]` quando o body inclui `desconto`). É **separação de função** (a atendente "fecha"/solicita a conta em `POST /api/orders/[id]/solicitar-conta`, sem guard; o caixa "finaliza"/cobra), não acesso a tela — por isso continua por papel mesmo depois da migração de 2026-09-06. Idem os checks de `/api/users/*` (qual papel gerencia qual) e `guardDevmaster()` em `/api/error-logs`
- **Agente de Impressão (desde 2026-09-03):** as rotas `/api/impressao/*` (consumidas pelo Agente de Impressão no PC do caixa, que não tem sessão NextAuth) são **isentas do gate de sessão do middleware** (`matcher` exclui `api/impressao`, mesmo padrão de `api/auth`) e autenticam por `guardAgenteImpressao(req)` — token compartilhado no header `Authorization: Bearer <IMPRESSAO_AGENT_TOKEN>` (env da VPS + `.env` do agente), sobre HTTPS. Sem o env configurado, essas rotas respondem 503. O token dá acesso só a ler a fila e reportar resultado de job — não a nenhum dado de negócio
- **Restrição de papel do Supervisor:** `PAPEIS_GERENCIAVEIS_POR_SUPERVISOR = ["CAIXA", "ATENDENTE", "COZINHA"]` (`src/lib/require-admin.ts`) — Supervisor nunca cria nem edita conta ADMIN ou SUPERVISOR, checado em `/api/users` e `/api/users/[id]`
- **Conta de suporte técnico (`devmaster`):** `guardDevmaster()` (`src/lib/api-guard.ts`) checa identidade (`email === "devmaster"`), não papel — único guard do sistema que não é role-based. Protege `GET /api/error-logs` e bloqueia edição da própria conta via `PATCH /api/users/[id]`. `GET /api/users` filtra essa conta da listagem, então nem ADMIN a vê na tela de Usuários
- **Tratamento de erro de API:** todas as rotas de negócio (exceto o handler do NextAuth) são envolvidas por `withErrorHandling` (`src/lib/api-error.ts`) — qualquer exceção não tratada vira `{ error: mensagemAmigavel }` no cliente e um registro em `ErrorLog` no servidor, nunca stack técnico exposto. Erros conhecidos do Prisma (P2025/P2002/P2003) têm mensagem específica; o resto cai num genérico. `error.tsx`/`global-error.tsx` cobrem o equivalente para falha de renderização React
- **Permissões granulares (desde 2026-08-04):** camada adicional ao RBAC por role, nunca substituta — `src/lib/permissions.ts` define a árvore canônica de chaves (abas + subtópicos) e resolve o mapa efetivo por usuário (`resolvePermissoes()`); `src/lib/require-permissao.ts` (`requirePermissao()`/`requirePermissaoQualquer()`) reforça no servidor, em cada `page.tsx`, além do que o `middleware.ts` já bloqueia por role; `PermissoesProvider` (Context React, populado server-side em `layout.tsx`) filtra Sidebar/Navbar/subabas no cliente sem flicker (sem chamada de API própria para isso). ADMIN nunca tem override — sempre acesso total
- **Dados sensíveis:** `senhaHash` (bcrypt) nunca exposto em nenhuma resposta de API; `AUTH_SECRET`, `DATABASE_URL`, `EVOLUTION_API_KEY` apenas no `.env`, nunca no repositório

---

## 6. Estratégia de escala

**Gargalos previstos:**
- SWR polling de múltiplos clientes simultâneos (mesas + balcão + KDS) — dimensionado para o volume de uma lanchonete de porte único, não uma rede de lojas
- Cálculo de pico de horário em memória (não SQL agregado) — suficiente para o volume esperado; se o volume de comandas por dia crescer muito, migrar para `$queryRaw` com `EXTRACT(HOUR FROM ...)`

**Estratégia atual:** PostgreSQL lida com dezenas de conexões simultâneas sem problema; Prisma Connection Pool gerencia reutilização.

**O que exige reescrita acima de X:**
- Se uma segunda unidade da Jocley Grill for aberta → schema precisaria de um campo `unidadeId` em todas as entidades (o schema atual não tem multi-unidade, ao contrário do sistema-thieco que já nasceu multi-unidade com `unidade_enum`)
- **Agendador de notificações (`src/instrumentation.ts`):** implementado como `setInterval` em processo dentro do próprio container Next.js — funciona porque o deploy é `next start` de vida longa (não serverless), mas não escala para múltiplas réplicas do app (cada réplica rodaria o próprio agendador, disparando notificação duplicada) nem sobrevive a um restart no meio do intervalo de 60s. Suficiente para uma única unidade com um único container `app`; se o sistema crescer para múltiplas réplicas, precisa virar worker/cron externo dedicado (ex.: `node-cron` num processo separado, ou job do orquestrador)

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-07-29 | Bootstrap do projeto — schema completo inicial (User/UserRole ADMIN-CAIXA-COZINHA, Table, Order/OrderItem com tipo MESA/BALCAO, ContadorComanda, Product, Ingredient/RecipeItem, MovimentacaoEstoque, Despesa, Funcionario/Feedback/PlanoAcao/Sugestao, TaxaPagamento, ConfiguracaoNotificacao, ConfiguracaoGeral); seed com 3 usuários, 12 mesas, taxas default, produtos de exemplo com ficha técnica |
| v1.1 | 2026-07-29 | Auth (NextAuth v5) + middleware RBAC inicial + Sidebar (Admin) + Navbar (Caixa) role-aware |
| v1.2 | 2026-07-29 | PDV core — Mesas, Balcão (numeração diária via `ContadorComanda`), comanda compartilhada, split payment, cupom térmico 80mm |
| v1.3 | 2026-07-29 | Cardápio + Estoque + CMV — cálculo automático de custo a partir de ficha técnica; dedução de estoque ligada ao fechamento de comanda |
| v1.4 | 2026-07-29 | Cozinha (KDS) — dark theme, poll 2s, urgência por tempo |
| v1.5 | 2026-07-29 | Dashboard financeiro (Início) — cards nos moldes do vilamill-sistema |
| v1.6 | 2026-07-29 | Inteligência Financeira — ranking de formas, ranking de pratos, pico de horário (novo, sem equivalente nos sistemas de referência), DRE exportável, projeção/break-even, ticket médio por caixa |
| v1.7 | 2026-07-29 | Despesas com recorrência (escopo esta/futuras) + Lançamentos |
| v1.8 | 2026-07-29 | Gestão de Time (Equipe, Feedbacks, PDCA, Sugestões, Timeline) |
| v1.9 | 2026-07-29 | Configurações (Notificações + Taxas por forma de pagamento) |
| v1.10 | 2026-07-29 | **Correção crítica:** middleware bloqueava chamadas de API dos próprios papéis operacionais (Caixa/Atendente não conseguiam usar o próprio PDV) — restrição de role passou a valer só para páginas, `/api/*` liberado após checagem de sessão |
| v1.11 | 2026-07-29 | **Correção de bug:** `.env` local com `NEXTAUTH_URL` apontando para a porta 3000 (do vilamill-sistema, rodando no mesmo workspace) causava redirect pós-login para o sistema errado — corrigido para a porta real (3001) |
| v1.12 | 2026-07-29 | Taxa por bandeira de cartão (opcional) — `TaxaPagamento.bandeira` nullable, seletor de bandeira no split payment, tela de Configurações ganha seção expansível "Por bandeira (opcional)" |
| v1.13 | 2026-07-29 | Papéis SUPERVISOR e ATENDENTE + tela de Usuários — migration do enum `UserRole`, RBAC estendido no middleware, `guardGestor()` criado e aplicado nas rotas de escrita de Produtos/Insumos/Ficha Técnica, modo somente-leitura no Cardápio/Estoque para papéis operacionais |
| v1.14 | 2026-07-30 | Rebranding — nome de exibição alterado de "Jocley Lanchonete" para "Jocley Grill" (constante `NOME_LANCHONETE`, usada em toda a UI: login, sidebar, navbar, cupom, KDS, DRE); repositório Git próprio criado (`git init`, sem remote no GitHub até este ponto) — antes vivia como pasta solta sem versionamento no `TeloVis Workspace` |
| v1.15 | 2026-07-30 | Configurações ganha "Taxas de Delivery" (`TaxaDelivery`, enum `CanalDelivery`: iFood/99/Motoboy/Outros) + Inteligência Financeira ganha aba "Calculadora de Metas" — projeta receita/taxa/custo/lucro a partir de uma quantidade de vendas desejada, distribuindo a meta por produto conforme o mix histórico |
| v1.16 | 2026-07-30 | Estoque ganha card de valor total (`quantidadeAtual × custoUnitario`) + filtro por nome de insumo — **correção de bug:** card inicial formatava moeda antes de `isLoading=false`, causando mismatch de hidratação (SSR e cliente divergindo na primeira renderização); corrigido com placeholder até os dados carregarem |
| v1.17 | 2026-07-30 | Sistema de tratamento e registro de erros — `ErrorLog` (novo model), `withErrorHandling`/`handleApiError` (`src/lib/api-error.ts`) aplicado nas 38 rotas de API (exceto NextAuth), `error.tsx`/`global-error.tsx` como error boundary React, `fetcher.ts` repassando mensagem amigável da API. Conta fixa `devmaster` criada (seed) com acesso exclusivo à nova aba "Logs de Erro" em Configurações — invisível para qualquer outro ADMIN, inclusive na tela de Usuários (`guardDevmaster()`) |
| v1.18 | 2026-07-30 | Push para GitHub — `willianslegacy94-zion/lanchonete-sistema` (repositório privado), realizado pelo agente @devops após quality gate (typecheck + lint + build + scan de segredos, todos PASS) |
| v1.19 | 2026-08-03 | **Deploy em produção** — VPS compartilhada (`2.24.93.178`), domínio `jocleygrill.online` (cliente já possuía domínio e VPS), Nginx como reverse proxy + Certbot/Let's Encrypt (renovação automática). `docker-compose.yml` hardened: Postgres e app publicados só em `127.0.0.1`, credenciais do Postgres parametrizadas via `${POSTGRES_USER}`/`${POSTGRES_PASSWORD}`/`${POSTGRES_DB}` em vez de fixas em `postgres/postgres`. Acesso ao repositório na VPS via SSH deploy key (só leitura), não HTTPS+senha (GitHub não aceita mais) |
| v1.20 | 2026-08-03 | **Correção de bug de build:** faltava a pasta `public/` no repositório (nunca existiu) — o `Dockerfile` falhava ao copiar `/app/public` no estágio final; corrigido criando `public/.gitkeep` versionado |
| v1.21 | 2026-08-03 | **Correção de conflito de porta:** porta do Postgres fixada em 5435 no `docker-compose.yml` (pra não colidir com o `lane-confeitaria`, que já ocupava 5434 na mesma VPS) quebrou o `scripts/dev.js` do ambiente local (`DB_PORT` hardcoded em 5434). Corrigido tornando a porta configurável via `POSTGRES_HOST_PORT` (default 5434) — dev local não muda nada, só a VPS define `POSTGRES_HOST_PORT=5435` no próprio `.env` (não commitado) |
| v1.22 | 2026-08-03 | **Cardápio real cadastrado** — `prisma/seed.ts` trocou os produtos/ingredientes de exemplo (X-Burguer, Espeto de Frango genérico etc.) pelos dois cardápios reais fornecidos pelo cliente (imagens): cardápio principal (espetos prontos, burgers na brasa, porções, adicionais, jantinhas, bebidas, combo — 42 produtos) e cardápio de espetinhos crus (pacotes por unidade para churrasco em casa, entrega só sáb/dom — 14 produtos), nova categoria `"Espetinhos Crus"` em `CATEGORIAS_CARDAPIO`. Preço das 6 bebidas ficou em R$ 0,00 (não veio explícito no cardápio) — cliente ajusta depois pela tela de Produtos. Favicon "JG" (texto, cores da marca — laranja `#d64000` + branco) adicionado via `src/app/icon.tsx` (`next/og`); **não é o logo real da marca ainda** (chama estilizada, ver `design-system-jocley-lanchonete`) — placeholder até a arte ser integrada |
| v1.23 | 2026-08-04 | **Dez melhorias operacionais pedidas pelo cliente** — migration única (`Product.enviaParaCozinha`, `User.permissoesOverride`); KDS filtra por mesa/comanda (com comprovante pendente+pronto) e exclui itens sem preparo; seletor de quantidade ao lançar item + ajuste +/- em item pendente (novo `PATCH /api/orders/[id]/items/[itemId]`); estoque oculta valor em R$ e custo unitário para não-ADMIN; permissões granulares por aba+subtópico por usuário (Módulo 17 novo — `src/lib/permissions.ts`, `PermissoesProvider`, `requirePermissao()`); telefone de WhatsApp configurável + botão "Enviar teste" em Configurações, envio real via Evolution API (`src/lib/evolution-api.ts`) e disparo agendado automático via `src/instrumentation.ts` (antes só existia a configuração, sem worker nenhum) |
| v1.24 | 2026-08-04 | **Correção de rede Docker (WhatsApp):** app não alcançava a Evolution API — porta publicada no host (`127.0.0.1:8081`) só aceita loopback, nem `host.docker.internal` (chega via bridge) passa por essa regra. Corrigido conectando o container `app` à rede Docker externa `orbita_shared` (onde `evolution_api` já está) e trocando `EVOLUTION_API_URL` para `http://evolution_api:8080` (nome do container, porta interna) |
| v1.25 | 2026-08-04 | **Correções pós-deploy do WhatsApp:** telefone sem DDI 55 era rejeitado pela Evolution API como "não existe no WhatsApp" — `enviarWhatsApp()` agora completa o DDI automaticamente para números de 10/11 dígitos, e traduz esse erro específico numa mensagem clara em vez de só o status HTTP; botão "Desconectar" adicionado ao lado do telefone (limpa e salva vazio com confirmação); campo "A cada quantos dias" adicionado quando periodicidade = Personalizado (existia no banco/API, nunca aparecia na tela); disparador corrigido para respeitar a periodicidade **na frequência** do envio (antes só influenciava o conteúdo do relatório — Semanal/Quinzenal disparavam todo dia igual a Diário) |
| v1.26 | 2026-08-07 | **Rendimento do insumo + custo efetivo no CMV** — `Ingredient.rendimentoPercentual` (migration `20260805025924_add_rendimento_percentual_ingredient`, default 100), `custoEfetivoUnitario()` (`src/lib/cmv-calc.ts`) corrige o custo por perda de limpeza/aparas antes do cálculo de CMV. Trabalho encontrado sem commit de uma sessão anterior, formalizado nesta |
| v1.27 | 2026-08-07 | **PDV lista todos os produtos ativos + entrada rápida de estoque + ficha técnica do Espeto de Contrafilé + categorias canônicas do cardápio** — `GET /api/products` ganha `include: recipeItems.ingredient` e ordena só por nome; novo `POST /api/ingredients/[id]/entrada` (increment atômico + `MovimentacaoEstoque` ENTRADA + custo opcional); novo `ModalEntrada` na tela de Estoque; seed ganha insumos "Contrafilé (Limpo)"/"Palito de Espetinho" + produto "Espeto de Contrafilé" com ficha técnica; `CATEGORIAS_CARDAPIO` renomeada para os nomes canônicos ("Espetinhos Assados", "Burgers na Brasa", "Jantinhas e Porções"), com migração automática das categorias antigas no seed. Commitado (`7abd46c`) e enviado à `main` — deploy na VPS ainda pendente de confirmação |
| v1.28 | 2026-08-10 | **Correção do erro de sessão quebrada da Evolution API ("sendMessage" undefined) + esclarecimento dos cards de WhatsApp em Configurações** — `POST /api/configuracoes/whatsapp/testar` passou a chamar `statusInstanciaWhatsApp()` antes de enviar (retorna erro claro sem nem chamar a Evolution se `estado !== "open"`); `mensagemAmigavelEvolution()` (`src/lib/evolution-api.ts`) reconhece o erro interno do Baileys (`response.message[]` contendo `sendMessage`) e devolve mensagem amigável em vez do JSON cru — cobre o caso em que a Evolution ainda reporta `open` mas a sessão morreu na prática. Labels dos dois cards de WhatsApp em `notificacoes-tab.tsx` reescritos ("Número que recebe os alertas" vs. "Número que envia (WhatsApp pareado)") para deixar explícito que não são duplicados — um é o destino da notificação, outro é a sessão que envia. **Alterações não commitadas até o fim desta sessão** — deploy feito via `scp` direto dos 3 arquivos pra `/opt/lanchonete-sistema` (variante já documentada no Playbook DevOps), execução não confirmada nesta sessão |
| v1.29 | 2026-08-23 | **Confirmação da estratégia de impressão (cozinha só no KDS) + código curto da comanda no cupom** — cliente confirmou que a cozinha acompanha pedidos exclusivamente pelo KDS (`/cozinha`), sem impressão física de ficha de produção; investigação prévia mostrou que a arquitetura já era essa desde o v1.2/v1.4, nada para remover. `DadosCupom` (`cupom-impressao.tsx`) ganha `codigo: string` (6 últimos caracteres do `Order.id`, maiúsculas — calculado em `fecharComanda()`, não persistido no schema), impresso como "Cód: XXXXXX". Logo-imagem no cabeçalho foi avaliada e implementada (`<img>` com fallback automático pro texto), mas descartada a pedido do cliente antes de ir pra produção — cabeçalho do cupom continua só com `NOME_LANCHONETE` em texto. Não commitado até o fim desta sessão. **Revertido em v1.32** (2026-09-02) — a impressão de rede da Cozinha passou a existir |
| v1.30 | 2026-09-02 | **"Nome do Cliente" em Despesas e Lançamentos + reimpressão de cupom na aba Lançamentos** — `Despesa.clienteNome` (String?, opcional, migration `20260902120000_add_cliente_nome_despesa`): campo no formulário de despesa, coluna na listagem e busca client-side por cliente (mesmo padrão de `produtos`/`estoque`). Aba **Lançamentos** (comandas fechadas, `Order`) ganha coluna Cliente (via `Order.clienteNome`, que já existia no schema desde a migration `20260811151346` mas nunca era exibido) e ação de clicar na linha → modal que reabre e **reimprime o cupom** (`window.print()`, reaproveita `CupomImpressao`), com o nome do cliente editável ali (`PATCH /api/orders/[id]`). `DadosCupom` ganha `cliente?: string` — impresso no cupom (fechamento e reimpressão). Commits `aadd0ae` (feature) + `c5ed041`. Migration aplicada no dev; prod aplica no boot do container |
| v1.31 | 2026-09-02 | **Porta fixa 3002 para o `npm run dev` local** — `scripts/dev.js` passa a subir o Next em `-p 3002` (sobrescrevível com `PORT=xxxx`), porque a 3000 costuma estar ocupada por outro projeto local do workspace (`villamill-app`). `.env` local também ajustado (não versionado): `NEXTAUTH_URL`/`AUTH_URL` → `:3002` e a URL do Postgres corrigida da 5436 (que nesta máquina é do `evolution_postgres`, não do Jocley — ver gotcha de 2026-08-13) para a 5434 do container `jocley-lanchonete-db`. Commit `c5ed041`. Só afeta ambiente de dev — produção (`next start` em container) não usa `scripts/dev.js` |
| v1.33 | 2026-09-03 | **Impressão da Cozinha: de socket direto para fila + Agente no PC do caixa** — resolve o pré-requisito de rede deixado em aberto na v1.32 (VPS não alcança o IP privado da impressora). `FilaImpressao` + enum `StatusFilaImpressao` + `Impressora.agenteVistoEm` (migration `20260903015245_add_fila_impressao`). `src/lib/impressao.ts` reescrito: só **renderiza** ESC/POS (`getBuffer()`) e **enfileira** — nenhum socket sai da VPS. Rotas `GET`/`PATCH /api/impressao/fila[/id]` (Bearer `IMPRESSAO_AGENT_TOKEN`, `guardAgenteImpressao`, isentas do gate de sessão no `middleware.ts`). Gatilhos (`items`, `kds/reimprimir`, `impressoras/testar`) passam a enfileirar. Nova pasta `agente-impressao/` (Node puro, sem deps) + `README.md` runbook offline-first. Aba Impressoras mostra "Agente: online/offline". `next build` OK; testado no dev simulando o agente com `curl`+token. Escolha do cliente entre VPN / agente / port-forward — ver Registro de Decisões 2026-09-03. Não commitado até o fim da sessão |
| v1.32 | 2026-09-02 | **Impressão de rede ESC/POS para a ficha de produção da Cozinha (reverte a estratégia "só KDS" de v1.29) + aba "Impressoras" em Configurações + correção do cupom claro do Caixa** — três frentes, três commits. *(O transporte por socket direto desta versão foi trocado por fila+agente na v1.33 — o resto, aba Impressoras/model `Impressora`/cupom escuro/`/cupom-teste`, continua.)* (1) `model Impressora` + enum `PapelImpressora` (migration `20260902214752_add_impressora`), dep `node-thermal-printer` 4.6.1 + `serverExternalPackages` no `next.config.ts`, `src/lib/impressao.ts` (socket TCP porta 9100, timeout 4s, `characterSet` PC860, tradução de erro de socket → mensagem amigável + detalhe técnico). Aba **Impressoras** em Configurações (`guardGestor()`): IP/porta/ativa + botão "Testar impressão" real + bolinha verde/vermelha do último teste + nota fixa de que a impressora do Caixa é do navegador/SO. (`c2b6672`). (2) Ao lançar item com `enviaParaCozinha`, o sistema envia a ficha de produção server-side, **fire-and-forget** (não bloqueia o lançamento, ~0.5s); falha → `ErrorLog` com IP:porta + código do socket; item segue no KDS. `POST /api/kds/reimprimir` + botões "Imprimir novamente" (item) e "Reimprimir" (comanda) no `/cozinha`. Cupom do Caixa (`window.print()`) intocado. (`ea08cff`). (3) CSS de `cupom-impressao.tsx` reescrito e escopado em `.cupom-termico`: `color:#000` puro + `print-color-adjust:exact` (navegador parava de clarear a tinta), `font-weight:700`, `-webkit-font-smoothing:none`, fonte Courier, corpo 12.5pt. Nova página `/cupom-teste` (ADMIN) com prévia ANTIGO×NOVO e botão de imprimir cada modelo. (`604eae4`). Build de produção validado; migration aplicada no dev, prod aplica no boot |
| v1.34 | 2026-09-05 | **Segmenta impressão Cozinha/Caixa (com USB local) + separa Fechar (atendente) de Finalizar (caixa) + edição de preço/desconto restrita ao caixa + cupom sem duplicar + Enter/quantidade digitável** — pedido direto do cliente, seis frentes num único commit principal (`b913ffa`) + um commit de asset (`0235b84`). (1) **Segmentação de impressão automática por item:** `PapelImpressora` ganha `CAIXA` — item com `enviaParaCozinha=true` continua indo pra fila da Cozinha, `enviaParaCozinha=false` (bebida/drink) passa a enfileirar automaticamente na impressora do Caixa (antes não imprimia em lugar nenhum), mesmo `enfileirarFichaItem()`. (2) **Impressora do Caixa é USB local** (confirmado pelo cliente, sem IP de rede) — novo enum `TipoConexaoImpressora` (REDE/USB_LOCAL), `Impressora`/`FilaImpressao` ganham `tipo`+`compartilhamento` (ip/porta viram opcionais); o Agente (`agente-impressao/agente.js`) ganha `imprimirLocal()` — grava os bytes num arquivo temp e `copy /b` pro compartilhamento de impressora do Windows (`\\localhost\<nome>`), zero dependências novas. `impressoras-tab.tsx` ganha o card "Impressora do Caixa" com seletor Rede/USB local. (3) **Fechar vs Finalizar:** novo `POST /api/orders/[id]/solicitar-conta` — qualquer papel operacional (tipicamente ATENDENTE pelo celular) "fecha" a comanda: trava itens pra quem não é caixa, marca `Table.status=CONTA` (enum já existia, nunca tinha sido setado por nenhum fluxo até aqui) e enfileira a ficha de conta na impressora do Caixa via fila+Agente — funciona mesmo vindo do celular, porque não depende de `window.print()` na máquina de quem clicou. `POST /api/orders/[id]/close` (Finalizar — cobra pagamento, desconto, baixa estoque) passa a exigir `guardCaixa()` (novo em `api-guard.ts`: ADMIN/SUPERVISOR/CAIXA). Novos campos `Order.contaSolicitada`/`contaSolicitadaEm`/`contaSolicitadaPor`. (4) **Preço do item só pelo caixa:** `PATCH .../items/[itemId]` aceita `precoUnit` opcional, com `guardCaixa()` quando presente; editor inline na tela da comanda, visível só pra `PAPEIS_CAIXA` (novo em `constants.ts`). Desconto (`PATCH /api/orders/[id]`) ganha o mesmo guard. (5) **Cupom duplicado/triplicado:** causa raiz era `.print-area { position: fixed }` em `globals.css` — `fixed` é repetido em toda página impressa por spec de mídia paginada; corrigido para `position: absolute`. (6) **UX de lançamento:** Enter no campo de busca abre o seletor do primeiro produto filtrado; Enter dentro do seletor (com opcionais obrigatórios satisfeitos) já adiciona; campo de quantidade aceita digitação direta além dos botões +/-. Migration `20260905180000_add_caixa_printer_conta_solicitada` (escrita à mão — sem banco local disponível pra gerar via `prisma migrate dev` nesta sessão; `prisma validate`/`generate` limpos). `tsc --noEmit`, `next lint` e `next build` de produção limpos. Deploy confirmado em produção: migration aplicada no boot do container Docker (`_prisma_migrations` + colunas novas verificadas direto no Postgres pós-deploy) |
| v1.35 | 2026-09-05 | **Ficha de pedido consolidada ("Confirmar Pedido") + retorno visível de impressão** — dois problemas reportados pelo cliente sobre a v1.34, no mesmo dia: (1) o pedido da mesa saía picado (uma ficha por item, em vez de uma folha só); (2) ao lançar um item, ele entrava na fila de impressão mas o sistema não mostrava nada — quem lançou achava que não tinha ido. Causa raiz de ambos: o lançamento de item (`POST /api/orders/[id]/items`) enfileirava sozinho e imediatamente (`fire-and-forget`, sem esperar nem avisar nada). Removido esse enfileiramento automático — `OrderItem` ganha `enviadoImpressaoEm DateTime?` (migration `20260905190000_add_enviado_impressao_em`), `null` = ainda não incluído em nenhuma ficha. Novo `POST /api/orders/[id]/confirmar-pedido`: agrupa todos os itens pendentes por destino (Cozinha/Caixa, mesmo critério `enviaParaCozinha` de sempre), enfileira **uma ficha consolidada por destino** (`renderFichaPedido`, novo em `lib/impressao.ts`), marca os itens como enviados assim que o job entra na fila, e **espera até ~12s a confirmação do Agente** (`aguardarConfirmacaoJob`, extraído e reaproveitado do "Testar impressão") antes de responder — a tela mostra por destino se saiu (`IMPRESSO`), falhou (`ERRO`, com o motivo) ou ainda está pendente (agente offline). Botão "Confirmar Pedido" novo em `comanda-itens.tsx`, com contagem de itens pendentes e uma bolinha ao lado de cada item ainda não enviado. Salvaguarda: "Fechar Comanda" e "Finalizar Comanda" chamam esse mesmo endpoint silenciosamente antes de prosseguir, caso reste algo não confirmado — evita que um item lançado na pressa nunca chegue à cozinha. `POST /api/kds/reimprimir { orderId }` também passou a consolidar (era uma ficha por item também). `tsc --noEmit`, `next lint` e `next build` de produção limpos; sem banco local disponível de novo nesta sessão (migration escrita à mão, só `prisma validate`/`generate` — mesmo gotcha já registrado). Commit `a0f664d` na `main`. **Deploy confirmado em produção** — `docker compose up -d --build` na VPS, log mostrou `Applying migration `20260905190000_add_enviado_impressao_em`` seguido de `All migrations have been successfully applied` e `Ready in 219ms` |
| v1.36 | 2026-09-05 | **Correção de horário (fuso) e letra maior na ficha de pedido consolidada** — dois ajustes pequenos encontrados testando a v1.35 em produção. (1) O horário impresso saía ~3h adiantado: o container roda em UTC, e `toLocaleTimeString`/`toLocaleString` sem fuso explícito formatam no horário do runtime, não em Brasília. Corrigido com dois helpers novos em `lib/impressao.ts` (`formatarHorario`/`formatarDataHora`, ambos com `timeZone: "America/Sao_Paulo"` — mesmo padrão já usado em `lib/periodo.ts`), aplicados nas 4 fichas (produção, pedido consolidado, conta, cupom de teste). (2) O nome do item na ficha de pedido consolidada (`renderFichaPedido`) saía em tamanho normal, sem destaque — cliente pediu letra um pouco maior; adicionado `setTextSize(2, 0)` (altura 3x, largura normal — não reduz quantos caracteres cabem por linha, evita cortar nome de produto comprido). `tsc --noEmit`, `next lint` e `next build` limpos. Commit `8db0a27` na `main`, deploy confirmado em produção (sem migration nova, só `docker compose up -d --build`) |
| v1.37 | 2026-09-06 | **Visual "fast-food ticket" (estilo McDonald's) nas fichas ESC/POS** — cliente reportou que a letra das fichas (Cozinha e Caixa) "não tava saindo legal" e pediu formatação/tamanho no estilo das redes de fast-food. `src/lib/impressao.ts` ganhou um padrão visual único aplicado às 4 fichas ESC/POS (`renderFichaProducao`, `renderFichaPedido`, `renderFichaConta`, `renderCupomTeste`): nome do item em **negrito + CAIXA ALTA + altura ~3x** (`imprimirNomeItem()`, novo helper), títulos em altura ~2x, divisórias fortes (`drawLine("=")`) separando cabeçalho/rodapé e leves (`drawLine()`, `-`) entre itens, TOTAL da conta maior e em negrito. **Restrição de design deliberada:** só a ALTURA do texto é ampliada (`setTextSize(n, 0)`), nunca a LARGURA — a lib (`node-thermal-printer`) calcula o preenchimento de espaços do `leftRight()` e a quebra de linha do `println()` sempre a partir da largura normal (42 colunas fixas em `COLUNAS`), então aumentar a largura desalinha preço/quebra nome comprido no meio, sem a lib saber que o texto ficou mais largo fisicamente. Aumentar só a altura não tem esse problema (cada caractere ocupa a mesma largura em pontos, só fica mais alto). `tsc --noEmit`, `next lint` e `next build` limpos. Commit `77a3025` na `main`, deploy confirmado (sem migration) |
| v1.38 | 2026-09-06 | **Mesas e categorias configuráveis em Configurações + autorização de API por permissão (não mais por papel)** — pedido do cliente em três partes + um princípio ("funcionalidade/botão aparece pra quem tem a permissão, não pro papel"). (1) **Categorias do cardápio** deixam de ser constante fixa (`CATEGORIAS_CARDAPIO`, `src/lib/constants.ts`) e passam a viver em `ConfiguracaoGeral` sob a chave `categorias_cardapio` (JSON `[{nome, vaiParaCozinha}]`) — `src/lib/categorias.ts` novo (parse/serialize + fallback pro padrão), `GET/PUT /api/configuracoes/categorias`, aba **Categorias do Cardápio** em Configurações. Sem migration. (2) **Mesas** viram CRUD: `POST /api/tables` (próximo número livre) e `DELETE /api/tables/[id]` (bloqueia se não-`LIVRE`/com comanda aberta; comandas fechadas são desvinculadas), aba **Mesas** em Configurações. (3) O `<select>` de categoria em `produto-form-dialog.tsx` vem da lista configurada (hook `useCategoriasCardapio`), e trocar pra uma categoria "sem preparo" (Bebidas) já desmarca "Enviar para a cozinha". (4) **`guardGestor()`/`guardAdmin()` removidos**; novos `guardPermissao(chave)`/`guardPermissaoQualquer(chaves[])` em `api-guard.ts`; rotas de Produtos/Insumos/Ficha Técnica/Configurações/Mesas/Notas migradas de papel → permissão granular. `guardCaixa()` (separação atendente/caixa) e os checks de `/api/users` mantidos por papel de propósito. Novas chaves `configuracoes.mesas`/`configuracoes.categorias` em `PERMISSION_TREE`. `tsc --noEmit`, `next lint` e `next build` de produção limpos. **Sem migration.** Commit `d15ae54` na `main` |
| v1.39 | 2026-09-06 | **Nome do cliente no KDS + conta impressa no caixa ao Fechar Comanda, com retorno visível** — (1) cada card do KDS (`kds-board.tsx`) e a lista de Concluídos mostram Mesa/Comanda + nome do cliente (`identificacaoPedido()` concatena `— <clienteNome>`; header do card com o nome em linha própria). (2) `POST /api/orders/[id]/solicitar-conta` trocou `void enfileirarFichaConta(...)` por `await` e passou a devolver `impressao: { ok, erro }`; `comanda-itens.tsx` mostra aviso âmbar ("Comanda fechada, mas …") quando a ficha de conta não entrou na fila do Caixa, em vez da mensagem verde otimista de sempre. A impressão automática da comanda completa no Caixa ao "Fechar" já existia desde a v1.34 — a mudança é tela (KDS) + feedback. `tsc --noEmit`, `next lint` e `next build` limpos. Sem migration. Commit `3b8aa6a` na `main` |
| v1.40 | 2026-09-07 | **Drill-down por horário no gráfico de Pico de Horário** — cliente pediu clicar num horário e ver ticket médio, nº de comandas e formas de pagamento daquele horário. `GET /api/inteligencia/pico-horario` passou a devolver, por hora, `ticketMedio` e `formasPagamento` (`[{forma, valor}]`, split-aware via `receitaPorFormaPagamento()`) junto com os campos que já tinha — sem rota nova nem segundo fetch. `pico-horario-chart.tsx`: `onClick` do `BarChart` seleciona a hora (`activePayload[0].payload.hora`), `<Cell>` por barra destaca a selecionada em dourado e esmaece as demais, painel de detalhe abaixo do gráfico. Pico rotulado como "comandas" (era "pedidos"). `tsc --noEmit`, `next lint` e `next build` limpos. Sem migration. Commit `5371a17` na `main` |
| v1.41 | 2026-09-29 | **Jantinha com escolha obrigatória de espetos, observações (item e comanda), edição da ficha técnica, saúde do CMV + simulador, opcionais recuados na impressão e consumo detalhado nas Notas** — pacote de 6 pedidos vindos da operação real. (1) **Grupo de opcionais "por categoria"** (`GrupoOpcional.origem="categoria"`, `categoria`, `quantidade` — sem mudança de schema em `Product.opcionais`): as opções são os produtos ativos da categoria e o PDV exige a quantidade exata, com +/- por produto (pode repetir o mesmo espeto). Espetos separados em **Espetos Tradicionais** (7) e **Espetos Premium** (9) como no cardápio impresso; as 4 Jantinhas vinculadas (1 ou 2 espetos). Validação também no servidor (`POST .../items`). Os escolhidos vão pra `OrderItem.componentes` (novo) e baixam estoque pela ficha técnica própria no fechamento; `custoUnit` usa o custo real do espeto escolhido; o `costPrice` cadastrado da Jantinha usa a média da categoria (ver decisão no registro). Cadastro de produto ganhou a opção "Produtos de uma categoria". (2) **Observação do item** (campo no modal do produto — `OrderItem.observacoes` já existia, a tela não enviava) e **observação geral da comanda** (`Order.observacoes`, novo; textarea no painel da comanda, `PATCH /api/orders/[id]`), impressas nas fichas de cozinha/bar, na conta, no cupom do caixa e mostradas no KDS. (3) **Edição direta da quantidade** de um insumo na ficha técnica (`PATCH /api/recipe-items { id, quantidade }`, lápis inline com g/kg) recalculando o CMV. (4) **Saúde do CMV** (custo ÷ preço — azul <28%, verde 28–35%, âmbar até 40%, vermelho >40%; constantes em `lib/cmv-calc.ts`) e **simulador por CMV-alvo** (preço = custo ÷ CMV%, mostra a margem bruta, "Aplicar este preço") na ficha técnica; `/cmv` ganha coluna CMV colorida e o preço sugerido passa de margem 65% para **CMV 32%**. (5) **Fichas ESC/POS:** nome do item continua em destaque; opcionais (`  - 2x Espeto de Carne`) e observação (`  OBS: ...`) saem em tamanho normal e recuados (`imprimirDetalhesItem()`, `itemFichaDe()`, `linhasOpcionaisSelecionados()`); observação da comanda em bloco próprio. Corrigidos junto: reimpressão do KDS e ficha de conta não levavam os opcionais; nome comprido na conta colava no preço (agora quebra, valor na linha de baixo). (6) **Notas:** `GET /api/notas` traz os itens da comanda; clicar no cliente abre o consumo (hora, item, opcionais, obs, valores, total, abertura/fechamento) e avisa quando a Nota cobre só parte da comanda. Migrations `20260929120000_add_observacoes_componentes` (schema) e `20260929120100_espetos_tradicionais_premium` (dados, idempotente — recategoriza espetos pelos nomes do seed, vincula Jantinhas, insere as categorias em `ConfiguracaoGeral`). `tsc --noEmit` e `next lint` limpos; APIs testadas ponta a ponta num Postgres descartável (21/21), migrations aplicadas sobre um banco no estado de produção e reaplicadas sem efeito. **Telas não abertas no navegador** (`node_modules` instalado pelo WSL, binários nativos Linux — `next dev` no Windows dá 500 em qualquer página). Commit `dad02cd` na `main`. **Deploy ainda não feito** |
