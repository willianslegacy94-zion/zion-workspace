---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Arquitetura Técnica — Kernel Foodservice

> Referência: [[prd-kernel-foodservice]] | [[modelo-de-dados-kernel-foodservice]]

Documento reconstruído por leitura do código em 2026-08-10. Tudo aqui é verificável em `orbita-workspace/kernel-foodservice/`.

---

## 1. Stack de decisão

| Camada | Tecnologia | Rationale (quando declarado no código) |
|---|---|---|
| Framework fullstack | Next.js 15 (App Router), `output: "standalone"` | Mesma versão do `lanchonete-sistema` de origem — este é um fork, não um projeto novo |
| Linguagem | TypeScript ^5 | Herdado |
| ORM | Prisma 6.4.1 (`@prisma/client` + `prisma`) | Herdado. **Não** Prisma 7 — sem `prisma.config.ts`, `url` ainda vive no bloco `datasource` |
| Banco | PostgreSQL 16 (container `kernel-foodservice-db`) | Volume próprio `kernel_foodservice_pgdata`, porta host 5440 (configurável por `POSTGRES_HOST_PORT`) |
| Auth (tenant) | NextAuth v5 beta, Credentials, sessão JWT | Herdado; cookies renomeados pra `kernelfs.*` |
| Auth (super-admin) | HMAC-SHA256 sobre `crypto` nativo, cookie `kernel_admin_session` | Deliberadamente fora do NextAuth — ver §4 |
| Estilo | Tailwind CSS ^4 (CSS-first, `@theme`) | Ver [[design-system-kernel-foodservice]] |
| Dados no client | SWR ^2.4 | Herdado (polling nas telas operacionais) |
| Gráficos | Recharts ^2.12 | Herdado |
| Ícones | lucide-react | Herdado |
| Hash de senha | bcryptjs ^3 | Herdado |
| Testes | **nenhum** | Nenhum test runner em `package.json`, nenhum arquivo de teste no repo |

**Repositório:** `orbita-workspace/kernel-foodservice/` — git local **sem nenhum commit** e **sem remote**. Todos os 174 arquivos versionáveis estão untracked.

**Portas em dev (fixadas de propósito, comentário em `scripts/dev.js`):** app em `3003`, Postgres em `5440`. O comentário explica: sem `-p` explícito, o Next.js cairia na porta livre mais baixa, descasando de `NEXTAUTH_URL`/`AUTH_URL` e quebrando o redirect pós-login. Mesmo motivo da renomeação dos cookies.

---

## 2. As três camadas que diferenciam este sistema do Jocley Grill

O domínio de foodservice inteiro (PDV, CMV, estoque, KDS, DRE, gestão de time) é herdado sem mudança semântica de [[arquitetura-jocley-lanchonete]]. O que é **novo** aqui são três camadas:

### 2.1 Isolamento — `tenantId` resolvido do usuário, nunca da URL

```
Login (email + senha)
  → prisma.user.findUnique({ email }) include tenant
  → user.ativo? tenant.ativo?          (tenant desativado bloqueia login de toda a equipe)
  → bcrypt.compare
  → JWT recebe { role, tenantId, tenantNome, features }
      ↓ (snapshot — não é recalculado a cada request)
Toda rota de negócio → requireTenantId() → session.user.tenantId → where: { tenantId }
```

O e-mail é único **globalmente** (`User.email @unique`, sem composta com `tenantId`) — consequência direta de não haver slug na URL: sem slug, o tenant só pode ser descoberto a partir do usuário, então o usuário precisa ser globalmente identificável. O schema documenta isso e recomenda `admin@nome-do-cliente` no onboarding.

**Cobertura verificada:** das 44 rotas de API de negócio, 40 chamam `requireTenantId()`. As 4 restantes escopam manualmente:
- `/api/users/*` (3 rotas) — usam `session.user.tenantId` direto no `where`
- `/api/configuracoes/whatsapp/instancia` — não toca o banco, só fala com a Evolution API (ver risco em §7)

### 2.2 Modulação — `Tenant.features` aplicado em três pontos

```
src/lib/features.ts
  CORE_FEATURES = { cardapio: true }        ← único módulo que nenhum tenant pode desligar
  FEATURES_OPCIONAIS (8)                    ← mesas, balcao, cmv, estoque,
                                              inteligenciaFinanceira, gestaoDeTime,
                                              notificacoesWhatsapp, taxasDelivery
  resolveFeatures(tenant.features) = { ...tenantFlags, ...CORE_FEATURES }
                                       ↑ core sempre vence
```

Aplicação em profundidade — as três camadas são independentes, esconder na UI nunca é a única defesa:

| Camada | Mecanismo | Arquivo |
|---|---|---|
| Navegação | `resolvePermissoes(user, features)` zera as chaves de permissão do módulo desligado; sidebar/navbar filtram por `permissoes[chave] === true` | `src/lib/permissions.ts`, `src/components/sidebar.tsx` |
| Página (server) | `requirePermissao("estoque")` → `redirect("/")` | `src/lib/require-permissao.ts` |
| API | `guardFeature("estoque")` → **404** (não 403) | `src/lib/feature-guard.ts` — 18 rotas |

O 404 é deliberado: "pra não revelar que o módulo existe, só que não está disponível nesta configuração".

**Nota de design:** `CHAVES_POR_FEATURE_OPCIONAL` é sempre um filtro subtrativo, nunca ampliação — módulo desligado zera a chave mesmo pra ADMIN, que normalmente tem tudo.

**Mudança registrada em comentário (2026-08):** `mesas`, `balcao`, `cmv` e `estoque` **deixaram de ser core**. Justificativa no código: "restaurante só-balcão não precisa de Mesas, e nem todo negócio quer CMV/Estoque calculado (ex.: cardápio simples sem ficha técnica)".

### 2.3 Onboarding — painel super-admin com autenticação paralela

O `SuperAdmin` **não é um `User` com role especial** — é uma tabela própria, sem `tenantId`. A justificativa está escrita em `src/lib/admin-auth.ts`: forçar super-admin dentro do NextAuth exigiria tornar `tenantId`/`features` opcionais para todos, quebrando a garantia "sessão de tenant sempre tem `tenantId`".

```
Cookie kernel_admin_session = "{superAdminId}.{exp}.{HMAC-SHA256(payload, AUTH_SECRET)}"
  → validado com timingSafeEqual (comparação constante)
  → 8h de duração, httpOnly, sameSite=lax, secure em produção
  → guardSuperAdmin() em toda rota /api/admin/*
```

---

## 3. Camadas do sistema

```
Browser
   ↓
Next.js App Router (standalone, container único)
   │
   ├─ src/middleware.ts ──────── RBAC de navegação por role
   │     matcher exclui: login, admin, api/auth, api/admin, _next/*
   │
   ├─ (tenant)/  ─── layout com Sidebar/Navbar + PermissoesProvider
   │     │            + <style>:root{--color-brand-primary: tenant.branding.corPrimaria}
   │     ├─ ADMIN/SUPERVISOR → Sidebar (desktop lateral)
   │     ├─ CAIXA/ATENDENTE  → Navbar (bottom bar mobile)
   │     └─ COZINHA          → sem casca (o KDS traz o próprio header dark)
   │
   ├─ admin/ ──────────────── fora do route group (tenant), casca própria dark
   │
   ├─ api/  (44 rotas de negócio)  → requireTenantId + guardGestor/guardFeature
   ├─ api/admin/ (6 rotas)         → guardSuperAdmin
   │
   └─ src/instrumentation.ts → setInterval 60s → notificacoes-dispatcher
         ↓ Prisma Client
   PostgreSQL 16
         ↓ (só quando notificacoesWhatsapp ligada)
   Evolution API (rede Docker externa orbita_shared)
```

---

## 4. Fronteiras de segurança

| Fronteira | Mecanismo |
|---|---|
| Sessão de tenant | NextAuth JWT, cookies `kernelfs.*`, `secure` em produção. Login bloqueado se `user.ativo=false` **ou** `tenant.ativo=false` |
| Sessão de super-admin | HMAC-SHA256 com `AUTH_SECRET`, `timingSafeEqual`, expiração no payload. Sem `AUTH_SECRET` a função lança — nunca degrada pra "sem assinatura" |
| Navegação por role | `src/middleware.ts` — listas explícitas de rota por role; qualquer rota fora da lista redireciona pro home do role |
| Página por permissão | `requirePermissao` / `requirePermissaoQualquer` server-side, consulta `permissoesOverride` no banco (não confia só no JWT) |
| API por papel | `guardGestor()` → 403 se não for ADMIN/SUPERVISOR |
| API por módulo | `guardFeature()` → 404 |
| Logs de erro | `guardDevmaster()` — conta fixa `devmaster` por e-mail hardcoded, não é permissão atribuível |
| Isolamento de dados | `requireTenantId()` em 40/44 rotas; as 4 restantes filtram por `session.user.tenantId` explicitamente |
| Erros ao cliente | `withErrorHandling` traduz códigos Prisma (P2025/P2002/P2003) em mensagem amigável; stack técnica vai pra `ErrorLog`, não pra resposta |
| Segredos | `.env` gitignored; `DATABASE_URL`, `AUTH_SECRET`, `EVOLUTION_API_*` só em env |

**Observação sobre `OrderItem`:** é a única tabela de negócio **sem** `tenantId`, por decisão documentada no schema — "`OrderItem` nunca é consultado fora do contexto de uma `Order` já filtrada por tenant". A garantia é indireta: depende de todo acesso passar pela `Order`. Verificado como verdadeiro no código atual, mas é uma invariante que nenhum mecanismo do banco impõe.

---

## 5. Integrações

| Integração | Direção | Autenticação | Notas |
|---|---|---|---|
| Browser ↔ Next.js | interno | Cookie NextAuth (tenant) ou HMAC (admin) | SWR nas telas operacionais |
| Next.js ↔ PostgreSQL | interno | `DATABASE_URL` | Prisma Client |
| Evolution API (WhatsApp) | sistema → externo | header `apikey` | Só saída (envio de notificação + QR/status de instância). **Não** há webhook de entrada — este sistema não recebe mensagem |

**Diferença relevante frente ao [[arquitetura-lane-confeitaria]]:** não existe integração com o Órbita Quasar, nem rotas `/api/internal/*`. O Kernel Foodservice não tem camada de atendimento por IA.

---

## 6. Deploy

**Nunca deployado.** O que existe:

- `Dockerfile` multi-stage (deps → builder → runner), `node:20-alpine`, roda `prisma migrate deploy` no `CMD` antes de `node server.js`, `HOSTNAME=0.0.0.0` explícito
- `docker-compose.yml`: `db` (postgres:16, `127.0.0.1:5440`) + `app` (`127.0.0.1:3011`), redes `default` + `orbita_shared` (externa)
- `deploy/nginx/SEU-DOMINIO.conf.example` — ainda com placeholder, sem TLS

A escolha de `orbita_shared` está justificada em comentário: falar com o container `evolution_api` pelo nome, já que a porta publicada em `127.0.0.1` só aceita conexão do próprio host, não de outro container.

O sistema se encaixa no padrão de VPS Hostinger compartilhada já usado por Thieco/VillaMill/academia-sandro/lane-confeitaria (nginx no host, cada app numa porta de loopback). Porta 3011 e banco 5440 não colidem com nenhum sistema já mapeado.

---

## 7. Riscos conhecidos (evidenciados no código, não mitigados)

| # | Risco | Evidência | Severidade |
|---|---|---|---|
| R1 | **Instância única de WhatsApp para todos os tenants.** `credenciaisEvolution()` lê `EVOLUTION_INSTANCE` de `process.env` — global, não por tenant. O dispatcher itera tenant a tenant e usa o telefone de destino de cada um (`ConfiguracaoGeral`), mas **todos enviam do mesmo número**. Num produto whitelabel, o cliente A recebe notificação vinda do WhatsApp do cliente B. | `src/lib/evolution-api.ts`, `src/lib/notificacoes-dispatcher.ts` | Alta — quebra a premissa de whitelabel |
| R2 | **Agendador em memória, sem lock.** `instrumentation.ts` liga um `setInterval(60s)` no processo. Se o app escalar pra 2 réplicas, cada réplica dispara as notificações de todos os tenants — mensagem duplicada. Não há lock distribuído; a única proteção é `ultimoDisparoEm` por dia, que sofre corrida entre réplicas. | `src/instrumentation.ts` | Média — só se materializa com >1 réplica |
| R3 | **`ignoreBuildErrors` + `ignoreDuringBuilds` ligados.** `next.config.ts` desliga TypeScript **e** ESLint no build. O build de produção passa mesmo com erro de tipo — perigoso justamente num sistema onde o esquecimento de um `tenantId` num `where` é um erro de dado, não de sintaxe. | `next.config.ts` | Alta — remove a única rede de proteção automática (não há testes) |
| R4 | **nginx de exemplo com `Connection "upgrade"` hardcoded.** Exatamente o padrão que quebrou Server Actions no deploy do Lane Confeitaria (registrado em [[arquitetura-lane-confeitaria]] v2.4). Se este arquivo for copiado como está, o mesmo bug se repete. | `deploy/nginx/SEU-DOMINIO.conf.example` | Média — só na hora do deploy, mas custo conhecido |
| R5 | **Senha temporária devolvida em JSON e nunca forçada a trocar.** `POST /api/admin/tenants` gera `randomBytes(6).toString("base64url")` e devolve no corpo da resposta. Não há flag de "senha provisória" nem fluxo de troca obrigatória no primeiro login. | `src/app/api/admin/tenants/route.ts` | Média |
| R6 | **Credenciais de seed previsíveis.** `superadmin@kernel / superadmin123` e `devmaster / dev2026`. Se o seed rodar em produção sem troca imediata, o painel de onboarding de todos os tenants fica exposto. | `prisma/seed.ts` | Alta se o seed for pra produção |
| R7 | **`OrderItem` sem `tenantId`.** Isolamento por invariante de código, não por dado. Uma query futura que consulte `orderItem` diretamente não tem como ser escopada. | `prisma/schema.prisma` | Baixa hoje, cresce com o tempo |
| R8 | **Nenhum teste, nenhum commit.** Sem histórico não há bisect nem rastreabilidade de decisão; sem teste não há regressão detectável — e este fork existe justamente pra receber mudanças estruturais. | `git log` vazio; `package.json` sem test runner | Alta |

---

## 8. O que exigiria reescrita

- **Slug na URL** (`/t/:slug`, como o Kernel faz): permitiria e-mail único por tenant em vez de global, mas mexe em login, middleware e resolução de sessão inteira
- **Categorias de cardápio por tenant:** hoje constante global; virar tabela exige migration + UI + migração de dado dos tenants existentes
- **Mais de uma réplica do app:** exige tirar o agendador do processo (cron externo ou lock no banco)
- **Instância de WhatsApp por tenant:** exige mover as credenciais Evolution de env pra `ConfiguracaoGeral`/`Tenant`, e provisionar instância no onboarding

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-07-29 | Fork inicial do `lanchonete-sistema` — datas de criação de `.eslintrc.json`, `.gitignore`, `tsconfig.json`, `Dockerfile` e `next-env.d.ts` |
| v0.2 | 2026-08-03 | `deploy/nginx/` e `public/` adicionados |
| v0.3 | 2026-08-08 | `.env.example`, `docker-compose.yml` e `package.json` na forma atual (nome `kernel-foodservice`, banco/volume/container próprios) |
| v0.4 | 2026-08-09 | Migration única `20260809144326_init_multitenant`; route group `(tenant)` isolado do painel `/admin` (comentário no layout registra o bug: a sidebar do tenant aparecia dentro do painel super-admin porque compartilhavam o layout raiz) |
| — | 2026-08-10 | Criação desta documentação. Estado: implementado, **nunca commitado, nunca executado contra banco real de forma registrada, nunca deployado** |

> As datas acima vêm de `mtime` dos arquivos, **não** de commits — o repositório não tem nenhum. São aproximações, não histórico auditável.

---

## Links relacionados

[[prd-kernel-foodservice]] — problema, objetivo e escopo que esta arquitetura implementa
[[modelo-de-dados-kernel-foodservice]] — schema Prisma detalhado por entidade
[[indice-kernel-foodservice]] — mapa completo dos artefatos do sistema
[[arquitetura-jocley-lanchonete]] — arquitetura do sistema de origem
[[arquitetura-orbita-whitelabel]] — o produto Kernel, origem dos padrões de multi-tenancy
