---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# System Creation Threshold — Kernel Foodservice

Resposta às 6 perguntas obrigatórias de [[system-creation-threshold]].

**Status: threshold parcialmente respondido.** Quatro das seis perguntas têm resposta rastreável no código. Duas (**para quem** e **por que agora**) não estão documentadas em lugar nenhum do repositório — precisam de confirmação do Willians antes deste documento sair de `draft`.

Este é um caso raro no kernel-hq: a pasta está sendo criada **depois** de o sistema já estar quase inteiro implementado (162 arquivos em `src/`), não antes. A documentação aqui é reconstruída por leitura do código, não capturada num kickoff.

---

## Respostas ao threshold

| Pergunta | Resposta | Rastreabilidade |
|---|---|---|
| **1. Qual problema esse sistema resolve?** | O sistema de PDV+CMV+Inteligência Financeira da Jocley Grill ([[prd-jocley-lanchonete]], repo `lanchonete-sistema/`) é single-tenant: nome do negócio hardcoded numa constante, um banco por cliente, um deploy por cliente. Vender esse mesmo produto pra um segundo restaurante exigiria copiar o repositório inteiro e manter N forks divergindo. O Kernel Foodservice resolve isso: **um único deployment atende N restaurantes**, com módulos ligados/desligados por cliente. | `src/lib/constants.ts` — comentário explícito: `NOME_PLATAFORMA` "substitui a antiga constante `NOME_LANCHONETE`"; `lanchonete-sistema/src/lib/constants.ts:1` = `NOME_LANCHONETE = "Jocley Grill"`. Migration única `20260809144326_init_multitenant`. |
| **2. Para quem?** | **NÃO DOCUMENTADO NO CÓDIGO — perguntar ao Willians.** O único tenant existente é `slug: "demo"` / "Restaurante Demo", explicitamente marcado no seed como "motor vazio — não é o cardápio real de nenhum cliente". Não há cliente real, contrato, nome de negócio ou pessoa citada em nenhum arquivo. Os papéis de usuário existem (ADMIN, SUPERVISOR, CAIXA, ATENDENTE, COZINHA) e são herdados do Jocley, mas o **operador comercial** do produto (quem faz onboarding pelo painel `/admin`) não está nomeado. | `prisma/seed.ts` — tenant demo + comentário "motor vazio". Nenhum cliente real em `.env`, `deploy/`, ou comentário. |
| **3. Qual é o output esperado?** | Uma plataforma whitelabel de foodservice com: painel super-admin (`/admin`) para cadastrar um restaurante novo em minutos — nome, slug, cor primária, e-mail do admin, senha temporária gerada, módulos contratados marcados por checkbox — e o app de tenant (`(tenant)`) com PDV mesa/balcão, KDS de cozinha, cardápio, CMV por ficha técnica, estoque, despesas, inteligência financeira/DRE, gestão de time e notificações WhatsApp. | `POST /api/admin/tenants` (cria Tenant + admin + `seedTenantBase`, devolve `senhaTemporaria`); `src/components/admin/admin-tenants-panel.tsx` (checkbox por `FEATURES_OPCIONAIS`); 17 páginas em `src/app/(tenant)/`. |
| **4. Quais inputs o sistema precisa para funcionar?** | Por tenant: cardápio cadastrado (**único módulo core** — sem ele não há o que vender), e opcionalmente insumos com custo/rendimento + ficha técnica (pra CMV/estoque), mesas (12 semeadas por padrão), taxas por forma de pagamento (6 defaults já semeadas), telefone de WhatsApp (pra notificações). Globalmente: `DATABASE_URL`, `AUTH_SECRET` e — se WhatsApp estiver ligado — `EVOLUTION_API_URL`/`_KEY`/`_INSTANCE`. | `src/lib/features.ts` (`CORE_FEATURES = { cardapio: true }`); `src/lib/tenant-seed.ts` (12 mesas, 6 taxas, 4 configs de notificação); `.env.example`. |
| **5. Qual é o primeiro artefato concreto?** | Já existe e está implementado: o **painel super-admin de onboarding** — login HMAC próprio, cadastro de tenant com slug validado por regex, seleção de módulos, criação do primeiro ADMIN com senha temporária e semeadura da base mínima, tudo numa transação. É o artefato que diferencia este sistema do Jocley e o que precisa ser validado primeiro. | `src/app/admin/page.tsx`, `src/app/api/admin/tenants/route.ts`, `src/lib/admin-auth.ts`, `src/lib/tenant-seed.ts`. |
| **6. Por que isso é um sistema e não uma pasta de apoio?** | Tem código-fonte próprio (repo `kernel-foodservice/`, git local independente), banco próprio (`kernel_foodservice`, container `kernel-foodservice-db`, porta 5440), imagem Docker própria (porta 3011) e um domínio de decisão que o Jocley não tem: isolamento por tenant, motor de feature flags e onboarding comercial. Não é um branch nem uma configuração do `lanchonete-sistema` — é um segundo produto. | `docker-compose.yml` (serviços/volumes/portas próprios), `.git` local independente, `+2 models` no schema e `+14 arquivos` em `src/` que não existem no `lanchonete-sistema`. |

---

## Linhagem — fork multi-tenant do Jocley Grill, com padrões emprestados do Kernel

Confirmado por leitura comparada dos dois repositórios, não por suposição:

**Origem do código: `lanchonete-sistema/`** (Jocley Grill, documentado em [[indice-jocley-lanchonete]]). `diff` das árvores `src/` mostra que o Kernel Foodservice é o Jocley com:

- as 17 páginas movidas pro route group `(tenant)/`
- `+ src/app/admin/` e `+ src/app/api/admin/*` (6 rotas) — painel super-admin
- `+ src/components/admin/*` (6 componentes)
- `+ src/lib/features.ts`, `feature-guard.ts`, `admin-auth.ts`, `tenant-seed.ts`
- schema: 19 → 21 models (`+ Tenant`, `+ SuperAdmin`) e `tenantId` propagado por todas as tabelas de negócio

**Origem dos padrões de multi-tenancy: o produto Kernel** ([[arquitetura-kernel]], repo `kernel/`). Os comentários do código citam o Kernel nominalmente três vezes, sempre como referência conceitual adaptada — nunca como código reaproveitado (o Kernel é Express + React, este é Next.js + Prisma):

- `src/lib/admin-auth.ts` — "mesmo espírito do token `role: 'super_admin'` do Kernel, adaptado pra cookie em vez de header Authorization"
- `src/lib/feature-guard.ts` — 404 em vez de 403 pra não revelar que o módulo existe, "mesmo espírito do `featureGate` do Kernel"
- `prisma/schema.prisma` — `SuperAdmin` no "mesmo espírito da conta `devmaster` do sistema original"

**Origem da paleta:** `src/app/globals.css` — "inspirada no `vilamill-sistema`".

Nenhuma regra de negócio de foodservice foi criada aqui: comissão, CMV por rendimento, contador diário de comanda, split payment, KDS — tudo herdado do Jocley Grill, que por sua vez herdou de VillaMill e Thieco.

---

## Lacunas que impedem a promoção do status

| Lacuna | Por que bloqueia |
|---|---|
| Pergunta 2 sem resposta | Sem saber quem é o cliente-alvo (ou se é produto de prateleira sem cliente ainda), não dá pra validar escopo nem priorizar backlog |
| Zero commits no git local | `git log` retorna "your current branch 'master' does not have any commits yet" — os 174 arquivos estão todos untracked. Não há histórico, mensagem de commit ou autoria pra rastrear decisão nenhuma |
| Nunca publicado, nunca deployado | Sem remote no git; `deploy/nginx/SEU-DOMINIO.conf.example` ainda com placeholder. Nenhuma evidência de execução real contra banco |
| Sem suíte de testes | Nenhum arquivo de teste, nenhuma dependência de test runner em `package.json` |

---

## Links relacionados

[[indice-kernel-foodservice]] — mapa de todos os artefatos do sistema
[[prd-kernel-foodservice]] — problema, objetivo e escopo
[[system-creation-threshold]] — as 6 perguntas que este documento responde
