---
status: archived
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-08-10
owner: willians
---

# Índice — Órbita Insight

> **Descontinuado em 2026-08-10.** Nunca teve cliente ativo (ver `04-carteira-de-clientes.md`) e nunca foi deployado em produção — última atividade real em código foi 2026-06-25, mais de 6 semanas parado. Código (`orbita-insight/`) apagado. Esta documentação fica como registro de arquitetura, não representa mais um sistema em operação.

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `orbita-insght/arquitetura-insight/` com sufixo `-insight`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-insight]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-insight]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do engine SaaS de BI preditivo |
| [[requisitos-funcionais-insight]] | @pm | 24 RFs em 5 módulos: ingestão de dados, classificação comportamental, geração de insight via IA, persistência e resposta da API |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-insight]] | @architect | Stack (FastAPI + Python + SQLite + OpenRouter), camadas, fluxo de dados, integrações, segurança e estratégia de escala |
| [[modelo-de-dados-insight]] | @data-engineer | Tabela `logs_insights` com 8 atributos, estados de `status_envio`, mapeamento de payload vs. persistência e decisões de modelagem |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-insight]] | @pm / todos | Decisões cronológicas: criação inicial do sistema, remoção do pandas |

---

## Ordem de leitura recomendada

```
system-creation-insight
        ↓
   prd-insight
        ↓
requisitos-funcionais-insight
        ↓
arquitetura-insight  ←→  modelo-de-dados-insight
        ↓
registro-de-decisoes-insight (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-insight  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-insight  ←  regra de negócio alterada
  - arquitetura-insight            ←  decisão técnica estrutural
  - modelo-de-dados-insight        ←  entidade ou atributo alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes pontuais) não precisam atualizar estes documentos.
