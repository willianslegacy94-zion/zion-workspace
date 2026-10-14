---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-10-14
owner: willians
---

# Índice — Telovis Brainiac

Mapa completo dos artefatos de governança do agente de notificações e relatórios do
**Telovis Barber**. Todos os arquivos vivem em `Telovis-hq/arquitetura-brainiac/` com sufixo
`-brainiac`.

Código-fonte: `telovis-brainiac/` — repositório próprio
`willianslegacy94-zion/telovis-brainiac` (privado, branch `main`, desde 2026-08-10).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-brainiac]] | As 6 perguntas respondidas antes da criação da pasta — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-brainiac]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo, métricas e a divergência entre o nome e o papel real |
| [[requisitos-funcionais-brainiac]] | @pm | RFs em 5 módulos: contexto de cliente, notificação do admin, relatório sob demanda, observabilidade, chat executivo |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-brainiac]] | @architect | Stack (Python + FastAPI + OpenRouter, **sem banco próprio**), camadas, fluxo de dados, Docker, segurança |
| [[modelo-de-dados-brainiac]] | @data-engineer | Ausência de persistência própria: estado volátil em memória e dados de terceiros consumidos por HTTP |
| [[integracoes-brainiac]] | @architect | Contratos de entrada (Kalel, Telovis Barber, Evolution, chat web) e saída (Telovis Barber `/internal/*`, OpenRouter, Evolution, Telegram) |

---

## Governança — Memória viva do agente

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-brainiac]] | @pm / todos | Decisões cronológicas: fork em vez de rename, ausência de SQLite, chaves independentes, autorização fail-closed, supressão de eco, cutover pendente |

---

## Ordem de leitura recomendada

```
system-creation-brainiac
        ↓
   prd-brainiac
        ↓
requisitos-funcionais-brainiac
        ↓
arquitetura-brainiac  ←→  integracoes-brainiac
        ↓
modelo-de-dados-brainiac
        ↓
registro-de-decisoes-brainiac (atualização contínua)
```

---

## Posição no ecossistema

| Componente | Papel | Relação com o Brainiac |
|---|---|---|
| **Brainiac** | Notificações + Raio-X do gestor (Telovis Barber) | — (este documento) |
| Kalel | Atendimento/agendamento conversacional do Telovis Barber | Chama `GET /api/v1/brainiac/atendimento` para contexto do cliente |
| Telovis Barber (backend) | Fonte de toda verdade de dados (Postgres multi-tenant) | Serve `/internal/*`; deve chamar `POST /api/v1/brainiac/notificar-admin` (cutover pendente) |
| Evolution API | Canal WhatsApp | Entrega mensagens do canal admin no webhook e recebe os envios |
| Cortex | Cérebro analítico da Holding de Robôs | **Origem do fork.** Continua em produção servindo thieco + lane — ver [[registro-de-decisoes-brainiac]], RD-001 e RD-010 |

---

## Relação com o Cortex — leia antes de mexer

O Brainiac é um **fork literal do Cortex** feito em 2026-08-05, não um sistema novo do
zero. Ao comparar os dois:

| Capacidade | Cortex | Brainiac |
|---|---|---|
| `POST /processar` — classificação de perfil de cliente via IA | Sim | **Removido** |
| Tabela `matriz_inteligencia` (SQLite) | Sim | **Removido** — sem banco próprio |
| Dicionário fixo de tenants do thieco | Sim | **Removido** — resolve tudo via API do Telovis Barber |
| `notificar-admin` (mensageiro WhatsApp) | Sim | Sim |
| Webhook de relatório sob demanda do admin | Sim | Sim |
| Alerta Telegram em falha de envio | Sim | Sim |
| Telemetria de custo de IA | Sim | Sim (`agente = "brainiac"`) |
| `GET /atendimento` (contexto de cliente para o agente conversacional) | Não documentado em [[indice-cortex]] | Sim |

Consequência prática: **o Brainiac não herdou a parte "cérebro analítico" do Cortex** —
herdou a parte mensageiro. Ver [[prd-brainiac]] seção 9 e
[[registro-de-decisoes-brainiac]] RD-002.

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-brainiac  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-brainiac  ←  regra de negócio alterada
  - arquitetura-brainiac            ←  decisão técnica estrutural
  - modelo-de-dados-brainiac        ←  estado interno ou contrato de dado alterado
  - integracoes-brainiac            ←  contrato de API alterado
```

[[ecosystem-guide]]
