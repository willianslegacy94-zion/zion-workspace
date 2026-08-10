---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Índice — Kernel Kalel

Mapa completo dos artefatos de governança do agente de atendimento e agendamento conversacional exclusivo do Kernel.
Todos os arquivos vivem em `kernel-hq/arquitetura-kalel/` com sufixo `-kalel`.
Código-fonte: `Kernel Workspace/Kernel-Kalel/` — repositório próprio `github.com/willianslegacy94-zion/kernel-kalel` (privado, branch `main`).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-kalel]] | As 6 perguntas respondidas antes da criação do Kalel — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-kalel]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do agente de atendimento do Kernel |
| [[requisitos-funcionais-kalel]] | @pm | RFs em 5 módulos: canais de entrada, contexto e prompt, geração de resposta, ferramentas, saída no WhatsApp |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-kalel]] | @architect | Stack (Python 3.12 + FastAPI + SQLite + OpenRouter), camadas, fluxo de dados, Docker e segurança |
| [[modelo-de-dados-kalel]] | @data-engineer | Tabela `historico_conversas` em `kalel.db`, chave de sessão e dados que o Kalel NÃO guarda |
| [[integracoes-kalel]] | @architect | Contratos com Kernel (`/internal/*`), Brainiac, Evolution API, OpenRouter e Telegram |

---

## Governança — Memória viva do agente

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-kalel]] | @pm / todos | Decisões cronológicas: fork do Quasar, FAQ dinâmico, nome customizável, anti-no-show, repositório próprio |

---

## Ordem de leitura recomendada

```
system-creation-kalel
        ↓
   prd-kalel
        ↓
requisitos-funcionais-kalel
        ↓
arquitetura-kalel  ←→  integracoes-kalel
        ↓
modelo-de-dados-kalel
        ↓
registro-de-decisoes-kalel (atualização contínua)
```

---

## Posição no ecossistema

| Sistema | Papel | Relação com o Kalel |
|---|---|---|
| **Kalel** | Atendimento conversacional do Kernel | — (este documento) |
| Kernel (backend) | Fonte de verdade de tenant, unidade, preços, agenda | Kalel lê tudo via `/internal/*` — ver [[indice-kernel]] |
| Brainiac | Cérebro/notificador do Kernel (fala com o admin) | Kalel consome `GET /api/v1/brainiac/atendimento` para contexto do cliente |
| Evolution API | Gateway de WhatsApp | Entrada (webhook) e saída (envio) do Kalel |
| Quasar | Agente original da Holding (thieco + lane) | Origem do fork — ver [[prd-quasar]] |
| Cortex | Cérebro analítico da Holding | Origem do fork do Brainiac — ver [[indice-cortex]] |

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-kalel  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-kalel  ←  regra de negócio/conversacional alterada
  - arquitetura-kalel            ←  decisão técnica estrutural
  - modelo-de-dados-kalel        ←  tabela ou campo alterado
  - integracoes-kalel            ←  contrato de API ou ferramenta alterada
```

---

## Pendências conhecidas (não resolver sem confirmar com o Willians)

| Item | Onde está registrado |
|---|---|
| `OPENROUTER_API_KEY` e `EVOLUTION_API_KEY` ainda `TROQUE-AQUI` no `.env` | [[registro-de-decisoes-kalel]], RD-004 |
| `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` vazios — alerta é no-op hoje | [[integracoes-kalel]] |
| `_deve_enviar_imagem` depende de `imagem_url`, que o Kernel não devolve | [[requisitos-funcionais-kalel]], RF-14 |
| Tela de Configurações para editar `nome_assistente`/`tom_voz` não existe | [[registro-de-decisoes-kalel]], RD-003 |
| Precificação: Kalel bundled no Base ou módulo destacável | `kernel/BACKLOG.md` |
| Brainiac ainda não tem pasta `arquitetura-brainiac/` em `kernel-hq` | — |
