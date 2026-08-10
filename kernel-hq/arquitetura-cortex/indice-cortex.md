---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Índice — Órbita Cortex

Mapa completo dos artefatos de governança do cérebro analítico central da Holding de Robôs.
Todos os arquivos vivem em `orbita-cortex/arquitetura-cortex/` com sufixo `-cortex`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-cortex]] | As 6 perguntas respondidas antes da criação do Cortex — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-cortex]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do cérebro analítico central |
| [[requisitos-funcionais-cortex]] | @pm | RFs em 3 módulos: ingestão de dados, classificação via IA, sincronização de flags |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-cortex]] | @architect | Stack (Python + FastAPI + SQLite + OpenRouter/Claude 3.5 Sonnet), camadas, fluxo de dados e escala |
| [[modelo-de-dados-cortex]] | @data-engineer | Entidade `matriz_inteligencia` com atributos reais, flags operacionais e ciclo de vida |
| [[integracoes-cortex]] | @architect | Contratos de entrada (plataformas) e saída (Horizon, Pulsar, Quasar), padrão de webhook |

---

## Governança — Memória viva do agente

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-cortex]] | @pm / todos | Decisões cronológicas: criação, escolha do Sonnet, SQLite compartilhado, remoção do pandas |

---

## Ordem de leitura recomendada

```
system-creation-cortex
        ↓
   prd-cortex
        ↓
requisitos-funcionais-cortex
        ↓
arquitetura-cortex  ←→  integracoes-cortex
        ↓
modelo-de-dados-cortex
        ↓
registro-de-decisoes-cortex (atualização contínua)
```

---

## Posição na Holding de Robôs

| Agente | Papel | Relação com o Cortex |
|---|---|---|
| **Cortex** | Cérebro analítico | — (este documento) |
| Horizon | Suporte EAD | Lê `status_churn_risk` para acolher alunos em risco |
| Pulsar | Atendimento PME + disparos | Lê `recomendacao_upsell` para ofertas de Mentoria VIP |
| Quasar | Atendimento / suporte geral | Lê `recomendacao_upsell` para ofertas de Suporte Acelerado |

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-cortex  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-cortex  ←  regra de negócio alterada
  - arquitetura-cortex            ←  decisão técnica estrutural
  - modelo-de-dados-cortex        ←  entidade ou atributo alterado
  - integracoes-cortex            ←  contrato de API ou flag alterado
```
