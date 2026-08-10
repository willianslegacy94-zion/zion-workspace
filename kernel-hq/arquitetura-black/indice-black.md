---
status: stable
domain: black
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Índice — Kernel v2: CRM Conversacional Multi-Tenant

Mapa completo dos artefatos de governança do sistema evoluído. Sucede [[../arquitetura-prospeccao/indice-prospeccao|arquitetura-prospeccao]]
(Nível 0 — motor de disparo e classificação, agora "congelado" como histórico; o código foi migrado, não descartado).
Todos os arquivos vivem em `kernel-hq/arquitetura-black/` com sufixo `-black`.

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-black]] | @pm | Contexto da evolução, problema, objetivo, usuário, hipótese, escopo e métricas do CRM conversacional |
| [[requisitos-funcionais-black]] | @pm | RFs por módulo: migração multi-tenant, agente de IA com tools, CRM (leads/interactions/meetings), painel visual, endpoints legados |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-black]] | @architect | Stack, camadas, fluxo de dados, distinção erro de rede vs erro de API, estratégia de escala |
| [[modelo-de-dados-black]] | @data-engineer | 4 tabelas ativas (`tenants_config`, `leads`, `interactions`, `meetings`) + `leads_prospeccao_legacy` como trilha de auditoria |

---

## Camada 3 — Como opera (fluxos e execução)

| Documento | Agente | O que cobre |
|---|---|---|
| [[fluxos-black]] | @architect | Migração do banco, loop de tool-calling, disparo em lote, webhook de resposta, chat de teste, webhook WhatsApp |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-black]] | @pm / todos | Decisões cronológicas: por que evoluir em vez de recriar, padrão de multi-tenant escolhido, destino do protótipo Node, gap de produto descoberto (Horizon/Insight/Cortex não cobrem o que seria vendido) |

---

## Ordem de leitura recomendada

```
prd-black
      ↓
requisitos-funcionais-black
      ↓
arquitetura-black  ←→  modelo-de-dados-black
      ↓
fluxos-black
      ↓
registro-de-decisoes-black (atualização contínua)
```

---

## Relação com os demais sistemas do ecossistema

| Sistema | Relação com o Black |
|---|---|
| [[../arquitetura-prospeccao/indice-prospeccao\|arquitetura-prospeccao]] | Nível 0 original — código migrado (não recriado), dados preservados em `leads_prospeccao_legacy` |
| [[../arquitetura-pulsar/indice-pulsar\|arquitetura-pulsar]] (se existir) | Padrão de multi-tenant (`tenant_id` + `tenants_config`) replicado aqui por consistência |
| [[../arquitetura-quasar/indice-quasar\|arquitetura-quasar]] (se existir) | Padrão de tool-calling real (não parsing de tag em texto) replicado e levado adiante — Quasar usa mock em memória para agendamento, Black usa persistência real |
| [[../arquitetura-horizon/indice-horizon\|arquitetura-horizon]] (se existir) | Reutilizável como base para o "Produto A" (atendimento a alunos) que o Black venderia — hoje só tem FAQ institucional estático, sem conteúdo de curso |

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
      ↓
registro-de-decisoes-black → registrar o que mudou, por quê e o impacto
      ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-black  ←  regra de negócio alterada
  - arquitetura-black            ←  decisão técnica estrutural
  - modelo-de-dados-black        ←  coluna ou estado alterado
  - fluxos-black                 ←  novo fluxo ou integração
```

Alterações sem impacto sistêmico (ajuste de texto do system prompt, limites de lote) não precisam atualizar estes documentos.
