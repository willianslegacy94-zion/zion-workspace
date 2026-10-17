---
status: stable
domain: telovis-barber-landing
source: claude
created: 2026-09-16
updated: 2026-10-17
owner: willians
---

# Índice — TeloVis Pro Landing

Mapa completo dos artefatos de governança da página de vendas do produto. Desde 2026-10-17 a LP usa o nome comercial **TeloVis Pro** e fala com salões de beleza, barbearias e clínicas de estética (D-19, D-20); antes foi TL Barber (D-12). Repositório, pastas e nomes destes arquivos continuam `telovis-barber-landing`.
Todos os arquivos vivem em `Telovis-hq/arquitetura-telovis-barber-landing/`, com sufixo `-telovis-barber-landing`.

**Código-fonte:** pasta local `Desktop/Ops/telovis-barber/telovis-barber-landing/`, com dois remotes de mesmo histórico: `lovable` → `github.com/willianslegacy94-zion/telovis-pro-canvas` (privado, sincronizado com a Lovable) e `origin` → `github.com/willianslegacy94-zion/telovis-barber-landing` (público).

**Produção:** **https://telovispro.com**, publicada pela Lovable (projeto `0b8ffaca-8f5b-4b8d-a353-2aea2557060c`, D-23). A VPS antiga (`kernellwc.online/vendas/`) ainda serve a v1 e **não deve receber `git pull`**.

**Identidade visual (v3):** paleta clara do sistema (creme `#F7F4EC` + dourado `#A9791E` + ônix `#1C1A14`), Playfair Display + Inter, logo com T dourado + pincel + navalha fechada em `public/assets/tl-logo.png` (D-21). Nunca usar o navy/verde da Telovis Tech na LP (D-13). Rodapé com o CNPJ da TeloVis Tech (D-22).

---

## Camada 1 — O quê (decisão e especificação)

| Documento | O que cobre |
|---|---|
| [[prd-telovis-barber-landing]] | Contexto e problema da v1 (histórico); objetivo, escopo, métricas e requisitos da v3 TeloVis Pro (com gap de analytics registrado) |

**Sem `requisitos-funcionais` de propósito:** página de marketing de seção única, sem módulos de sistema — os requisitos funcionais/não-funcionais relevantes já cabem na seção 8 do PRD.

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | O que cobre |
|---|---|
| [[arquitetura-telovis-barber-landing]] | Stack (LP em HTML/CSS/JS vanilla dentro do template TanStack Start da Lovable), design tokens do produto, camadas, fluxo de conversão (botões, simulador e formulário → WhatsApp), publicação pela Lovable em `telovispro.com`, segurança e estratégia de escala |

**Sem `modelo-de-dados`, `design-system`, `ui-kit` ou `ux-flows` de propósito:** não há banco de dados (sem backend próprio); os tokens visuais estão em `src/landing/landing.css` (`:root`) e vêm da paleta clara de fábrica do produto (`telovis-barber/frontend/src/lib/theme.js`), não duplicados aqui — se a LP virar múltiplas páginas, vale extrair um `design-system-telovis-barber-landing.md` nesse momento.

---

## Governança — Memória viva do sistema

| Documento | O que cobre |
|---|---|
| [[registro-de-decisoes-telovis-barber-landing]] | 24 decisões cronológicas. **v1 (D-01 a D-11):** remoção de preços, benchmarking Trinks/BarberCode, diferenciais sem expor spec, mentoria, rebrand Telovis Barber, rename do repo, `/vendas/` como path de deploy, incidente na VPS errada (sem impacto), chave SSH dedicada, primeiro deploy. **v2 (D-12 a D-18):** nome TL Barber, versão navy/verde descartada, estrutura da LP Telovis Tech, paleta/fontes do sistema + logo oficial, contatos e formulário → WhatsApp, push sem atualizar a VPS, artes TL Barber. **v3 (D-19 a D-24):** público salões + barbearias + estética, nome TeloVis Pro, logo com pincel e navalha fechada, CNPJ da TeloVis Tech no rodapé, hospedagem na Lovable em `telovispro.com`, artes TeloVis Pro ([[telovis-pro-prospeccao.png]] e [[telovis-pro-status.png]]) |

Artes antigas (D-18) mantidas nesta pasta como histórico: [[tl-barber-prospeccao.png]] e [[tl-barber-status.png]].

---

## Ordem de leitura recomendada

```
prd-telovis-barber-landing
      ↓
arquitetura-telovis-barber-landing
      ↓
registro-de-decisoes-telovis-barber-landing (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Mudança de conteúdo/posicionamento com impacto de decisão
      ↓
registro-de-decisoes-telovis-barber-landing → registrar o que mudou, por quê e o impacto
      ↓  decisão altera escopo ou arquitetura
Artefato correspondente atualizado:
  - prd-telovis-barber-landing            ←  problema, objetivo ou escopo mudou
  - arquitetura-telovis-barber-landing    ←  decisão técnica ou de deploy mudou
```

Ajustes só de copy/texto (trocar uma frase, reescrever um bullet) não precisam atualizar estes documentos — só mudanças estruturais (nova seção, mudança de stack, mudança de processo de deploy, decisão de posicionamento).

**Documentação operacional do dia a dia (não deste índice):** `DEPLOY.md`, `README.md` e `BACKLOG.md` (histórico da v1), no repositório da própria LP — são runbook e lista de melhorias táticas, não artefatos de governança.
