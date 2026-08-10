---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-08-07
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

**Fechamento de comanda com split payment + bandeira:**
```
[POST /api/orders/[id]/close { pagamentos: [{forma, valor, bandeira?}], desconto }]
→ [valida soma dos pagamentos == total - desconto, tolerância 0.01]
→ [lib/pagamentos.ts: resolverPagamentos() — forma primária = maior valor; pagamentosSplit só se houver >1 forma]
→ [lib/taxas.ts: calcularTaxaAplicada() — busca TaxaPagamento por forma+bandeira, cai para forma+null se não houver taxa específica]
→ [transaction:
     1. prisma.order.update (FECHADO, closedAt, formaPagamento, pagamentosSplit, taxaTotal)
     2. se tipo MESA: prisma.table.update (LIVRE)
     3. para cada item: se produto tem ficha técnica, decrementa Ingredient.quantidadeAtual + cria MovimentacaoEstoque(VENDA);
        senão, se trackInventory, decrementa Product.estoque
   ]
→ [Response 200]
→ [CupomImpressao dispara window.print() no client]
```

**Cálculo de CMV (recalculo automático):**
```
[PATCH em RecipeItem, ou em Ingredient.custoUnitario/rendimentoPercentual]
→ [lib/cmv.ts: recalculateProductCost(productId) ou recalculateProductsByIngredient(ingredientId)]
→ [custoEfetivo = custoUnitario / (rendimentoPercentual / 100), se rendimento < 100 — corrige perda de limpeza/aparas]
→ [Product.costPrice = Σ (recipeItem.quantidade × custoEfetivo do insumo), pulando produtos com costPriceManual=true]
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
| Impressora térmica 80mm | nenhuma (via SO) | — | — | `window.print()` + CSS — o navegador do dispositivo precisa ter a impressora configurada como padrão ou selecionável no diálogo de impressão |
| WhatsApp (notificações agendadas) | saída (Next.js → Evolution API) | REST/JSON (`POST /message/sendText/{instance}`) | header `apikey` (`EVOLUTION_API_KEY`) | Evolution API self-hosted (`evoapicloud/evolution-api`, container `evolution_api`, mesma VPS compartilhada), instância dedicada `jocley-grill` — não reaproveita nenhuma das instâncias de outros clientes já rodando na mesma Evolution API (thieco, academia-sandro, lane-confeitaria). Container do app conectado à rede Docker externa `orbita_shared` para falar com `evolution_api:8080` (porta interna) — a porta publicada no host (`127.0.0.1:8081`) só aceita loopback, nem `host.docker.internal` alcança. Ver Registro de Decisões (2026-08-04) para o troubleshooting completo |

---

## 5. Fronteiras de segurança

- **Autenticação:** NextAuth v5 via Credentials provider — username (campo `email`) + bcryptjs hash. Sessão JWT, `AUTH_SECRET`/`AUTH_URL`/`NEXTAUTH_URL` no `.env`
- **Autorização de página:** middleware em Edge Runtime aplica allowlist de rota por role antes de qualquer página renderizar
- **Autorização de API (defesa em profundidade):** `src/lib/api-guard.ts` (`guardGestor()`) centraliza a checagem `role === ADMIN || role === SUPERVISOR` no servidor, aplicada em toda rota de escrita de Produtos, Insumos e Ficha Técnica (`/api/products`, `/api/products/[id]`, `/api/ingredients`, `/api/ingredients/[id]`, `/api/recipe-items`) e nas rotas de Usuários (com a restrição adicional de papel do SUPERVISOR aplicada dentro do próprio handler) — necessário porque o middleware por si só libera todas as rotas `/api/*` para qualquer role autenticado (ver Decisão "Correção do bloqueio de API para papéis operacionais" no Registro de Decisões)
- **Restrição de papel do Supervisor:** `PAPEIS_GERENCIAVEIS_POR_SUPERVISOR = ["CAIXA", "ATENDENTE", "COZINHA"]` (`src/lib/require-admin.ts`) — Supervisor nunca cria nem edita conta ADMIN ou SUPERVISOR, checado em `/api/users` e `/api/users/[id]`
- **Conta de suporte técnico (`devmaster`):** `guardDevmaster()` (`src/lib/api-guard.ts`) checa identidade (`email === "devmaster"`), não papel — único guard do sistema que não é role-based. Protege `GET /api/error-logs` e bloqueia edição da própria conta via `PATCH /api/users/[id]`. `GET /api/users` filtra essa conta da listagem, então nem ADMIN a vê na tela de Usuários
- **Tratamento de erro de API:** todas as 38 rotas (exceto o handler do NextAuth) são envolvidas por `withErrorHandling` (`src/lib/api-error.ts`) — qualquer exceção não tratada vira `{ error: mensagemAmigavel }` no cliente e um registro em `ErrorLog` no servidor, nunca stack técnico exposto. Erros conhecidos do Prisma (P2025/P2002/P2003) têm mensagem específica; o resto cai num genérico. `error.tsx`/`global-error.tsx` cobrem o equivalente para falha de renderização React
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
| v1.14 | 2026-07-30 | Rebranding — nome de exibição alterado de "Jocley Lanchonete" para "Jocley Grill" (constante `NOME_LANCHONETE`, usada em toda a UI: login, sidebar, navbar, cupom, KDS, DRE); repositório Git próprio criado (`git init`, sem remote no GitHub até este ponto) — antes vivia como pasta solta sem versionamento no `Kernel Workspace` |
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
