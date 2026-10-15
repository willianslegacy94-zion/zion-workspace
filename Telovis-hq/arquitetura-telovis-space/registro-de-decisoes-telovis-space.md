---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-14
owner: willians
---

# Registro de Decisões — TeloVis Space

> Referência: [[prd-telovis-space]] | [[requisitos-funcionais-telovis-space]] | [[arquitetura-telovis-space]]

---

## [2026-10-13] — Base e rodadas de funcionalidades

**Motivo:** construção a partir da spec "ESCOPO TÉCNICO E ARQUITETURA DE SOFTWARE — TELOVIS SPACE".
**Impacto:** 6 commits em `feat/telovis-space`:
- `264df7f` escritório 2D com login, acesso por membro e dashboard
- `fa7f97c` customizer de avatar
- `ca4d1b8` mapa novo com áreas, mesas pessoais e eventos ao vivo (Next → realtime)
- `c629385` kart, patinete e mesas personalizadas
- `1e22d6b` sentar nas cadeiras e status de ausência
- `9f96030` convite por e-mail (Resend)

**Status:** aplicado
**Observação:** decisões estruturais desta fase — realtime valida ticket JWT sem tocar no banco;
`identity` do LiveKit = `socket.id`; chat filtrado por alcance no servidor; posição/veículo/status
não são gravados.

---

## [2026-10-14] — Métricas de uso

**Motivo:** o dono do space precisa ver se o escritório está sendo usado.
**Impacto:** commit `4ad54e9` — entidade `Visit`, coleta no realtime, envio em lote para o Next,
painel `/dashboard/[slug]/metricas`. O texto do chat não sai do realtime.
**Status:** aplicado

---

## [2026-10-14] — LiveKit local e correção da mídia ao se afastar

**Motivo:** testar áudio/vídeo de verdade sem conta no LiveKit Cloud.
**Impacto:** commit `3b85fa0` — serviço `livekit` no `docker-compose.yml` (chave `devkey`), `.env.example`
do realtime apontando para ele. Teste com duas contas achou um bug: ao sair do alcance, o vídeo do
colega ficava congelado e duplicava ao voltar (o `livekit-client` chama `track.detach()` antes de
emitir `TrackUnsubscribed`). O `MediaController` passou a guardar o elemento de cada faixa.
**Status:** aplicado e testado

---

## [2026-10-14] — PR e decisões de deploy

**Motivo:** levar o Space para a `main` e para a VPS.
**Impacto:**
- PR #2 aberto: https://github.com/willianslegacy94-zion/zion-workspace/pull/2 — inclui também
  `626af64`/`c775527` (vesale) e `d126de8` (doc gw-coreai), que estavam na branch e não na `main`.
- Deploy decidido: **LiveKit Cloud** para mídia; **sem Resend** no primeiro deploy (link de
  convite copiado do dashboard); padrão do Telovis Barber (containers em 127.0.0.1 + Nginx do host
  + certbot); app e `/socket.io` no mesmo domínio.
- **Domínio:** será um domínio próprio, não subdomínio de kernellwc.online — ainda não informado.

**Status:** parado aguardando o Willians

---

## Pendências abertas

| Pendência | Precisa de |
|---|---|
| Domínio do Space + registro A para 2.24.117.12 | Willians |
| Projeto no LiveKit Cloud (URL, API key, secret — vão só no `.env` da VPS) | Willians |
| Arquivos de deploy + `playbook-devops-telovis-space.md` | Claude, depois dos dois itens acima |
| Decidir se o PR #2 leva os commits do vesale/gw-coreai ou se eles saem da branch | Willians |
| Recuperação de senha, verificação de e-mail, rate limit no login | antes de usuários reais |
| Resend com domínio verificado | depois do primeiro deploy |
| Ausente silenciar mic/câmera; status com texto livre | backlog |
| Renomear/excluir space, transferir posse; limpeza de convites expirados | backlog |
| Exportar métricas em CSV; apagar histórico antigo | backlog |
| Redis para mais de uma instância do realtime | quando escalar |
| Upload de mapa próprio; spritesheet de avatar enviado | backlog |
