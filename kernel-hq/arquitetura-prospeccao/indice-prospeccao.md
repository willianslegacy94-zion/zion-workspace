---
status: stable
domain: prospeccao
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Índice — Kernel: Motor Ativo de Prospecção

> **Nível 0, histórico.** O sistema evoluiu para multi-tenant + CRM conversacional em 2026-07-22 — ver [[../arquitetura-black/indice-black|arquitetura-black]]. Este documento descreve o estado do sistema antes da evolução; o código foi migrado, não recriado, e os 1829 leads aqui documentados continuam preservados (agora em `leads_prospeccao_legacy`, fora do fluxo ativo).

Mapa completo dos artefatos de governança do robô de prospecção.
Todos os arquivos vivem em `kernel-hq-prospeccao/arquitetura-prospeccao/` com sufixo `-prospeccao`.

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-prospeccao]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do robô de prospecção ativa |
| [[requisitos-funcionais-prospeccao]] | @pm | RFs por módulo: fila de leads, motor de disparo, classificação por IA, webhook de resposta, transbordo comercial |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-prospeccao]] | @architect | Stack (Python + FastAPI + SQLite + OpenRouter), camadas, fluxo de dados, integrações e estratégia de escala |
| [[modelo-de-dados-prospeccao]] | @data-engineer | Entidade única `leads_prospeccao` com atributos, estados e ciclo de vida dos 1829 leads carregados |

---

## Camada 3 — Como opera (fluxos e execução)

| Documento | Agente | O que cobre |
|---|---|---|
| [[fluxos-prospeccao]] | @architect | Fluxos de disparo em lote, recebimento de resposta via webhook, classificação por IA e transbordo comercial |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-prospeccao]] | @pm / todos | Decisões cronológicas: stack, modelo de IA, estrutura de dados, ganchos de integração |

---

## Ordem de leitura recomendada

```
prd-prospeccao
      ↓
requisitos-funcionais-prospeccao
      ↓
arquitetura-prospeccao  ←→  modelo-de-dados-prospeccao
      ↓
fluxos-prospeccao
      ↓
registro-de-decisoes-prospeccao (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
      ↓
registro-de-decisoes-prospeccao → registrar o que mudou, por quê e o impacto
      ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-prospeccao  ←  regra de negócio alterada
  - arquitetura-prospeccao            ←  decisão técnica estrutural
  - modelo-de-dados-prospeccao        ←  coluna ou estado alterado
  - fluxos-prospeccao                 ←  novo fluxo ou integração
```

Alterações sem impacto sistêmico (ajustes no texto da mensagem, limites de lote) não precisam atualizar estes documentos.
