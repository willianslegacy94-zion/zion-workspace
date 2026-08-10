---
status: draft
domain: kernel-academia
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# System Creation Threshold — Kernel Academia

Resposta às 6 perguntas obrigatórias de [[system-creation-threshold]].

Status: **threshold aprovado retroativamente** — a pasta foi criada em 2026-08-10, depois do código já existir. O sistema é real (schema multi-tenant migrado, 2 migrations aplicadas, painel de onboarding funcional), mas **nunca foi implantado em produção** e **não está versionado em git**.

> **Aviso de rastreabilidade:** este documento foi escrito lendo o código de `kernel-academia/`, não a partir de um kickoff registrado. Tudo aqui rastreia para arquivo, comentário de código, schema ou config. O que não pôde ser confirmado está marcado como pergunta aberta na seção final — não foi inventado.

---

## Respostas ao threshold

| Pergunta | Resposta | Onde isso está evidenciado no código |
|---|---|---|
| **1. Qual problema esse sistema resolve?** | O sistema do Centro de Treinamento Sandro Freire (`academia-sandro`) resolve a gestão de **uma** academia — é single-tenant: um banco, um conjunto de alunos, uma marca hardcoded. Para vender esse mesmo produto a uma segunda academia seria preciso duplicar o repositório, o banco e o deploy inteiros. O problema que o `kernel-academia` resolve é esse: **transformar um sistema de academia de cliente único num produto whitelabel multi-tenant**, onde cada academia nova é uma linha na tabela `tenants` — sem fork, sem rebuild, sem novo container. | `src/app/admin-kernel/(protegido)/page.tsx`: *"Cada linha aqui é uma academia cliente — isolada por tenantId, sem rebuild necessário pra criar uma nova."* |
| **2. Para quem?** | Dois públicos distintos, com autenticação separada: (a) **Willians, como operador da plataforma** — cadastra e desativa academias clientes pelo painel `/admin-kernel`, reseta senha de qualquer usuário e lê os logs de erro de todos os tenants; (b) **cada academia cliente** — admin do CT (gestão de alunos/agenda/financeiro) e alunos do CT (portal próprio). | `model SuperAdmin` no `schema.prisma` (*"Conta de quem cadastra/gerencia tenants (onboarding) — nunca pertence a um tenant"*); `enum Role { ADMIN, ALUNO }`; `src/lib/superadmin-auth.ts` |
| **3. Qual é o output esperado?** | Um SaaS de gestão de academia/CT rodando em código-base único, com: painel de onboarding de tenants (branding + módulos opcionais por cliente), gestão de alunos, agenda de aulas por modalidade/horário/capacidade, financeiro com ciclo de 12 parcelas (mensalidade principal + modalidades extras com vencimento próprio), pacotes de desconto (família/combo), portal do aluno com anexo de comprovante, páginas públicas de pré-matrícula e autocadastro por slug do tenant, e notificações reais de WhatsApp via Evolution API. | Árvore de rotas em `src/app/` (grupos `(app)`, `aluno`, `admin-kernel`, `cadastro-aluno/[tenantSlug]`, `matricule-se/[tenantSlug]`) |
| **4. Quais inputs o sistema precisa para funcionar?** | Por tenant: nome + slug + admin inicial (criados juntos no onboarding), grade de horários (`AgendaAula`: modalidade, dia, hora, capacidade), preço por modalidade (`ModalidadePreco`), e o cadastro dos alunos. Globalmente: um `SuperAdmin` (bootstrapado pelo seed a partir de `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA`) e, para notificações reais, uma instância de WhatsApp na Evolution API compartilhada. | `criarTenant` em `src/app/admin-kernel/actions.ts`; `garantirSuperAdmin`/`garantirTenantDemo` em `prisma/seed.ts`; `.env` |
| **5. Qual é o primeiro artefato concreto?** | O painel `/admin-kernel` com criação de tenant em um passo — cria `Tenant` + `Usuario` ADMIN na mesma transação e devolve a senha temporária na tela. É o artefato que diferencia este sistema do `academia-sandro`: sem ele, não existe produto, existe só uma cópia do sistema do Sandro. | `criarTenant` (`prisma.$transaction` com `tenant.create` + `usuario.create`) |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Tem repositório próprio, schema próprio (16 models, todos escopados por `tenantId`), banco próprio (`kernel-academia-db`, porta 5441), container próprio (porta 3012) e um plano de controle que o `academia-sandro` não tem (`SuperAdmin`, `Tenant.features`, `Tenant.branding`, `ErrorLog` cross-tenant). Não é material de apoio ao `academia-sandro`: é um produto derivado, com ciclo de vida independente. | `docker-compose.yml`, `prisma/schema.prisma`, `prisma/migrations/20260809120232_init_multitenant/` |

---

## Origem — derivado direto do academia-sandro, com o padrão whitelabel do kernel-foodservice

Diferente do [[system-creation-lane-confeitaria]] (kickoff direto com cliente, sem sistema irmão do mesmo domínio), o `kernel-academia` **não nasceu de um cliente**. Nasceu de dois sistemas que já existiam no workspace:

- **`academia-sandro`** — origem de **todo o domínio de negócio**. O conjunto de models é o mesmo (`Aluno`, `TransacaoFinanceira`, `AgendaAula`, `Matricula`, `AlunoFaixaModalidade`, `PresencaDiaria`, `Despesa`, `ModalidadePreco`, `Pacote`, `PacoteMembro`, `PreCadastro`, `ConfiguracaoAgenda`, `BloqueioAgenda`, `Usuario` + enums `DiaSemana`/`StatusPresenca`/`TipoPacote`/`Role`), a árvore de rotas é a mesma e os 13 componentes de `src/components/` são os mesmos (o `kernel-academia` só acrescenta `AdminKernelSidebar.tsx`).
- **`kernel-foodservice`** — origem do **padrão whitelabel**. Está citado explicitamente em 6 pontos do código como referência de decisão: o bloco `Tenant`/`SuperAdmin` do schema, o bloco `ErrorLog`, a decisão de login global (não por tenant) em `src/auth.ts`, o "Gerar nova senha" do painel admin, o padrão de captura de erro e o `docker-compose.yml` com Postgres local separado.

**Nada do domínio de academia foi inventado aqui** — foi herdado do `academia-sandro`, que por sua vez veio do cliente real. O que é novo neste sistema é a camada de multi-tenancy (isolamento por `tenantId`, plano de controle, branding e feature flags por cliente).

---

## Não confundir com o academia-sandro

| | `academia-sandro` ([[arquitetura-academiasandro]]) | `kernel-academia` (este sistema) |
|---|---|---|
| Natureza | Sistema de **um cliente** | **Produto** whitelabel multi-tenant |
| Cliente | Centro de Treinamento Sandro Freire | Nenhum cliente real ainda — só 2 tenants demo no seed |
| Banco | Supabase (mesmo banco em dev e produção) | Postgres local em Docker (`kernel-academia-db`, porta 5441) |
| Isolamento | Não existe (tudo é do Sandro) | `tenantId` obrigatório em 15 dos 16 models |
| Plano de controle | Não existe | `/admin-kernel` com `SuperAdmin`, tenants, usuários e logs |
| Branding | Hardcoded | `Tenant.branding` (slogan, logo, cor primária, cor de fundo) |
| Módulos | Todos ligados | `Tenant.features` — 3 core + 4 opcionais |
| Status | **Em produção** desde 2026-08-03 (`sandrofreiresf.online`, porta 3010) | **Nunca implantado** — porta 3012 reservada no compose, sem `.env.production` no repo |

O `.env` do `kernel-academia` avisa isso duas vezes, com todas as letras:

> *"NUNCA aponte isso pro Supabase de produção do academia-sandro — schema incompatível (multi-tenant) e dado real de aluno/pagamento em jogo."*

---

## Status do threshold

**Status:** aprovado (retroativo)
**Data de aprovação:** 2026-08-10 — mesma sessão em que esta documentação foi criada
**Estado atual do código:**

- Scaffold `create-next-app` datado de 2026-07-10 (`README.md` ainda é o boilerplate original, não editado)
- Migration `20260809120232_init_multitenant` — schema multi-tenant inteiro nascido já com `tenants`/`super_admins`, sem migration anterior single-tenant
- Migration `20260809195433_error_logs` — captura automática de erro por tenant
- Build local funcionando (`tsconfig.tsbuildinfo` e `.next/` de 2026-08-09), `db:seed` cria SuperAdmin + 2 tenants demo + contas fixas `devaluno`/`devmaster`
- **Sem suíte de testes** — não há dependência de teste no `package.json`
- **Sem git próprio e não versionado no monorepo pai** — `git status` do `Kernel Workspace` mostra a pasta inteira como `?? kernel-academia/`
- **Sem deploy** — `docker-compose.yml` aponta para `.env.production`, arquivo que não existe no repositório

---

## Perguntas abertas — precisam do Willians, não estão no código

1. **Existe cliente real na fila?** O seed só cria tenants fictícios ("Academia Vale Fitness", "CT Guerreiros do Ringue"). Não há nenhum tenant real evidenciado no repositório.
2. **O `academia-sandro` vai migrar pra cá ou os dois convivem?** O `.env` proíbe apontar este sistema para o banco do Sandro, mas não registra se a intenção é migrar depois ou manter os dois separados para sempre.
3. **Qual a relação formal com o produto "Kernel" (`kernel/`) e com `kernel-foodservice`/`kernelmei`?** O nome e os comentários sugerem uma família de verticais whitelabel, mas nenhum documento de `kernel-hq` registra essa família — [[folder-purpose]] não tem entrada para nenhum `kernel-*`.
4. **Modelo comercial:** `kernel-hq-arquitetura/06-precificação-Kernel.md` precifica o KERNEL OS por módulos, mas para o nicho de **barbearia**. Não há nada escrito sobre precificação do vertical academia.

---

## Links relacionados

[[indice-kernel-academia]] — mapa de todos os artefatos do sistema
[[prd-kernel-academia]] — problema, objetivo e escopo
[[system-creation-threshold]] — as 6 perguntas obrigatórias do ecossistema
[[arquitetura-academiasandro]] — sistema de origem do domínio (cliente diferente, não confundir)
