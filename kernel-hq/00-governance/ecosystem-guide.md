---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-08-10
owner: willians
---

# Guia do Ecossistema — kernel-hq

Para Willians. Responde: onde estou, o que essa pasta representa dentro do kernel-hq, e quando devo abrir cada uma.

---

## O que é o kernel-hq

`kernel-hq` é o workspace de arquitetura de sistemas do Willians.

Cada sistema que passa pelo threshold de criação (`00-governance-systems`) ganha uma pasta própria com 10 artefatos de arquitetura. Os sistemas documentados aqui são sistemas reais em produção — não experimentos nem provas de conceito.

---

## Visão rápida

| Pasta | Tipo | O que representa |
|---|---|---|
| `00-governance` | lei | Regras dos documentos de projeto |
| `00-governance-systems` | lei | Templates e threshold de criação de sistemas |
| `00-types` | compartilhado | Padrões reutilizáveis entre sistemas |
| `arquitetura-thieco` | sistema — ERP | Sistema de Caixa Barbearia Thieco Leandro |
| `arquitetura-villamill` | sistema — ERP | Sistema VillaMill Tamboré (restaurante/bar) |
| `arquitetura-ivsstore` | sistema — ERP | IVSSTORE — ERP loja de vestuário infantil e perfumaria |
| `arquitetura-kernel` | produto SaaS | Kernel — caixa e comissões multi-tenant |
| `arquitetura-kernelmei` | produto SaaS | KernelMei — whitelabel multi-tenant para confeitarias/doceiras |
| `arquitetura-kernel-foodservice` | produto SaaS | Kernel Foodservice — whitelabel multi-tenant para restaurantes/lanchonetes |
| `arquitetura-kernel-academia` | produto SaaS | Kernel Academia — whitelabel multi-tenant para academias/CTs |
| `arquitetura-horizon` | agente IA | Órbita Horizon — suporte EAD multi-tenant (infoprodutores) |
| `arquitetura-pulsar` | agente IA | Órbita Pulsar — atendimento + disparos proativos para PMEs |
| `arquitetura-quasar` | agente IA | Órbita Quasar — concierge de elite para mentorias de alto ticket |
| `arquitetura-kalel` | agente IA | Kernel Kalel — atendimento e agendamento por WhatsApp, exclusivo do Kernel |
| `arquitetura-brainiac` | agente IA | Kernel Brainiac — notificações e raio-X do gestor, exclusivo do Kernel |
| `arquitetura-cortex` | módulo IA | Órbita Cortex — cérebro analítico central da Holding de Robôs |
| `arquitetura-insight` | módulo IA | Órbita Insight — engine SaaS de BI preditivo |
| `arquitetura-prospeccao` | motor IA | Motor Ativo de Prospecção — fila de leads + disparos em lote |

---

## 00-governance

**Tipo:** lei dos documentos de projeto

**O que é:** define o padrão que todos os arquivos dentro de `kernel-hq` precisam seguir — frontmatter obrigatório, estrutura de pastas, workflow, protocolo com IAs.

**Quando abrir:** antes de criar qualquer arquivo dentro de qualquer sistema aqui. Antes de iniciar qualquer sessão de trabalho com uma IA neste workspace.

**Responde:**
- Quais propriedades de frontmatter são obrigatórias? → [[system-rules]]
- Como organizar as pastas de cada sistema? → [[folder-purpose]]
- Qual é o ciclo de status dos documentos (draft → stable)? → [[status-promotion-rules]]
- Como colaborar com IAs aqui dentro? → [[ai-collaboration-protocol]]
- Como iniciar, pausar e retomar o trabalho? → [[operational-workflow]]

---

## 00-governance-systems

**Tipo:** lei de criação de sistemas

**O que é:** define o que um sistema precisa ter para começar a ser construído. Contém os templates das 8 camadas arquiteturais que todo sistema em kernel-hq precisa preencher.

**Diferença do `00-governance`:** o `00-governance` define como os documentos devem ser estruturados. O `00-governance-systems` define o que um sistema precisa provar antes de virar pasta.

**Quando abrir:** sempre que um novo sistema ou produto estiver sendo cogitado. Se não passa pelo threshold, não vira pasta.

**Responde:**
- Esse sistema está pronto para virar uma pasta? → [[system-creation-threshold]]
- Qual template usar para cada camada? → arquivos numerados dentro da pasta

---

## 00-types

**Tipo:** compartilhado

**O que é:** material que pertence a mais de um sistema e não faz sentido duplicar.

**Quando abrir:** quando um recurso precisa ser consultado por mais de um sistema.

---

## arquitetura-thieco

**Tipo:** sistema em produção

**O que é:** Sistema de Caixa Barbearia Thieco Leandro — sistema financeiro interno com registro de vendas, cálculo automático de comissão e relatórios por unidade e profissional.

**Contexto:** duas unidades (Tambore e Mutinga), dois barbeiros operacionais (Igor Hidalgo e Kauã dos Santos), 8.580 vendas históricas importadas de 2024-2026. Sistema em produção desde 2024, evolução contínua.

**Stack:** Node.js 18 + Express + PostgreSQL 16 + Docker Compose + React 18 + Vite + Nginx

**Quando abrir:** quando for trabalhar no sistema de caixa — desenvolvimento, decisão técnica, sessão com IA.

**Ponto de entrada:** [[indice-thieco]] → leitura recomendada de todos os artefatos

---

## arquitetura-villamill

**Tipo:** sistema em produção

**O que é:** Sistema VillaMill Tamboré — PDV full-stack para restaurante/bar com controle de mesas, estoque de insumos, split payment e relatório financeiro consolidado.

**Stack:** Next.js 15 (Standalone) + PostgreSQL 16 + NextAuth v5 + Docker

**Quando abrir:** quando for trabalhar no sistema VillaMill.

**Ponto de entrada:** [[indice-villamill]]

---

## arquitetura-ivsstore

**Tipo:** sistema em produção (MVP local)

**O que é:** IVSSTORE — ERP para loja de vestuário infantil e perfumaria. Importação automática de NF-e via XML, PDV com suporte a fiado (vencimentos dias 15/30), caderninho de clientes com cobrança via WhatsApp e fluxo de caixa integrado.

**Contexto:** loja de vestuário infantil e perfumaria. MVP v1.1 funcional em produção local. Propriedade 100% Willians.

**Stack:** React 18 + Node.js/Express + PostgreSQL + Docker

**Quando abrir:** quando for trabalhar no IVSSTORE — desenvolvimento, decisão técnica, sessão com IA.

**Ponto de entrada:** [[prd-ivsstore]] → [[arquitetura-ivsstore]] → [[modelo-de-dados-ivsstore]]

---

## arquitetura-kernel

**Tipo:** produto SaaS (white label)

**O que é:** Kernel (nome do repositório: `sistema-orbita-whitelabel`, mantido no remote GitHub por continuidade) — produto de prateleira de gestão de caixa e comissões para estabelecimentos de serviços (barbearias, salões, clínicas). Um único código-base serve múltiplos clientes com branding, terminologia e módulos configurados por variáveis de ambiente. Nasce do `sistema-thieco` generalizado.

**Stack:** React 18 + Node.js/Express + PostgreSQL + Docker (multi-tenant via env vars)

**Quando abrir:** quando for onboarding de novo cliente, implementar feature no produto whitelabel ou comparar com o sistema-thieco de origem.

**Ponto de entrada:** [[indice-kernel]]

---

## arquitetura-kernelmei

**Tipo:** produto SaaS (white label) — **em desenvolvimento, nunca deployado**

**O que é:** KernelMei — whitelabel multi-tenant para confeitarias e doceiras. Pega o domínio de negócio do `lane-confeitaria` (CRM em funil kanban, agenda de produção com limite diário, financeiro com CMV por sabor, metas, ranking por faixa de peso) e o reconstrói para atender várias clientes no mesmo código-base e no mesmo banco, isoladas por `tenantId`, com marca e módulos configuráveis por tenant. Inclui um painel de operação (`/admin`) para provisionar clientes, com sessão de SuperAdmin totalmente separada da sessão de usuária.

**Contexto:** membro da família `kernel*` do workspace (`kernel/`, `kernel-academia/`, `kernel-foodservice/`, `kernelmei/`) — é o vertical de confeitaria. Herda a regra de negócio do `lane-confeitaria` e o padrão de tenant do `kernel-foodservice`, mas com uma diferença arquitetural deliberada: o isolamento é imposto por um Prisma Client Extension que injeta `tenantId` automaticamente, em vez do `requireTenantId()` solto do `kernel-foodservice` — onde uma auditoria encontrou 2 bugs reais de vazamento cross-tenant.

**Stack:** Next.js 16 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16 + NextAuth v5 (tenant) + `jose` (SuperAdmin) + Tailwind v4 + Docker

**Estado real (2026-08-10):** fundação multi-tenant completa e verificada por script de isolamento; camada de serviço quase inteira; **interface parcial** (4 das 7 telas do menu não existem); **git local com zero commits e sem remote** — o código está em cópia única, numa máquina só; sem deploy; sem testes.

**O que "Mei" significa não está documentado no código** — nenhuma ocorrência de "MEI" ou "microempreendedor" em nenhum arquivo. Pendente de confirmação do Willians.

**Quando abrir:** quando for trabalhar no KernelMei — onboarding de tenant, isolamento multi-tenant, feature flags, branding por cliente, ou completar as telas de agenda/financeiro/dashboard/projeção.

**Ponto de entrada:** [[indice-kernelmei]] → [[registro-de-decisoes-kernelmei]] (seção "Pendências que exigem decisão do Willians")

---

## arquitetura-kernel-foodservice

**Tipo:** produto SaaS (white label) — **em desenvolvimento, nunca deployado**

**O que é:** Kernel Foodservice — whitelabel multi-tenant pro domínio de restaurante/lanchonete. Fork do `lanchonete-sistema` (Jocley Grill: PDV mesa+balcão, CMV por ficha técnica, KDS, DRE, gestão de time) generalizado com os mesmos padrões do produto Kernel: isolamento por `tenantId`, feature flags (`Tenant.features`, 1 core + 8 opcionais) e onboarding via painel super-admin (`/admin`) com autenticação HMAC própria, fora do NextAuth.

**Contexto:** membro da família `kernel*` do workspace (`kernel/`, `kernel-academia/`, `kernel-foodservice/`, `kernelmei/`) — é o vertical de foodservice, irmão do KernelMei (confeitaria). O KernelMei herdou o *padrão de tenant* daqui, mas com uma diferença deliberada: o isolamento deste sistema é por `requireTenantId()` chamado manualmente em cada rota (40 de 44), enquanto o KernelMei usa um Prisma Client Extension que injeta `tenantId` automaticamente — **uma auditoria do KernelMei encontrou 2 bugs reais de vazamento cross-tenant nesse padrão manual**, ainda não corrigidos aqui.

**Stack:** Next.js 15 + Prisma 6.4 + PostgreSQL 16 + NextAuth v5 (tenant) + HMAC-SHA256 nativo (super-admin) + Tailwind v4 + Docker

**Estado real (2026-08-10):** implementado (174 arquivos); as 3 camadas de multi-tenancy (isolamento, modulação, onboarding) funcionam e estão documentadas com cobertura verificada; **8 riscos conhecidos não mitigados (R1–R8)** — o mais severo é uma única instância de WhatsApp compartilhada entre todos os tenants (quebra a premissa de whitelabel: cliente A recebe notificação vinda do número do cliente B); **git local com zero commits e sem remote**; nunca deployado; sem testes.

**Quando abrir:** quando for trabalhar no Kernel Foodservice — onboarding de tenant, isolamento multi-tenant, feature flags, ou mitigação dos riscos R1-R8 (ver [[arquitetura-kernel-foodservice]] §7).

**Ponto de entrada:** [[indice-kernel-foodservice]] → [[registro-de-decisoes-kernel-foodservice]] (seção "Pendências que exigem decisão do Willians")

---

## arquitetura-kernel-academia

**Tipo:** produto SaaS (white label) — **em desenvolvimento, nunca deployado**

**O que é:** Kernel Academia — whitelabel multi-tenant pro domínio de academia/centro de treinamento. Fork do `academia-sandro` (gestão de alunos, financeiro com ciclo de 12 parcelas, agenda de aulas por modalidade, pacotes de desconto, portal do aluno) generalizado com o padrão whitelabel emprestado do `kernel-foodservice`: `Tenant`/`SuperAdmin`/`ErrorLog`, login global (não por tenant), painel de onboarding próprio (`/admin-kernel`).

**Contexto:** membro da família `kernel*` do workspace (`kernel/`, `kernel-academia/`, `kernel-foodservice/`, `kernelmei/`) — vertical de academia. **Não confundir com [[indice-academiasandro|academia-sandro]]**: aquele é o sistema de **um** cliente real, em produção (`sandrofreiresf.online`); este é o produto derivado, sem cliente real — só 2 tenants demo no seed ("Academia Vale Fitness", "CT Guerreiros do Ringue").

**Stack:** Next.js + Prisma + PostgreSQL 16 (Docker local, porta 5441, `.env` avisa duas vezes pra nunca apontar pro Supabase do academia-sandro) + Evolution API

**Estado real (2026-08-10):** schema multi-tenant migrado (16 models, `tenantId` em 15), painel de onboarding funcional, build local ok. **Bloqueante crítico, único entre os sistemas da família `kernel*`:** a marca do cliente de origem vazou pro produto — título/descrição da página, texto de consentimento LGPD, 4 mensagens de WhatsApp e o valor default de `EVOLUTION_INSTANCE_NAME` citam "Centro de Treinamento Sandro Freire" diretamente. Um lead de um tenant diferente assinaria consentimento pra academia errada. Mais 7 bloqueantes documentados (instância WhatsApp compartilhada, comprovantes sem controle de acesso, cron sem autenticação, sem RLS, sem git, sem `.env.production`, sem testes). Sem `.git`, nunca deployado.

**Quando abrir:** quando for trabalhar no Kernel Academia — onboarding de tenant, e principalmente a correção do vazamento de marca antes de qualquer tenant real (ver [[arquitetura-kernel-academia]] §9).

**Ponto de entrada:** [[indice-kernel-academia]] → [[registro-de-decisoes-kernel-academia]] (seção "Pendências que exigem decisão do Willians")

---

## arquitetura-horizon

**Tipo:** agente de IA (Holding de Robôs)

**O que é:** Agente Órbita Horizon — suporte EAD multi-tenant com validação de aluno por e-mail. Atende receptivamente alunos de plataformas de membros 24/7, com transbordo para CRM humano. Primeiro nível da Holding de Robôs.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3 Haiku, temperatura 0.3)

**Quando abrir:** quando for desenvolver ou configurar o agente de suporte EAD — seja para novo tenant de infoprodutor ou para ajuste de comportamento do bot.

**Ponto de entrada:** [[indice-horizon]]

---

## arquitetura-pulsar

**Tipo:** agente de IA (Holding de Robôs)

**O que é:** Agente Órbita Pulsar — atendimento conversacional multi-tenant para PMEs com duas camadas: passiva (qualificação de leads via chat) e ativa (disparos sistêmicos automáticos — alertas, cobranças, recuperação de mensalidades baseados em eventos de ERP).

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet, temperatura 0.2)

**Quando abrir:** quando for trabalhar no agente Pulsar — fluxo de qualificação, webhook de disparos ou integração com ERP externo.

**Ponto de entrada:** [[indice-pulsar]]

---

## arquitetura-quasar

**Tipo:** agente de IA (Holding de Robôs)

**O que é:** Órbita Quasar — engine de atendimento AI para mentorias e serviços de alto ticket. Concierge de elite que reconhece o cliente por nome e e-mail, responde com a persona do tenant e executa agendamentos autônomos via Function Calling.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet)

**Quando abrir:** quando for trabalhar no agente Quasar — feature de agendamento, fechamento comercial ou configuração de novo tenant de mentoria.

**Ponto de entrada:** [[prd-quasar]] → [[arquitetura-tecnica-quasar]] → [[comportamento-quasar]]

---

## arquitetura-kalel

**Tipo:** agente de IA (exclusivo do Kernel)

**O que é:** Kernel Kalel — atendimento e agendamento conversacional por WhatsApp para os clientes finais dos tenants do Kernel. Fork do Quasar (2026-08-05) sem nenhuma lógica de thieco/lane: persona, horário, endereço, equipe, preços, regras e mensagem de transbordo vêm em tempo real do backend do Kernel, então um tenant novo não exige mudança de código. Confirma e cancela agendamentos existentes pela própria conversa (Lógica Anti-No-Show) e faz transbordo para humano. O nome do assistente é customizável por tenant — "Kalel" é só o padrão.

**Stack:** Python 3.12 + FastAPI + SQLite (só histórico de conversa) + OpenRouter + Evolution API

**Quando abrir:** quando for trabalhar no atendimento por WhatsApp do Kernel — FAQ dinâmico, ferramentas de agendamento, transbordo, visão (foto de referência) ou telemetria de custo de IA.

**Ponto de entrada:** [[indice-kalel]]

---

## arquitetura-brainiac

**Tipo:** agente de IA (exclusivo do Kernel)

**O que é:** Kernel Brainiac — o canal do **gestor** nos tenants do Kernel, par do Kalel (que cuida do cliente final). Fork do Cortex (2026-08-05) com o núcleo analítico deliberadamente removido: sem `POST /processar`, sem `matriz_inteligencia`, sem banco. Faz três coisas — entrega no WhatsApp do admin as notificações que o backend gerou, responde pergunta livre do gestor sobre faturamento / produtos mais vendidos / serviços mais realizados / estoque parado, e serve ao Kalel o contexto real do cliente. Resolve o tenant pelo nome da instância (`${slug}-admin`), então tenant novo não exige mudança de código.

**Stack:** Python 3.12 + FastAPI + OpenRouter + Evolution API — **sem banco próprio**, todo dado vem do backend do Kernel via `/internal/*`

**Achado a considerar antes de mexer:** apesar do nome (e do rótulo "cérebro" no `kernel/BACKLOG.md`), o Brainiac **não é** o equivalente analítico do [[indice-cortex|Cortex]] — o único uso de IA é classificar qual relatório o gestor pediu. O título declarado no próprio código é o mais preciso: *"Notificações & Raio-X do Gestor"*. Cortex e Brainiac não são redundantes: o Brainiac é o subconjunto mensageiro do Cortex, isolado para o Kernel.

**Quando abrir:** quando for trabalhar no canal do gestor do Kernel — relatório sob demanda por WhatsApp, notificação de admin, alerta Telegram de falha de envio ou o cutover `CORTEX_URL` → `BRAINIAC_URL`.

**Ponto de entrada:** [[indice-brainiac]]

---

## arquitetura-cortex

**Tipo:** módulo de IA (Holding de Robôs)

**O que é:** Órbita Cortex — cérebro analítico central da Holding de Robôs. Ingere dados das plataformas, classifica comportamento dos leads/alunos via IA e sincroniza flags operacionais (`status_churn_risk`, `recomendacao_upsell`) para os agentes Horizon, Pulsar e Quasar tomarem decisões personalizadas.

**Stack:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet)

**Quando abrir:** quando for trabalhar no motor de inteligência analítica — entidade `matriz_inteligencia`, flags de classificação ou contratos de integração com os agentes.

**Ponto de entrada:** [[indice-cortex]]

---

## arquitetura-insight

**Tipo:** módulo de IA / SaaS

**O que é:** Órbita Insight — engine SaaS de BI preditivo. Ingere dados de infoprodutores, classifica comportamento de alunos/leads via IA (24 RFs em 5 módulos) e entrega insights acionáveis via API. Complementa o Cortex no nível de análise preditiva.

**Stack:** Python + FastAPI + SQLite + OpenRouter

**Quando abrir:** quando for trabalhar no motor de insights — tabela `logs_insights`, classificação comportamental ou endpoint de resposta da API.

**Ponto de entrada:** [[indice-insight]]

---

## arquitetura-prospeccao

**Tipo:** motor de IA (Holding de Robôs)

**O que é:** Motor Ativo de Prospecção — gerencia fila de 1829 leads, dispara mensagens em lote via Evolution API/WhatsApp, classifica respostas via IA e faz transbordo comercial automático para atendente humano quando há interesse detectado.

**Stack:** Python + FastAPI + SQLite + OpenRouter

**Quando abrir:** quando for trabalhar no motor de prospecção — fila de leads, disparos em lote, classificação de resposta ou webhook de transbordo.

**Ponto de entrada:** [[indice-prospeccao]]

---

## Fluxo de criação de um novo sistema

```
Novo sistema cogitado
        ↓
00-governance-systems/system-creation-threshold.md
  → responder as 6 perguntas
  → threshold aprovado ou rejeitado
        ↓ (aprovado)
Criar pasta: arquitetura-{nome}/
  → system-creation-{nome}.md   (respostas ao threshold)
  → indice-{nome}.md
  → prd-{nome}.md
  → requisitos-funcionais-{nome}.md
  → arquitetura-{nome}.md
  → modelo-de-dados-{nome}.md
  → design-system-{nome}.md
  → ui-kit-{nome}.md
  → ux-flows-{nome}.md
  → registro-de-decisoes-{nome}.md
        ↓
Registrar nova pasta em 00-governance/folder-purpose.md
```

---

## Fluxo de trabalho em sistema existente

```
Antes de cada sessão:
  1. Ler ai-collaboration-protocol.md
  2. Ler indice-{sistema}.md  →  orientação geral
  3. Ler registro-de-decisoes-{sistema}.md  →  última entrada

Durante a sessão:
  4. Trabalhar nos artefatos do sistema
  5. Registrar decisões com impacto sistêmico

Ao encerrar:
  6. Atualizar artefatos impactados (campo updated no frontmatter)
  7. Adicionar entrada em registro-de-decisoes-{sistema}.md se houve decisão
```

---

## Projetos de Software — Implementações dos Sistemas

Os sistemas documentados em `kernel-hq` correspondem a implementações de software reais no workspace.

### ERPs e Produtos de Gestão

| Sistema | Tipo | Stack | Status |
|---|---|---|---|
| `arquitetura-thieco` | Barbearia Thieco Leandro — Sistema de Caixa | Node.js + Express + PostgreSQL + React | Em produção (2024) |
| `arquitetura-villamill` | Villa Mill Tamboré — PDV Restaurante | Next.js 15 + PostgreSQL + NextAuth v5 | Em produção (2026-04) |
| `arquitetura-ivsstore` | IVSSTORE — ERP Vestuário e Perfumaria | React + Node.js + PostgreSQL | MVP local (2026-06) |
| `arquitetura-kernel` | Kernel — Caixa multi-tenant | React + Node.js + PostgreSQL | Produto SaaS |
| `arquitetura-lane-confeitaria` | Lane Confeitaria — CRM + Agenda + Financeiro | Next.js 16 + Prisma 7 + PostgreSQL + NextAuth v5 | Em produção (2026-08) |
| `arquitetura-academiasandro` | Centro de Treinamento Sandro Freire | Next.js 16 + Prisma 7 + PostgreSQL (Supabase) | Em produção (2026-08-03) |
| `arquitetura-kernelmei` | KernelMei — Whitelabel Confeitaria multi-tenant | Next.js 16 + Prisma 7 + PostgreSQL + NextAuth v5 + jose | Draft (2026-08-10) — sem deploy, sem commits |
| `arquitetura-kernel-foodservice` | Kernel Foodservice — Whitelabel Restaurante multi-tenant | Next.js 15 + Prisma 6.4 + PostgreSQL + NextAuth v5 | Draft (2026-08-10) — sem deploy, sem commits |
| `arquitetura-kernel-academia` | Kernel Academia — Whitelabel Academia/CT multi-tenant | Next.js + Prisma + PostgreSQL | Draft (2026-08-10) — bloqueante crítico (marca do cliente de origem vazada), sem deploy, sem git |

### Holding de Robôs — Agentes e Módulos de IA

| Sistema | Tipo | Stack | Status |
|---|---|---|---|
| `arquitetura-horizon` | Órbita Horizon — Suporte EAD | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-24) |
| `arquitetura-pulsar` | Órbita Pulsar — Atendimento + Disparos PME | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-24) |
| `arquitetura-quasar` | Órbita Quasar — Concierge Alto Ticket | Python + FastAPI + SQLite + OpenRouter | Draft (2026-06-25) |
| `arquitetura-kalel` | Kernel Kalel — Atendimento/Agendamento do Kernel | Python 3.12 + FastAPI + SQLite + OpenRouter + Evolution API | Experimental (2026-08-10) |
| `arquitetura-brainiac` | Kernel Brainiac — Notificações e Raio-X do Gestor | Python 3.12 + FastAPI + OpenRouter + Evolution API (sem banco) | Experimental (2026-08-10) |
| `arquitetura-cortex` | Órbita Cortex — Cérebro Analítico Central | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |
| `arquitetura-insight` | Órbita Insight — BI Preditivo SaaS | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |
| `arquitetura-prospeccao` | Motor Ativo de Prospecção | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |

**Ponto de entrada para Claude em cada sistema:**

**ERPs:**
- `arquitetura-thieco/indice-thieco.md`
- `arquitetura-villamill/indice-villamill.md`
- `arquitetura-ivsstore/prd-ivsstore.md` (sem indice — 4 artefatos)
- `arquitetura-kernel/indice-kernel.md`
- `arquitetura-lane-confeitaria/indice-lane-confeitaria.md`
- `arquitetura-academiasandro/indice-academiasandro.md`
- `arquitetura-kernelmei/indice-kernelmei.md`
- `arquitetura-kernel-foodservice/indice-kernel-foodservice.md`
- `arquitetura-kernel-academia/indice-kernel-academia.md`

**Holding de Robôs:**
- `arquitetura-horizon/indice-horizon.md`
- `arquitetura-pulsar/indice-pulsar.md`
- `arquitetura-quasar/prd-quasar.md` (sem indice — 6 artefatos)
- `arquitetura-kalel/indice-kalel.md` (código em `Kernel-Kalel/`, repo próprio `kernel-kalel`)
- `arquitetura-brainiac/indice-brainiac.md` (código em `Kernel-brainiac/`, repo próprio `kernel-brainiac`)
- `arquitetura-cortex/indice-cortex.md`
- `arquitetura-insight/indice-insight.md`
- `arquitetura-prospeccao/indice-prospeccao.md`
