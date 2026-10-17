---
status: stable
domain: telovis-barber-landing
source: claude
created: 2026-09-16
updated: 2026-10-17
owner: willians
---

# Arquitetura Técnica — TeloVis Pro Landing (repo `telovis-barber-landing`)

> Referência: [[prd-telovis-barber-landing]] | decisões em [[registro-de-decisoes-telovis-barber-landing]] (D-19 a D-24 para a v3)

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Hospedagem | **Lovable** (publica no Cloudflare), domínio `telovispro.com` | Mesmo caminho da LP da TeloVis Tech; sem VPS para manter (D-23) | Publicar depende de clicar **Publicar → Update** na Lovable |
| Projeto | Template **TanStack Start** da Lovable (React 19 + Vite + Nitro), mantido intacto | A publicação da Lovable depende do template; trocar por Vite puro arriscava quebrar o deploy (D-23) | ~500 pacotes de dependência para servir uma página estática |
| Página | HTML + CSS + JS vanilla em `src/landing/`, injetado pela rota `/` (`src/routes/index.tsx`) | A LP aprovada continua idêntica, sem reescrever em React | Editar pelo chat da Lovable pode levar ela a "converter" para React; editar pelo código |
| Interatividade | `src/landing/main.js` (módulo ES), carregado no navegador depois da hidratação | Idioma, segmento, filtro de módulos, simulador e formulário → WhatsApp já funcionavam assim | Nada de estado React; o `main.js` mexe direto no DOM que o SSR entregou |
| Idiomas | `src/landing/i18n.js` (EN/ES + textos gerados pelo JS); o PT vem do próprio HTML | Um lugar só para cada texto em PT | Texto novo em PT precisa da chave equivalente em EN e ES |
| Estilo | `src/landing/landing.css` (tokens em `:root`: creme `#F7F4EC`, dourado `#A9791E`, ônix `#1C1A14`), Playfair Display + Inter (Google Fonts) | Paleta e fontes do próprio sistema (D-15) | O Tailwind do template só carrega nas telas de 404/erro, para não colidir |
| SEO | `head` da rota: title, description, og (title, description, url, image), canonical `https://telovispro.com/` | SSR entrega o HTML completo para buscadores e prévias de link | Os textos em EN/ES só aparecem depois do JS (o SSR sai em PT) |
| Imagens | `public/assets/tl-logo.png` (720 px, T + pincel + navalha fechada), `favicon.png`, `apple-touch-icon.png`, `public/favicon.ico` | Logo da v3 (D-21) | Logo gerado em render, não vetorial oficial |
| Versionamento | Dois remotes com o mesmo histórico: `lovable` → `telovis-pro-canvas` (privado, sincroniza com a Lovable) e `origin` → `telovis-barber-landing` | Igual à LP da TeloVis Tech | Nunca reescrever histórico enviado (force push, rebase): a Lovable perde o histórico |

---

## 2. Camadas do sistema

```
[Visitante — navegador, majoritariamente mobile]
              ↓  (HTTPS)
[Cloudflare DNS — telovispro.com, A @ e www → 185.158.133.1]
              ↓
[Lovable hosting — build Nitro (Cloudflare) do projeto 0b8ffaca-…]
              ↓
   rota /  (src/routes/index.tsx)
     SSR: <head> (meta, canonical, fontes, landing.css) + corpo de src/landing/page.html
     navegador: hidrata → import('src/landing/main.js') → aplica idioma/segmento, liga simulador e formulário
   404 / erro (src/routes/__root.tsx) → telas do template com o Tailwind
```

Não existe backend, banco ou API própria. Todo CTA é um link `https://wa.me/<numero>?text=<mensagem>`; o formulário e o simulador montam a mensagem em JS e abrem o WhatsApp.

---

## 3. Fluxo de dados

### Visita

```
GET https://telovispro.com/?lang=en&segmento=equipe
  → SSR devolve o HTML em PT com <html lang="pt-BR">
  → navegador carrega landing.css, fontes e /assets/*
  → main.js: idioma (?lang= → escolha salva → idioma do navegador → PT) e segmento (?segmento=)
```

### Conversão (tudo vai para o WhatsApp)

```
Botões "Converse pelo WhatsApp" → wa.me/5511954079335 ou wa.me/5511953445647, "Olá! Quero conhecer o TeloVis Pro."
Simulador → wa.me/5511954079335 com o faturamento estimado por profissional e a % de comissão
Formulário → valida nome, salão/barbearia/clínica e consentimento → wa.me/5511954079335 com os campos
Nada é enviado a servidor nem salvo. Número: constante WHATSAPP no topo de main.js.
```

### Atualização de conteúdo (deploy)

```
Local: editar src/landing/* ou src/routes/index.tsx → npm run build && npm test
      → git push lovable main && git push origin main
Lovable: o commit aparece no editor → Publicar → Update
```

Ver `DEPLOY.md` no repo da LP (onde mexer em cada coisa, rodar local, avisos).

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Status |
|---|---|---|---|---|
| Visitante → Lovable/Cloudflare | entrada | HTTPS | nenhuma (site público) | Ativo |
| LP → WhatsApp (`wa.me`) | saída | link com texto pré-preenchido | nenhuma | Ativo |
| LP → Google Fonts | saída | `<link>` CSS | nenhuma | Ativo |
| LP → telovistech.com | saída | link no rodapé | nenhuma | Ativo |
| Repo ↔ Lovable | duas vias | git (`telovis-pro-canvas`, branch `main`) | GitHub App da Lovable | Ativo |
| VPS `kernellwc.online/vendas/` | — | estático (v1, Telovis Barber) | — | **Legado**: não atualizar (D-23) |

Sem integração com o backend do Telovis Barber nem com Brainiac/Kalel.

---

## 5. Fronteiras de segurança

- **Sem dado armazenado:** o formulário só monta a mensagem e abre o WhatsApp do próprio visitante. Sem banco, endpoint, sessão ou cookie. Consentimento obrigatório no formulário.
- **Sem pixels/analytics.** Se forem adicionados, seguir o modelo da LP da TeloVis Tech: política de privacidade publicada antes e trackers só após consentimento.
- **Rodapé com o CNPJ da TeloVis Tech** (51.960.551/0001-38), dona do produto (D-22).
- **Repositório `telovis-pro-canvas` é privado;** o `telovis-barber-landing` é público. Nenhum segredo no código (não há `.env`).

---

## 6. Estratégia de escala

Página única servida pela infraestrutura da Lovable/Cloudflare; não há gargalo previsível.

**Se o escopo crescer:**
- Mais páginas (LP por nicho: salão, barbearia, estética) → novas rotas no próprio TanStack (`src/routes/*.tsx`), reaproveitando `landing.css`
- Guardar leads → server function + banco (Supabase/Lovable Cloud), como a LP da TeloVis Tech, com cuidado de LGPD
- Analytics → ver §5

---

## 7. Deploy e ambiente

**Produção:** https://telovispro.com (e `www`). Publicado pela Lovable, projeto `0b8ffaca-8f5b-4b8d-a353-2aea2557060c`. Confirmado no ar em 2026-10-17 (200, título "TeloVis Pro | Gestão para salões, barbearias e estética").

**Local:** `npm install`, `npm run dev`. O `npx vite preview` não roda essa build no Windows (saída para Cloudflare); usar o dev server.

**VPS antiga:** `/var/www/telovis-barber-landing` em `kernellwc.online` ainda serve a v1 em `/vendas/`. Não rodar `git pull` lá (sem `index.html` na raiz, a página sairia do ar). Pendência: desligar o bloco `/vendas/` ou redirecionar para `telovispro.com` (`telovis-barber/deploy/nginx-kernellwc.conf`).

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-09-15/16 | Reforma completa: remoção de preços, rebrand Telovis Barber, diferenciais, mentoria, primeiro deploy em produção (`/vendas/`) |
| v2.0 | 2026-10-14 | TL Barber: construção da LP Telovis Tech (órbita, segmentos, módulos, simulador, formulário → WhatsApp), paleta clara e fontes do sistema, logo oficial. Commit `c1a6f9b`; nunca publicada na VPS |
| v2.1 | 2026-10-15 | LP multi-idioma PT/EN/ES (commit `53ce9c6`) |
| v3.0 | 2026-10-17 | **TeloVis Pro**: salões + barbearias + estética, logo com pincel e navalha fechada, CNPJ da TeloVis Tech no rodapé, LP dentro do template TanStack Start da Lovable, publicada em `telovispro.com` (commits `6d083ee` a `a04f2eb`) |
