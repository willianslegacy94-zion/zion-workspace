---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# System Creation Threshold — Órbita Cortex

As 6 perguntas que devem ser respondidas antes de criar um novo agente ou sistema.
Threshold aprovado quando todas as respostas são claras e justificáveis.

---

## 1. Qual problema específico este sistema resolve?

Os agentes da Holding (Horizon, Pulsar, Quasar) operam de forma isolada, sem inteligência compartilhada sobre o cliente. Um mesmo lead pode ser tratado como churn pelo Horizon enquanto o Pulsar tenta um upsell agressivo — comportamentos contraditórios por falta de uma visão centralizada.

O Cortex resolve: uma camada analítica única que classifica cada cliente com IA e distribui flags de comportamento que todos os agentes consultam antes de agir.

---

## 2. Quem é o usuário e qual é o caso de uso principal?

**Usuário direto:** Sistemas externos (plataformas de cursos, e-commerce, ERPs) que enviam eventos de cliente via `POST /api/v1/cortex/processar`.

**Usuário indireto:** Horizon, Pulsar e Quasar — que lêem os flags do SQLite para adaptar seu comportamento.

**Caso de uso principal:** Uma plataforma EAD envia dados de um aluno (dias ativos, progresso, valor gasto). O Cortex classifica com IA, grava `churn_risk` e `upsell_product` no banco, e os agentes passam a agir de forma coordenada sobre esse aluno.

---

## 3. Por que este sistema precisa existir — e não pode ser resolvido por um dos agentes já existentes?

Horizon, Pulsar e Quasar são agentes conversacionais reativos. Nenhum deles tem autoridade para classificar o estado global do cliente — isso criaria acoplamento e conflito de responsabilidades.

O Cortex é a única entidade com autoridade analítica: recebe dados brutos, chama a IA com temperatura 0.0 (determinístico), e grava a verdade única que os demais consomem.

---

## 4. Qual é a fronteira clara deste sistema — o que está dentro e o que está fora?

**Dentro:**
- Receber payloads de plataformas externas
- Classificar churn risk e recomendação de upsell via Claude 3.5 Sonnet
- Gravar e atualizar flags no SQLite central (`orbita_cortex.db`)
- Expor API REST para receber dados

**Fora:**
- Enviar mensagens para clientes (responsabilidade dos agentes)
- Gerir conversas ou histórico de chat
- Tomar decisões de negócio além dos dois flags definidos
- Interface visual de administração

---

## 5. Como este sistema se integra com o ecossistema existente sem criar dependência circular?

O Cortex é **write-only** em relação aos outros agentes: ele escreve no banco, os agentes leem. Não há chamada do Cortex para Horizon, Pulsar ou Quasar — a dependência é unidirecional.

```
Plataformas → Cortex → orbita_cortex.db ← Horizon / Pulsar / Quasar
```

Sem dependência circular por design.

---

## 6. Qual é a métrica que define se este sistema foi bem-sucedido?

| Métrica | Meta |
|---|---|
| Flags atualizados após cada evento de plataforma | 100% |
| Tempo de resposta do endpoint `/processar` | < 15 segundos (inclui chamada IA) |
| Consistência entre flag gravado e comportamento do agente | 100% — agentes leem o mesmo banco |
| Classificações contraditórias entre agentes | 0% — única fonte de verdade |

---

**Threshold:** APROVADO — sistema criado em 2026-06-25.
