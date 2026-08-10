---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# PRD — Kernel Foodservice

> Este PRD é **reconstruído a partir do código**, não capturado num kickoff. O sistema já estava implementado quando esta documentação foi criada (2026-08-10). Tudo aqui rastreia a um arquivo, comentário ou schema real — o que não rastreia está marcado explicitamente como lacuna. Ver [[system-creation-kernel-foodservice]].

---

## 1. Contexto

Existem hoje três sistemas de foodservice separados no workspace, cada um com código próprio e banco próprio: `vilamill-sistema` (VillaMill Tamboré, em produção), `lanchonete-sistema` (Jocley Grill) e agora o Kernel Foodservice. O Jocley Grill é o mais recente e o mais completo dos dois primeiros — PDV mesa+balcão, CMV por ficha técnica, KDS, inteligência financeira, gestão de time — mas é **single-tenant por construção**: o nome do negócio vive numa constante (`NOME_LANCHONETE = "Jocley Grill"`), o cardápio de seed é o cardápio real do cliente, e cada novo cliente significaria um novo fork do repositório.

O ecossistema já tem um precedente resolvido do mesmo problema no domínio de serviços: o produto **Kernel** ([[arquitetura-kernel]]) generalizou o `sistema-thieco` (barbearia) num SaaS multi-tenant real, com `tenant_id` no banco, branding e feature flags em JSONB resolvidas em runtime. O Kernel Foodservice aplica o mesmo movimento ao domínio de foodservice, partindo do Jocley Grill.

## 2. Problema

**Dor específica:** o produto de gestão de foodservice do portfólio só escala copiando o repositório.

**Como se manifesta (evidenciado no `lanchonete-sistema`):**
- Nome do negócio hardcoded em `src/lib/constants.ts` — mudar de cliente exige mudar código e rebuildar
- Nenhuma tabela tem coluna de tenant: um banco por cliente, um container por cliente, uma migration por cliente
- Todo cliente recebe **todos** os módulos, mesmo os que não usa — um restaurante só-balcão carrega a tela de Mesas; um cardápio sem ficha técnica carrega CMV e Estoque vazios
- Criar o primeiro usuário de um cliente novo exige rodar seed manualmente no servidor, não existe tela pra isso
- Cada correção de bug precisa ser portada N vezes, uma por fork

**Por que ainda não foi resolvida:** o Jocley Grill nasceu como sistema de um cliente específico, não como produto. Multi-tenancy não era requisito no PRD original ([[prd-jocley-lanchonete]] lista "Multi-unidade (mais de uma loja Jocley Grill)" explicitamente **fora** de escopo).

## 3. Objetivo

Após o sistema existir:

- Um restaurante novo entra no ar sem tocar em código: o super-admin abre `/admin`, preenche nome, slug, cor primária e e-mail do administrador, marca os módulos contratados e recebe uma senha temporária pra entregar ao cliente
- O tenant recém-criado já nasce operável — 12 mesas, 6 taxas por forma de pagamento e as 4 configurações de notificação são semeadas na mesma transação de cadastro
- Cada tenant vê só os módulos que contratou; um módulo desligado some da navegação **e** devolve 404 na API, sem revelar que existe
- Nenhum tenant enxerga dado de outro: toda query de negócio é escopada pelo `tenantId` da sessão, resolvido no login
- O mesmo deployment (uma imagem, um banco) atende todos os clientes — correção de bug é feita uma vez

## 4. Usuário

**Dois públicos, dois sistemas de autenticação distintos:**

| Público | Onde opera | Como autentica |
|---|---|---|
| **Super-admin** (operador da plataforma) | `/admin` — cadastro de tenants, listagem/edição, criação e reset de senha de usuários de qualquer tenant, leitura dos logs de erro globais | Cookie HMAC próprio (`kernel_admin_session`, 8h), tabela `SuperAdmin`, **fora** do NextAuth |
| **Equipe do restaurante** (5 papéis) | app de tenant — ADMIN, SUPERVISOR, CAIXA, ATENDENTE, COZINHA | NextAuth v5 Credentials, JWT com `tenantId` + `features` embutidos |

Os 5 papéis do tenant são herdados do Jocley Grill sem alteração de semântica — a descrição de cada um está em [[prd-jocley-lanchonete]] §4. A diferença aqui: além do papel, o acesso passa por um segundo filtro, o conjunto de módulos que o tenant contratou.

**Lacuna:** quem é o super-admin na vida real (Willians? um sócio? uma equipe comercial?) e para qual cliente o produto está sendo construído **não estão documentados no código** — o único tenant é `demo`. Ver [[system-creation-kernel-foodservice]] pergunta 2.

## 5. Hipótese de solução

Manter **integralmente** o domínio de foodservice já validado no Jocley Grill (PDV mesa/balcão, CMV por ficha técnica com rendimento, dedução de estoque no fechamento, KDS, DRE, gestão de time) e adicionar por baixo três camadas novas:

1. **Isolamento** — `tenantId` em toda tabela de negócio, resolvido do usuário logado, nunca da URL
2. **Modulação** — `Tenant.features` (JSONB) com um único módulo core (`cardapio`) e 8 opcionais, aplicado em três pontos: sidebar, guard de página e guard de API
3. **Onboarding** — painel super-admin isolado do app de tenant, com autenticação própria

**Por que faz sentido:** o Kernel ([[arquitetura-kernel]]) já provou os três padrões em produção no domínio de serviços — `tenant_id` no banco, `features` em JSONB no JWT, `FeatureGate` na UI. O que muda aqui é a stack (Next.js + Prisma em vez de Express + React), não o desenho.

**Risco central identificado no código:** o e-mail de login é único **globalmente**, não por tenant (`User.email @unique`, sem chave composta com `tenantId`). O próprio schema documenta a consequência: dois tenants não podem ambos ter um usuário chamado "admin" — o onboarding precisa usar `admin@nome-do-cliente`. Isso é uma decisão deliberada (o tenant é resolvido a partir do usuário, sem slug na URL), mas é uma restrição de produto que vaza pro cliente final.

## 6. Escopo

**Dentro (implementado e verificado no código):**
- Painel super-admin `/admin`: login/logout, CRUD de tenants com toggle de 8 módulos, branding (nome + cor primária), criação de usuário em qualquer tenant, reset de senha, leitura de logs de erro
- Semeadura automática da base de um tenant novo (`seedTenantBase`, idempotente)
- Autenticação de tenant com `tenantId`, `tenantNome` e `features` resolvidos no login e congelados no JWT
- Motor de features: 1 core (`cardapio`) + 8 opcionais (`mesas`, `balcao`, `cmv`, `estoque`, `inteligenciaFinanceira`, `gestaoDeTime`, `notificacoesWhatsapp`, `taxasDelivery`)
- Branding por tenant: cor primária injetada como CSS custom property no layout do tenant
- Todo o domínio herdado do Jocley Grill (PDV, CMV, estoque, KDS, despesas, lançamentos, inteligência financeira/DRE, gestão de time, usuários, configurações)
- Notificações WhatsApp com agendador em processo, varrendo **todos** os tenants a cada 60s
- Log de erro centralizado com `tenantId` opcional

**Fora (por evidência de ausência no código):**
- Cardápio digital, integração com maquininha, integração com delivery (herdados como "fora" do Jocley)
- Categorias de cardápio por tenant — `CATEGORIAS_CARDAPIO` é uma constante global de 7 categorias genéricas, com comentário marcando personalização por tenant como "trabalho futuro, fora do escopo desta v1"
- Slug na URL — `Tenant.slug` existe mas o comentário do schema diz "usado só no painel super-admin e em URLs futuras — nunca aparece na tela de login do tenant"
- Instância de WhatsApp por tenant — a Evolution API é configurada por variável de ambiente **global** (ver risco em [[arquitetura-kernel-foodservice]] §7)
- Cobrança/billing/planos — não há nenhuma entidade de assinatura, plano ou fatura no schema
- Testes automatizados — nenhum

## 7. Métrica de sucesso

Nenhuma métrica está declarada no repositório. As abaixo derivam diretamente do objetivo declarado em §3 e devem ser **confirmadas pelo Willians** antes de virarem compromisso:

| Métrica | Referência atual | Meta proposta |
|---|---|---|
| Tempo de onboarding de um restaurante novo | fork do repo + seed manual (horas) | < 5 minutos pelo painel `/admin` |
| Vazamento de dado entre tenants | n/a (sistema nunca rodou) | zero — toda rota de negócio escopada por `tenantId` |
| Módulos desligados invisíveis ao tenant | n/a | 100% — nem na navegação, nem na API (404) |
| Deployments a manter por cliente | 1 por cliente | 1 total |

## 8. Requisitos de alto nível

**Funcionais:** detalhados em [[requisitos-funcionais-kernel-foodservice]].

**Não funcionais (evidenciados no código):**
- Isolamento por tenant obrigatório em toda rota de negócio — `requireTenantId()` ou filtro explícito por `session.user.tenantId`
- Módulo desligado responde 404, nunca 403 — não revelar existência de funcionalidade não contratada
- Cookies de sessão com prefixo próprio (`kernelfs.*`) — o default `authjs.*` colide entre apps Next.js rodando em portas diferentes de `localhost` no mesmo workspace
- Painel super-admin fora do route group `(tenant)` — nunca herda a casca do app de tenant (bug real corrigido em 2026-08-09, registrado em comentário no layout)
- Snapshot de preço/custo no momento da venda (`OrderItem.precoUnit`/`custoUnit`) — herdado do Jocley
- Falha de notificação num tenant nunca impede os demais

---

## Links relacionados

[[indice-kernel-foodservice]] — mapa de todos os artefatos do sistema
[[system-creation-kernel-foodservice]] — threshold respondido e lacunas conhecidas
[[arquitetura-kernel-foodservice]] — como a multi-tenancy é implementada
[[prd-jocley-lanchonete]] — PRD do sistema de origem, onde o domínio de foodservice foi definido
