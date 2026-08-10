---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Arquitetura Técnica — Kernel Academia

## 1. Stack de decisão

| Camada | Tecnologia | Rationale (evidência) |
|---|---|---|
| Framework fullstack | Next.js 16.2.10 (App Router, `output: "standalone"`) | Mesma versão do `academia-sandro`, sistema de origem |
| Linguagem | TypeScript ^5 | Padrão do workspace |
| ORM | Prisma ^7.8 com `@prisma/adapter-pg` + `pg` ^8.22 | Herdado do `academia-sandro`; client gerado em `src/generated/prisma` (provider `prisma-client`, não `prisma-client-js`) |
| Banco | PostgreSQL 16 (container `kernel-academia-db`, `127.0.0.1:5441`) | Postgres **local de desenvolvimento**, deliberadamente desacoplado do Supabase de produção do `academia-sandro` — comentado no `docker-compose.yml` e duas vezes no `.env` |
| Auth (tenant) | NextAuth v5 beta 31, Credentials Provider, sessão JWT | Padrão de `academia-sandro`/`kernel-foodservice` |
| Auth (plataforma) | Cookie próprio assinado com HMAC-SHA256 sobre `AUTH_SECRET` | Decisão explícita: SuperAdmin não pertence a tenant, sessão não pode se confundir com a de `Usuario` |
| Estilo | Tailwind CSS ^4 (CSS-first, `@theme inline`) | Herdado; adaptado para branding por tenant via indireção de variável |
| Ícones | `lucide-react` ^1.24 | Padrão do workspace |
| Hash de senha | `bcryptjs` ^3, custo 12 | Padrão do workspace |
| Runtime de container | `node:22-alpine`, multi-stage (deps → builder → runner), usuário `nextjs` não-root | Dockerfile do repositório |
| Testes | — | **Nenhuma dependência de teste no `package.json`** |

**Repositório:** `Kernel Workspace/kernel-academia/` — código fora do Obsidian. **Sem `.git` próprio e untracked no monorepo pai** (`?? kernel-academia/`).

---

## 2. Herança e o que é novo

Este sistema é um derivado do `academia-sandro` com a camada de multi-tenancy do `kernel-foodservice` por cima. Separar as duas coisas é essencial para não atribuir a este sistema decisões que vieram de outro contexto.

**Herdado do `academia-sandro` (domínio de academia — idêntico):**
`Aluno`, `TransacaoFinanceira`, `AgendaAula`, `Matricula`, `AlunoFaixaModalidade`, `PresencaDiaria`, `Despesa`, `ModalidadePreco`, `Pacote`, `PacoteMembro`, `PreCadastro`, `ConfiguracaoAgenda`, `BloqueioAgenda`, `Usuario`; enums `DiaSemana`, `StatusPresenca`, `TipoPacote`, `Role`; os 13 componentes de `src/components/`; a árvore de rotas `(app)`, `aluno`, `login`, `esqueci-senha`, `resetar-senha`.

**Novo neste sistema:**
- `Tenant` (slug, ativo, `features` JSON, `branding` JSON) e `tenantId` em 15 dos 16 models
- `SuperAdmin` + `src/lib/superadmin-auth.ts` + grupo de rotas `/admin-kernel`
- `ErrorLog` + `src/instrumentation.ts` / `src/instrumentation-node.ts`
- `src/lib/features.ts` (core vs. opcional), `src/lib/api-guard.ts` (`requireTenantId`), `src/lib/tenant-publico.ts` (resolução por slug + branding)
- Rotas públicas parametrizadas por slug: `/cadastro-aluno/[tenantSlug]`, `/matricule-se/[tenantSlug]`
- `AdminKernelSidebar.tsx`
- Indireção de tema em `globals.css`: `--primary`/`--background` como variáveis sobrescrevíveis, em vez das cores fixas do `academia-sandro`

**Padrões copiados nominalmente do `kernel-foodservice`** (citado em 6 pontos do código): bloco `Tenant`/`SuperAdmin` do schema, bloco `ErrorLog`, login global em `src/auth.ts`, "Gerar nova senha" no painel admin, captura centralizada de erro, `docker-compose.yml` com Postgres local separado.

---

## 3. Camadas do sistema

```
Browser (mobile-first)
   ↓ HTTPS  (nginx do host, na VPS — não implantado ainda)
Next.js App Router (container, 127.0.0.1:3012)
   ├─ src/proxy.ts  ← middleware (Next 16 renomeou middleware.ts → proxy.ts)
   │     matcher: "/", /alunos, /transacoes, /agenda, /despesas,
   │              /pre-cadastros, /matriculas, /configuracoes, /aluno
   │     callback authorized() em src/auth.ts → checa sessão e role
   │     NÃO cobre: /admin-kernel, /cadastro-aluno, /matricule-se, /api/*
   │
   ├─ Server Components (leitura) — chamam prisma direto, sempre após requireTenantId()
   ├─ Server Actions (mutação) — actions.ts por rota
   ├─ Route Handlers — /api/auth/*, /api/cron/limpar-comprovantes
   ├─ src/lib/* — regra de negócio compartilhada (parcelas, precos, matricula,
   │              alertas, agenda, comprovantes, whatsapp-gateway)
   └─ instrumentation.ts → onRequestError → ErrorLog
        ↓ Prisma Client (@prisma/adapter-pg)
   PostgreSQL 16
```

**Onde vive a regra de negócio:** não há camada de service formal (diferente do `lane-confeitaria`, que concentra tudo em `src/server/services/`). Aqui as Server Actions falam direto com o Prisma, e o que é compartilhado entre telas mora em `src/lib/` — `parcelas.ts` (ciclo de 12 meses), `precos.ts` (hierarquia de preço e descontos), `matricula.ts` (capacidade e criação de matrícula+transação), `alertas.ts` (sino), `vencimento.ts` (status efetivo), `comprovantes.ts` (retenção). Consequência: as regras não são testáveis sem banco — e não há testes.

---

## 4. Modelo de multi-tenancy

**Estratégia:** um banco, um schema, `tenantId` como coluna (*shared database, shared schema*).

| Aspecto | Como é resolvido |
|---|---|
| Identificação do tenant (autenticado) | A partir do `Usuario` encontrado no login — **sem slug na URL**. `tenantId` e `tenantSlug` entram no JWT |
| Identificação do tenant (público) | Slug no path (`/matricule-se/[tenantSlug]`), resolvido no servidor via `resolveTenantPublico()`, com `.bind()` para a action |
| Escopo de query | `requireTenantId()` no topo de cada page/action, `where: { tenantId }` manual em toda query |
| Isolamento no banco | **Nenhum** — sem RLS, sem role por tenant. Uma query sem `tenantId` vaza dado |
| Unicidade | `Usuario.username` e `Usuario.email` são `@unique` **globais**, não por tenant |
| Chaves compostas por tenant | `@@unique([tenantId, alunoId, agendaAulaId])` (Matricula), `[tenantId, alunoId, modalidade]` (faixas), `[tenantId, alunoId, agendaAulaId, data]` (presença), `[tenantId, modalidade]` (preço) |
| Singleton por tenant | `ConfiguracaoAgenda` usa `tenantId` como PK |
| Suspensão | `Tenant.ativo = false` → `authorize()` recusa o login; slug público devolve 404 |
| Branding | `Tenant.branding` JSON → CSS custom properties inline no shell |
| Módulos | `Tenant.features` JSON mesclado com `CORE_FEATURES` (core sempre vence), snapshot no JWT |

**Trade-off assumido:** *shared schema* mantém um deploy, um pool e uma migration para todos os clientes — proporcional a dezenas de academias. O preço é que o isolamento passa a ser disciplina de código, não garantia do banco. **Mitigação recomendada e ainda não aplicada:** RLS no Postgres com `SET LOCAL app.tenant_id`, ou uma extensão de Prisma Client que injete `tenantId` automaticamente.

---

## 5. Fluxos de dados principais

### Onboarding de um tenant novo

```
[/admin-kernel — form "Novo tenant"] → [Server Action criarTenant]
  → requireSuperAdmin()  (cookie HMAC, não NextAuth)
  → slugify(slug informado || nome)
  → monta features {} a partir dos checkboxes (FEATURES_OPCIONAIS)
  → monta branding {} (slogan/logoUrl/corPrimaria/corFundo — só campos preenchidos)
  → senhaTemporaria = randomBytes(9).base64url ; bcrypt custo 12
  → $transaction:
        tenant.create({ slug, nome, features, branding })
        usuario.create({ tenantId, username, email, passwordHash, role: ADMIN,
                         senhaTemporaria: true })
  → P2002 ⇒ "Slug, usuário ou e-mail já em uso por outro tenant"
  → redirect com ?criado=1&slug&adminUsername&senha  (senha exibida UMA vez, na tela)
```

### Login e resolução de tenant

```
[/login username+senha] → [authorize() em src/auth.ts]
  → usuario.findUnique({ username }) include tenant     ← busca GLOBAL, sem tenant
  → bcrypt.compare(senha, usuario?.passwordHash ?? DUMMY_HASH)   ← tempo constante
  → !usuario || !senhaValida ⇒ null
  → !usuario.tenant.ativo   ⇒ null   (inadimplência, teste vencido)
  → devolve { id, username, nome, role, alunoId, tenantId, tenantSlug,
              features: resolveFeatures(tenant.features) }
  → jwt() copia tudo para o token ; session() copia do token para a sessão

[toda page/action autenticada] → requireTenantId() → session.user.tenantId
```

### Ciclo de parcelas (mensalidade principal e modalidades extras)

```
[getParcelasCiclo({ tenantId, alunoId, matriculaId, dataBase })]
  → transacoes = findMany({ tenantId, alunoId, tipo:"Receita", matriculaId })
        matriculaId = null  → mensalidade principal   (dataBase = Aluno.dataMatricula)
        matriculaId = id    → ciclo da modalidade extra (dataBase = Matricula.dataVencimentoBase)
  → para i = 0..11:
        mesRef = 1º dia do mês (dataBase + i meses)      ← janela FIXA, não "próximos 12 meses"
        casa transação por (ano, mês)                     ← não por dia
        confirmadoEm      ⇒ "Paga"
        comprovanteUrl    ⇒ "Aguardando confirmação"
        transação existe  ⇒ "Pendente"
        mesRef > hoje     ⇒ "A vencer"
        senão             ⇒ "Não paga"
```

### Matrícula em horário extra (portal do aluno e autocadastro)

```
[matricularAlunoEmAula(tenantId, alunoId, agendaAulaId, formaPagamento, client?)]
  → aula inexistente                      ⇒ MatriculaError
  → aula.modalidade == aluno.modalidade   ⇒ MatriculaError
        ("já tem acesso por este horário pela modalidade principal")
  → ocupação = count(Aluno com modalidade da aula) + count(Matricula do horário)
     ocupação >= capacidadeMax             ⇒ MatriculaError "Horário lotado"
  → valor = ModalidadePreco[tenantId, modalidade] ?? 0
  → matricula.create + transacaoFinanceira.create (categoria "Matrícula extra — {modalidade}")
  → P2002                                 ⇒ MatriculaError "já está matriculado neste horário"
```

O parâmetro `client` permite compor a função dentro de uma `$transaction` maior (autocadastro com várias modalidades) ou chamá-la isolada (portal).

### Bloqueio de agenda → aviso real por WhatsApp

```
[Configurações → Agenda → criar bloqueio] → [criarBloqueio]
  → notificarAlunosDoBloqueio():
       diaSemana = DIA_SEMANA_POR_INDICE[data.getUTCDay()]
       aulas do tenant nesse dia cujo horário ∈ [horaInicio, horaFim)
       destinatários = alunos com modalidade afetada (acesso implícito)
                     ∪ alunos com Matricula nos horários afetados
                     (deduplicados por id, só quem tem telefone)
       enviarWhatsapp(...) por aluno, em Promise.all
       falha individual ⇒ console.error, nunca lança
```

### Captura de erro por tenant

```
[exceção não tratada em Server Action / Server Component / Route Handler]
  → onRequestError (src/instrumentation.ts)
      → console.error sempre
      → NEXT_RUNTIME != "nodejs" ⇒ retorna (Prisma usa node:path/node:url,
                                    quebraria o bundle de Edge)
      → import dinâmico de instrumentation-node.ts
          → getToken({ headers, secret }) para recuperar tenantId/username do JWT
          → errorLog.create({ tenantId?, rota, status 500,
                              mensagem[:2000], stack[:4000], usuario? })
          → falha ao logar ⇒ console.error, nunca propaga
```

---

## 6. Pontos de integração

| Integração | Direção | Formato | Autenticação | Notas |
|---|---|---|---|---|
| Browser ↔ Next.js (tenant) | interna | Server Actions + Server Components | Cookie de sessão NextAuth (JWT) | Cobertura do `proxy.ts` limitada ao matcher declarado |
| Browser ↔ Next.js (plataforma) | interna | Server Actions | Cookie `kernel_superadmin_session` (HMAC), path `/admin-kernel`, 7 dias | Fora do NextAuth de propósito |
| Next.js ↔ PostgreSQL | interna | Prisma Client (TCP) | `DATABASE_URL` no `.env` | Postgres local em Docker, porta 5441 |
| Evolution API (WhatsApp) | sistema → serviço externo | REST/JSON | Header `apikey` | `src/lib/whatsapp-gateway.ts`. Alcançada pela rede Docker `orbita_shared` (só existe na VPS). Em dev toda função degrada em silêncio |
| WhatsApp por link `wa.me` | browser → WhatsApp | URL | — | `src/lib/whatsapp.ts` — clique manual do admin (cobrança, envio de acesso ao portal) |
| `GET /api/cron/limpar-comprovantes` | externo → sistema | REST/JSON | **Nenhuma** | Rota pronta para cron externo. Sem chave, sem verificação de origem |

**Divergência registrada entre comentário e código:** o `.env` afirma que `EVOLUTION_INSTANCE_NAME` "é por tenant em produção (ver `Tenant.branding`/onboarding)". Não é: `INSTANCE_NAME` é lido uma vez do ambiente do processo em `whatsapp-gateway.ts`, com default `"academia-sandro-admin"`. **Todos os tenants compartilham a mesma instância de WhatsApp.**

---

## 7. Fronteiras de segurança

**O que está bem resolvido:**
- Sessão de plataforma separada da de tenant, com cookie `httpOnly`, `sameSite: lax`, `secure` em produção, escopado ao path `/admin-kernel`, payload assinado com HMAC e expiração verificada
- `bcrypt` custo 12 em toda senha; `DUMMY_HASH` quando o usuário não existe (timing attack)
- Login recusado para tenant inativo
- Slug público inexistente e tenant inativo devolvem o mesmo 404 — não revelam qual dos dois
- `tenantId` de rota pública vem de `.bind()` no servidor, nunca do formulário
- Distinção `/alunos` (gestão) × `/aluno` (portal) por segmento exato, não por prefixo
- Erro nunca chega cru ao usuário; stack fica só no `ErrorLog`
- Container roda como usuário não-root; porta publicada só em loopback

**Riscos conhecidos, não mitigados:**

| Risco | Detalhe | Impacto |
|---|---|---|
| Sem RLS | Isolamento depende de `where: { tenantId }` em toda query | Uma query esquecida vaza dado entre academias clientes |
| `/admin-kernel` fora do `proxy.ts` | Protegido só por `requireSuperAdmin()` nas pages/actions | Uma page nova esquecida do guard fica aberta |
| `/api/cron/limpar-comprovantes` sem auth | `GET` público dispara limpeza de comprovantes de todos os tenants | Perda de comprovante ainda dentro da janela de 10 dias |
| Comprovantes servidos de `public/` | Arquivos ficam sob `public/comprovantes/` (há 2 arquivos reais no repo) | URL adivinhável = comprovante de pagamento de aluno acessível sem sessão, inclusive de outro tenant |
| Senhas temporárias em query string | `?senha=...` no redirect após criar tenant e após reset | Fica no histórico do browser e em log de acesso do proxy |
| Contas fixas de suporte | `devmaster` (ADMIN) e `devaluno`, senha em texto no `seed.ts`, devem sobreviver em produção | Acesso permanente de suporte aos dados de um cliente real |
| Login global | `username`/`email` únicos na plataforma | Colisão entre clientes; e um username enumera a existência de conta na plataforma inteira |
| Segredo único | `AUTH_SECRET` assina JWT de tenant **e** cookie de SuperAdmin | Vazamento compromete os dois planos de uma vez |

---

## 8. Estratégia de escala

**Volume esperado:** não declarado em lugar nenhum do repositório. O que dá para afirmar: o `docker-compose.yml` prevê **um** container de app e **um** Postgres, e o dashboard carrega `findMany()` de alunos, transações e despesas do tenant inteiro em memória e agrega com `reduce` — dimensionado para academias de porte pequeno/médio, não para milhares de alunos por tenant.

**Plataforma pretendida (pelo `docker-compose.yml`):** VPS + Docker, porta `127.0.0.1:3012`, nginx do host cuidando de roteamento e TLS — mesmo padrão dos outros produtos da Holding na VPS Hostinger compartilhada. Rede externa `orbita_shared` para alcançar o container `evolution_api`. Volume nomeado `comprovantes` para os anexos sobreviverem a rebuild, e `kernel_academia_pgdata` para o banco.

**Operação prevista (comentada no compose):** `docker compose run --rm migrate` (aplica `prisma migrate deploy`) e `docker compose run --rm seed` (uma vez, após o primeiro migrate). Ambos são serviços one-off que não sobem com `docker compose up`.

**O que exigiria retrabalho:**
- **WhatsApp por tenant** — hoje instância única por processo; exige mover o nome da instância para o `Tenant` e reescrever `whatsapp-gateway.ts` para receber o tenant como parâmetro
- **Catálogo de modalidades por tenant** — `MODALIDADES` é constante em `src/lib/modalidades.ts` com as 5 modalidades do CT do Sandro; um tenant novo não cadastra as suas
- **Feature flags de verdade** — 3 das 4 opcionais são gravadas mas nunca lidas
- **Agregações do dashboard** — precisariam migrar de `reduce` em memória para `groupBy`/SQL agregado
- **Tela de Preços** — N+1 (`getAlunosComPrecos` consulta matrículas por aluno)
- **Isolamento forte** — RLS ou extensão de client que injete `tenantId`

---

## 9. Bloqueantes para o primeiro cliente real

Levantados por leitura de código, em ordem de gravidade:

1. **Marca do cliente de origem vazada no produto** — `layout.tsx` (title/description), `TermosAceite.tsx` (texto de consentimento LGPD), as 4 mensagens de `src/lib/whatsapp.ts` e o default de `EVOLUTION_INSTANCE_NAME` citam "Centro de Treinamento Sandro Freire" / `academia-sandro`. Um lead de outro tenant assina consentimento para a academia errada e recebe cobrança assinada por outra marca.
2. **Instância de WhatsApp única para todos os tenants** (seção 6).
3. **Comprovantes de pagamento em `public/`** sem controle de acesso (seção 7).
4. **`/api/cron/limpar-comprovantes` sem autenticação** (seção 7).
5. **Sem RLS** — isolamento apenas por disciplina (seção 4).
6. **Sem versionamento** — o projeto não está em git nenhum; qualquer perda de disco perde tudo.
7. **Sem `.env.production`** — o compose depende dele; não há deploy possível como está.
8. **Sem testes** — nenhuma rede de segurança para a regra de parcelas/preços/capacidade.

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-07-10 | Scaffold `create-next-app` (data dos arquivos `README.md`, `AGENTS.md`, `eslint.config.mjs`, `tsconfig.json`, `postcss.config.mjs`). `README.md` permanece o boilerplate até hoje |
| v0.2 | 2026-08-03 | Infraestrutura de container: `Dockerfile` multi-stage e `.dockerignore` |
| v1.0 | 2026-08-09 | Migration `20260809120232_init_multitenant` — schema multi-tenant inteiro em uma migration só: `tenants`, `super_admins` e `tenantId` em todas as tabelas de negócio. Não houve estágio single-tenant neste repositório |
| v1.1 | 2026-08-09 | Migration `20260809195433_error_logs` — captura automática de erro por tenant via `onRequestError`, com a implementação isolada em `instrumentation-node.ts` para não puxar o Prisma para o bundle de Edge |
| v1.2 | 2026-08-09 | `docker-compose.yml` com Postgres local (5441), app em loopback 3012, rede externa `orbita_shared`, volume de comprovantes e serviços one-off `migrate`/`seed`. `.env` com os avisos de nunca apontar para o Supabase do `academia-sandro` |
| — | 2026-08-10 | Criação desta documentação de governança em `kernel-hq/arquitetura-kernel-academia/` |

> As datas acima vêm de `mtime` de arquivo e de nome de migration — **não há histórico de commit** para confirmar autoria ou sequência exata, porque o projeto não está versionado.

---

## Links relacionados

[[prd-kernel-academia]] — problema, objetivo e escopo que esta arquitetura implementa
[[modelo-de-dados-kernel-academia]] — schema Prisma detalhado por entidade
[[registro-de-decisoes-kernel-academia]] — decisões técnicas reconstruídas a partir do código
[[indice-kernel-academia]] — mapa completo dos artefatos do sistema
