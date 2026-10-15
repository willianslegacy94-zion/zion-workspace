---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# UI Kit — TeloVis Space

> Referência: [[design-system-telovis-space]] | [[ux-flows-telovis-space]]

## Telas (construídas)

| Rota | Tela |
|---|---|
| `/` | Landing + lista dos seus spaces |
| `/login`, `/signup` | Formulários de conta |
| `/dashboard` | Seus spaces + criar space |
| `/dashboard/[slug]` | Membros, papéis, convites pendentes, mesas (só ADMIN) |
| `/dashboard/[slug]/metricas` | Métricas de uso (só ADMIN) |
| `/convite/[token]` | Aceitar convite (criar conta ou entrar) |
| `/space/[spaceId]` | O escritório (Phaser + HUD) |
| `/space/[spaceId]/customizer` | Editor de avatar com prévia |

## HUD do escritório (construída)

| Componente | Posição | Conteúdo |
|---|---|---|
| Barra do space | topo esquerdo | nome do space, área atual, estado da conexão/mídia |
| Status | topo direito | Disponível/Ausente/Volto já/Almoço/Café |
| Atalhos | topo direito | "WASD / setas para andar · Enter para conversar" |
| Botão Avatar | topo direito | abre o customizer |
| Minimapa | topo esquerdo | câmera extra do Phaser |
| Perto de você + chat | inferior esquerdo | colegas ao alcance (distância, status) e mensagens |
| Mic / Câmera | inferior direito | liga/desliga; verde quando ligado |
| Vídeos remotos | canto superior direito | tiles 160×112 de quem está ao alcance |
| Avisos de interação | sobre o mapa | "E para pegar mesa / subir no kart" |
| Balão "falando" | sobre a cabeça do avatar | pixel art 16×14 com 3 pontinhos esmeralda animados (`game/speaking.ts`); acima do nome, empurra o balão do chat para cima |
| Balão de chat | sobre a cabeça do avatar | última mensagem por 6s |
| Diálogo de setup da mesa | modal | modelo, telas, cores, cadeira, acessórios, com prévia |

## Planejado

- Biblioteca de componentes (Shadcn/UI) — hoje Tailwind repetido por tela.
