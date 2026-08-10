---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Índice — Kernel Foodservice

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-kernel-foodservice/` com sufixo `-kernel-foodservice`.
Código-fonte real em `kernel-foodservice/` (fora do Obsidian) — **sem `.git` com commits, sem remote, nunca deployado**.

> Documentação **reconstruída a partir do código** em 2026-08-10, não capturada num kickoff. O sistema já estava implementado (174 arquivos) quando esta pasta foi criada. Ver [[system-creation-kernel-foodservice]] para as lacunas que impedem promover o status de `draft`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-kernel-foodservice]] | As 6 perguntas do threshold, 4 respondidas por leitura do código e 2 sem resposta documentada (público-alvo, por que agora) |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | O que cobre |
|---|---|
| [[prd-kernel-foodservice]] | Contexto (fork multi-tenant do Jocley Grill, padrões emprestados do Kernel), problema, objetivo, dois públicos (super-admin + equipe do tenant), hipótese, escopo dentro/fora, métricas propostas (não confirmadas) |
| [[requisitos-funcionais-kernel-foodservice]] | 19 RFs em 4 módulos novos (auth+isolamento, modulação, onboarding, notificações multi-tenant) — domínio de foodservice em si herdado sem RF duplicado |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | O que cobre |
|---|---|
| [[arquitetura-kernel-foodservice]] | Stack (Next.js 15 + Prisma 6.4 + PostgreSQL, fork do Jocley), as 3 camadas novas (isolamento/modulação/onboarding) com fluxo e cobertura verificada, fronteiras de segurança, deploy (nunca feito), **8 riscos conhecidos não mitigados (R1–R8)**, o que exigiria reescrita |
| [[modelo-de-dados-kernel-foodservice]] | 21 models / 13 enums — `Tenant` e `SuperAdmin` (novos) + 17 entidades herdadas do Jocley com `tenantId` propagado; `OrderItem` como única exceção sem tenant; regra de custo efetivo e dedução de estoque |

---

## Lacunas de artefato (sem Camada 3/4 ainda)

`design-system-`, `ui-kit-`, `ux-flows-kernel-foodservice` **não foram criados** — o sistema herda a UI do Jocley Grill sem mudança visual documentada além da cor primária por tenant (`branding.corPrimaria`, injetada como CSS custom property). Criar se/quando a modulação de UI (esconder módulo desligado) precisar de decisão de design própria, não só técnica.

---

## Governança — Memória viva do sistema

| Documento | O que cobre |
|---|---|
| [[registro-de-decisoes-kernel-foodservice]] | Registro único de criação desta documentação — sistema não tem histórico de commits pra reconstruir decisões cronológicas reais |

---

## Ordem de leitura recomendada

```
system-creation-kernel-foodservice
        ↓
   prd-kernel-foodservice
        ↓
requisitos-funcionais-kernel-foodservice
        ↓
arquitetura-kernel-foodservice
        ↓
modelo-de-dados-kernel-foodservice
        ↓
registro-de-decisoes-kernel-foodservice (atualização contínua)
```

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| Resposta às perguntas 2 e 6 do threshold | Assim que o Willians confirmar público-alvo e prioridade — pré-requisito pra `status: draft` virar `experimental` |
| Primeiro commit no git local | Repositório com 174 arquivos untracked, zero histórico — bloqueia qualquer rastreabilidade de decisão futura |
| Mitigação do risco R1 (instância WhatsApp compartilhada) | Antes do primeiro cliente real — quebra a premissa de whitelabel se não resolvido |
| Rotação das credenciais de seed (R6) | Antes de qualquer deploy real |
| `design-system-`, `ui-kit-`, `ux-flows-kernel-foodservice` | Se/quando a modulação por tenant exigir decisão visual própria além da cor primária |

---

## Links relacionados

[[arquitetura-jocley-lanchonete]] — sistema de origem, mesmo domínio de foodservice
[[arquitetura-kernel]] — produto Kernel, origem dos padrões de multi-tenancy
[[arquitetura-kernelmei]] — outro vertical da família `kernel*`, mesmo movimento aplicado à confeitaria
