---
status: archived
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-08-10
owner: willians
---

# Índice — Agente Órbita Horizon

> **Descontinuado em 2026-08-10.** Nunca teve cliente ativo (ver `04-carteira-de-clientes.md`) e nunca foi deployado em produção — última atividade real em código foi 2026-06-24, mais de 6 semanas parado. Código (`orbita-horizon/`) apagado. Esta documentação fica como registro de arquitetura, não representa mais um sistema em operação.

Mapa completo dos artefatos de governança do agente.
Todos os arquivos vivem em `kernel-hq/arquitetura-horizon/` com sufixo `-horizon`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-horizon]] | As 6 perguntas respondidas antes da criação do agente — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-horizon]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do agente de suporte EAD multi-tenant com validação de aluno |
| [[requisitos-funcionais-horizon]] | @pm | RFs em 4 módulos: tenants, autenticação de aluno, chat receptivo, infraestrutura |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-horizon]] | @architect | Stack (Python + FastAPI + SQLite + OpenRouter/Claude 3 Haiku), camadas, fluxo de dados, autenticação e escala |
| [[modelo-de-dados-horizon]] | @data-engineer | 3 entidades com atributos reais do banco, mapeamento CSV, feature flags e ciclo de vida |
| [[integracoes-horizon]] | @architect | Contrato de integração com OpenRouter, padrão de webhook inbound, stub de CRM para transbordo |

---

## Governança — Memória viva do agente

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-horizon]] | @pm / todos | Decisões cronológicas: criação, escolha do Haiku, gate de autenticação, ausência de camada ativa, teste com CSV real |

---

## Ordem de leitura recomendada

```
system-creation-horizon
        ↓
   prd-horizon
        ↓
requisitos-funcionais-horizon
        ↓
arquitetura-horizon  ←→  integracoes-horizon
        ↓
modelo-de-dados-horizon
        ↓
registro-de-decisoes-horizon (atualização contínua)
```

---

## Diferenças chave vs. Órbita Pulsar

| Dimensão | Horizon | Pulsar |
|---|---|---|
| Caso de uso | Suporte a alunos EAD (plataformas de membros) | Atendimento a leads de PMEs + disparos proativos |
| Modelo IA | Claude 3 Haiku (rápido, barato) | Claude 3.5 Sonnet (raciocínio superior) |
| Temperature | 0.3 | 0.2 |
| Validação de usuário | Por e-mail na `alunos_base` | Sem validação de identidade |
| Camada ativa (disparos) | ❌ Não tem | ✅ `POST /api/v1/disparos/webhook` |
| Qualificação de leads | ❌ Não tem | ✅ `##META##` + `leads_dados` |
| Feature flags | 2 (validar aluno + transbordo) | 3 (enviar docs + qualificar + transbordo) |
| Entidade extra | `alunos_base` | — |
| Import de dados | CSV via pandas | — (tenant de demo hardcoded) |
| Auth API | ❌ v1.0 sem auth (backlog F2) | ✅ Bearer Token em todas as rotas |
| Histórico de contexto | 6 mensagens (3 turnos) | 8 mensagens (4 turnos) |
| Timeout OpenRouter | 12 segundos | 15 segundos |

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-horizon  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-horizon  ←  regra de negócio alterada
  - arquitetura-horizon            ←  decisão técnica estrutural
  - modelo-de-dados-horizon        ←  entidade ou atributo alterado
  - integracoes-horizon            ←  contrato de API ou mapeamento CSV alterado
```

Alterações sem impacto sistêmico (bugs pontuais, ajustes de prompt) não precisam atualizar estes documentos.
