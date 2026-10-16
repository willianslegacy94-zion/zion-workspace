---
status: stable
domain: telovis-tech-landing
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# Registro de Decisões — Telovis Tech Landing

> Referência: [[prd-telovis-tech-landing]] | [[arquitetura-telovis-tech-landing]]

---

## D-01 — Export do Lovable vira a LP oficial; versão estática arquivada

**Data:** 2026-10-14
**Decisão:** adotar o projeto do Lovable (TanStack Start + Supabase) como LP oficial em `Desktop/Ops/telovis-tech-landing/`. A versão estática (ex-"Kernel Sistemas", rebatizada Telovis Tech, HTML/CSS/JS sem build) foi movida para `Desktop/Ops/telovis-tech-landing-estatica/`.
**Contexto:** Willians escolheu a opção "usar a versão do Lovable como oficial" entre: Lovable oficial, portar partes para a estática, ou publicar só no Lovable.
**Alternativa descartada:** manter a estática e copiar o catálogo para ela. Descartada porque perderia recomendador, formulário de lead, painel e variantes por público.
**Impacto:** deixa de ser estática — precisa de processo Node na VPS e das chaves do Lovable Cloud (ver arquitetura §7).

---

## D-02 — Repositório próprio no GitHub (sincronização resolvida em D-13)

**Data:** 2026-10-14
**Decisão:** criar `willianslegacy94-zion/telovis-tech-landing` (privado) e versionar o export lá. `.env` fora do Git (`.gitignore` + `.env.example`).
**Pendente:** conectar o projeto do Lovable a esse repo; até lá, editar no Lovable e aqui diverge.

---

## D-03 — Logo oficial servido localmente

**Data:** 2026-10-14
**Decisão:** o export só trazia um ponteiro para o CDN do Lovable (`/__l5e/assets-v1/...`), que quebra fora dele. O logo oficial (JPEG enviado por Willians) foi convertido em PNG transparente na cor da marca `#17A77C` → `public/telovis_logo.png`, e o favicon gerado a partir dele. `telovis_logo.png.asset.json` aponta para `/telovis_logo.png`.

---

## D-04 — Telas dos projetos recriadas com dados fictícios, nunca prints reais

**Data:** 2026-10-14
**Decisão:** a partir de prints dos sistemas em produção, recriar cada tela em HTML com os mesmos layouts e dados inventados ("Ana Costa", "Seu Restaurante", "Sua Frota", PIX `financeiro@suaacademia.com`) e publicar só esses mockups (WebP em `public/projetos/`). Cada preview leva o selo "Tela ilustrativa · dados fictícios".
**Contexto:** pedido de Willians — "não coloca exatamente a imagem com os dados, gere uma genérica". Os prints tinham nome de aluna, chave PIX real, domínio do cliente e valores.
**Impacto:** regra no `AGENTS.md` do repo mudou de "sem screenshots de produto" para "telas recriadas com dados fictícios, sinalizadas como ilustrativas". Fontes dos mockups em `divulgacao/fonte/telas.html` e `desktop.html`.

---

## D-05 — Notebook + celular nas imagens dos sistemas

**Data:** 2026-10-14
**Decisão:** além das telas de celular, criar uma tela de computador por projeto e mostrar os dois juntos (notebook com celular à frente) no card da vitrine e no topo da página do projeto; a galeria "Telas do sistema" mostra o computador em destaque e os celulares abaixo.
**Contexto:** Willians "sentiu falta de telas de computador", com referência de arte que combina os dois dispositivos.

---

## D-06 — "Academia Prof. Sandro" passa a "Centro de Treinamento Sandro Freire"

**Data:** 2026-10-14
**Decisão:** nome público atualizado; slug `academia-prof-sandro` → `ct-sandro-freire`. Ver [[../arquitetura-academiasandro/registro-de-decisoes-academiasandro|registro do CT]].

---

## D-07 — Novo CTA principal: "Falar sobre o meu negócio"

**Data:** 2026-10-14
**Decisão:** botões do hero, do topo e do fim das páginas de projeto passam de "Vamos conversar (sobre seu projeto)" para "Falar sobre o meu negócio". No topo, em telas ≤760px, mostra "Falar" para não estourar a largura ao lado do logo e do menu.

---

## D-08 — Sistema de barbearias sai da vitrine

**Data:** 2026-10-14
**Decisão:** o card "Sistema para Barbearias" (Telovis Barber) foi criado e removido no mesmo dia: o produto vai para a LP própria do TL Barber ([[../arquitetura-telovis-barber-landing/indice-telovis-barber-landing|telovis-barber-landing]]). As artes trocaram "Barbearias e salões" por "Serviços" e o exemplo de agendamento de corte por reserva de mesa.

---

## D-09 — Agentes de IA agrupados no fim da vitrine

**Data:** 2026-10-14
**Decisão:** ordem do catálogo: 6 sistemas primeiro (2 linhas completas no desktop), depois TeloVis Brainiac e TeloVis Kalel lado a lado.

---

## D-10 — Villa Mill: camadas de acesso, perfis e acesso por horário

**Data:** 2026-10-14
**Decisão:** o projeto passou a destacar "Perfis de acesso por função e por horário". Novas telas ilustrativas: início com módulos (inclui "Usuários e perfis" e "Cancelamentos"), perfis (Administração / Caixa / Cozinha com áreas e horários) e bloqueio fora do expediente (equivalente público do `/bloqueio-horario` / BYOD Guard). Ver [[../arquitetura-villamill/registro-de-decisoes-villamill|registro do Villa Mill]].

---

## D-11 — "Órbita Quasar" vira "TeloVis Kalel" na vitrine

**Data:** 2026-10-14
**Decisão:** card renomeado, slug `orbita-quasar` → `telovis-kalel`. Descrição mantida — o Kalel é fork do Quasar com as mesmas capacidades (WhatsApp, ferramentas de agenda/catálogo, memória, cálculo de valores). Na Lane Confeitaria, "Integração com o Quasar" virou "integração com o agente de atendimento por IA", já que o Kalel não atende a Lane. Nome escrito "TeloVis Kalel" para casar com "TeloVis Brainiac" (Willians pediu "TeloVis - Kalel"; ajustável).

---

## D-12 — Artes de divulgação

**Data:** 2026-10-14
**Decisão:** duas artes na identidade da LP — status 1080×1920 e post 1080×1350 — com notebook + celulares, conversa de exemplo do "Funcionário Digital", 4 serviços, segmentos e WhatsApp **(11) 95407-9335** com QR Code (`wa.me` com mensagem pré-preenchida). Arquivos em `divulgacao/` no repo; fonte em `divulgacao/fonte/share.html` (`#story` / `#post`).

---

## D-13 — Lovable sincroniza com `campaign-flow-creations`; histórico unificado

**Data:** 2026-10-15
**Decisão:** o projeto "TV Tech Landing" na Lovable está ligado ao repositório `willianslegacy94-zion/campaign-flow-creations`, e não a `telovis-tech-landing`. Os dois históricos foram unidos com um merge `-s ours` (código daqui mantido integralmente, nada da versão antiga da Lovable preservado, sem force push). Todo push vai para os dois repositórios: `lovable` e `origin`.
**Contexto:** commits enviados a `telovis-tech-landing` nunca chegavam à Lovable; o editor mostrava uma versão de 14/10 sem idiomas.
**Consequência:** o `.env` com as chaves **públicas** do Supabase (URL e publishable) voltou a ser versionado. O build publicado da Lovable depende dele; sem o arquivo, o site carregava e quebrava com "Missing Supabase environment variable(s)". Chaves secretas (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) nunca vão para o `.env`; localmente ficam em `.env.local`.
**Substitui:** a pendência de D-02.

---

## D-14 — Recomendador usa Gemini 3.1 Flash Lite

**Data:** 2026-10-15
**Decisão:** trocar o modelo do "Encontre o projeto ideal" de `openai/gpt-6-astra` para `google/gemini-3.1-flash-lite`, o mais barato da lista da Lovable fora dos obsoletos.
**Contexto:** a tarefa é curta (até três projetos do catálogo e uma frase por projeto) e o workspace tem 4 créditos de IA por mês; o campo é público. Slugs fora do catálogo já são descartados no servidor.
**Detalhe técnico:** no AI Gateway da Lovable, `/v1/responses` só atende modelos OpenAI; os demais usam `/v1/chat/completions`, e as opções de raciocínio da OpenAI só são enviadas para modelos OpenAI. Falhas ficam nos logs do servidor como `recommend failed`.
**Alternativa:** se a qualidade cair, subir para Gemini 3.8 Flash (padrão da Lovable).

---

## D-15 — Publicação na Lovable com domínio `telovistech.com`

**Data:** 2026-10-15
**Decisão:** hospedar o site na própria Lovable e conectar o domínio raiz `telovistech.com` (DNS na Cloudflare, registros da Lovable com proxy desligado, `www` redireciona para a raiz).
**Impacto:** o deploy em VPS descrito no `DEPLOY.md` deixa de ser o caminho principal e vira alternativa. Recomendado registrar `telovistech.com.br` só para proteger a marca, redirecionando (301) para o `.com` por Redirect Rule da Cloudflare.
**Junto:** favicons completos derivados da logo oficial (`favicon.ico`, `favicon.png`, `icon-192.png`, `apple-touch-icon.png`). O selo "Edit with Lovable" é injetado pela hospedagem e só sai pela configuração do projeto (plano pago), nunca por CSS.

---

## D-16 — "Versões da campanha" sai do site público

**Data:** 2026-10-15
**Decisão:** remover o botão "Versões da campanha" do rodapé e o modal que copiava texto e link por público. Os textos e links de cada público, nos três idiomas, ficaram arquivados em [[versoes-campanha-telovis-tech-landing]].
**Contexto:** a ferramenta era interna, de divulgação, e aparecia para qualquer visitante no site em produção (`telovistech.com`).
**Mantido:** o parâmetro `segmento` (e `lang`) continua definindo o público da página, então os links já divulgados seguem válidos.

---

## D-17 — SEO e cartão social: "Funcionário digital" no Google, "Sistemas sob medida" no cartão

**Data:** 2026-10-15
**Decisão:** o `<title>` e a descrição (o que aparece no Google) focam em **funcionário digital com IA no WhatsApp**: "TeloVis Tech | Funcionário digital com IA no WhatsApp". O cartão de compartilhamento (WhatsApp/LinkedIn) usa **"Sistemas sob medida para o seu negócio"** como título e na imagem, com a frase dos funcionários digitais abaixo. Tudo em PT, EN e ES em `src/lib/campaign/i18n.ts`.
**Contexto:** a primeira versão citava "SDR virtual" e "escritórios virtuais 2D". O escritório 2D saiu por não existir no catálogo nem na página; "SDR" virou "funcionário digital" por ser mais amplo (atende, qualifica leads e agenda, como documenta o TeloVis Kalel). Willians não gostou de "Inteligência Artificial" como título do cartão e preferiu manter "Sistemas sob medida".
**Implementação:** imagem `public/og-image.jpg` (1200×630, ~90 KB, gerada da imagem do hero + logo oficial) com URL absoluta e versionada (`?v=2`) em `src/lib/campaign/site.ts`, para forçar LinkedIn e WhatsApp a buscar de novo; `og:image` no root vale para todas as páginas; home com `og:url` e `canonical` por idioma.
**Junto:** `robots.txt` com um único grupo `User-agent: *` bloqueando `/auth`, `/painel` e `/area-privada` (os grupos por robô anteriores anulavam o `*`) e apontando para `/sitemap.xml`, gerado do catálogo nos três idiomas.
**Validação:** o Post Inspector do LinkedIn exibiu o cartão novo após o Publish. Ao trocar a imagem, subir o `v` em `shareImage.url`.

---

## D-18 — Dados estruturados (JSON-LD) da empresa na home

**Data:** 2026-10-15
**Decisão:** a home publica um bloco schema.org (`Organization` + `WebSite`) com nome, logo, descrição no idioma da página, os 3 WhatsApps como contato comercial, idiomas e região atendida (Brasil e América Latina). Código em `src/lib/campaign/structured-data.ts`.
**Fora, de propósito:** avaliações e notas (proibidas sem evidência), Instagrams de clientes e `sameAs`, que fica vazio em `officialProfiles` até a TeloVis ter perfis oficiais. `email` e `taxID` (CNPJ) entraram com os dados da empresa (D-20).
**Validação:** Teste de pesquisa aprimorada do Google em `https://telovistech.com`.

---

## D-19 — Pixels (GA4, Google Ads, Meta, LinkedIn) só com consentimento e política de privacidade

**Data:** 2026-10-15
**Decisão:** instalar as quatro ferramentas de medição e anúncio por um único módulo (`src/lib/campaign/tracking.ts`) que só carrega scripts depois de "Aceitar" no aviso de cookies (LGPD; Consent Mode v2 do Google). Eventos: **lead** no envio do formulário e **contato** nos cliques de WhatsApp (bloco de contato e simulador de CMV). Página `/privacidade` em PT, EN e ES e link "Cookies" no rodapé para rever a escolha.
**Regra:** tudo fica inerte enquanto faltar razão social, CNPJ e e-mail de privacidade (`company` em `site.ts`) ou os IDs das plataformas (`trackingIds`). A política nunca vai ao ar com dados em branco, e nenhum pixel roda sem ela.
**Status:** no `main` desde o commit `03e3d26` (merge do branch `feat/pixels-consent`), com a política publicada (D-20). Os pixels seguem **inertes**. Pendências: IDs (`G-…`, pixel da Meta, Partner ID do LinkedIn, `AW-…` com os rótulos de conversão) e revisão jurídica do texto da política, que não fixa prazos de retenção.

---

## D-20 — Dados da empresa no rodapé e na política de privacidade

**Data:** 2026-10-15
**Decisão:** preencher `company` em `src/lib/campaign/site.ts` com razão social **51.960.551 WILLIANS DE OLIVEIRA SANTANA** (texto exato do cadastro do CNPJ, MEI; mantida por escolha do Willians), CNPJ **51.960.551/0001-38** e e-mail **willians.legacy94@gmail.com**. Com isso entram no ar: `/privacidade` nos três idiomas, o link "Privacidade" e a linha "CNPJ · e-mail" no rodapé das três páginas, `/privacidade` no sitemap e `email` + `taxID` no JSON-LD (D-18).
**Por quê:** a política exige identificar o controlador dos dados, e o rodapé com CNPJ e contato dá credibilidade à prospecção.
**Atenção (fora do site):** no cadastro, a atividade principal é comércio de cosméticos (CNAE 4772-5/00) e não há CNAE de software; a saída do MEI/Simples consta para 31/12/2026. Ajustar com o contador.
**Commit:** `03e3d26`, enviado a `lovable` e `origin`. Vai ao ar após **Publicar → Update** na Lovable.

