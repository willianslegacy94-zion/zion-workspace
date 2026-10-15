---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# Índice — TeloVis Space

Mapa dos artefatos de governança do TeloVis Space, o escritório virtual 2D em pixel art com
áudio/vídeo por proximidade.
Todos os arquivos vivem em `Telovis-hq/arquitetura-telovis-space/` com sufixo `-telovis-space`.
Código-fonte em `Ops/telovis-space/` (monorepo `zion-workspace`, branch `feat/telovis-space`,
PR #2 aberto para a `main`). O `README.md` do repositório é a referência técnica detalhada;
estes documentos registram o porquê e o estado.

---

## Onde paramos (2026-10-14)

- **Implementado e testado localmente:** login/conta, acesso por membro, dashboard, mapa com
  áreas e salas privadas, proximidade de áudio/vídeo e chat, customizer de avatar, mesas
  pessoais, kart/patinete, sentar e status de ausência, convites por e-mail, métricas de uso,
  LiveKit local no `docker-compose`.
- **Git:** 8 commits do Space na branch `feat/telovis-space`; PR #2
  (https://github.com/willianslegacy94-zion/zion-workspace/pull/2). O PR também carrega 2
  commits do vesale e 1 doc do gw-coreai que não estão na `main` — decidir antes do merge.
- **Parado em:** deploy (passo 3). Decidido: **LiveKit Cloud** para mídia, **convites por e-mail
  depois** (sem Resend no início: o dashboard mostra o link para copiar). **Pendente do
  Willians:** escolher o domínio (não será subdomínio de kernellwc.online), apontar o registro A
  para a VPS (2.24.117.12) e criar o projeto no cloud.livekit.io.
- **Próximo passo técnico:** `docker-compose` de produção (Postgres + web + realtime em
  127.0.0.1), Dockerfiles, Nginx do host com certbot (app e `/socket.io` no mesmo domínio) e
  `playbook-devops-telovis-space.md`, no padrão do Telovis Barber.

Detalhe em [[registro-de-decisoes-telovis-space]].

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-telovis-space]] | As 6 perguntas do threshold — produto próprio da Telovis, não sistema sob encomenda de cliente |

## Camada 1 — O quê

| Documento | O que cobre |
|---|---|
| [[prd-telovis-space]] | Problema (time remoto sem "corredor"), hipótese do escritório espacial, escopo dentro/fora, métricas |
| [[requisitos-funcionais-telovis-space]] | RFs por módulo: conta, spaces e membros, mapa e movimento, proximidade e mídia, chat, avatar, mesas, veículos, presença, convites, métricas |

## Camada 2 — Como sustenta

| Documento | O que cobre |
|---|---|
| [[arquitetura-telovis-space]] | Monorepo (web Next.js 16 + realtime Socket.io + protocol), ponte por ticket JWT, LiveKit SFU, eventos internos, deploy pretendido |
| [[modelo-de-dados-telovis-space]] | 7 entidades Prisma: User, Session, Space, SpaceMember, Desk, Invite, Visit; estado volátil que fica só no realtime |

## Camada 3 — Como aparece

| Documento | O que cobre |
|---|---|
| [[design-system-telovis-space]] | Pixel art gerado em runtime, HUD escura sobre o mapa, verde-esmeralda como cor de "ativo" |
| [[ui-kit-telovis-space]] | Telas e componentes da HUD existentes |

## Camada 4 — Funciona?

| Documento | O que cobre |
|---|---|
| [[ux-flows-telovis-space]] | Jornadas: entrar no escritório, conversar por proximidade, convidar alguém, pegar mesa — não validado com uso real |

## Governança

| Documento | O que cobre |
|---|---|
| [[registro-de-decisoes-telovis-space]] | Decisões por data e pendências abertas |

---

## Ordem de leitura recomendada

```
system-creation-telovis-space
        ↓
   prd-telovis-space
        ↓
requisitos-funcionais-telovis-space
        ↓
arquitetura-telovis-space  ←→  design-system-telovis-space
        ↓                               ↓
modelo-de-dados-telovis-space      ui-kit-telovis-space
        ↓                               ↓
        └──────── ux-flows-telovis-space ┘
                        ↓
     registro-de-decisoes-telovis-space (atualização contínua)
```

## Próximos artefatos/passos

| Item | Quando fazer |
|---|---|
| `playbook-devops-telovis-space.md` + arquivos de deploy | assim que o domínio e o LiveKit Cloud estiverem definidos |
| Recuperação de senha e rate limit no login | antes de abrir para usuários reais |
| Resend (convites por e-mail) | depois do primeiro deploy |
| Primeira rodada real de [[ux-flows-telovis-space]] | após o primeiro time usar o escritório |
