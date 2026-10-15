---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# PRD — TeloVis Space

> Referência: [[system-creation-telovis-space]] | [[requisitos-funcionais-telovis-space]]

## Problema

Em time remoto, toda conversa precisa de agenda e link. Some o "passar na mesa de alguém", a
sensação de presença e a conversa que nasce por estar perto. Ferramentas de chamada resolvem a
reunião, não o dia a dia.

## Hipótese

Um escritório espacial, em que a distância entre avatares decide quem ouve quem, devolve a
conversa espontânea sem virar uma chamada aberta o dia inteiro. Salas privadas dão a reunião
fechada; status de ausência e mesas pessoais dão a sensação de "lugar".

## Objetivo

Um time inteiro passar o expediente no space: entrar de manhã, conversar por proximidade, fazer
reuniões nas salas e ser visto como presente ou ausente.

## Escopo

**Dentro (implementado em 2026-10-13/14):**
- Conta por e-mail/senha, spaces com dono e membros (ADMIN, MEMBER, GUEST), convites
- Mapa Tiled com áreas abertas, salas privadas, mesas, assentos, garagens de veículos
- Proximidade: áudio/vídeo (LiveKit) e chat de texto só para quem está ao alcance
- Avatar personalizável, mesa pessoal com setup, kart e patinete, sentar, status de ausência
- Dashboard de membros, convites e métricas de uso

**Fora (por enquanto):**
- Recuperação de senha, verificação de e-mail, rate limit no login
- Upload de mapa próprio por cliente (só o mapa padrão)
- Spritesheet de avatar enviado pelo usuário (`User.avatarSprite` reservado)
- Várias instâncias do realtime (estado em memória; precisaria de Redis)
- Cobrança/planos

## Métricas

As próprias métricas do produto (`/dashboard/[slug]/metricas`): tempo no escritório por pessoa,
pessoas ativas por dia, pico simultâneo e **tempo conversando** (alguém ao alcance de voz) — esta
última é a métrica que valida a hipótese.

## Perguntas em aberto

- Modelo comercial (por space? por usuário?) — não definido.
- Primeiro time real para usar — não definido.
