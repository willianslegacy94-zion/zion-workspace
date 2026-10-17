---
status: stable
domain: telovis-barber-landing
source: claude
created: 2026-09-16
updated: 2026-10-17
owner: willians
---

# Registro de Decisões — TeloVis Pro Landing (repo `telovis-barber-landing`)

> Referência: [[prd-telovis-barber-landing]] | [[arquitetura-telovis-barber-landing]]

Decisões cronológicas que moldaram a LP. Cada entrada registra o contexto, a alternativa descartada e o impacto.

---

## D-01 — Remoção de todos os valores em R$ dos planos

**Data:** 2026-09-15
**Decisão:** nenhum plano exibe preço numérico. Cards de plano mostram "ideal para [perfil de barbearia]" em vez de valor; nota final explica que a proposta é sob medida.
**Contexto:** pedido explícito de Willians — preço fixo publicado "pode confundir o cliente em relação a precificação do sistema", já que a proposta real é configurada por número de unidades e funcionalidades ativas.
**Alternativa descartada:** manter preço "a partir de" como estava. Descartado porque contradizia o próprio texto da página, que já dizia que os valores eram "configurados conforme as funcionalidades ativas".
**Impacto:** todo CTA de plano vira conversa de WhatsApp em vez de decisão de compra direta na página — objeção "quanto custa" precisou ganhar resposta explícita no FAQ (ver D-03).

---

## D-02 — Estrutura inspirada em Trinks e BarberCode (benchmarking de concorrentes)

**Data:** 2026-09-15
**Decisão:** reestruturar a LP com base em `negocios.trinks.com/planos` e `barbercode.com.br` — prova social cedo na página, planos por funcionalidade em vez de tabela fechada de preço, FAQ em accordion.
**Contexto:** pedido explícito de Willians para usar essas duas páginas como referência de estrutura (não de conteúdo/copy).
**Alternativa descartada:** redesenho do zero sem referência de mercado. Descartado porque concorrentes já validaram esses padrões de conversão no mesmo setor.
**Impacto:** página ganhou seções novas (prova social, FAQ) que não existiam antes; layout de planos mudou de "tabela de preço" para "cards por funcionalidade/perfil".

---

## D-03 — Seção de FAQ com resposta direta para "quanto custa"

**Data:** 2026-09-15
**Decisão:** adicionar seção de FAQ em accordion (JS vanilla) com 6 perguntas, incluindo "Quanto custa o sistema?" respondida sem citar valor, explicando o modelo de proposta sob medida em até 24h.
**Contexto:** consequência direta de D-01 — remover o preço sem responder a pergunta na cabeça do visitante aumentaria a taxa de abandono.
**Alternativa descartada:** nenhuma resposta sobre preço em lugar nenhum da página. Descartado por deixar a objeção mais óbvia sem resposta.
**Impacto:** objeção de preço é reconhecida e redirecionada para o canal de conversão (WhatsApp) em vez de ser ignorada.

---

## D-04 — Diferenciais em linguagem de benefício, não ficha técnica

**Data:** 2026-09-15
**Decisão:** reescrever descrições de features e dos itens de cada plano em tom de resultado/benefício (ex.: "fechamento diário sem planilha") em vez de nome de funcionalidade específica (ex.: "DRE automático", "Metas e PDCA", "500 disparos/mês").
**Contexto:** pedido explícito de Willians — "quero usar nossos diferenciais para conseguir se destacar no mercado mas sem entregar muito o que tem na plataforma pra evitar cópias".
**Alternativa descartada:** manter bullets técnicos específicos (mais fáceis de comparar, mas também mais fáceis de copiar por um concorrente lendo a página).
**Impacto:** página menos "spec sheet", mais orientada a dor/resultado — reduz o quanto um concorrente consegue clonar a partir só do texto público. Também levou à criação de uma seção "Por que Telovis Barber" dedicada a diferenciais posicionais (não é sistema genérico, whitelabel de verdade, suporte direto, validado com dados reais).

---

## D-05 — Seção de Implantação e Mentoria (José Alef + Thieco Leandro)

**Data:** 2026-09-15
**Decisão:** nova seção dedicada, entre Diferenciais e Planos, com dois cards: José Alef (Gestor Comercial) treinando o uso do sistema, e Thieco Leandro (barbeiro e dono de barbearia) dando mentoria de crescimento para donos/gestores de barbearia.
**Contexto:** pedido explícito de Willians para expor que o produto vem com suporte humano real na implantação e mentoria de negócio pós-venda — diferencial que um sistema puramente self-service não consegue oferecer.
**Alternativa descartada:** incluir como só mais 1-2 itens dentro da grade de Diferenciais já existente. Descartado (escolha do usuário via pergunta direta) em favor de seção própria, por ter peso suficiente para não ficar diluída.
**Impacto:** reforça posicionamento "sistema + gente ajudando a crescer", coerente com D-04 (diferencial humano não é copiável por concorrente).

---

## D-06 — Rebrand "Órbita Barber" → "Telovis Barber"

**Data:** 2026-09-15
**Decisão:** substituir toda ocorrência de "Órbita Barber"/"Órbita" na página (logo, título da aba, meta description, CTAs de WhatsApp, footer) por "Telovis Barber"/"Telovis Barber". Reescrita da headline final do CTA porque o trocadilho original ("colocar sua barbearia em órbita") não fazia mais sentido com a nova marca.
**Contexto:** pedido explícito de Willians — "não pode ter mais orbita em nada, tudo é Telovis Barber". O restante do ecossistema (domínio `kernellwc.online`, repo do produto `telovis-barber`, documentação em `Telovis-hq`) já usa a marca Telovis Barber; "Órbita" era resquício de nomenclatura anterior do projeto.
**Alternativa descartada:** manter "Órbita Barber" como nome comercial específico da LP, diferente do produto. Descartado por ser exatamente o tipo de inconsistência que o pedido do usuário queria eliminar.
**Impacto:** repositório GitHub também renomeado (D-08). `BACKLOG.md` da LP teve URLs de exemplo atualizadas (`orbita.seudominio.com.br` → `kernelbarber.seudominio.com.br`).

---

## D-07 — Deploy como subpath `/vendas/` do domínio do produto, não subdomínio nem domínio próprio

**Data:** 2026-09-15
**Decisão:** publicar a LP em `https://kernellwc.online/vendas/`, via `location /vendas/` no Nginx do host, servida por `alias` direto do disco — sem Docker, sem build.
**Contexto:** perguntado diretamente a Willians entre 3 opções (domínio próprio / subdomínio `landing.kernellwc.online` / subpasta `kernellwc.online/vendas`). Optou por subpasta, reaproveitando o domínio e o certificado SSL já existentes do produto, sem precisar de DNS novo.
**Alternativa descartada:** subdomínio `landing.kernellwc.online` — mais isolado (bloco Nginx próprio, zero risco de colidir com as rotas do app React que já roda na raiz), mas Willians preferiu manter tudo sob o mesmo domínio.
**Impacto:** exigiu cuidado extra no Nginx para não colidir com as rotas do app (`/t/<slug>`, `/admin`) que já usam `location /` — resolvido com `location /vendas/` mais específico, que o Nginx sempre prioriza sobre o prefixo genérico `/`, independente da ordem no arquivo.

---

## D-08 — Repositório GitHub renomeado de `orbita-barber-landing` para `telovis-barber-landing`

**Data:** 2026-09-15
**Decisão:** `gh repo rename telovis-barber-landing` no repo `willianslegacy94-zion/orbita-barber-landing` → `willianslegacy94-zion/telovis-barber-landing`. Remote local atualizado automaticamente pelo `gh`.
**Contexto:** consequência de D-06 — consistência total de marca, inclusive na URL do repositório.
**Alternativa descartada:** manter o nome do repo antigo e só trocar o conteúdo. Descartado porque o pedido do usuário foi explícito: "renomeia o repositório também".
**Impacto:** GitHub mantém redirect automático da URL antiga por um tempo — links externos antigos (se existirem) não quebram na hora.

---

## D-09 — Incidente: config aplicada por engano na VPS errada durante o primeiro deploy

**Data:** 2026-09-16
**Decisão/ocorrência:** durante o processo de dar acesso SSH à IA (chave dedicada `id_ed25519_kernel_deploy`, adicionada ao `authorized_keys` de `willians@2.24.117.12`), o bloco de comandos de deploy (clone + `sudo tee` no Nginx) foi colado, por engano, num terminal conectado a **outra VPS** (hostname `systems`, provavelmente a VPS compartilhada de `sistema-thieco`/`vilamill-sistema`) em vez da VPS do Telovis Barber (`kernellwc.online`, hostname `telovis-barber`).
**Como foi detectado:** o prompt do terminal colado pelo usuário mostrava `root@systems:~#` em vez de `willians@telovis-barber:~$` — divergência notada antes de rodar o `curl` de confirmação final.
**Por que não causou dano:** o `sudo nginx -t` rodado na VPS errada **teria falhado** se o arquivo `sites-available/kernellwc.online` tivesse sido de fato carregado ali, porque ele referencia certificados SSL (`/etc/letsencrypt/live/kernellwc.online/...`) que só existem na VPS certa. O teste ter passado confirma que o arquivo ficou parado em `sites-available` sem estar linkado em `sites-enabled` — invisível pro tráfego real de `barbeariatl.online`/`villamill.online`.
**Correção aplicada:** `rm -f /etc/nginx/sites-available/kernellwc.online` e `rm -rf /var/www/telovis-barber-landing` na VPS errada, seguido de `nginx -t && systemctl reload nginx` para confirmar que os sites reais continuavam intactos.
**Lição registrada:** sempre confirmar `hostname`/prompt antes de colar qualquer bloco de comando em uma sessão SSH de produção — especialmente quando o usuário tem múltiplos terminais abertos simultaneamente para VPSs diferentes. Passou a ser prática adotada nesta sessão pedir confirmação de hostname antes de qualquer bloco com `sudo`.

---

## D-10 — Chave SSH dedicada para acesso da IA à VPS (não a chave original do runbook)

**Data:** 2026-09-16
**Decisão:** gerar um par de chaves novo (`~/.ssh/id_ed25519_kernel_deploy`) no ambiente onde a IA opera (Windows/Git Bash), em vez de tentar localizar ou reusar a chave `id_ed25519_kernel` originalmente gerada no WSL (documentada em `telovis-barber/deploy/RUNBOOK.md`).
**Contexto:** a chave original do runbook não existia no ambiente Windows local; buscar por chaves/credenciais no disco é uma ação bloqueada pelo classificador de modo automático (categoria "Credential Exploration"). Autenticação por senha via SSH não funciona de forma não-interativa (sem TTY para digitar senha).
**Alternativa descartada:** pedir a senha da VPS para a IA usar diretamente. Descartado por prática de segurança — senha não deve trafegar pelo chat.
**Impacto:** Willians precisou logar manualmente uma vez (senha, sessão interativa) para colar a chave pública nova em `~/.ssh/authorized_keys`. Depois disso, acesso de leitura (e, quando liberado pelo classificador, escrita) via essa chave dedicada. Escrita remota (`Remote Shell Writes`) continua bloqueada pelo modo automático — comandos que alteram estado na VPS (clone, `sudo tee`, `nginx reload`) precisam ser rodados pelo próprio Willians no terminal dele, não pela IA diretamente.

---

## D-11 — Primeiro deploy bem-sucedido em produção

**Data:** 2026-09-16
**Decisão/marco:** LP publicada em `https://kernellwc.online/vendas/`, confirmada via smoke test (`/vendas/` → 200, `/vendas/style.css` → 200, `/vendas/BACKLOG.md` → 403, `/` do app principal → 200, sem regressão).
**Contexto:** conclusão do processo iniciado em D-07, após o incidente de D-09.
**Impacto:** `DEPLOY.md` (no repo da LP) e `telovis-barber/deploy/nginx-kernellwc.conf` (no repo do produto) são a partir de agora a fonte de verdade do processo de atualização — rotina normal é só `git pull` na VPS, sem build nem restart (ver [[arquitetura-telovis-barber-landing]], seção 7).

---

## D-12 — Nome comercial da LP: TL Barber

**Data:** 2026-10-14
**Decisão:** a página de vendas passa a usar a marca **TL Barber** (título, meta tags, logo, CTAs, mensagens pré-preenchidas de WhatsApp, rodapé). Rodapé: "© 2026 TL Barber. Um produto Telovis Tech · Desenvolvido por Willians Santana."
**Contexto:** pedido explícito de Willians — "o nome será TL Barber".
**Escopo deliberadamente limitado à LP:** repositório, pastas, containers, banco e o próprio sistema continuam com nomes técnicos `telovis-*` / "Telovis Barber" (ver [[../arquitetura-telovis-barber/registro-de-decisoes-telovis-barber|registro do produto]]). Renomear o produto não foi pedido.
**Alternativa descartada:** renomear tudo de uma vez (sistema, repos, infra) — fora do pedido e com custo de migração alto (ver a migração Kernel → Telovis de 2026-10-05/06).
**Impacto:** marca comercial (TL Barber) e nome técnico (telovis-barber) passam a divergir. `DEPLOY.md` e `BACKLOG.md` do repo da LP ainda citam "Telovis Barber".

---

## D-13 — Primeira versão clara (cores Telovis + listras de poste de barbeiro) descartada

**Data:** 2026-10-14
**Decisão/ocorrência:** a primeira proposta da LP nova misturava a identidade da Telovis Tech (navy `#1E3A8A`, verde `#10B981`, off-white, de `Downloads/Telovis-Tech-sistemas.html`) com elementos de barbearia (listras de poste em navy/branco/verde, mockup de "caixa do dia"). Foi descartada antes de qualquer commit.
**Contexto:** o pedido inicial era "cores claras, mesclando o sistema de barbearia com as cores da Telovis". Willians corrigiu o rumo duas vezes: (1) a construção da tela deveria seguir a LP da Telovis feita no Lovable (D-14); (2) "as cores do sistema da barbearia não é verde, tem que seguir a paleta branca do sistema de barbearia" (D-15).
**Lição registrada:** **produto de barbearia usa a paleta do próprio sistema (dourado + creme / ônix), nunca o navy/verde da Telovis Tech.** A Telovis aparece só como assinatura ("Um produto Telovis Tech").
**Impacto:** nenhum em produção (nunca foi publicada).

---

## D-14 — Estrutura copiada da LP da Telovis Tech (projeto Lovable)

**Data:** 2026-10-14
**Decisão:** reconstruir a LP seguindo a construção da página de campanha da Telovis Tech (projeto Lovable/TanStack em `Downloads/1411dd35-98f0-509e-93e1-c545d7282da3`, usado só como referência — nada do código dele foi executado nem importado). A LP continua HTML/CSS/JS estático.
**Mapeamento referência → TL Barber:**

| LP Telovis Tech | TL Barber |
|---|---|
| Header com marca + subtítulo, nav, CTA "Vamos conversar" | Igual, com logo TL e "Sistema de Gestão para Barbearias" |
| Hero escuro com imagem + órbita animada (logo no centro + 3 cards) | Hero **claro** + órbita (logo TL no centro; cards Caixa & Comissões / Agenda & Atendimento / Relatórios e IA para o Dono) |
| Faixa de segmentos (empresas/serviços/varejo/startups) que troca o texto do hero | Momentos da barbearia: solo / equipe / rede / abrindo — troca hero e título do contato; link direto `?segmento=` |
| Benefícios /01–/03 | Nascido dentro de uma barbearia / Menos caderno, mais controle / Pronto para a próxima unidade |
| "Como funciona" em 3 passos | Escuta → implantação (José Alef) → mentoria (Thieco Leandro) |
| Vitrine de projetos com filtro e preview de fluxo | 6 módulos (Caixa, Comissões, Relatórios & DRE, Agenda, IA para o dono, Multi-unidade/whitelabel), filtro Gestão / IA |
| Simulador de CMV | Simulador de faturamento por cadeira (atendimentos × ticket × dias, comissão %) |
| Contato + formulário | Contato + formulário que abre WhatsApp (D-16) |

**Removido em relação à v1 (estrutura Trinks/BarberCode, D-02):** seção de planos em 3 níveis, FAQ (D-03), "Para quem é", seção própria de mentoria (D-05 — o conteúdo virou os passos 2 e 3 do "Como funciona"), depoimento de "Marcos B. — Barbearia Black" (não confirmado como cliente real; ficou só o do Thieco Leandro, em seção de prova com "+8.500 vendas desde 2024").
**Removido da referência por depender de backend:** recomendador de projetos por IA, área privada/painel de leads, modal "Versões da campanha".
**Alternativa descartada:** manter a estrutura v1 só trocando cores — Willians pediu explicitamente "se baseie exatamente nisso".
**Impacto:** D-02 e D-03 deixam de valer. **D-01 continua valendo** — nenhum preço do sistema é publicado; os R$ do simulador são estimativas do faturamento do próprio visitante, não preço. A objeção "quanto custa", antes respondida no FAQ, agora só aparece como "Proposta sob medida em até 24h" no contato — o risco de abandono do PRD §5 fica menos mitigado; avaliar trazer o FAQ de volta.

---

## D-15 — Paleta clara do sistema, tipografia do sistema e logo oficial

**Data:** 2026-10-14
**Decisão:**
- **Cores = modo claro de fábrica do sistema** (`telovis-barber/frontend/src/lib/theme.js`, constantes `LIGHT_*`): fundo `#F7F4EC`, superfícies `#FFFFFF`, hover/seções alternadas `#F1ECDD`, borda `#DDD3B8`, dourado `#A9791E` (botões, ícones), `#8A6117` para texto dourado (contraste no creme), `#D9B65C` (claro). Texto em ônix `#1C1A14` / `#2A2820`, secundário `#6B6352`. Tokens em `style.css` (`:root`), com comentário apontando a origem.
- **Fontes = as do sistema:** Playfair Display (títulos e marca) + Inter (texto). As fontes da referência (Syne / Plus Jakarta / Libre Baskerville) não foram usadas.
- **Logo oficial:** T dourado em serifa + navalha formando o L (original: `Downloads/WhatsApp Image 2026-10-14 at 22.06.51.jpeg`, fundo preto). Fundo removido por flood-fill a partir das bordas (preserva o cabo preto da navalha, que é fechado pelo contorno dourado). Arquivos: `assets/tl-logo.png` (360 px), `assets/favicon.png` (64 px), `assets/apple-touch-icon.png` (180 px).
**Contexto:** correção de Willians após D-13 + envio da logo.
**Alternativa descartada:** recolorir a logo ou redesenhá-la em SVG — a logo é a oficial e deve ser usada como veio.
**Impacto/gap:** a logo vem de um JPEG de 1254 px — em tamanhos grandes pode perder nitidez. Trocar `assets/tl-logo.png` quando houver o PNG transparente ou SVG original.

---

## D-16 — Contatos, CTA e formulário → WhatsApp (sem backend)

**Data:** 2026-10-14
**Decisão:**
- Contatos: **(11) 95407-9335** e **(11) 95344-5647** (dois botões em "Converse pelo WhatsApp"). O número antigo (11) 94845-5946 saiu da página.
- Formulário (nome, barbearia, cidade, nº de barbeiros, detalhes opcionais, consentimento) e simulador abrem `wa.me/5511954079335` com a mensagem montada — constante `WHATSAPP` no topo de `main.js`. **Nada é gravado**, diferente da LP da Telovis (que salva leads no Supabase).
- Texto do CTA principal do hero e do botão do formulário: **"Quero falar sobre minha barbearia"**.
**Contexto:** números e texto do CTA definidos por Willians; a LP continua estática (deploy por `git pull`, D-07).
**Alternativa descartada:** endpoint de leads na API do produto — possível depois (ver B-10 do `BACKLOG.md`), mas exige backend e cuidado de LGPD no armazenamento.
**Impacto:** primeira vez que a LP tem formulário; o consentimento é exigido no front, mas o dado só vai até o WhatsApp do próprio visitante.

---

## D-17 — Publicação: commit no GitHub, VPS não atualizada de propósito

**Data:** 2026-10-14
**Decisão/marco:** commit `c1a6f9b` ("feat: nova LP TL Barber (tema claro do sistema + logo oficial)") enviado para `main` do repo `telovis-barber-landing` (push pelo WSL — o git do Windows não tem credencial). **A VPS não foi atualizada:** Willians vai trocar o domínio antes de publicar.
**Estado:** produção (`https://kernellwc.online/vendas/`) continua servindo a v1 (Telovis Barber, tema escuro/dourado) até o `git pull` em `/var/www/telovis-barber-landing`.
**Pendências:** definir o domínio novo (nginx, certbot — a decisão D-07 pode mudar); `git pull` na VPS; atualizar `DEPLOY.md`/`BACKLOG.md` da LP para TL Barber; analytics de conversão continua sem instrumentação.

---

## D-18 — Artes de divulgação TL Barber

**Data:** 2026-10-14
**Decisão:** duas artes com a mesma construção das artes da Telovis Tech (ver [[../arquitetura-telovis-tech-landing/registro-de-decisoes-telovis-tech-landing|Telovis Tech Landing, D-12]]), mas com a logo e a paleta clara do sistema de barbearia: **prospecção 1080×1620** ([[tl-barber-prospeccao.png]]) e **status 1080×1920** ([[tl-barber-status.png]]). Elas trazem notebook + celulares, 4 serviços (Caixa e comissões, Agenda online, IA para o dono, Relatórios e DRE), perfis de barbearia (solo, equipe, rede, abrindo/nova) e o WhatsApp **(11) 95407-9335** com QR Code (`wa.me` com "Olá! Vi a divulgação do TL Barber e quero falar sobre minha barbearia." — QR conferido por decodificação dos PNGs).
**Telas:** recriadas em HTML com dados fictícios (Sua Barbearia, Rafael/Daniel/Lucas, clientes "João P.", valores inventados), seguindo a regra D-04 da Telovis Tech Landing. O painel do barbeiro aparece no **modo escuro** do sistema (ônix + dourado `#D4AF37`), o resto no modo claro.
**Adaptações:** o botão do WhatsApp e a faixa de contato usam dourado/ônix no lugar do verde/navy; "Atendimento com IA" (que depende do envio por WhatsApp, hoje parado) virou "IA para o dono", o chat executivo que já está em produção; o card "App para seu cliente" virou "Agenda online".
**Onde ficam:** PNGs e fonte em `telovis-barber-landing/divulgacao/` (`fonte/arte.html`, `#prospeccao` / `#status`, ver `README.md` de lá); cópia dos PNGs nesta pasta do vault.

---

## D-19 — Público: salões de beleza, barbearias e estética

**Data:** 2026-10-17
**Decisão:** a LP deixa de falar só com barbearia e passa a falar com **salões de beleza, barbearias e clínicas de estética**. "Barbearia" vira "salão, barbearia ou clínica" ou "seu negócio"; "barbeiro" vira "profissional"; no simulador, "cadeira" vira "profissional" (valores iniciais: 8 atendimentos/dia e R$ 90 de ticket). Segmentos: Profissional autônomo / Equipe de profissionais / Rede de unidades / Abrindo o negócio. Texto em PT, EN e ES.
**Contexto:** Willians pediu primeiro para trocar barbearia por "salão de beleza e estética em geral" e, logo depois, corrigiu: "não quero deixar barbearia pra trás". A primeira versão (só beleza e estética, commit `6d083ee`) foi substituída antes de ir ao ar.
**Prova social:** o depoimento do Thieco Leandro e as +8.500 vendas continuam, apresentados como o que são: o sistema nasceu numa barbearia de verdade e "agora a mesma base chega também a salões de beleza e clínicas de estética". Nenhum caso de salão ou clínica foi inventado.
**Alternativa descartada:** remover a prova social até existir um caso de salão. Descartada por escolha do Willians (manter, reenquadrada).
**Impacto:** o PRD §3–§8 passa a valer para os três nichos. Os módulos continuam os mesmos do sistema: nenhuma funcionalidade nova (pacotes, sessões) foi prometida.

---

## D-20 — Nome comercial: TeloVis Pro

**Data:** 2026-10-17
**Decisão:** a marca da LP passa de **TL Barber** para **TeloVis Pro** (com V maiúsculo, como o Willians escreveu), com a tagline "Gestão para Salões, Barbearias e Estética". Houve um nome intermediário, **Telovis Beauty**, que durou um commit e nunca foi publicado.
**Contexto:** Telovis Beauty soava feminino demais para incluir barbearia (D-19). Willians escolheu TeloVis Pro.
**Escopo:** como em D-12, só a marca comercial muda. Repositório, pastas, chave de idioma (`tlbarber_lang`) e estes arquivos continuam `telovis-barber-landing`.
**Impacto:** substitui D-12.

---

## D-21 — Logo: pincel na haste e navalha fechada na base do L

**Data:** 2026-10-17
**Decisão:** o T dourado original fica. A navalha aberta que formava o L sai, e no lugar entram um **pincel** (haste do L, inclinado como a navalha antiga) e uma **navalha fechada deitada** (base do L, com a ponta curva da lâmina à direita, como no logo antigo). O pincel lê tanto como pincel de barba quanto de maquiagem; a navalha mantém a barbearia.
**Como foi feito:** o T foi recortado do PNG antigo pela cor dourada (o pé direito da serifa, que ficava escondido sob a navalha, foi espelhado do esquerdo). Pincel e navalha foram desenhados em SVG por cima e renderizados no Edge headless em 720×706 com fundo transparente. Do mesmo render saem `public/assets/tl-logo.png`, `favicon.png` (64), `apple-touch-icon.png` (180) e `public/favicon.ico`.
**Caminho até aqui:** (1) pincel com uma pincelada dourada na base (commit `8e24d5d`); (2) pedido do Willians: "a haste na horizontal pode ser a navalha fechada" (`e0b9eab`). Alternativas consideradas e não usadas: conta-gotas, ramo/folha, tesoura, um logo por nicho.
**Impacto/gap:** é uma versão funcional para a LP, não a identidade definitiva. O SVG-fonte do pincel e da navalha ficou num arquivo temporário da sessão; para refinar com designer, partir do PNG atual. Substitui D-15 só na parte da logo (paleta e fontes continuam).

---

## D-22 — Rodapé com o CNPJ da TeloVis Tech

**Data:** 2026-10-17
**Decisão:** rodapé em PT/EN/ES: "© 2026 TeloVis Pro. Um produto **TeloVis Tech** · CNPJ 51.960.551/0001-38 · Desenvolvido por Willians Santana." "TeloVis Tech" é link para https://telovistech.com.
**Contexto:** "esse produto pertence à TeloVis Tech, que já tem um CNPJ atribuído na LP da TeloVis Tech". CNPJ lido de `telovis-tech-landing/src/lib/campaign/site.ts`; mesmo padrão do rodapé de lá (só CNPJ, sem razão social). Ver [[../arquitetura-telovis-tech-landing/registro-de-decisoes-telovis-tech-landing|Telovis Tech Landing, D-20]].
**Impacto:** a LP não tem política de privacidade própria nem pixels; se ganhar analytics, vai precisar da política, como na LP da TeloVis Tech.

---

## D-23 — Hospedagem na Lovable, domínio telovispro.com

**Data:** 2026-10-17
**Decisão:** a LP sai da VPS (`kernellwc.online/vendas/`, D-07/D-11) e passa a ser publicada pela **Lovable** em **https://telovispro.com**, igual à LP da TeloVis Tech.
**Como ficou:**
- Projeto Lovable `0b8ffaca-8f5b-4b8d-a353-2aea2557060c`, repositório sincronizado `willianslegacy94-zion/telovis-pro-canvas` (privado). O repo `telovis-barber-landing` tem o mesmo histórico; remotes `lovable` e `origin`, push para os dois, depois **Publicar → Update** na Lovable.
- DNS na Cloudflare: `@` e `www` em registro A para `185.158.133.1` (IP da Lovable) + TXT `_lovable`, como o `telovistech.com`.
- A Lovable não vincula repositório existente (sempre cria um novo), e o projeto nasce com o template **TanStack Start** (build Nitro → Cloudflare). O template foi mantido intacto e a LP entrou nele sem virar React: `src/landing/page.html` (corpo), `main.js`, `i18n.js`, `landing.css`; a rota `src/routes/index.tsx` injeta o HTML no SSR, põe meta, canonical, og e fontes no `head` e importa o `main.js` no navegador depois da hidratação. Imagens em `public/assets/`.
- O CSS do template (Tailwind) só carrega nas telas de 404/erro: o preflight e as variáveis `:root` dele colidiriam com `landing.css`.
- Os dois históricos foram unidos por merge (`--allow-unrelated-histories`), sem force push, como pede o `AGENTS.md` da Lovable.
**Alternativas descartadas:** (1) importar ZIP na Lovable ("Upload code"): a documentação diz que ela "reconstrói o app", o que poderia reescrever a LP; (2) trocar o template por um Vite simples (chegou a ser preparado, commit `674437c`): arriscava quebrar o "Publicar" da Lovable, que depende do template; (3) seguir na VPS: o acesso SSH da IA foi recusado (`Permission denied (publickey,password)`), e o Willians preferiu o mesmo caminho da LP da TeloVis Tech.
**Impacto:** D-07 e D-11 deixam de valer. **Não rodar mais `git pull` em `/var/www/telovis-barber-landing`**: sem `index.html` na raiz, `/vendas/` sairia do ar. A VPS ainda serve a v1 (Telovis Barber) em `/vendas/` até alguém desligar ou redirecionar para `telovispro.com`. Verificado: `telovispro.com` responde 200 com o título novo. Gap: o `vite preview` desse template não roda no Windows, então o build de produção só foi validado pela própria Lovable.

---

## D-24 — Artes de divulgação TeloVis Pro

**Data:** 2026-10-17
**Decisão:** as artes de D-18 foram refeitas para TeloVis Pro, com a mesma construção: **prospecção 1080×1620** ([[telovis-pro-prospeccao.png]]) e **status 1080×1920** ([[telovis-pro-status.png]]). Logo novo, "Seu negócio no controle de verdade!" / "Seu negócio, seu sistema.", público salões + barbearias + estética, site `telovispro.com`, QR para `wa.me/5511954079335` com "Olá! Vi a divulgação do TeloVis Pro e quero falar sobre o meu negócio."
**Telas fictícias:** misturam os três nichos (coloração, escova, corte + barba, manicure, limpeza de pele; profissionais Carla, Rafael, Ana e Juliana; "Seu Espaço"). Mesma regra de nunca usar print real.
**Gap:** desta vez o QR **não** foi conferido por decodificação (sem leitor de QR no ambiente). Conferir com a câmera antes de disparar.
**Onde ficam:** `telovis-barber-landing/divulgacao/` (fora do git; fonte em `fonte/arte.html`). As artes antigas do TL Barber foram para `divulgacao/antigo/`. Cópia dos PNGs nesta pasta do vault. Substitui D-18.
