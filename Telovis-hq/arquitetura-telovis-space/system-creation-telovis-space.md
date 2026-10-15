---
status: stable
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# System Creation Threshold — TeloVis Space

Resposta às 6 perguntas obrigatórias antes da criação do sistema.
Status: **threshold aprovado (registrado depois)** — o sistema foi construído entre 2026-10-13 e
2026-10-14 a partir da spec "ESCOPO TÉCNICO E ARQUITETURA DE SOFTWARE — TELOVIS SPACE"; esta pasta
de governança foi criada em 2026-10-14, com o código já em andamento. As respostas abaixo
refletem o que foi construído, não um levantamento com clientes.

---

## Respostas ao threshold

| Pergunta | Resposta |
|---|---|
| **1. Qual problema esse sistema resolve?** | Times remotos perdem a conversa espontânea do escritório: tudo vira reunião marcada com link. Não há como "ver quem está por aí" nem puxar alguém para uma conversa rápida sem agendar. |
| **2. Para quem?** | Empresas e equipes pequenas/médias que trabalham remotas ou híbridas — o dono do space (ADMIN) que monta o escritório e convida o time, e os membros que passam o dia nele. Também é vitrine/produto da própria Telovis. |
| **3. Qual é o output esperado?** | Escritório virtual 2D no navegador: cada pessoa é um avatar pixel art que anda pelo mapa; áudio, vídeo e chat ligam sozinhos com quem está perto ou na mesma sala privada; dashboard para gerenciar membros, convites e ver métricas de uso. |
| **4. Quais inputs o sistema precisa?** | Contas dos usuários, mapa do Tiled (`.json` + tileset), um servidor LiveKit (Cloud ou próprio) para a mídia e, opcionalmente, Resend para e-mail. |
| **5. Qual é o primeiro artefato concreto?** | Space `hq` com dois avatares se vendo e se ouvindo ao se aproximar — o núcleo de proximidade. |
| **6. Por que é um sistema e não uma pasta de apoio?** | Integra autenticação, controle de acesso por space, servidor de tempo real, mídia via SFU, persistência de mesas/avatares e métricas. Cada parte depende da outra: o ticket do Next autoriza o realtime, o realtime decide quem ouve quem, as métricas saem do realtime para o banco. |

---

## Origem

Produto próprio da Telovis, sem cliente pagante definido no momento da criação. A spec técnica
original define a stack (Next.js + Phaser + Socket.io + LiveKit + Prisma/PostgreSQL). O resto
(mesas, veículos, ausência, convites, métricas) entrou em rodadas sucessivas pedidas pelo
Willians — ver [[registro-de-decisoes-telovis-space]].

## Links relacionados

[[indice-telovis-space]] · [[prd-telovis-space]]
