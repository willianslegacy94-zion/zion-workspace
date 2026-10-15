---
status: draft
domain: telovis-space
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# Requisitos Funcionais — TeloVis Space

> Referência: [[prd-telovis-space]] | [[arquitetura-telovis-space]]

Status por RF: **feito** (implementado e testado localmente) ou **pendente**.

## Módulo 1 — Conta e sessão

| RF | Requisito | Status |
|---|---|---|
| RF-001 | Criar conta com nome, e-mail e senha (scrypt) | feito |
| RF-002 | Login por e-mail/senha; sessão em cookie httpOnly de 30 dias, banco guarda só SHA-256 do token | feito |
| RF-003 | Logout | feito |
| RF-004 | Recuperar senha por e-mail | pendente |
| RF-005 | Limitar tentativas de login | pendente |

## Módulo 2 — Spaces e membros

| RF | Requisito | Status |
|---|---|---|
| RF-010 | Qualquer usuário cria um space (mapa padrão) e vira dono/ADMIN | feito |
| RF-011 | ADMIN adiciona pessoa por e-mail, troca papel (ADMIN/MEMBER/GUEST) e remove | feito |
| RF-012 | Sem vínculo: "Sem acesso" (mesma resposta para space inexistente e alheio) | feito |
| RF-013 | Space `demo` aberto a qualquer usuário logado como GUEST | feito |
| RF-014 | Remoção/troca de papel vale na hora para quem está conectado | feito |
| RF-015 | Renomear/excluir space, transferir posse | pendente |

## Módulo 3 — Mapa e movimento

| RF | Requisito | Status |
|---|---|---|
| RF-020 | Andar com WASD/setas, colisão com paredes e móveis | feito |
| RF-021 | Ver os outros em tempo real (até ~15 Hz) | feito |
| RF-022 | Áreas abertas com nome no chão e na HUD; salas privadas destacadas | feito |
| RF-023 | Minimapa com jogadores e área visível | feito |
| RF-024 | Upload de mapa próprio | pendente |

## Módulo 4 — Proximidade, mídia e chat

| RF | Requisito | Status |
|---|---|---|
| RF-030 | Áudio/vídeo ativo até 150px, desliga acima de 170px (histerese); volume cai com a distância | feito |
| RF-031 | Sala privada: só quem está na mesma sala se ouve, volume cheio | feito |
| RF-032 | "Mutar" = cancelar assinatura no SFU (economiza banda) | feito |
| RF-033 | Chat de texto com a mesma regra, aplicada no servidor; balão sobre o avatar | feito |
| RF-034 | Botões de mic e câmera na HUD | feito |
| RF-035 | Balão "falando" sobre a cabeça enquanto há voz no microfone; só para quem você consegue ouvir | feito |

## Módulo 5 — Avatar, mesas, veículos e presença

| RF | Requisito | Status |
|---|---|---|
| RF-040 | Customizer de avatar (pele, cabelo, roupa), visto ao vivo pelos colegas | feito |
| RF-041 | Pegar mesa pessoal e montar setup (modelo, telas, cores, cadeira, acessórios); uma por pessoa por space | feito |
| RF-042 | Kart (310 px/s) e patinete (240 px/s) nas garagens, com **E** | feito |
| RF-043 | Sentar sozinho ao parar numa cadeira | feito |
| RF-044 | Status Disponível/Ausente/Volto já/Almoço/Café; ausente automático após 5 min | feito |
| RF-045 | Ausente silenciar mic/câmera; status com texto livre | pendente |

## Módulo 6 — Convites

| RF | Requisito | Status |
|---|---|---|
| RF-050 | Convidar e-mail sem conta: link `/convite/[token]` de 7 dias | feito |
| RF-051 | Aceitar só logado com o mesmo e-mail do convite | feito |
| RF-052 | Reenviar (token novo) e cancelar | feito |
| RF-053 | Envio por Resend; sem ele, link para copiar no dashboard | feito (Resend não configurado) |

## Módulo 7 — Métricas de uso

| RF | Requisito | Status |
|---|---|---|
| RF-060 | Painel só ADMIN, 7/30/90 dias: tempo, ativos, pico, tempo conversando, mensagens | feito |
| RF-061 | Por dia, por pessoa e por sala privada | feito |
| RF-062 | Exportar CSV; apagar histórico antigo | pendente |
