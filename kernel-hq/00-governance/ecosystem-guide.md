---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-06-25
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
| `arquitetura-orbita-whitelabel` | produto SaaS | Orbita Whitelabel — caixa e comissões multi-tenant |
| `arquitetura-horizon` | agente IA | Órbita Horizon — suporte EAD multi-tenant (infoprodutores) |
| `arquitetura-pulsar` | agente IA | Órbita Pulsar — atendimento + disparos proativos para PMEs |
| `arquitetura-quasar` | agente IA | Órbita Quasar — concierge de elite para mentorias de alto ticket |
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

## arquitetura-orbita-whitelabel

**Tipo:** produto SaaS (white label)

**O que é:** Sistema Orbita Whitelabel — produto de prateleira de gestão de caixa e comissões para estabelecimentos de serviços (barbearias, salões, clínicas). Um único código-base serve múltiplos clientes com branding, terminologia e módulos configurados por variáveis de ambiente. Nasce do `sistema-thieco` generalizado.

**Stack:** React 18 + Node.js/Express + PostgreSQL + Docker (multi-tenant via env vars)

**Quando abrir:** quando for onboarding de novo cliente, implementar feature no produto whitelabel ou comparar com o sistema-thieco de origem.

**Ponto de entrada:** [[indice-orbita-whitelabel]]

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
| `arquitetura-orbita-whitelabel` | Orbita Whitelabel — Caixa multi-tenant | React + Node.js + PostgreSQL | Produto SaaS |

### Holding de Robôs — Agentes e Módulos de IA

| Sistema | Tipo | Stack | Status |
|---|---|---|---|
| `arquitetura-horizon` | Órbita Horizon — Suporte EAD | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-24) |
| `arquitetura-pulsar` | Órbita Pulsar — Atendimento + Disparos PME | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-24) |
| `arquitetura-quasar` | Órbita Quasar — Concierge Alto Ticket | Python + FastAPI + SQLite + OpenRouter | Draft (2026-06-25) |
| `arquitetura-cortex` | Órbita Cortex — Cérebro Analítico Central | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |
| `arquitetura-insight` | Órbita Insight — BI Preditivo SaaS | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |
| `arquitetura-prospeccao` | Motor Ativo de Prospecção | Python + FastAPI + SQLite + OpenRouter | Stable (2026-06-25) |

**Ponto de entrada para Claude em cada sistema:**

**ERPs:**
- `arquitetura-thieco/indice-thieco.md`
- `arquitetura-villamill/indice-villamill.md`
- `arquitetura-ivsstore/prd-ivsstore.md` (sem indice — 4 artefatos)
- `arquitetura-orbita-whitelabel/indice-orbita-whitelabel.md`

**Holding de Robôs:**
- `arquitetura-horizon/indice-horizon.md`
- `arquitetura-pulsar/indice-pulsar.md`
- `arquitetura-quasar/prd-quasar.md` (sem indice — 6 artefatos)
- `arquitetura-cortex/indice-cortex.md`
- `arquitetura-insight/indice-insight.md`
- `arquitetura-prospeccao/indice-prospeccao.md`
