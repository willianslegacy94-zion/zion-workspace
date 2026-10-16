---
status: stable
domain: telovis-tech-landing
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# Índice — Telovis Tech Landing

Mapa dos artefatos de governança da landing page institucional da **Telovis Tech** (sistemas sob medida e agentes de IA).
Todos os arquivos vivem em `Telovis-hq/arquitetura-telovis-tech-landing/`, com sufixo `-telovis-tech-landing`.

**Código-fonte:** `github.com/willianslegacy94-zion/telovis-tech-landing` (privado, remote `origin`) e `github.com/willianslegacy94-zion/campaign-flow-creations` (remote `lovable`, o que a Lovable sincroniza). Os dois ficam no mesmo commit — pasta local em `Desktop/Ops/telovis-tech-landing/` (fora do TeloVis Workspace).

**Origem:** projeto criado no Lovable (id `1411dd35-98f0-509e-93e1-c545d7282da3`), exportado e versionado no GitHub. Desde 2026-10-15 a Lovable recebe os pushes via `campaign-flow-creations` (ver [[registro-de-decisoes-telovis-tech-landing]], D-13). Desenvolvimento aqui; a Lovable serve de preview e hospedagem.

**Produção:** https://telovistech.com — publicado pela Lovable, DNS na Cloudflare (D-15). Cada mudança só vai ao ar após **Publicar → Update** na Lovable.

**Versão anterior (arquivada):** `Desktop/Ops/telovis-tech-landing-estatica/` — HTML estático "Kernel Sistemas" rebatizado para Telovis Tech, substituído por esta versão (D-01).

---

## Camada 1 — O quê (decisão e especificação)

| Documento | O que cobre |
|---|---|
| [[prd-telovis-tech-landing]] | Contexto, problema, objetivo, público, escopo, métricas e requisitos de alto nível |

**Sem `requisitos-funcionais` separado:** o escopo funcional (vitrine, variantes por público, recomendador, formulário, painel) cabe na seção 8 do PRD. Se o painel de leads crescer, vale extrair.

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | O que cobre |
|---|---|
| [[arquitetura-telovis-tech-landing]] | Stack (TanStack Start + Supabase do Lovable Cloud + AI SDK), SEO, medição, camadas, fluxos, integrações, segurança, deploy |

**Sem `modelo-de-dados` próprio:** as tabelas (`campaign_leads`, `campaign_recommendations`, `user_roles`) estão nas migrations em `drizzle/migrations/` do repo e resumidas na seção 4 da arquitetura.
**Sem `design-system`:** tokens em `src/styles.css` (`:root`), fontes Syne / Plus Jakarta Sans / Libre Baskerville, verde da marca `#17A77C`.

---

## Governança — Memória viva

| Documento | O que cobre |
|---|---|
| [[registro-de-decisoes-telovis-tech-landing]] | Decisões cronológicas: troca da LP estática pelo export do Lovable, logo local, telas ilustrativas com dados fictícios, notebook + celular, renomeações de projetos (CT Sandro Freire, TeloVis Kalel), saída da barbearia, Villa Mill com perfis/horário, CTA, artes de divulgação, sincronização com a Lovable, modelo do recomendador, domínio, saída das versões da campanha, SEO e cartão social, JSON-LD, pixels com consentimento LGPD (aguardando IDs), dados da empresa no rodapé e na política de privacidade |
| [[versoes-campanha-telovis-tech-landing]] | Arquivo das "Versões da campanha" removidas do site: links e textos de divulgação por público em PT, EN e ES |

---

## Ordem de leitura recomendada

```
prd-telovis-tech-landing
      ↓
arquitetura-telovis-tech-landing
      ↓
registro-de-decisoes-telovis-tech-landing (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Mudança estrutural (nova seção, projeto entra/sai da vitrine, stack, deploy, posicionamento)
      ↓
registro-de-decisoes-telovis-tech-landing → o que mudou, por quê, impacto
      ↓  altera escopo ou arquitetura
  - prd-telovis-tech-landing           ← problema, público ou escopo mudou
  - arquitetura-telovis-tech-landing   ← decisão técnica, integração ou deploy mudou
```

Ajustes só de copy não precisam atualizar estes documentos.

**Documentação operacional (no repo, não neste índice):** `README.md` (onde mexer em cada coisa), `DEPLOY.md` (alternativa em VPS: Node + pm2 + Nginx), `AGENTS.md` (regras do projeto para IA), `roadmap.md` (histórico do Lovable), `divulgacao/README.md` (artes e mockups).

**Projetos citados na vitrine:** [[../arquitetura-academiasandro/indice-academiasandro|CT Sandro Freire]] · [[../arquitetura-frota-honduras/arquitetura-frota-honduras|Frota Honduras]] · [[../arquitetura-jocley-lanchonete/indice-jocley-lanchonete|Jocley Grill]] · [[../arquitetura-villamill/indice-villamill|Villa Mill]] · [[../arquitetura-manicure-nilza/indice-manicure-nilza|Manicure]] · [[../arquitetura-lane-confeitaria/indice-lane-confeitaria|Lane]] · [[../arquitetura-brainiac/indice-brainiac|Brainiac]] · [[../arquitetura-kalel/indice-kalel|Kalel]]
