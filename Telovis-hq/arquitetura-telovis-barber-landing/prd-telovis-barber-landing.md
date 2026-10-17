---
status: stable
domain: telovis-barber-landing
source: claude
created: 2026-09-16
updated: 2026-10-17
owner: willians
---

# PRD — TeloVis Pro Landing (repo `telovis-barber-landing`)

> **v3 (2026-10-17):** a LP virou **TeloVis Pro** e passou a falar com **salões de beleza, barbearias e clínicas de estética**, com logo novo (pincel + navalha fechada), CNPJ da TeloVis Tech no rodapé e publicação pela Lovable em **https://telovispro.com** (D-19 a D-24). A construção da v2 (órbita, segmentos, módulos, simulador, formulário → WhatsApp) continua.
>
> **v2 (2026-10-14):** a LP virou **TL Barber**, em tema claro com a paleta do próprio sistema e a logo oficial, seguindo a construção da LP da Telovis Tech (D-12 a D-17). As seções 1 e 2 descrevem o problema original da v1 (setembro) e ficam como histórico. Objetivo, escopo, métricas e requisitos (3, 6, 7 e 8) refletem a v3.

## 1. Contexto

O Telovis Barber (produto SaaS whitelabel de gestão de caixa/comissões para barbearias, ver [[../arquitetura-telovis-barber/indice-telovis-barber|arquitetura-telovis-barber]]) precisa de uma página de vendas própria, separada do app — o domínio raiz `kernellwc.online` serve o produto logado (rotas `/t/<slug>`, `/admin`), não uma vitrine para quem ainda não é cliente. Existia uma pasta `telovis-barber-landing/` já versionada (repo próprio no GitHub, então chamada `orbita-barber-landing`), criada como primeira tentativa de LP, mas com marca antiga ("Órbita Barber") e com preços fixos publicados (R$ 149 / R$ 299 / R$ 499).

## 2. Problema

**Dor específica:** a LP existente publicava valores numéricos fixos por plano, mas a precificação real do Telovis Barber é sob consulta (varia por número de unidades e funcionalidades ativas) — o texto da própria página já dizia isso ("valores configurados conforme as funcionalidades ativas"), então os números fixos contradiziam a promessa ao lado deles e podiam confundir o cliente quanto à precificação real do sistema.

**Como se manifesta:**
- Preço fixo por plano (R$ 149/299/499) sem refletir a política real de proposta sob medida
- Estrutura mais fraca que concorrentes diretos do mercado de gestão para barbearia/salão (Trinks, BarberCode) — sem prova social quantificada, sem FAQ, sem seção de diferenciais, sem menção a suporte humano/mentoria
- Marca desatualizada ("Órbita Barber") — o restante do ecossistema (repo, domínio, produto) já usa "Telovis Barber"

**Por que ainda não foi resolvida:** a LP nasceu como primeira versão rápida ("pasta nova, ainda não versionada" — ver `telovis-barber/BACKLOG.md`, pendência de 2026-08-14) e nunca tinha sido revisada com benchmarking de concorrentes nem tinha canal de deploy definido.

## 3. Objetivo

**v3 (atual):**
- Marca **TeloVis Pro** em toda a página, logo com T dourado + pincel + navalha fechada (D-21) e assinatura "Um produto TeloVis Tech · CNPJ 51.960.551/0001-38"
- Público ampliado sem abandonar a barbearia: salões de beleza, barbearias e clínicas de estética; texto em PT, EN e ES
- Simulador por profissional (antes, por cadeira); formulário pede "salão, barbearia ou clínica"
- No ar em **https://telovispro.com** pela Lovable

**v2 (2026-10-14, histórico):**
- Marca **TL Barber** consistente em toda a página, com a logo oficial (T dourado + navalha formando o L) e assinatura "Um produto Telovis Tech"
- Visual coerente com o produto: paleta clara de fábrica do sistema (creme + dourado + ônix) e as mesmas fontes (Playfair Display + Inter) — quem conhece a LP reconhece o sistema ao entrar
- Construção da LP da Telovis Tech: hero com órbita, texto adaptado ao momento da barbearia (solo / equipe / rede / abrindo), módulos com filtro, simulador e formulário
- Nenhum preço do sistema publicado (D-01 mantida) — todo CTA leva para conversa no WhatsApp
- Implantação (José Alef) e mentoria (Thieco Leandro) mantidas como diferencial, agora dentro do "Como funciona"
- Publicação no domínio novo, ainda a definir (resolvido na v3: `telovispro.com`)

**v1 (2026-09-16, histórico):** remoção dos preços, estrutura Trinks/BarberCode com planos e FAQ, rebrand Órbita → Telovis Barber, publicada em `/vendas/`.

## 4. Usuário

**Quem (v3):** dono ou gestor de salão de beleza, barbearia ou clínica de estética, ou profissional autônomo do setor, pesquisando sistema de gestão. **Na v1/v2:** dono ou gestor de barbearia pesquisando sistema de gestão — geralmente já comparando com Trinks, BarberCode ou outro concorrente genérico, chegando via link de WhatsApp/Instagram ou busca.

**Estado no uso:** visitante frio a morno, decidindo se vale a pena iniciar uma conversa comercial. Não é usuário logado do produto.

**Contexto:** acesso majoritariamente mobile, via link compartilhado (WhatsApp/Instagram) — a página precisa comunicar valor e credibilidade sem exigir leitura de tabela de preço.

## 5. Hipótese de solução

Uma landing estática (sem backend, sem CMS) que segue a estrutura de conversão dos concorrentes fortes do setor (prova social cedo, funcionalidades por nível em vez de preço, FAQ, CTA sempre para WhatsApp), mas comunica dois diferenciais que um sistema genérico não tem: (1) o sistema nasceu dentro de uma barbearia real e (2) o cliente recebe treinamento e mentoria de crescimento de gente que já opera o negócio — não é só um SaaS auto-serviço.

**Risco central:** sem preço nenhum publicado, parte do tráfego frio pode abandonar a página em vez de iniciar conversa. Na v1 isso era mitigado por CTA de WhatsApp em vários pontos e pela resposta explícita no FAQ. **Na v2 o FAQ saiu** (D-14): a mitigação ficou só nos CTAs, na promessa "proposta sob medida em até 24h" e no simulador, que inicia a conversa já com um número do visitante. Avaliar trazer o FAQ de volta.

## 6. Escopo

**Dentro (v3):**
- Página única (`src/landing/page.html`): header com seletor PT/EN/ES, hero com órbita, faixa de momentos do negócio, benefícios /01–/03, "Como funciona" (escuta → implantação → mentoria), 6 módulos com filtro Gestão/IA, prova (Thieco Leandro + "+8.500 vendas"), simulador de faturamento por profissional, contato com formulário, rodapé com CNPJ
- CSS custom com a paleta clara do sistema; JS vanilla (idioma com `?lang=`, segmento com `?segmento=`, filtro de módulos, simulador, formulário → WhatsApp)
- Logo e favicons em `public/assets/`
- Todo CTA de conversão aponta para `wa.me`: (11) 95407-9335 e (11) 95344-5647
- Publicação pela Lovable (template TanStack Start) em `telovispro.com`

**Fora:**
- Armazenamento de lead — o formulário só monta a mensagem e abre o WhatsApp (backlog: B-10 em `BACKLOG.md`)
- Planos em níveis e FAQ (saíram na v2, D-14)
- Recomendador por IA e área privada da LP da Telovis (dependem de backend)
- Screenshots reais do produto (backlog: B-05)
- Analytics/pixel de conversão (gap conhecido, ver seção 7)
- CMS ou geração de conteúdo dinâmico — página é HTML estático versionado no Git

## 7. Métrica de sucesso

| Métrica | Referência atual | Meta |
|---|---|---|
| Preços do sistema publicados | 0 (desde a v1) | 0 — os R$ do simulador são do faturamento do visitante, não preço |
| Cliques em CTA / envios do formulário para o WhatsApp | não instrumentado | instrumentar (gap conhecido — sem GA/Meta Pixel ainda) |
| Conversas iniciadas pelo simulador | não instrumentado | medir quando houver analytics (a mensagem leva o resultado, dá para contar no WhatsApp manualmente) |
| Prova social | depoimento do Thieco + "+8.500 vendas desde 2024" | só prova verificável — nenhum depoimento não confirmado |

**Gap conhecido:** não há pixel/analytics de conversão instalado — não é possível medir taxa de clique em CTA nem origem de tráfego até essa instrumentação ser adicionada.

## 8. Requisitos de alto nível

**Funcionais (v3):**
- Nenhum preço do sistema publicado; o único R$ na página é o resultado do simulador
- Todo CTA leva para `wa.me` pré-preenchido; CTA principal e botão do formulário: "Quero falar sobre o meu negócio"
- Segmento escolhido troca o hero e o título do contato, e fica na URL (`?segmento=solo|equipe|rede|abrindo`)
- Idioma PT/EN/ES, escolhido por `?lang=`, pela escolha salva ou pelo idioma do navegador
- Filtro de módulos (Todos / Gestão / Inteligência Artificial) com contagem
- Simulador: faturamento por profissional = atendimentos × ticket × dias; comissão e "fica para a casa"; valida valores negativos e comissão > 100%; nada é salvo
- Formulário valida nome, salão/barbearia/clínica e consentimento antes de abrir o WhatsApp
- Nav com âncoras: A solução, Como funciona, Módulos, Simulador

**Não funcionais:**
- SSR entrega o HTML completo em PT com meta, canonical e og; o JS só adiciona comportamento
- Responsivo (breakpoints em 1100px, 860px, 760px e 360px), sem rolagem lateral em 390px
- `prefers-reduced-motion` desliga as animações (órbita, cards)
- Deploy sem downtime: push para o repositório da Lovable + **Publicar → Update** (ver [[arquitetura-telovis-barber-landing]])
