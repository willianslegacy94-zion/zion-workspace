---
status: draft
domain: kernelmei
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Arquitetura Técnica — KernelMei

Documento derivado da leitura do código real em `orbita-workspace/kernelmei/` em 2026-08-10. Nenhuma decisão listada aqui foi inferida: cada uma aponta para o arquivo que a evidencia.

## 1. Stack de decisão

| Camada | Tecnologia | Evidência / Rationale |
|---|---|---|
| Framework fullstack | Next.js 16.2.12 (App Router, Turbopack) | `package.json`; `next.config.ts` com `output: "standalone"` e `turbopack.root` |
| Linguagem | TypeScript ^5 | `tsconfig.json` |
| ORM | Prisma ^7.9.1 com `@prisma/adapter-pg` | `package.json`; client gerado em `src/generated/prisma` (provider `prisma-client`, não o legado) |
| Banco | PostgreSQL 16-alpine | `docker-compose.yml`, serviço `db` |
| Auth (tenant) | NextAuth v5 beta.32, Credentials, sessão JWT | `src/auth.ts` |
| Auth (SuperAdmin) | `jose` ^6 — JWT HS256 assinado à mão, cookie próprio | `src/lib/admin-session.ts` — deliberadamente fora do NextAuth |
| Hash de senha | bcryptjs ^3, custo 12 | `src/auth.ts`, `onboardingService.ts` |
| Estilo | Tailwind CSS ^4 (CSS-first, `@theme inline`) | `src/app/globals.css` |
| Fetch client-side | SWR ^2.4.2 | usado só nos 3 painéis de `/admin` |
| Ícones | lucide-react ^1.28 | 4 componentes |
| Testes | Vitest ^4.1.10 — **instalado, zero testes escritos** | `package.json` tem `"test": "vitest run"`; não existe nenhum `*.test.ts` nem `vitest.config` |
| Gráficos | recharts ^3.10.1 — **declarado, nunca importado** | provisionado pras telas de dashboard que não existem |
| Validação | zod ^4.4.3 — **declarado, nunca importado** | validação hoje é manual, dentro dos services |

**Repositório:** `orbita-workspace/kernelmei/` — polyrepo, código fora do Obsidian, git local **sem nenhum commit e sem remote** (ver seção 9).

---

## 2. Herança: o que veio de onde

O sistema declara suas duas fontes no cabeçalho do `prisma/schema.prisma` e as mantém separadas com clareza:

| Origem | O que foi herdado | O que NÃO foi herdado |
|---|---|---|
| [[arquitetura-lane-confeitaria\|lane-confeitaria]] | Domínio inteiro: entidades, campos, enums, cálculo de precificação, CMV, ranking por faixa de peso, funil de 5 filas com flags comportamentais | Rotas `/api/internal/*`, telas de dashboard/agenda/financeiro/projeção, suíte Vitest, seed de catálogo |
| `kernel-foodservice` | Padrão de tenant: `Tenant`/`SuperAdmin`, `features` com núcleo inegociável, `branding`, snapshot de sessão no JWT, junções puras sem `tenantId` próprio | O `requireTenantId()` solto — **substituído de propósito**, ver seção 4 |

**Ponto arquitetural mais importante do sistema:** o schema **nasceu** multi-tenant. Não houve retrofit. A primeira migration (`20260809153741_multi_tenant`) já cria toda entidade de negócio com `tenantId`. Isso elimina a classe inteira de bug em que uma linha antiga fica sem dono depois de uma migração de single para multi-tenant.

---

## 3. Camadas do sistema

```
Browser
   ↓ HTTPS
Next.js App Router (src/app)
   ├─ src/proxy.ts (Edge)  →  exige sessão nas rotas de TENANT
   │                          (/, /crm, /clientes, /configuracoes, /dashboard,
   │                           /agenda, /financeiro, /projecao)
   │                          NÃO cobre /admin/* — de propósito
   │
   ├─ (app)/  rotas de tenant     → layout checa sessão, injeta AppShell
   ├─ admin/  rotas de plataforma → cada page.tsx checa obterSessaoAdmin() sozinha
   │
   ├─ Server Components (leitura direta)
   ├─ Server Actions (src/server/actions/*)  →  única porta de mutação
   │      ↓ requireDb()  →  { tenantId, db: ScopedPrisma }
   └─ Service layer (src/server/services/*)  →  todo cálculo e toda query
          ↓ ScopedPrisma  (injeta tenantId automaticamente)
       Prisma Client → PostgreSQL

  instrumentation.ts (onRequestError, runtime Node)  →  ErrorLog  →  /admin
```

**Contrato de assinatura da camada de serviço.** Todo service de negócio recebe `db: ScopedPrisma` como **primeiro parâmetro** e nunca importa `@/lib/prisma`. Vários também recebem `tenantId` explícito, para os casos em que ele precisa ir no `where` de um `upsert` composto ou num `create` de entidade filha. A única exceção autorizada é `onboardingService.ts`, que importa o client cru porque, por definição, precisa enxergar e criar tenants — e o próprio arquivo documenta isso.

**Diferença deliberada de `src/proxy.ts` para `/admin`:** o proxy é o `auth` do NextAuth, que só sabe da sessão de tenant. Como o SuperAdmin usa outra sessão inteiramente, incluí-lo no matcher faria o proxy redirecionar um SuperAdmin válido para `/login`. Por isso `/admin/*` fica fora do matcher e cada página chama `obterSessaoAdmin()` e redireciona para `/admin/login` por conta própria.

---

## 4. Isolamento multi-tenant — a decisão central

`src/lib/scoped-prisma.ts` é um Prisma Client Extension que intercepta `$allOperations` sobre `$allModels`:

| Operação | O que o extension faz |
|---|---|
| `findMany`, `findFirst(OrThrow)`, `findUnique(OrThrow)`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`, `groupBy` | injeta `tenantId` em `args.where` |
| `create` | injeta `tenantId` em `args.data` |
| `createMany` | injeta `tenantId` em cada item do array |
| `upsert` | injeta em `args.where` **e** em `args.create` |

Cobre 14 modelos (`MODELOS_COM_TENANT`). Ficam de fora, e passam sem interferência:
- `Tenant` e `SuperAdmin` — não pertencem a tenant nenhum
- `PedidoSabor` e `ReceitaInsumo` — junções puras, só alcançadas através de um pai já escopado
- `ErrorLog` — gravado deliberadamente pelo client cru (um erro pode ocorrer antes de a sessão existir)

**Por que essa camada existe** (citando o comentário do arquivo): a referência de arquitetura, o `kernel-foodservice`, usa só um `requireTenantId()` que devolve o valor sem nada obrigando seu uso — e **uma auditoria de código encontrou 2 bugs reais de vazamento cross-tenant lá**, por rota que esqueceu `tenantId` no `where`. O extension torna esse esquecimento estruturalmente difícil: quem usa `scopedPrisma(tenantId)` nunca escreve `tenantId`.

**Limite honesto da proteção, declarado no próprio arquivo:** o extension não impede alguém de importar `@/lib/prisma` (o client cru) por engano. Isso continua sendo convenção, reforçada pelo padrão de assinatura dos services.

**Verificação executada:** `scripts/verificar-isolamento.ts` (rodado por `npx tsx`, fora do produto) provisiona dois tenants reais, cria sabor e pedido no A, e afirma que o B enxerga zero pedidos e zero sabores, enquanto o client cru confirma que o dado existe no banco. Depois desativa o A e confirma o kill-switch. No final apaga tudo, na ordem correta de FK — porque `Tenant` não tem cascade de propósito.

---

## 5. Autenticação — duas sessões independentes

### Sessão de tenant (NextAuth v5, `src/auth.ts`)

- **Credentials provider.** E-mail é único **globalmente**, não por tenant: o tenant é resolvido a partir de qual `Usuario` bateu com o e-mail. Não há seletor de tenant na tela. Consequência assumida no schema: dois tenants não podem ter o mesmo e-mail; a convenção sugerida no onboarding é `admin@<slug>`.
- **Kill-switch no login:** `if (!usuario.tenant.ativo) return null` — inadimplência é resolvida no ponto de autenticação, não numa tela de admin.
- **Timing attack mitigado:** `bcrypt.compare` sempre roda, contra um `DUMMY_HASH` quando o e-mail não existe, pra não vazar a existência da conta pelo tempo de resposta. Mesmo padrão em `autenticarSuperAdmin()`.
- **Snapshot no JWT:** `tenantId`, `tenantSlug`, `tenantNome`, `features` e `branding` são gravados no token no login. Trade-off explicitado em `src/lib/features.ts`: mudar `Tenant.features` exige a usuária deslogar e logar de novo.
- **Callback `authorized`** presente — sem ele o proxy anexaria a sessão e deixaria passar. (No lane-confeitaria a ausência desse callback foi um bug de segurança real, registrado no [[registro-de-decisoes-lane-confeitaria]]; aqui ele já nasce presente.)

### Sessão de SuperAdmin (`src/lib/admin-session.ts`)

JWT HS256 assinado com `jose`, cookie `kernelmei_admin_session` (`httpOnly`, `sameSite: lax`, `secure` em produção), validade **8h** — "sessão de operação, não fica logado por dias". Assina com `NEXTAUTH_SECRET` e falha ruidosamente se ele não existir.

**Por que separada** (comentário do arquivo): um SuperAdmin nunca pertence a um tenant, e fundir os dois num único `session.user` exigiria um discriminador de tipo espalhado por toda checagem de sessão do sistema.

---

## 6. Feature flags e branding

**Features** (`src/lib/features.ts`). `CORE_FEATURES` — `pedidos`, `catalogo`, `agenda` — são aplicadas **por último** no spread de `resolveFeatures()`, o que torna impossível um tenant desligá-las via `Tenant.features`. As opcionais são `financeiro`, `dashboard`, `projecao` e `whatsappIA`.

`whatsappIA` merece nota: o comentário do arquivo diz que o flag liga/desliga **só a UI**, porque a automação de verdade (a Mel respondendo por WhatsApp) ainda não é multi-tenant do lado do Quasar. O flag existe pra não bloquear o desenho da tela.

**Branding** (`src/lib/theme.ts` + `src/app/globals.css`). O Tailwind v4 declara os tokens de marca como `var(--tenant-X, <fallback>)`. `brandingParaCssVars()` converte `Tenant.branding` em CSS custom properties aplicadas no `src/app/layout.tsx`. Se o tenant não configurou uma cor, a variável simplesmente não é escrita e o fallback do CSS cobre sozinho. Nome de classe Tailwind (`brand-rose`, `brand-gold`...) nunca muda — só o valor por trás. Ver [[design-system-kernelmei]].

---

## 7. Observabilidade

`src/instrumentation.ts` implementa `onRequestError`, capturando erro de render de Server Component, Route Handler e Server Action **globalmente**, sem instrumentar cada action.

Detalhes que o código trata explicitamente:
- **Guard de runtime:** `if (process.env.NEXT_RUNTIME !== "nodejs") return` — Prisma não roda no Edge, e o proxy roda no Edge
- **Imports dinâmicos** de `@/lib/error-log` e `@/auth`, pra não puxar Prisma pro bundle Edge
- **Resolução best-effort de quem estava logado:** tenta a sessão de tenant; se não achar, tenta a de admin; se nenhuma, o log ainda sai com rota, status, mensagem e stack
- **`registrarErro` nunca lança:** se a própria gravação falhar, cai num `console.error`, "pra não mascarar o erro original com um erro secundário de logging"
- Mensagem truncada em 2000 caracteres, stack em 4000

Consumo: `listarErros()` devolve os 100 mais recentes de toda a plataforma para a aba "Logs de Erro" do `/admin`.

---

## 8. Deploy

**Dockerfile multi-stage**, com um alvo a mais que o padrão:

| Stage | Papel |
|---|---|
| `deps` | `npm ci` |
| `builder` | `prisma generate` + `next build` |
| `migrate` | imagem **completa** (com o CLI do Prisma), roda `prisma migrate deploy` como job avulso — não serve tráfego |
| `runner` | imagem slim, usuário não-root `nextjs` (uid 1001), só o output `standalone` + `public` + `.next/static`, `CMD ["node","server.js"]` |

**docker-compose.yml:** `db` (Postgres 16-alpine, healthcheck `pg_isready`, exposto só em `127.0.0.1:5438`), `migrate` (sob `profiles: ["tools"]`, portanto **fora** do `docker compose up`) e `app` (exposto só em `127.0.0.1:3021`, portanto atrás de um proxy no host — mesmo arranjo dos outros sistemas em VPS compartilhada).

**Lição já incorporada de outro sistema.** O comentário do serviço `migrate` referencia explicitamente o playbook de deploy do lane-confeitaria: *"Sempre `docker compose build migrate` antes do `run` quando houver migration nova — imagem em cache não pega migration nova."* Esse foi um incidente real de produção no lane (ver [[modelo-de-dados-lane-confeitaria]]), e chegou aqui como comentário preventivo antes do primeiro deploy. Vale como exemplo de conhecimento operacional atravessando sistemas.

**Portas em uso:** `3021` (app em compose), `5438` (Postgres), `3022` (dev server — visto no `.claude/settings.local.json`, que registra a sessão de teste manual do `/admin`).

---

## 9. Estado real e lacunas técnicas

### Versionamento — a lacuna mais urgente

O repositório tem `.git`, mas o branch `master` **não tem nenhum commit** e **não há remote configurado**. Os 80 arquivos estão todos untracked. Consequências:

- Não há histórico, não há rastreabilidade de decisão por commit message, não há como reverter nada
- **O código existe em uma única cópia, numa máquina só.** Não está no GitHub, não está em VPS, não está em backup
- Este documento de arquitetura foi escrito lendo comentários de código porque **não existe outra fonte de intenção** no repositório

### Telas com service pronto e sem página

`/dashboard`, `/agenda`, `/financeiro` e `/projecao` aparecem no `AppShell` e no matcher do `src/proxy.ts`, e têm service por trás (`financeiroService`, `cmvService`, `metaService`, `rankingService`, `agendaService`, `formaPagamentoService`), mas **não têm `page.tsx`** — hoje resultam em 404. As Server Actions correspondentes (`financeiro.ts`, `meta.ts`, `configuracao.ts`, `formaPagamento.ts`) já existem e não têm quem as chame.

### Estratégia de teste — declarada e não executada

Vitest está instalado, `npm test` está mapeado, e a arquitetura é **favorável a teste**: funções puras isoladas e sem banco em `precificacaoService` (7 funções), `rankingService.faixaDePeso`, `agendaService.dataMinimaEntrega` e `features.resolveFeatures`. Nenhuma tem teste.

A verificação que existe hoje é `scripts/verificar-isolamento.ts` — um script de asserção manual, contra banco real, rodado uma vez e não repetível em CI (cria e apaga dado real, sem transação de rollback). É valioso, mas não é suíte de teste.

**Recomendação (não implementada — decisão do Willians):** as funções puras acima são o alvo de maior retorno e menor custo — cobrem regra de negócio monetária sem exigir banco. O `resolveFeatures` merece teste específico porque a garantia de que `CORE_FEATURES` não pode ser desligada é uma propriedade de produto, não um detalhe.

### Integração com o Quasar — meia ponte

Só a direção **de saída** existe (`quasarService.classificarDesistencia`), e ela é um stub consciente que sempre devolve `INDEFINIDO` porque o endpoint do Quasar ainda é fixo no lane-confeitaria. A direção **de entrada** — as rotas `/api/internal/*` que no lane recebem o atendimento automático — não foi portada. A única rota de API do sistema é `/api/auth/[...nextauth]`.

### Dívidas menores

- Comentário desatualizado em `src/app/globals.css` aponta para `src/components/TenantThemeProvider.tsx`, arquivo que não existe — a lógica está em `src/lib/theme.ts`, aplicada em `src/app/layout.tsx`
- `recharts` e `zod` no `package.json` sem nenhum import
- `agendaService.desbloquearDia` e `diasBloqueadosDoMes` não recebem `tenantId` explícito — corretos, porque o `deleteMany`/`findMany` passa pelo extension, mas assimétricos em relação aos vizinhos, o que pode confundir leitura futura
- Sem README

---

## 10. Histórico de versão

| Versão | Data | Descrição |
|---|---|---|
| v0.1 | 2026-08-09 | Migration `multi_tenant` — schema completo, 19 modelos, todos com `tenantId` desde a origem |
| v0.1 | 2026-08-10 | Migration `add_error_log` — observabilidade via `instrumentation.ts` e aba de logs no `/admin` |
| — | 2026-08-10 | Documentação de arquitetura criada no kernel-hq (este documento), a partir de leitura de código |

---

## Links relacionados

[[indice-kernelmei]] — mapa completo dos artefatos do sistema
[[prd-kernelmei]] — problema, usuário e escopo entregue vs. pendente
[[modelo-de-dados-kernelmei]] — 19 entidades, estratégia de `tenantId` e regras de cálculo
[[design-system-kernelmei]] — tokens de marca e mecanismo de branding por tenant
[[registro-de-decisoes-kernelmei]] — memória viva do sistema
[[arquitetura-lane-confeitaria]] — arquitetura do sistema de origem da regra de negócio
