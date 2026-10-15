---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# Modelo de Dados — TeloVis Space

> Referência: [[arquitetura-telovis-space]] · Fonte: `apps/web/prisma/schema.prisma`
> Migrações: `init_auth`, `user_avatar`, `desks`, `invites`, `visits`

## Entidades persistidas

| Entidade | Para quê | Campos-chave | Regras |
|---|---|---|---|
| **User** | Conta | `email` único, `passwordHash` (scrypt), `avatar` (Json `AvatarLook`), `avatarSprite` (reservado, sem uso) | Sem `avatar` salvo, o visual é derivado do nome |
| **Session** | Login | `id` = SHA-256 do token do cookie, `expiresAt` | 30 dias; sem limpeza periódica das expiradas |
| **Space** | Escritório | `slug` único, `mapJsonUrl`, `tilesetUrl`, `ownerId` | Dono entra como ADMIN sem precisar de SpaceMember |
| **SpaceMember** | Vínculo pessoa ↔ space | `role` ADMIN/MEMBER/GUEST | `@@unique([userId, spaceId])` |
| **Desk** | Mesa pessoal | `key` (nome do objeto na camada `desks`), `setup` (Json `DeskSetup`) | `@@unique([spaceId, key])` uma pessoa por mesa; `@@unique([spaceId, userId])` uma mesa por pessoa |
| **Invite** | Convite por e-mail | `tokenHash` único, `role`, `expiresAt` (7 dias) | `@@unique([spaceId, email])`; aceito vira SpaceMember e é apagado |
| **Visit** | Métricas | `startedAt`, `endedAt`, `messages`, `talkSeconds`, `zones` (Json: segundos por sala) | Visita aberta gravada em trechos de 5 min; < 5s não conta; > 24h cortada |

## Estado volátil (só no realtime, nunca no banco)

| Dado | Onde | Observação |
|---|---|---|
| Posição, direção, zona, `sitting`, `vehicle` | `RoomRegistry` em memória | Ao recarregar, volta a pé e no spawn |
| Status de ausência | conexão | O cliente reenvia ao reconectar |
| Mensagens do chat | trânsito | O texto não é gravado; só a contagem vai para `Visit.messages` |

## JSON versionados por índice

`AvatarLook` e `DeskSetup` (`packages/protocol`) guardam **índices** em paletas/listas. Regra:
só acrescentar opções no fim das listas; campo novo do `DeskSetup` entra em `ADDED_LATER` e
assume o padrão em mesas já salvas.
