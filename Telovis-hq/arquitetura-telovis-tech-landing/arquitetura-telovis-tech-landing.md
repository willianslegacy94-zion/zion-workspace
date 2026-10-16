---
status: stable
domain: telovis-tech-landing
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# Arquitetura Técnica — Telovis Tech Landing

> Referência: [[prd-telovis-tech-landing]]

---

## 1. Stack de decisão

| Componente | Tecnologia | Motivo | O que fecha |
|---|---|---|---|
| Framework | TanStack Start (React 19, SSR) via template Lovable `tanstack_start_ts_current` | Veio do Lovable; SSR + server functions para lead, recomendação e painel | Não é estático: precisa de processo Node rodando |
| Estilo | Tailwind 4 + shadcn/ui + `src/styles.css` (tokens no `:root`) | Padrão do Lovable | Componentes `ui/` são gerados — mexer pouco neles |
| Build | Vite 8 + Nitro (`@lovable.dev/vite-tanstack-config`) | Padrão do Lovable; o default é Cloudflare | Na Lovable usa o padrão; **numa VPS exige `NITRO_PRESET=node-server`** |
| Banco / Auth | Supabase gerenciado pelo **Lovable Cloud** | Veio pronto com RLS e login Google | Chave `service_role` e auth dependem do painel do Lovable Cloud |
| IA | AI SDK (`ai` + `@ai-sdk/openai`) via **AI Gateway do Lovable** (`LOVABLE_API_KEY`) | Recomendador "Encontre o projeto ideal", modelo `google/gemini-3.1-flash-lite` por chat completions (D-14) | Fora do Lovable precisa da chave do gateway ou trocar de provedor |
| Imagens | WebP em `public/projetos/` + logo em `public/telovis_logo.png` | Leve, servido como arquivo estático | Logo deixou de vir do CDN do Lovable (D-03) |
| Testes | Vitest + Testing Library (51 testes no `main`) | Veio do Lovable | — |
| SEO | Meta tags e Open Graph por idioma (`i18n.ts`), `og-image.jpg`, `robots.txt`, `sitemap.xml` gerado do catálogo, JSON-LD `Organization` na home | Cartão profissional no WhatsApp/LinkedIn e indexação no Google (D-17, D-18) | Trocar a imagem exige subir o `?v=` em `site.ts` |
| Medição | GA4, Google Ads, Meta Pixel e LinkedIn Insight via `tracking.ts`, só após consentimento | Medir leads e cliques no WhatsApp (D-19) | No `main`; inerte até ter os IDs das plataformas (dados da empresa já preenchidos, D-20) |
| Versionamento | GitHub privado `telovis-tech-landing` (`origin`) + `campaign-flow-creations` (`lovable`) | A Lovable só sincroniza o repo que ela criou | Push sempre para os dois (D-13) |

---

## 2. Camadas

```
[Visitante — mobile/desktop]
        ↓ HTTPS
[Cloudflare DNS — telovistech.com]
        ↓
[Hospedagem Lovable — build do repo campaign-flow-creations]
   (alternativa: Nginx + Node/pm2 numa VPS, ver DEPLOY.md)
   ├─ SSR das rotas: /  ·  /projetos/$slug  ·  /auth  ·  /_authenticated/painel  ·  /privacidade (D-19, D-20)
   ├─ rota de servidor: /sitemap.xml (gerada do catálogo, 3 idiomas)
   ├─ server functions: leads.functions · recommend.functions · panel.functions
   └─ estáticos: /projetos/*.webp · /telovis_logo.png · /og-image.jpg · /robots.txt · /favicon.ico · /favicon.png · /apple-touch-icon.png
        ↓
[Supabase (Lovable Cloud)]     [AI Gateway Lovable]
```

---

## 3. Fluxos

**Visita:** SSR da home → hidratação → vitrine lê `projects.ts` (sem banco).
**Lead:** formulário → server function valida com Zod (`leadSchema`) → insert em `campaign_leads` com chave publicável (RLS insert-only).
**Recomendação:** visitante descreve a necessidade → server function → AI Gateway com catálogo no prompt → resultado normalizado (só slugs existentes) → salvo em `campaign_recommendations` (service role) → id opaco vinculado ao lead.
**Medição (D-19; aguardando IDs):** aviso de cookies → "Aceitar" → carrega GA4/Ads/Meta/LinkedIn → eventos de lead (formulário enviado) e contato (clique no WhatsApp). "Recusar" ou nenhuma escolha = nenhum script.
**Painel:** login Google → trigger atribui papel admin se o e-mail está na allowlist → leitura via server function autenticada.

---

## 4. Dados (migrations em `drizzle/migrations/`)

| Tabela | Acesso público | Conteúdo |
|---|---|---|
| `campaign_leads` | insert (anon) | nome, e-mail, empresa, telefone, mensagem, segmento, consentimento, recommendation_id |
| `campaign_recommendations` | nenhum | necessidade descrita + resultado da IA |
| `user_roles` | nenhum | papéis do painel (admin) |

---

## 5. Integrações

| Integração | Direção | Autenticação | Status |
|---|---|---|---|
| Supabase (Lovable Cloud) | saída | publishable key (browser/SSR) · service role (servidor) | Ativo no Lovable; service role ainda não obtida para a VPS |
| AI Gateway Lovable | saída | `LOVABLE_API_KEY` | Só funciona com a chave |
| Login Google | entrada | OAuth via Lovable Cloud | Pendente: primeiro login da conta autorizada (roadmap) |
| WhatsApp (`wa.me`) | saída | nenhuma | Ativo — 3 números em `discovery.ts` |
| Google Fonts | saída | nenhuma | Ativo |
| Google Analytics 4 / Google Ads | saída | ID público (`G-…`, `AW-…`) | Pendente: IDs (D-19) |
| Meta Pixel | saída | ID público | Pendente (D-19) |
| LinkedIn Insight Tag | saída | Partner ID público | Pendente (D-19) |

---

## 6. Segurança

- `.env` versionado **só com as chaves públicas** do Supabase (exigido pelo build da Lovable, D-13); segredos locais ficam em `.env.local`. Chave publicável pode ir ao browser; `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_API_KEY` nunca.
- Leads: RLS insert-only para `anon`; nenhuma leitura pública.
- Prompt do recomendador trata o texto do visitante como dado não confiável e só aceita slugs do catálogo.
- `robots.txt` bloqueia `/auth`, `/painel` e `/area-privada`; o sitemap só lista páginas públicas.
- Pixels só carregam após consentimento explícito e só existem se `/privacidade` estiver publicada (D-19).
- Dados do controlador (razão social, CNPJ, e-mail) num único lugar, `company` em `site.ts`; se algum campo ficar vazio, política, links legais e pixels saem do ar juntos (D-20).
- **Nenhum print real** em `public/`: telas são mockups HTML com dados fictícios (fonte em `divulgacao/fonte/`).

---

## 7. Deploy

Ver `DEPLOY.md` no repo. Resumo:

```bash
cp .env.example .env            # preencher (VITE_* entram no build)
npm ci && NITRO_PRESET=node-server npm run build
PORT=3010 pm2 start .output/server/index.mjs --name telovis-tech-landing --node-args="--env-file=.env"
# Nginx: proxy_pass 127.0.0.1:3010 + certbot
```

Atualização: `git pull` → build → `pm2 restart telovis-tech-landing`.
**Pendências:** migration `0002_campaign_lead_locale.sql` no banco da Lovable; selo da Lovable (plano pago); registro opcional do `.com.br`.

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-10-14 | Export do Lovable adotado, logo local, telas ilustrativas (celular + computador), CT Sandro Freire, Villa Mill com perfis/horário, Kalel, CTA "Falar sobre o meu negócio", artes de divulgação |
| v1.1 | 2026-10-15 | Sincronização com a Lovable (`campaign-flow-creations`), `.env` público versionado, recomendador em Gemini 3.1 Flash Lite, publicação em `telovistech.com`, favicons, saída das "Versões da campanha" |
| v1.2 | 2026-10-15 | SEO e cartão social ("Funcionário digital" / "Sistemas sob medida"), `og-image.jpg`, robots com rotas privadas bloqueadas, JSON-LD; estrutura de pixels com consentimento e política de privacidade em branch, aguardando dados |
| v1.3 | 2026-10-15 | Dados da empresa (razão social, CNPJ, e-mail) preenchidos; `/privacidade` publicada, CNPJ e e-mail no rodapé, `email`/`taxID` no JSON-LD; pixels no `main`, inertes até os IDs |
