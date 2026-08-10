---
status: stable
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Índice — Agente Órbita Pulsar

Mapa completo dos artefatos de governança do agente.
Todos os arquivos vivem em `orbita-pulsar/arquitetura-pulsar/` com sufixo `-pulsar`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-pulsar]] | As 6 perguntas respondidas antes da criação do agente — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-pulsar]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do agente conversacional multi-tenant |
| [[requisitos-funcionais-pulsar]] | @pm | RFs em 4 módulos: tenants, camada passiva (chat IA), camada ativa (disparos), qualificação de leads |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-pulsar]] | @architect | Stack (Python + FastAPI + SQLite + OpenRouter/Claude), camadas, fluxo de dados, segurança e escala |
| [[modelo-de-dados-pulsar]] | @data-engineer | 3 entidades com atributos reais do banco, relacionamentos, feature flags e ciclo de vida |
| [[integracoes-pulsar]] | @architect | Contrato de integração com OpenRouter, padrão de webhook inbound/outbound, tags de automação |

---

## Governança — Memória viva do agente

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-pulsar]] | @pm / todos | Decisões cronológicas: criação, schema, troca de httpx por requests, META_TAG, separação de camadas ativa/passiva |

---

## Ordem de leitura recomendada

```
system-creation-pulsar
        ↓
   prd-pulsar
        ↓
requisitos-funcionais-pulsar
        ↓
arquitetura-pulsar  ←→  integracoes-pulsar
        ↓
modelo-de-dados-pulsar
        ↓
registro-de-decisoes-pulsar (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-pulsar  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-pulsar  ←  regra de negócio alterada
  - arquitetura-pulsar            ←  decisão técnica estrutural
  - modelo-de-dados-pulsar        ←  entidade ou atributo alterado
  - integracoes-pulsar            ←  contrato de API ou tag alterada
```

Alterações sem impacto sistêmico (bugs pontuais, ajustes de prompt) não precisam atualizar estes documentos.
