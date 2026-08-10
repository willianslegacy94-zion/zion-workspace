---
status: in-progress
domain: orbita-whitelabel
source: claude
created: 2026-07-10
updated: 2026-08-03
owner: willians
---

# Backlog de Tarefas — Migração para Supabase + multi-tenant real

> Referência: [[arquitetura-orbita-whitelabel]] | [[modelo-de-dados-orbita-whitelabel]] | [[registro-de-decisoes-orbita-whitelabel]]

**Última atualização:** 2026-07-10

## Contexto

O sistema-orbita-whitelabel era "1 deployment Docker = 1 cliente": cada barbearia
rodava seu próprio Postgres, e tudo que diferenciava um cliente do outro
(branding, cores, feature flags) era fixado em **build-time** via `.env` e
build args do `docker-compose.yml`.

Objetivo: ir para **1 banco compartilhado, multi-tenant de verdade** — um único
deployment atende todos os clientes, cada linha de dado carrega `tenant_id`, e
tanto as feature flags quanto o branding são resolvidos **em runtime a partir
do login/URL**. Onboarding de um novo cliente vira "inserir uma linha na
tabela `tenants`", não "subir um novo stack Docker".

Plano completo original: `/home/willians_orbita/.claude/plans/merry-pondering-storm.md`
(fora do repositório — histórico da sessão que desenhou a migração).

## Status por fase

| Fase | Status | Descrição |
|------|--------|-----------|
| 0 — Supabase (infra) | 🟡 Código pronto, **não conectado** | SSL em `db.js`, `DB_HOST`/`DB_SSL` no `.env`. Falta o projeto Supabase existir e a connection string ser configurada. |
| 1 — Schema multi-tenant | ✅ Feito e testado | Tabela `tenants` + `tenant_id` em toda tabela de negócio, migração idempotente (`runMigrations()` em `backend/models.js`). |
| 2 — Backend (auth/tenant scoping) | ✅ Feito e testado | Login exige `slug`, JWT carrega `tenant_id`+`features`. Auth virou global no `server.js`. `tenant_id` propagado em ~30 funções de `models.js` e todas as rotas. |
| 3 — Endpoint público de branding | ✅ Feito | `GET /api/public/tenants/:slug` (sem autenticação), retorna só branding. |
| 4 — Frontend runtime | ✅ Feito, build validado | `TenantConfigContext` resolve `/t/:slug`. `config/tenant.js`/`config/features.js` (build-time) removidos. `docker-compose.yml`/`Dockerfile` sem build args de branding/flags. **Não testado visualmente em navegador** (sem essa ferramenta na sessão que fez a migração). |

> **A Thieco não migra para este banco — isso nunca vai existir.** O `sistema-thieco`
> permanece definitivamente como instância própria e separada. Este banco
> multi-tenant é exclusivamente para clientes novos que vierem a partir de agora.

## Correções de segurança feitas durante a migração

Encontradas ao propagar `tenant_id` (não existiam antes por acaso — cada
deployment tinha banco isolado, então não eram exploráveis até virar multi-tenant):

- **IDOR**: várias funções buscavam só por PK (`findById`, `toggleAtivo`,
  combos/consumo por ID etc.) sem checar dono — corrigido, agora todas exigem
  `tenant_id` + retornam 404 se o registro for de outro tenant.
- **SQL injection latente**: `relatorios.js` e `metas.js` interpolavam
  `unidade` (query param) direto na string SQL — agora parametrizado.
- **Rota sem autenticação**: `POST /import` não tinha nenhum middleware de
  auth — fechado pela autenticação global no `server.js`.
- **Cache de taxas cross-tenant**: `vendas.js` tinha um cache global de taxas
  de cartão que vazaria taxa de um tenant pro cálculo de outro — virou `Map`
  por `tenant_id`.

Tudo validado via curl: login cross-tenant isolado, IDOR bloqueado (404 +
lista vazia), feature flag por tenant funcionando sem restart.

## Ambiente de teste local

Stack Docker `orbita-test` rodando em `http://localhost:8080`.

- URL de acesso: `http://localhost:8080/t/principal`
- Tenant: `principal` (id=1), todas as feature flags habilitadas.

**Logins de teste** (senha igual pros três: `orbita2526`):

| Usuário | Papel | Visualização |
|---|---|---|
| `orbita` | admin | Sistema completo |
| `orbita.barbeiro` | barbeiro | PDV, Lançamentos, Painel, Metas (+ Relatório, fixo pro papel) |
| `orbita.operador` | operador | Operação do caixa |

> **Atualizado em 2026-08-03:** isso deixou de ser verdade. `GET /auth/me`
> recalcula `features`/`usaComissao` do tenant a cada chamada, e o frontend
> revalida a cada 60s — editar `tenants.features` no banco (ou pelo Painel
> Admin, ver abaixo) reflete em quem já está logado sem precisar de
> logout/login. Ver [[registro-de-decisoes-orbita-whitelabel]] 2026-08-03.

## Pendências / próximos passos

1. **Conectar Supabase de verdade**: usuário precisa criar o projeto em
   supabase.com e passar a connection string (idealmente a do Connection
   Pooler, porta 6543). Depois disso: apontar `DB_HOST`/`DB_SSL` no `.env` e
   rodar a migração lá antes de qualquer dado real.
2. **Testar visualmente no navegador** — a migração do frontend foi validada
   por build (`npm run build` e `docker compose build` limpos) e por chamadas
   de API via curl, mas ninguém abriu `/t/principal` num navegador ainda para
   confirmar visualmente (tema, logo, toggle claro/escuro, menus).
3. **`VITE_NICHO` / `config/labels.js`** continua build-time (terminologia
   por nicho de negócio — barbearia/salão/clínica). Não estava no escopo
   combinado desta migração (só branding + flags), mas é a última coisa
   "presa" a um build único — ficaria inconsistente se dois tenants
   diferentes precisarem de nichos diferentes no mesmo deployment.
4. **RLS (Row Level Security)** no Postgres foi decidido como *fora de
   escopo* nesta rodada — a isolação primária é via `tenant_id` obrigatório
   em toda query (já feito). RLS com `SET LOCAL app.tenant_id` fica como
   endurecimento futuro, se quiser (exigiria trocar `pool.query()` direto por
   checkout de conexão + transação por request).

## Arquivos-chave alterados nesta migração

**Backend:** `models.js`, `server.js`, `db.js`, `config/features.js`,
`middleware/featureGate.js`, `routes/auth.js`, `routes/public.js` (novo),
e todas as rotas em `routes/*.js` (tenant_id propagado).

**Frontend:** `contexts/TenantConfigContext.jsx` (novo),
`contexts/ThemeContext.jsx`, `lib/theme.js`, `lib/api.js`, `App.jsx`,
`pages/Login.jsx`, `pages/EsqueciSenha.jsx`, `pages/ResetarSenha.jsx`,
`pages/GestaoProfissionais.jsx`, `pages/IntelFinanceira.jsx`,
`pages/MeuPainel.jsx`, `pages/RegistroVenda.jsx`, `components/Header.jsx`,
`components/Sidebar.jsx`, `components/Dashboard.jsx`,
`components/FeatureGate.jsx`. Removidos: `config/tenant.js`,
`config/features.js`.

**Infra:** `docker-compose.yml`, `frontend/Dockerfile`, `.env.example`.

---

## Backlog — Portabilidade WhatsApp + IA (Cortex/Quasar), desde 2026-07-28

> Ver [[registro-de-decisoes-orbita-whitelabel]] 2026-07-28 para a decisão completa. Playbook operacional: `kernel-hq-arquitetura/Playbook DevOps - Comandos Docker e Bancos.md`.

| Item | Status | Descrição |
|------|--------|-----------|
| `authenticateInternal` | ✅ Feito e testado | Auth serviço-a-serviço via `X-Internal-Key` |
| `whatsappService.js` + `routes/whatsapp.js` | ✅ Feito e testado | Canal dinâmico por tenant, instância `{tenantSlug}-{unidadeSlug}` |
| `routes/internal.js` (transbordo, relatório sob demanda, admin-autorizado, resolve-instancia, unidade-atendimento, cliente-atendimento) | ✅ Feito e testado | Ver decisão 2026-07-28 |
| `sincronizarAlertas` (fix de bug de `lida` perdida) | ✅ Feito e testado | — |
| Cortex/Quasar: resolução dinâmica de tenant (sem hardcode) | ✅ Feito e testado localmente (webhook simulado ponta a ponta) | Não testado com WhatsApp/OpenRouter reais — falta cliente com número pareado |
| Role `cortex_readonly` dedicada | ❌ Descartado | Desenho final é 100% mediado por API — não precisa de conexão direta ao Postgres |

### Gap de CRUD de unidade + taxa por unidade — ✅ Concluído (2026-07-28)

- **CRUD de unidade**: `backend/routes/unidades.js` novo — `GET /unidades` (ativas, uso geral), `GET /unidades/admin` (todas, admin), `POST /unidades` (slug derivado do nome, deduplicado, imutável depois de criado), `PATCH /unidades/:id` (nome), `PATCH /unidades/:id/ativo`. Nova aba "Unidades" em `Configuracoes.jsx` (admin-only, lista + criar + editar nome + ativar/inativar).
- **Taxa de cartão por unidade**: nova coluna `unidades.taxas` (JSONB), mesma convenção de `atendimento_ia` — chaves `debito`/`credito`/`pix`/`dinheiro`/`cortesia` + variantes por bandeira (visa/mastercard/elo/hipercard/diners, mesma lista do thieco). `GET/PUT /configuracoes/taxas` agora scoped por unidade (`{ <slug>: {...} }`), substituindo as 9 chaves fixas tenant-wide antigas. `calcularValorLiquido()` em `routes/vendas.js` passou a receber `unidade` e ler `unidades.taxas` em vez do cache tenant-wide antigo — mudança real na cadeia de cálculo do `valor_liquido`, não só na tela.
- **Layout**: `AbaTaxas` reescrita pro grid de cards agrupados por forma de pagamento (Débito/Crédito/Outros), mesmo padrão visual do sistema-thieco — `SeletorUnidade` (já existia, usado em 3 das 4 abas) agora é alimentado pela lista real de unidades via `useUnidades()` (novo hook em `config/unidades.js`), não mais o fallback estático `VITE_UNIDADES`.
- **Testado via API** (`docker compose up -d --build`, stack `orbita-test`): criar unidade nova, configurar taxas diferentes por unidade (3% vs 5% de crédito), registrar venda em cada uma e confirmar `valor_liquido` correto por unidade (R$97,00 e R$95,00 sobre R$100,00, respectivamente); validação rejeita chave de taxa inválida e unidade inexistente (422). Build de produção do frontend (`docker compose build frontend`) passou limpo. **Não testado visualmente em navegador** (sem ferramenta de browser disponível na sessão).
