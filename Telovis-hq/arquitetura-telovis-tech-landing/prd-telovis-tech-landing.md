---
status: stable
domain: telovis-tech-landing
source: claude
created: 2026-10-14
updated: 2026-10-15
owner: willians
---

# PRD — Telovis Tech Landing

## 1. Contexto

A Telovis Tech vende **sistemas sob medida** e **agentes de IA** ("Sistema Sob Medida e Funcionário Digital") para negócios que já cresceram demais para planilhas e softwares de prateleira. Cada produto tinha sua própria página ou nenhuma — o Telovis Barber tem LP de vendas própria ([[../arquitetura-telovis-barber-landing/indice-telovis-barber-landing|telovis-barber-landing]]) —, mas não existia uma página institucional da **empresa** mostrando o portfólio inteiro.

Havia uma versão estática anterior (`cerne-sistemas.html` → "Kernel Sistemas", depois rebatizada `Telovis-Tech-sistemas.html`), e em paralelo uma versão mais completa construída no Lovable, com vitrine de projetos, variantes por público e captação de leads. Em 2026-10-14 a versão do Lovable foi adotada como oficial.

## 2. Problema

- Prospects recebiam links soltos de cada sistema, sem uma visão do que a Telovis Tech já entregou.
- Prints reais dos sistemas não podem ser publicados: expõem nomes de clientes, alunos, chaves PIX e valores.
- Sem canal estruturado de lead — contato só por WhatsApp, sem registro do que o visitante precisava.

## 3. Objetivo

- Uma página que apresente a Telovis Tech e prove capacidade com **projetos reais**, sem expor dados de clientes.
- Mostrar os sistemas como o cliente vai usá-los: **computador + celular**.
- Converter visitante em conversa: botão "Falar sobre o meu negócio", WhatsApp e formulário de lead.
- Mesma página reaproveitável por público (empresas, serviços, varejo, startups) via link próprio.

## 4. Usuário

**Quem:** dono ou gestor de pequena/média empresa (restaurante, academia, frota, serviços, comércio) avaliando um sistema próprio ou automação de atendimento.
**Chegada:** link enviado no WhatsApp, status, Instagram ou indicação — majoritariamente mobile.
**Estado:** frio a morno; quer ver "algo parecido com o meu negócio" antes de conversar.

## 5. Hipótese de solução

Vitrine de projetos reais com telas **recriadas com dados fictícios** (mesma interface, nenhum dado de cliente), página de detalhe por projeto (problema → funcionalidades → entregas → telas), recomendador por IA que aponta projetos parecidos com a necessidade descrita, e CTA constante para conversa.

**Risco:** telas ilustrativas podem ser lidas como prints reais → mitigado com o selo "Tela ilustrativa · dados fictícios" em cada preview e nota na galeria.

## 6. Escopo

**Dentro:**
- Hero com órbita animada e variantes `?segmento=empresas|servicos|varejo|startups`
- Vitrine com 8 projetos: 6 sistemas (CT Sandro Freire, Gestão de Frota, Jocley Grill, Villa Mill Tamboré, Gestão de Manicure, Lane Confeitaria) + 2 agentes de IA agrupados (TeloVis Brainiac, TeloVis Kalel)
- Página `/projetos/<slug>` com galeria "Telas do sistema"
- Simulador de CMV e camadas de acesso para restaurantes
- "Encontre o projeto ideal" (recomendação por IA, limitada ao catálogo)
- Formulário de lead + painel privado `/painel` (login Google, allowlist)
- Artes de divulgação (status 1080×1920 e post 1080×1350) em `divulgacao/`

**Fora:**
- Telovis Barber / sistema de barbearias → vai para a LP do TL Barber (D-08)
- Preços — proposta sempre sob conversa
- Depoimentos, logos de clientes e métricas de desempenho sem autorização/evidência
- Pixels ativos: estrutura com consentimento LGPD e política de privacidade já no ar (D-19, D-20), aguardando só os IDs das plataformas

## 7. Métrica de sucesso

| Métrica | Referência | Meta |
|---|---|---|
| Leads pelo formulário (`campaign_leads`) | 0 (não publicada) | medir após publicação |
| Cliques em WhatsApp | não instrumentado | evento "contato" pronto (D-19); medir após publicar os pixels |
| Projetos com telas ilustrativas | 0 | todos os sistemas com print disponível (hoje 5 de 6: CT, Frota, Jocley, Villa Mill + Manicure/Lane pendentes) |
| Dados reais de cliente expostos | — | 0 |

## 8. Requisitos de alto nível

**Funcionais**
- Todo CTA principal leva ao formulário/WhatsApp com o texto **"Falar sobre o meu negócio"** (no topo, em telas pequenas, versão curta "Falar")
- Catálogo único em `src/lib/campaign/projects.ts` alimenta vitrine, detalhe e recomendador
- Recomendador só cita projetos do catálogo e exige ação explícita do visitante
- Lead público é insert-only; leitura só no painel autenticado
- Título e descrição de busca focam em funcionário digital com IA no WhatsApp; o cartão de compartilhamento usa "Sistemas sob medida para o seu negócio" (D-17)
- Nenhum pixel sem consentimento explícito e política de privacidade publicada (D-19)

**Não-funcionais**
- Nenhum print real nem dado de cliente em `public/`; telas sempre recriadas com dados fictícios
- Página funcional em 360px+ sem rolagem horizontal
- Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) só no servidor, nunca no `.env` versionado (que guarda só as chaves públicas)
