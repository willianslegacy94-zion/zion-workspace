---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# Arquitetura Técnica — TeloVis Space

> Referência: [[requisitos-funcionais-telovis-space]] | [[modelo-de-dados-telovis-space]]
> Detalhe técnico completo: `Ops/telovis-space/README.md`

## Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 16 (App Router, Server Actions), React 19, Tailwind v4 |
| Jogo | Phaser 3 (cena `OfficeScene`), mapa do Tiled, sprites desenhados em canvas em runtime |
| Tempo real | Node + Socket.io (`apps/realtime`), estado das salas em memória |
| Mídia | LiveKit (SFU) — `livekit-client` no navegador, token emitido pelo realtime |
| Banco | PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`) |
| E-mail | API do Resend (opcional) |
| Protocolo | `packages/protocol`: tipos dos eventos e regras compartilhadas (`canHear`, paletas) |

## Estrutura

```
telovis-space/
├── packages/protocol   tipos e regras usados por web e realtime
├── apps/realtime       Socket.io :4000 — posições, chat, status, token LiveKit, métricas
└── apps/web            Next.js :3000 — páginas, auth, dashboard, Phaser
```

## Fronteiras e confiança

- **Next ↔ realtime:** a cada conexão o navegador pede `GET /api/realtime-ticket?space=<slug>`.
  O Next confere sessão + vínculo e devolve um JWT HS256 de 60s (`sub`, `name`, `space`, `role`,
  avatar). O realtime valida no `io.use()` com o segredo `REALTIME_TICKET_SECRET`, **sem acessar
  o banco**. Nome e avatar vêm do ticket, não do cliente.
- **Next → realtime (mudanças ao vivo):** `POST /internal/events` com JWT de audiência
  `telovis-realtime-internal` — remoção de membro, troca de papel, avatar, mesa. Melhor esforço.
- **Realtime → Next (métricas):** `POST /api/internal/visits` com JWT de audiência
  `telovis-web-usage`, em lotes a cada 15s; fila se o Next estiver fora.
- **Mídia:** o token LiveKit usa `identity = socket.id`, definido pelo servidor. A proximidade é
  calculada no cliente a cada 200ms e aplicada assinando/cancelando faixas (autoSubscribe
  desligado). O chat aplica `canHear` **no servidor**.
- **Quem está falando:** vem do evento `ActiveSpeakersChanged` do LiveKit (detecção no SFU). O SFU
  avisa a sala inteira; o filtro "só quem você ouve" é aplicado no cliente, na cena, junto com a
  decisão de proximidade.

## Desenvolvimento local

`docker compose up -d` sobe Postgres (:5450) e LiveKit de desenvolvimento (:7880, chave
`devkey`). `npm run dev` sobe web e realtime. O LiveKit local anuncia a mídia em 127.0.0.1 — só
vale para navegadores da própria máquina.

## Deploy (decidido, ainda não feito — 2026-10-14)

- VPS Hostinger (2.24.117.12), mesmo padrão do Telovis Barber: containers publicados só em
  `127.0.0.1`, **Nginx do host** com certbot na frente.
- Um domínio próprio (ainda a definir pelo Willians — não é subdomínio de kernellwc.online),
  servindo o app e o `/socket.io` do realtime no mesmo domínio (WebSocket upgrade no Nginx).
- **LiveKit Cloud** para a mídia (sem carga nem portas UDP na VPS).
- Sem Resend no primeiro deploy.

## Limites conhecidos

- Realtime é instância única (estado em memória). Escalar exige Redis +
  `@socket.io/redis-adapter`.
- Se o realtime cair sem desligar direito, perde até 5 min de métricas abertas e a fila.
