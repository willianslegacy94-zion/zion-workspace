---
status: stable
domain: kernel
source: claude
created: 2026-06-24
updated: 2026-08-27
owner: willians
---

# Arquitetura — Sistema Whitelabel (produto: Kernel)

> Referência: [[prd-kernel]] | [[modelo-de-dados-kernel]]

---

## Stack de decisão

| Camada | Tecnologia | Motivo |
|---|---|---|
| Runtime backend | Node.js 18 | Ecossistema maduro, baixo overhead, async nativo |
| Framework web | Express.js | Minimalista, sem magia, rota por rota explícita |
| Banco de dados | PostgreSQL 16 (Supabase gerenciado, ou local via Docker em dev) | ACID, bom suporte a cálculos financeiros, sem surpresas; Supabase = 1 banco compartilhado entre tenants, sem manter infra própria por cliente |
| Frontend | React 18 + Vite | SPA de alta produtividade, build rápido, hot reload |
| Estilização | Tailwind CSS | Utility-first, tokens CSS custom vars para theming por tenant |
| Container | Docker Compose | Deploy reproduzível, isolamento de dependências |
| Proxy reverso | Nginx | TLS termination, cache-control de assets, roteamento /api vs / |
| Autenticação | JWT (jsonwebtoken) | Stateless, carrega role + profissional_id + percentual_comissao no token |
| Email | Nodemailer + SMTP | Recuperação de senha — provider configurável via env var |

---

## Camadas do sistema

> Desde 2026-07-10 (ver [[registro-de-decisoes-kernel]]) o sistema é
> **multi-tenant real**: 1 deployment atende N clientes, isolados por `tenant_id`
> no banco. Branding e feature flags saíram do build-time (`.env`/`VITE_*`) e
> passaram a viver em `tenants.branding`/`tenants.features` (JSONB), resolvidos
> em runtime a partir do login e da URL `/t/:slug`.

```
┌─────────────────────────────────────────────────────────┐
│         RESOLUÇÃO DE TENANT (runtime, não build-time)   │
│   URL /t/:slug → GET /public/tenants/:slug (sem auth)    │
│   → branding (tenants.branding). Login (POST /auth/login │
│   com slug+username+senha) → JWT com tenant_id+features  │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│                   FRONTEND (React/Vite)                 │
│                                                         │
│  contexts/TenantConfigContext.jsx → resolve slug da URL,│
│    busca branding, expõe useTenantConfig()               │
│  config/labels.js → VITE_NICHO / VITE_LABEL_* (segue    │
│    build-time — fora do escopo desta migração)           │
│                                                         │
│  pages/  → telas principais                             │
│  hooks/  → lógica de estado e chamadas de API           │
│  components/ → componentes reutilizáveis                │
│  components/FeatureGate.jsx → oculta UI conforme         │
│    useAuth().user.features (JWT), não mais módulo estático│
│                                                         │
│  AdminApp.jsx → árvore SEPARADA, montada por main.jsx    │
│    quando pathname começa com /admin (não passa por      │
│    TenantConfigProvider nem pelo Login de tenant — não é │
│    tenant nenhum). Desde 2026-08-02, ver seção            │
│    "Painel Admin de Onboarding" abaixo.                   │
│  contexts/AdminAuthContext.jsx → token próprio            │
│    (localStorage key própria, nunca colide com o token   │
│    de tenant)                                            │
│  pages/admin/ → AdminLogin, AdminTenantsList,             │
│    AdminTenantForm                                        │
└─────────────────────────────────────────────────────────┘
                          │
                    Nginx /api proxy
                          │
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (Express)                     │
│                                                         │
│  middleware/auth.js        → JWT verify + req.user       │
│    (global desde server.js, exceto /auth e /public)      │
│  middleware/featureGate.js → 404 se req.user.features[x] │
│    for false (por tenant, não mais por processo)         │
│  middleware/requireAdmin.js → 403 se não for admin       │
│                                                         │
│  routes/public.js           → branding sem autenticação │
│    (+ unidades do tenant, desde 2026-07-13)              │
│  routes/agendamentos-publico.js → autoagendamento +      │
│    confirmação de presença, SEM auth (resolve tenant      │
│    pelo slug na URL — montada antes do authenticate)      │
│  routes/vendas.js          → CRUD de vendas             │
│  routes/gastos.js          → CRUD de gastos             │
│  routes/catalogo.js        → catálogo + estoque         │
│  routes/profissionais.js   → gestão de colaboradores    │
│  routes/combos.js          → combos V2 — créditos JSONB│
│  routes/clientes.js        → cadastro de clientes       │
│  routes/metas.js           → metas individuais          │
│  routes/metas-unidade.js   → metas por unidade          │
│  routes/metas-diarias.js   → metas diárias da casa      │
│  routes/relatorios.js      → fluxo-caixa, DRE, comissoes│
│  routes/painel-barbeiro.js → painel do colaborador      │
│  routes/gestao.js          → PDCA, feedbacks, sugestões │
│  routes/auth.js            → login (slug+user+senha),    │
│    esqueci-senha (slug+email)                            │
│  routes/import.js          → importação em lote (admin) │
│  routes/agendamentos.js    → agenda interna (admin/      │
│    operador/barbeiro) — CRUD + jornada de funcionamento  │
│  routes/campanhas.js       → segmentação + disparo       │
│    manual de campanhas de marketing                      │
│  routes/notificacoes.js    → gerado de alertas + gatilhos│
│    automáticos (aniversário, cliente sumido, pós-venda,  │
│    lembrete de agendamento) + fila WhatsApp/e-mail;       │
│    desde 2026-08-03 também gera avaliação a partir de um  │
│    agendamento específico (gatilho automático/manual)     │
│  routes/admin.js           → CRUD de tenant (Painel       │
│    Admin de Onboarding, desde 2026-08-02) — auth própria  │
│    (authenticateAdmin), montada fora da fronteira do      │
│    authenticate global, mesmo grupo de /public/           │
│    /agendamentos-publico//internal                        │
│                                                         │
│  models.js → queries SQL, tenant_id como 1º arg em      │
│    toda função de todo modelo                            │
│  db.js     → pg pool + runMigrations() + SSL (Supabase) │
│  config/features.js → CORE_FEATURES + resolveFeatures() │
│    (mescla tenants.features com o core sempre-true)       │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL 16 — Supabase (gerenciado)            │
│         ou local via Docker (dev)                        │
│                                                         │
│  Migrations auto-aplicadas no startup (runMigrations)   │
│  tabela `tenants` (slug, nome, features, branding)       │
│  `tenant_id` em toda tabela de negócio                   │
│  Seed do tenant + admin padrão via TENANT_PADRAO*/        │
│    ADMIN_USERNAME* do .env (bootstrap, 1x)                │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de dados — registro de venda

```
1. Colaborador preenche RegistroVenda.jsx
2. Frontend calcula ganho estimado (percentual_comissao do JWT) — visual apenas
3. POST /api/vendas com { servico, valor, desconto, forma_pagamento, tipo_item, catalogo_id?, ... }
4. Backend:
   a. authenticate() → verifica JWT, injeta req.user (id, role, tenant_id, features, ...)
   b. featureGate('vendas') → vendas é core, sempre passa
   c. express-validator → valida campos
   d. calcularComissao(tenantId, valor, tipo_item, pct) → comissao_servico ou comissao_produto
   e. calcularValorLiquido(tenantId, valor, forma_pagamento, ...) → valor_liquido
      (sem taxas hardcoded — usa desconto apenas; taxas de cartão, quando configuradas,
      vêm de `configuracoes` por tenant)
   f. Venda.create(tenantId, {...}) → INSERT INTO vendas (tenant_id, ...) RETURNING *
   g. Se estoque ativo E tipo_item='produto' E catalogo_id:
      UPDATE catalogo SET quantidade = GREATEST(0, quantidade - $qtd)
      WHERE id = $catalogo_id AND tenant_id = $tenantId AND controla_estoque = true
5. Retorna 201 { id, valor, comissao, ... }
6. Frontend atualiza lista de lançamentos
```

---

## Fluxo de dados — DRE

```
1. Admin seleciona período e unidade em IntelFinanceira.jsx
2. GET /api/relatorios/dre?inicio=&fim=&unidade=
3. Backend executa 6 queries paralelas:
   a. totaisEntrada  → SUM(comissao_servico), SUM(comissao_produto), SUM(comissao)
   b. rankingServicos → TOP serviços por receita (exclui tipo_item='produto')
   c. comissoesBarbeiro → comissão por colaborador
   d. gastosPorCategoria → GROUP BY (categoria, descricao, unidade)
   e. gastos_lista → despesas individuais linha a linha
   f. resumo_diario → entradas e saídas por data
4. Retorna JSON consolidado
5. Frontend renderiza interativo OU gera buildDreHtml (HTML exportável)
```

---

## Sistema de Feature Flags

> **Desde 2026-07-10, flags são por tenant e resolvidas em runtime** — não mais
> build-time. `backend/config/features.js` e o antigo `frontend/src/config/features.js`
> (removido) foram substituídos por uma coluna JSONB no banco.

**Fonte da verdade:** `tenants.features` (JSONB), ex.: `{"combos": true, "metas": true}`.

**Resolução (login):**

```js
// backend/config/features.js
const CORE_FEATURES = {
  vendas: true, gastos: true, catalogo: true, profissionais: true, dashboard: true,
};

// Mescla as flags do tenant com os módulos core — core sempre vence.
function resolveFeatures(tenantFeatures = {}) {
  return { ...tenantFeatures, ...CORE_FEATURES };
}
```

`POST /auth/login` chama `resolveFeatures(tenant.features)` e embute o resultado no JWT (campo `features`) — mesmo padrão que `unidade`/`role` já usavam.

> **Atualizado em 2026-08-03** (ver [[registro-de-decisoes-kernel]]): o parágrafo antigo aqui dizia que mudar `tenants.features` só refletia depois de logout+login — isso deixou de ser verdade. `GET /auth/me` agora recalcula `features` (e `usaComissao`) do tenant **a cada chamada**, não só devolve o que veio no JWT, e `AuthContext.jsx` (frontend) chama esse endpoint no mount e a cada 60s, mesclando o resultado em `user` sem gerar token novo. O JWT continua sendo a fonte de `role`/`tenant_id`/etc. (esses sim só mudam com relogin) — só `features`/`usaComissao` ganharam essa segunda fonte viva. Motivo: editar os módulos de um tenant no Painel Admin não tinha nenhum efeito em quem já estava logado, nem com F5.

**Backend — runtime, por request:**

```js
// backend/middleware/featureGate.js
const featureGate = (featureName) => (req, res, next) => {
  if (!req.user?.features?.[featureName]) {
    return res.status(404).json({ erro: 'Módulo não disponível nesta configuração.' });
  }
  next();
};
```

Roda depois do `authenticate` global (`server.js`) — precisa de `req.user` já populado. Diferença chave em relação ao modelo antigo: antes o gate era aplicado **uma vez, no mount da rota** (`app.use('/combos', featureGate('combos'), ...)`), lendo `process.env` — um único valor pra todo o processo. Agora é avaliado **por request**, lendo o tenant daquele request específico — dois tenants no mesmo processo podem ter `combos` ligado/desligado de forma independente.

**Frontend — vem do JWT, não é mais módulo estático:**

```jsx
// qualquer componente
const { user } = useAuth();
user.features.combos // true/false, decodificado do JWT
```

`components/FeatureGate.jsx` (`<FeatureGate feature="estoque">...</FeatureGate>`) e as listas de navegação em `App.jsx` (`gruposAdmin(features)`, `gruposOperador(features)`, `gruposBarbeiro(features)` — funções que recebem `user.features`, não mais constantes de módulo) leem daí.

---

## Sistema de Branding por Tenant

> **Desde 2026-07-10, branding é por tenant e resolvido em runtime** a partir da
> URL, não mais build-time via `VITE_*`.

**Fonte da verdade:** `tenants.branding` (JSONB) — `nome`, `slogan`, `logoUrl`, `loginBgUrl`, `temaPadrao`, `corPrimaria`, `corPrimariaEscuro`, `corFundo`, `corFundoEscuro`, `corSuperficie`, `corSuperficieEscuro`.

**Resolução (antes do login):**

```
Frontend abre em /t/:slug
  → contexts/TenantConfigContext.jsx faz parse manual do pathname (sem
    react-router — projeto usa state manual pra roteamento, mesmo estilo)
  → GET /public/tenants/:slug (backend/routes/public.js — único endpoint
    sem autenticação além de /auth/*)
  → retorna { nome, ...branding } — nunca features, nunca dado de negócio
  → useTenantConfig() expõe { slug, branding, loading }
```

Enquanto o fetch não resolve, `main.jsx` já aplicou a **paleta de fábrica neutra** (`applyTenantTheme(getModoInicial())`, sem argumento de branding) pra evitar tela em branco — pequeno FOUC aceito até o branding real chegar. `ThemeProvider` reaplica (`useEffect` com `[modo, branding]`) assim que `useTenantConfig()` resolve.

**Login:** `Login.jsx` usa o `slug` do `TenantConfigContext` (não é mais um campo que o usuário digita) e envia `{ slug, username, senha }` — resolve o tenant no backend antes de buscar o usuário, já que `username` só é único dentro de um tenant agora.

**Regra dos 3 lugares (`VITE_*` em build-time) deixou de existir para branding** — não há mais `ARG`/`ENV`/`build.args` de cor/nome/logo no `Dockerfile`/`docker-compose.yml`. Um único build de frontend atende todos os tenants. A única variável `VITE_*` que permanece build-time é `VITE_NICHO` (terminologia — ver [[requisitos-funcionais-kernel]] § Limitações conhecidas).

### Ícone do PWA por tenant — HTML renderizado no backend (desde 2026-08-18)

O fluxo de branding acima (fetch client-side + JS troca as tags do `<head>`) resolve o favicon da aba, mas **não resolve o ícone de "Adicionar à Tela de Início" no iOS**: o Safari lê `<link rel="apple-touch-icon">` direto do HTML inicial, antes do JS rodar — e como o `href` inicial (mesmo build atende todos os tenants) apontava pro favicon genérico em **SVG** (formato que `apple-touch-icon` não suporta), o iOS caía no fallback padrão da Apple: gerar um ícone com a primeira letra do nome da página.

**Solução:** `GET /t/:slug` passou a ser renderizado no **backend** (`backend/server.js`), não mais servido como arquivo estático genérico pelo nginx:

```
nginx.conf: location ^~ /t/ { proxy_pass http://backend:3001; }
  → server.js: GET /t/:slug busca o index.html do frontend
    (fetch interno http://frontend:80/index.html) e troca:
    <title>, <meta apple-mobile-web-app-title>, <link rel="icon">,
    <link rel="apple-touch-icon"> — usando Tenant.findBySlug direto,
    sem esperar nenhum JS rodar
  → resposta sempre Cache-Control: no-cache, no-store, must-revalidate
```

Assets (`/assets/*.js`, `/favicon.svg` etc.) continuam batendo direto no nginx normalmente — só a navegação (`/t/:slug`) passa pelo backend. O manifest dinâmico (Web App Manifest via Blob URL, `TenantConfigContext.jsx`) continua existindo à parte pra Android/Chrome ("Instalar app"), que já lia o manifest certo em runtime sem esse problema — o gap era só iOS.

> **Incidente real (2026-08-18):** a primeira versão guardava o `index.html` buscado do frontend em **cache indefinido na memória do processo** do backend. Um deploy incremental normal (só o serviço `frontend` reconstruído, sem reiniciar o `backend` junto — fluxo padrão descrito no Playbook DevOps) deixou esse cache apontando pro hash de JS antigo, que o build novo já tinha removido. Resultado: `GET /t/:slug` — login de **qualquer** tenant, admin ou barbeiro — servia um HTML com `<script src>` pra um arquivo 404, o app nunca montava, tela em branco. Só um restart manual do `kernel_api` resolvia até a causa ser identificada. Corrigido removendo o cache por completo — busca o template de novo a cada request (custo desprezível, rota de baixo tráfego). Ver [[registro-de-decisoes-kernel]].

---

## Shell de navegação por papel

Uma única árvore React (`App.jsx`) monta um shell diferente conforme o papel resolvido no login (`AppRoot`):

| Papel | Componente | Sidebar (grupos) | BottomNav (mobile) |
|---|---|---|---|
| admin / gestor | `AppAutenticado` | `gruposAdmin(features, profissional_id)` | `Dashboard · Lançamentos · Agenda (centro) · Clientes · Config.` |
| operador | `AppOperador` | `gruposOperador(features)` | — (sem barra inferior) |
| barbeiro (`role='barbeiro'` puro) | `AppBarbeiro` | `gruposBarbeiro(features)` | `bottomNavBarbeiro(features)` — espelha o admin (desde 2026-08-27) |
| barbeiro com `eh_gestor=true` | `AppAutenticado` | igual admin | igual admin |

Componentes compartilhados por todos os shells: `Header.jsx` (logo do tenant + toggle de tema + sino de notificações só pra admin), `Sidebar.jsx` (menu lateral, overlay no mobile), `HamburgerBtn.jsx`, `BottomNav.jsx`.

- **Tela inicial ao logar = Agenda para todos os papéis** (desde 2026-08-27) — os três shells inicializam `pagina` com `user.features.agenda ? 'agenda' : <padrão do papel>` (`dashboard` pro admin, `registro` pro operador, `meupainel`/`registro` pro barbeiro). Só cai no padrão do papel quando o tenant não tem o módulo Agenda no plano.
- **`BottomNav.jsx`** — barra inferior fixa, `md:hidden` (só mobile; no desktop a navegação é a sidebar). Aceita `esquerda` / `centro` / `direita` como props; sem elas usa o layout padrão do admin. O item central fica elevado em destaque. **Item fora do plano do tenant não aparece** — sem cadeado, sem versão apagada (decisão de 2026-08-24). O barbeiro passa sua própria config via `bottomNavBarbeiro()`: `Meu Painel` + `Lançamentos` à esquerda, `Agenda` no centro (ou `Registro` se o tenant não tem `features.agenda`), `Registro` + `Relatório` à direita; `Metas` e `Consumo Interno` só na sidebar.
- **`Sidebar.jsx` — "Configurações" + "Sair"** ficam no fim da `<nav>` rolável, logo abaixo do último item do menu (separados por `border-t`), não num rodapé ancorado na base do `<aside>`. O rodapé fixo antigo, empurrado pelo `<nav flex-1>`, ficava longe demais do resto com poucos itens (login do barbeiro) e sumia abaixo da dobra no mobile (`h-full` + barra de endereço). Agora, aberta a sidebar, todos os botões aparecem juntos; menu longo (admin) rola até o "Sair" (mudou em 2026-08-27).
- **Fechar a sidebar no `resize`** — o handler só força `setSidebar(false)` na **transição desktop → mobile**, não em todo evento. No mobile a barra de endereço do navegador (e o teclado) dispara `resize` durante o scroll; sem o guard `eraMobile`, a sidebar fechava sozinha ao rolar a página (fix de 2026-08-27).
- **`MeuPainel.jsx`** é só conteúdo (não é mais uma shell paralela com header/abas próprios — mudou em 2026-08-27).
- **Agenda do barbeiro é escopada a ele** — na tela `Agenda.jsx` o barbeiro puro não tem seletor de unidade (`podeEscolherUnidade = isAdmin`) nem filtro por profissional (`podeFiltrarProfissional = isAdmin || isOperador`), e `carregarProfissionais` devolve só o próprio cadastro. Compartilhamento: ele vê **só** o botão "Meu link de agendamento" (`CompartilharAgendamento` com `profissionalId={user.profissional_id}`); o botão do link **geral da unidade** é `isAdmin || isOperador` apenas (o agente opera a agenda da unidade pelo login admin). Teste canônico pra "pode ver o link genérico da unidade" nas três telas que expõem `CompartilharAgendamento` (`Agenda`, `MeuPainel`, `GestaoTime`): `!user.profissional_id`. Mudou em 2026-08-27 — antes a Agenda mostrava os dois botões pro barbeiro; ver [[registro-de-decisoes-kernel]].

---

## Sistema de Tema Escuro/Claro

```
frontend/src/lib/theme.js          → hexToRgb, lighten, darken, withAlpha, getModoInicial, applyTenantTheme
frontend/src/contexts/ThemeContext.jsx → ThemeProvider + useTheme hook
```

`applyTenantTheme(modo, branding)` injeta CSS custom properties em `:root` via `document.documentElement.style.setProperty()`. Os blocos `dark` e `light` são **totalmente separados** dentro do `if/else` — nenhuma chamada compartilhada fora do bloco. Isso previne comportamento incorreto quando as fórmulas de lighten/darken diferem entre modos. Desde 2026-07-10, `branding` é um **argumento** (vindo de `useTenantConfig()`), não mais um import estático de `config/tenant.js` (removido) — default `BRANDING_PADRAO` (paleta neutra) quando chamado sem argumento, usado só no primeiro paint em `main.jsx` antes do fetch resolver.

`getModoInicial(branding)` lê `localStorage.getItem('orbita_tema') ?? branding.temaPadrao ?? 'escuro'`. `main.jsx` chama `applyTenantTheme(getModoInicial())` (sem branding — paleta de fábrica) antes do `ReactDOM.createRoot()` para evitar flash de tema errado; `ThemeProvider` reaplica com o branding real assim que `useTenantConfig()` resolve.

**Duas fontes de cor (`branding.usaPaletaPersonalizada`):**

- **Paleta de fábrica** (`usaPaletaPersonalizada = false`, tenant sem nenhuma cor customizada em `tenants.branding`) — `theme.js` monta as cores direto de 24 constantes hex exatas (12 por modo), idênticas ao sistema-thieco original. Nunca calculadas por fórmula. Esse é o visual padrão de qualquer novo tenant sem customização.
- **Paleta personalizada** (`usaPaletaPersonalizada = true`, qualquer `corPrimaria`/`corFundo`/`corSuperficie` configurada em `tenants.branding`) — mantém a derivação por `lighten()`/`darken()` sobre as 3 cores base do tenant, com fallback para a paleta de fábrica nos campos não informados. Calculado em `TenantConfigContext.jsx` a partir da resposta de `GET /public/tenants/:slug` (`Boolean(data.corPrimaria || data.corFundo || data.corSuperficie)`).

A fórmula lighten/darken **não reproduz** a paleta de fábrica (`lighten('#D4AF37', 50)` dá `#FFE169`, não o `#F0E6C8` real) — por isso as duas fontes coexistem em vez de uma única derivação. Ver [[design-system-kernel]] para os valores hex exatos.

**Cobertura do toggle (sol/lua):**
- `Login.jsx` — antes de logar (todos, inclusive barbeiro)
- `Header.jsx` — admin, operador **e barbeiro** (desde 2026-08-27 o barbeiro usa o mesmo shell; ver "Shell de navegação por papel"). O `MeuPainel.jsx` não tem mais header próprio.

---

## Sistema de Labels por Nicho

```
VITE_NICHO = barbearia | salao | clinica | generico (padrão)
```

O arquivo `frontend/src/config/labels.js` carrega um mapa de terminologia conforme o nicho:

| Label key | barbearia | salao | clinica | generico |
|---|---|---|---|---|
| profissional | Barbeiro | Profissional | Especialista | Colaborador |
| estabelecimento | Barbearia | Salão | Clínica | Estabelecimento |
| servico | Serviço | Serviço | Procedimento | Serviço |
| clientes | Clientes | Clientes | Pacientes | Clientes |
| combos | Combos | Pacotes | Pacotes | Pacotes |
| estoque | Estoque | Estoque | Materiais | Estoque |

Overrides individuais via `VITE_LABEL_PROFISSIONAL`, `VITE_LABEL_CLIENTES`, etc.

> **Limitação conhecida pós-migração multi-tenant:** diferente de branding e feature
> flags, `VITE_NICHO`/labels **não** foram movidos pra runtime nesta rodada —
> continuam build-time, um valor único por deployment. Como agora um único
> deployment atende N tenants, dois clientes com nichos diferentes (ex.: uma
> barbearia e uma clínica) no mesmo deployment veriam a mesma terminologia. Não
> era o escopo combinado da migração de 2026-07-10 (só branding + flags); fica
> como próximo passo natural se/quando isso virar um problema real.

---

## Sistema de Agendamento Público

> Portado do `sistema-thieco` (TASK-23) em 2026-07-13 — ver [[registro-de-decisoes-kernel]].

O motor de agendamento mistura rotas autenticadas e públicas, seguindo o mesmo
padrão já usado em `auth.js` (login é público, `/me` exige token). A parte
pública precisa resolver **dois níveis** de escopo sem JWT — qual tenant e
qual unidade — porque o whitelabel (ao contrário do thieco, que tinha só duas
unidades hardcoded) tem N tenants com N unidades cada:

```
Link compartilhado pela barbearia:  /t/:tenantSlug?agendar=:unidadeSlug
                                              │
                          TenantConfigContext resolve :tenantSlug
                          (mesmo mecanismo do branding — GET /public/tenants/:slug,
                           que agora também devolve a lista de unidades do tenant)
                                              │
                    AgendamentoPublico.jsx chama /agendamentos/publico/:tenantSlug/*
                                              │
              agendamentos-publico.js resolve o tenant de novo no backend
              (nunca confia em tenant_id vindo do cliente) e valida que
              tenant.features.agenda está ligado — 404 genérico se não
```

Duas garantias contra corrida (dois clientes reservando o mesmo horário ao
mesmo tempo): checagem `OVERLAPS` na aplicação (mensagem amigável) **e**
`EXCLUDE CONSTRAINT` no Postgres (`tenant_id + profissional_id + intervalo de
tempo`, via `btree_gist`) como rede de segurança de última instância.

**Folga mínima de 10min entre agendamentos (desde 2026-08-27):** a regra
entre dois agendamentos do mesmo profissional deixou de ser só "não sobrepor"
— cada agendamento existente passa a "ocupar" também os
`INTERVALO_MINIMO_ENTRE_AGENDAMENTOS_MIN = 10` minutos antes e depois
(constante hardcoded em `routes/agendamentos.js`, não configurável por
tenant). Aplicada em `calcularDisponibilidade` (não oferece o slot que
encosta no anterior — cobre agenda interna, link público e Kalel, que reusam
essa função) e em `existeConflito` (janela expandida ±10min no `OVERLAPS`
pré-INSERT, criação e reagendamento). O almoço (`jornada_unidade.intervalo_*`)
fica de fora — já é janela fechada à parte. A `EXCLUDE CONSTRAINT` segue só
anti-sobreposição (não conhece a folga), continua sendo só o backstop de
corrida.

**Duração de serviço por profissional (desde 2026-08-18):** `calcularDisponibilidade`
(o motor que monta o grid de horários candidatos) deixou de assumir um único
horário de fim compartilhado por todos os barbeiros candidatos a um slot —
recebe um `duracaoPorProfissional` opcional (`Map<profissional_id, minutos>`,
resolvido de `catalogo_duracao_profissional`, ver [[modelo-de-dados-kernel]])
e calcula o fim **por profissional** dentro do próprio filtro de disponibilidade.
Sem override cadastrado, cai no `duracaoMinutos` padrão do catálogo — mesmo
comportamento de antes pra quem não personalizou nada. Os 4 pontos que
resolvem duração antes de checar disponibilidade/criar o agendamento (interno,
autoagendamento público, `POST /internal/agendar-direto` e
`GET /internal/disponibilidade` do Kalel) foram todos atualizados juntos —
inclusive o cálculo final de `hora_fim` no INSERT, que precisa refletir a
duração de QUEM efetivamente foi escolhido pro slot, não o padrão do catálogo.

A confirmação de presença (`?confirmar=:codigo`) **não** precisa do slug do
tenant na URL — o `codigo_confirmacao` (aleatório, único globalmente) já
resolve o agendamento sozinho.

---

## Sistema de Notificações e Gatilhos Automáticos

> Portado do `sistema-thieco` em 2026-07-13. Duas famílias de disparo, ambas
> só **enfileiram** em `notificacoes` (canal `sistema`/`whatsapp`/`email`) —
> não há integração real de terceiros (Twilio/Z-API/etc.) embutida no
> sistema. Quem consome a fila e envia de fato é externo (hoje manual, no
> roadmap o Órbita Horizon assume esse papel).

```
setInterval (server.js)
   │
   ├─ a cada 5min  → gerarLembretesAgendamento + gerarGatilhoAvaliacaoPosVenda
   └─ a cada 15min → verificarNotificacoesConfiguradas + gerarResumoAgendaBarbeiros
                      + gerarGatilhoAniversariante + gerarGatilhoClienteSumido
                      + gerarGatilhoInadimplente
   │
   └─ para CADA tenant ativo (Tenant.findAllAtivos()), só se a feature
      correspondente estiver ligada — 1 processo atende todos os tenants,
      diferente do thieco (1 processo = 1 cliente, nunca precisou iterar)
```

Cooldown de marketing: no máximo 1 mensagem de marketing (aniversário /
cliente sumido / promoção / avaliação pós-venda) por cliente a cada 14 dias,
**mesmo entre tipos diferentes** — evita empilhar contato em cima de contato
recente.

**Quem recebe o quê:** os lembretes/gatilhos de marketing e confirmação vão
pro **cliente** (`cliente_contato`); as notificações configuráveis
(faturamento/ranking/estoque/ticket) vão pro **admin** (`usuarios.telefone`,
role `admin`, com `notif_canal_whatsapp`). O único disparo que vai pro
**barbeiro** é o **resumo diário da agenda** (`gerarResumoAgendaBarbeiros`,
desde 2026-08-27): de manhã (janela 07:00–11:00, TZ do container =
America/Sao_Paulo), cada profissional com `profissionais.telefone` cadastrado
**e com pelo menos um agendamento no dia** recebe a lista dos horários dele.
Sem agendamento hoje → não recebe nada (a consulta volta vazia, a função sai
sem disparar). Idempotente por profissional/dia via `notificacoes`
(`tipo = 'resumo_agenda_barbeiro'`), gated por `features.agenda`.

**Disparo "vazio" suprimido:** `gerarNotifFaturamento` retorna `null` quando
não houve nenhum atendimento no período (mesmo critério que
`gerarNotifTicketMedio`/rankings/estoque parado já tinham) — não enfileira
mais "R$ 0,00 em 0 atendimento(s)".

---

## Sistema de Campanhas de Marketing

Disparo manual (não é cron) — segmentação por filtro combinável (unidade +
dias sem visita + tipo de cliente + faixa de ticket gasto + serviço já
consumido) sobre a tabela `clientes`, com preview de audiência antes de
confirmar o envio. Cada disparo grava `campanhas_promocionais` (1 linha) +
`campanhas_destinatarios` (1 linha por cliente) + enfileira em `notificacoes`
— o mesmo cooldown de 14 dias do sistema de gatilhos se aplica aqui também.

**UI (desde 2026-08-20):** página própria, `frontend/src/pages/Campanhas.jsx`
— item de menu no grupo "Administração & Gestão" (`App.jsx`, `gruposAdmin`),
gate por `features.campanhas`. Antes vivia como aba dentro de Configurações;
saiu de lá por ser ferramenta de uso recorrente, não configuração pontual —
ver [[registro-de-decisoes-kernel]].

---

## Sistema de Atendimento via WhatsApp + IA (Cortex/Quasar)

> Desde 2026-07-28. Ver [[registro-de-decisoes-kernel]] para a decisão completa.

Envio real de WhatsApp (via Evolution API, self-hosted) e concierge conversacional
de IA são fornecidos por **duas microservices Python compartilhadas, fora deste
repositório** — `cortex` (canal administrativo: relatório sob demanda,
notificação de alerta) e `quasar` (canal do cliente: FAQ, agendamento,
transbordo pra humano). A mesma dupla de serviços atende o sistema-thieco e
**todos** os tenants do whitelabel — não existe 1 Cortex/Quasar por cliente.

- **Autenticação:** `authenticateInternal` (`middleware/auth.js`) — chave
  compartilhada via header `X-Internal-Key` (env `INTERNAL_SERVICE_KEY`, mesmo
  valor configurado no `.env` do Cortex/Quasar). Sem JWT de usuário.
- **`backend/routes/internal.js`** — todas as rotas serviço-a-serviço, montadas
  **antes** do `app.use(authenticate)` global (mesma fronteira de `/public` e
  `/agendamentos/publico`): `/transbordo`, `/relatorio-sob-demanda`,
  `/admin-autorizado`, `/tenant-nome`, `/tenant-by-slug`,
  `/unidade-atendimento` (bundle de FAQ: jornada, equipe, catálogo, regras —
  montado em tempo real, sem cache), `/cliente-atendimento` (contexto de churn),
  `/resolve-instancia`.
- **Nome de instância Evolution API:** `{tenantSlug}-{unidadeSlug}` (ou
  `{tenantSlug}-admin` pro canal administrativo) — resolvido de volta pro par
  `(tenant_id, unidade)` via `GET /internal/resolve-instancia`, que faz o match
  no SQL (`WHERE (t.slug || '-' || u.slug) = $1`) em vez de o Cortex/Quasar
  tentar fazer `split("-")` no nome da instância — ambíguo quando um slug
  contém hífen.
- **Sem conexão direta ao Postgres:** ao contrário do sistema-thieco (que tem
  `THIECO_DATABASE_URL` + role `cortex_readonly` dedicada, herança de quando
  cada cliente tinha banco próprio), o whitelabel não expõe nenhuma
  `WHITELABEL_DATABASE_URL` — toda leitura de `clientes`/`usuarios` pelo
  Cortex/Quasar passa pela API interna acima, autenticada por
  `X-Internal-Key`.
- **`unidades.atendimento_ia` (JSONB)** — conteúdo editável pelo admin do
  tenant (`GET/PUT /configuracoes/atendimento-ia`) que alimenta o FAQ do
  Quasar: nome do assistente, tom de voz, endereço, regras de atendimento,
  mensagem de transbordo, link de agendamento. Sem essa configuração
  preenchida, o Quasar ainda responde, só com um FAQ mais vazio (seções
  omitidas quando o campo correspondente está ausente).

---

## Sistema de Onboarding — Painel Admin

> Desde 2026-08-02. Ver [[registro-de-decisoes-kernel]] para a decisão completa.

Substitui o `INSERT` manual em `tenants`/`unidades`/`usuarios` (único jeito que existia de criar cliente até aqui) por um CRUD de verdade, com tela própria em `/admin` — árvore React **inteiramente separada** de `App.jsx` (não é tenant nenhum, então não passa por `TenantConfigProvider` nem pelo `Login` de tenant).

```
Frontend                                    Backend
─────────────────────────────────────────   ─────────────────────────────────────
main.jsx: pathname.startsWith('/admin')?
  → AdminApp.jsx (SWRConfig +
    AdminAuthProvider)                       POST /admin/login (público)
    │                                          → compara com ADMIN_PANEL_USERNAME/
AdminAuthContext.jsx                            PASSWORD (env var), timingSafeEqual
  → token próprio, localStorage key           → signToken({ role: 'super_admin' })
    própria (nunca colide com o token         (sem tenant_id)
    de tenant)                                        │
    │                                          router.use(authenticateAdmin) —
pages/admin/AdminLogin.jsx                     tudo abaixo exige esse token
pages/admin/AdminTenantsList.jsx                       │
pages/admin/AdminTenantForm.jsx  ───────────► GET/POST /admin/tenants
  (criar/editar, mesmo componente)             GET/PUT /admin/tenants/:id
                                                PATCH /admin/tenants/:id/ativo
                                                GET /admin/tenants/:id/usuarios
                                                PATCH .../usuarios/:id/redefinir-senha
```

**Auth separada do JWT de tenant** — `authenticateAdmin` (`middleware/auth.js`) valida um token com `role: 'super_admin'` e **sem `tenant_id`**; nunca aceito nas rotas normais, e o JWT de tenant nunca é aceito em `/admin/*`. `routes/admin.js` é montado em `server.js` **antes** do `app.use(authenticate)` global — mesma fronteira de `/public`, `/agendamentos/publico`, `/internal` — porque `POST /admin/login` precisa ficar acessível sem token nenhum; tudo depois dele fica atrás de `router.use(authenticateAdmin)` dentro do próprio arquivo.

**Criação de tenant é transacional** (`getClient()` + `BEGIN`/`COMMIT` em `POST /admin/tenants`): tenant + 1 unidade (`principal`) + 1 usuário admin com senha temporária, tudo ou nada. Sem isso, um tenant criado sem usuário ficaria no ar mas ninguém conseguiria logar (`routes/auth.js` exige `usuarios.tenant_id`, sem fallback). Slug validado por regex (`^[a-z0-9]+(-[a-z0-9]+)*$`) e checado contra `Tenant.findBySlugAny` (ignora `ativo`, mesma regra da UNIQUE constraint do banco) — **imutável depois de criado**, `PUT /admin/tenants/:id` nunca aceita `slug` no corpo, mesma regra já usada em `routes/unidades.js`.

**Reset de senha de usuário do tenant** (`PATCH /admin/tenants/:id/usuarios/:usuarioId/redefinir-senha`) — cobre um gap real: a conta admin de um tenant (criada aqui, sem `profissional_id`) não tem nenhum outro caminho de recuperação — `/auth/esqueci-senha` exige e-mail de um `profissional` vinculado (que ela não tem), e o reset que já existe em `GestaoProfissionais`/`profissionais.js` só aceita `role='barbeiro'`. Sem essa rota, um admin de tenant que esquece a senha ficaria trancado pra sempre.

---

## Modelo KERNEL OS — Módulos e Pacotes

> Desde 2026-08-02/03, fonte da verdade: `kernel-hq/kernel-hq-arquitetura/06-precificação-Kernel.md`. Substitui a estrutura "Nível 1/2/3" anterior. Ver [[registro-de-decisoes-kernel]] e [[modelo-de-dados-kernel]] (tabela `tenants`, incl. tabela de mapeamento módulo → flag).

Dois formatos de venda em paralelo, ambos configurados no Painel Admin:

- **Módulos avulsos** (à la carte) — `tenants.features` (JSONB), mapeados a `featureGate(...)` reais um a um.
- **Pacotes fechados** (`tenants.plano`: `start`/`pro`/`full`) — só rótulo + preset de módulo pro formulário pré-marcar; o admin ainda ajusta módulo a módulo depois. Não é enforcement — quem gate é sempre `features`.

`tenants.limite_profissionais` ("cadeira" do plano) é a única parte desse modelo com **trava de verdade** no backend: `POST /profissionais/admin/cadastrar` bloqueia com HTTP 403 ao atingir o limite, comparando contra a contagem de `profissionais` ativos do tenant.

`tenants.usa_comissao` (default `true`) é ortogonal a plano/módulo — liga/desliga só a **palavra** "Comissão" no frontend (Dashboard, cadastro de profissional, relatório DRE), pra tenants que não trabalham com comissão (dono solo, ou time assalariado). Nunca muda cálculo — `percentual_comissao` continua existindo e sendo somado normalmente em `vendas.comissao`.

**Divergência conhecida entre o documento de precificação e o código:** o documento descreve "Autoatendimento & Google Reviews" como 1 módulo, mas no código são 2 flags independentes — `features.autoatendimentoPublico` (bloqueia o link público de agendamento) e `features.notificacoes` (dispara o gatilho de avaliação). Ligar só Autoatendimento não ativa a parte de Google Reviews; precisa dos dois. Não unificado de propósito — juntar as duas flags numa só exigiria inventar um comportamento que ninguém pediu.

**`id` do módulo ≠ nome da feature, pra 2 dos 4 módulos** — `combos`/`estoque` batem (`id` do módulo é literalmente o nome da flag), mas `financeiro` liga a flag `relatorios` e `cortex` liga `notificacoes` (`MODULOS` em `backend/routes/admin.js`). **Bug corrigido em 2026-08-18:** `frontend/src/config/planosKernel.js` não carregava esse de-para — o reverse-mapping em `AdminTenantForm.jsx` (reconstrói os checkboxes a partir de `tenant.features` ao reabrir um tenant pra editar) comparava `MODULOS[].id` direto contra as chaves de feature, então "Financeiro Avançado" e "Brainiac" **sempre** apareciam desmarcados ao reabrir, mesmo já salvos como `true` no banco — parecia que a seleção "não ficava salva" (salvar sempre funcionou certo, só a leitura mentia). `MODULOS` ganhou um campo `flag` explícito por módulo; `mapaDeLista()` passa a comparar por `flag` quando existe.

---

## Pontos de integração

| Integração | Onde | Configuração |
|---|---|---|
| SMTP / email | `backend/mailer.js` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| PostgreSQL | `backend/db.js` | Local: `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` (serviço `postgres` do compose). Supabase: mesmas variáveis apontando pro host do projeto + `DB_SSL=true` |
| Branding/flags por tenant | `backend/routes/public.js`, `backend/routes/auth.js` | Sem env var — vive em `tenants.branding`/`tenants.features` (JSONB) no banco |
| Nginx → backend | `/etc/nginx/nginx.conf` | `proxy_pass http://backend:3001` — location `/api/` |
| Nginx → frontend | `/etc/nginx/nginx.conf` | Serve build estático — location `/`, incluindo fallback SPA pra rotas como `/t/:slug` |
| WhatsApp (Evolution API) | `backend/services/whatsappService.js` | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` — instância por unidade, ver seção acima |
| Cortex (relatório admin/IA) | `backend/routes/internal.js`, chamado por `cortex` | `INTERNAL_SERVICE_KEY` compartilhada |
| Quasar (concierge WhatsApp) | `backend/routes/internal.js`, chamado por `quasar` | `INTERNAL_SERVICE_KEY` compartilhada |

---

## Fronteiras de segurança

| Camada | Mecanismo | O que garante |
|---|---|---|
| JWT | `middleware/auth.js` (global desde `server.js`, exceto `/auth` e `/public`) | Todo request carrega identidade verificável, incluindo `tenant_id` |
| Isolamento de tenant | `tenant_id` obrigatório em toda query de `models.js` e rotas | Um tenant nunca lê/escreve dado de outro, mesmo adivinhando um ID (proteção IDOR) — retorna 404, não vaza existência do registro |
| Role guard | `middleware/requireAdmin.js` | Rota de admin bloqueia operador e colaborador |
| Isolamento de colaborador | Lógica nas routes | `profissional_id` vem sempre do JWT — query param ignorado |
| Feature gate backend | `middleware/featureGate.js` | Módulo desativado retorna 404 (não 403) — evita enumeração; avaliado por tenant a cada request, não mais fixo por processo |
| Rotas públicas de agendamento | `routes/agendamentos-publico.js`, montada antes de `app.use(authenticate)` | Resolve o tenant pelo slug da própria URL (nunca aceita `tenant_id` do cliente) e confere `tenant.features.agenda` antes de qualquer query — 404 genérico se o tenant não existir ou o módulo estiver desligado, mesmo padrão do featureGate autenticado |
| Rotas serviço-a-serviço (Cortex/Quasar) | `routes/internal.js`, montada antes de `app.use(authenticate)`, `authenticateInternal` por rota | Exige `X-Internal-Key` compartilhada — sem JWT de usuário; `tenant_id` sempre recebido explicitamente no corpo/query da chamada, nunca inferido |
| Senha | bcrypt (salt rounds = 12) | Hash armazenado nunca reversível |
| Recuperação de senha | Token de uso único com TTL, escopado por `slug` (tenant) | Colunas `token_recuperacao`/`token_expiracao` em `usuarios` — expirado = inválido |
| SQL parametrizado | `pg` prepared statements em toda query | Nenhuma interpolação de input de usuário em SQL — corrigido em `relatorios.js`/`metas.js` na migração de 2026-07-10 (interpolavam `unidade` direto na string) |
| CORS | Express cors() | Configurável por deploy |

---

## Estratégia de escala

> Revertido em 2026-07-10 — ver [[registro-de-decisoes-kernel]]. A
> estratégia original (single-tenant por deploy) está descrita abaixo só como
> histórico; **não reflete mais o sistema atual**.

**Modelo atual — multi-tenant, banco compartilhado (Supabase):**

- 1 deployment (backend + frontend + Nginx) atende N clientes
- Isolamento de dados via `tenant_id` obrigatório em toda tabela/query — não mais bancos físicos separados
- Onboarding de cliente novo = tela do Painel Admin (`/admin`, desde 2026-08-02 — ver seção "Sistema de Onboarding — Painel Admin" acima), não é mais `INSERT` manual — mas o princípio de fundo continua o mesmo: não sobe infraestrutura nova
- Escala horizontalmente no nível do banco (Supabase gerenciado) e verticalmente/horizontalmente no nível da aplicação (mais réplicas do container backend/frontend atrás do mesmo Postgres)
- Trade-off aceito: um bug de isolamento (`tenant_id` esquecido numa query nova) é um incidente cross-tenant, não um problema contido a 1 cliente — por isso `tenant_id` é tratado como obrigatório, não opcional, em toda função nova de `models.js`

**Modelo anterior (histórico, até 2026-07-10) — single-tenant por deploy:**

O sistema foi originalmente projetado para single-tenant por deploy (um cliente = um Docker Compose). Essa decisão:

- Simplificava isolamento de dados (bancos separados) — eliminava por construção o risco de vazamento de dados entre clientes
- Permitia personalização por VPS sem afetar outros clientes
- Escalava verticalmente (upgrade de VPS) antes de qualquer mudança de arquitetura
- Não escalava operacionalmente para onboarding rápido de múltiplos clientes — cada cliente novo exigia subir um stack Docker inteiro (1 container backend + 1 frontend/nginx + 1 PostgreSQL), com branding/flags fixados em build-time

---

## Histórico de versão

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 2026-06-24 | Fork do sistema-thieco com parametrização por env var, feature flags, sistema de labels e remoção de hardcodes |
| 1.1 | 2026-06-24 | Port de 3 features do thieco: estoque integrado à venda (catalogo_id FK), ganho estimado em tempo real no RegistroVenda, ModalFechamento no MeuPainel |
| 1.1 | 2026-06-24 | DRE sync: fluxo-caixa passa a usar SUM(comissao) armazenado, gastos_por_categoria inclui descricao no GROUP BY, endpoint /origem-clientes adicionado |
| 1.2 | 2026-06-25 | Sistema de tema escuro/claro: ThemeContext, lib/theme.js com blocos dark/light separados, toggle sol/lua em Login+Header+MeuPainel, persistência em localStorage (chave: orbita_tema). Logo no header/sidebar e imagem de fundo no login via VITE_LOGO_URL e VITE_LOGIN_BG_URL. Fix Dockerfile: declarações ARG+ENV obrigatórias para todos os VITE_* novos. Correção ||  vs ?? em tenant.js para tratar string vazia como ausente. |
| 1.3 | 2026-07-10 | Paleta de fábrica exata (idêntica ao sistema-thieco) como visual padrão sem customização — `tenant.usaPaletaPersonalizada` decide entre paleta exata e derivação por fórmula. Combos V2: créditos dinâmicos por serviço via JSONB (`creditos`/`creditos_originais`), nova tabela `catalogo_combo_creditos`, motor de fila (`na_fila`/`em_uso`/`encerrado`), consumo em lote, ranking de serviços via combo, edição de data de lançamento. Recorrência em Despesas (`recorrente`, `frequencia_recorrencia`, geração automática de 11 ocorrências futuras). Rankings no Dashboard: origem de clientes (canal de aquisição) e serviços mais consumidos via combo (cor por hash do nome do serviço). |
| 2.0 | 2026-07-10 | **Migração para multi-tenant real (banco compartilhado) + Supabase.** Nova tabela `tenants` + `tenant_id` em toda tabela de negócio. Login exige `slug`; JWT carrega `tenant_id`+`features`. Branding e feature flags saem do build-time (`VITE_*`) e passam a viver em `tenants.branding`/`tenants.features`, resolvidos em runtime (`GET /public/tenants/:slug`, login). `config/tenant.js`/`config/features.js` (frontend) removidos. Correções de segurança encontradas no processo: IDOR em várias buscas por PK sem checar dono, SQL injection latente em `relatorios.js`/`metas.js`, rota `/import` sem autenticação, cache de taxas cross-tenant. Ver [[registro-de-decisoes-kernel]] para o detalhamento completo e [[backlog-tarefas-kernel]] para o status (Supabase real ainda não conectado; teste visual em navegador pendente). |
| 2.1 | 2026-07-13 | **Paridade de funcionalidades com o sistema-thieco: Motor de Agendamento, Campanhas e Notificações avançadas.** Novas features `agenda` e `campanhas` em `tenants.features`. Tabelas novas: `agendamentos` (+ EXCLUDE constraint anti-overlap), `jornada_unidade`, `configuracoes_notificacoes`, `configuracoes_gatilhos_cliente`, `campanhas_promocionais`, `campanhas_destinatarios`; colunas novas em `unidades` (`whatsapp_remetente`, `link_avaliacao`) e `usuarios` (`email`, `notif_canal_whatsapp`, `notif_canal_email`). `routes/agendamentos.js` (autenticado) e `routes/agendamentos-publico.js` (sem auth, resolve tenant por slug) substituem o único arquivo misto do thieco. Cron periódico em `server.js` passa a iterar todos os tenants ativos (thieco tinha 1 processo por cliente). Todo o mecanismo (fila WhatsApp/e-mail, cooldown de marketing, cálculo de disponibilidade) foi preservado; nenhuma regra de negócio específica da Thieco (nomes de unidade, textos de mensagem fixos, `NOME_BARBEARIA` hardcoded) foi copiada — ver [[registro-de-decisoes-kernel]]. |
| 2.2 | 2026-07-28 | **Motor de disparo real (WhatsApp/e-mail) e concierge de IA (Cortex/Quasar) portados, sem infraestrutura por cliente.** `authenticateInternal` + `routes/internal.js` (fora da fronteira do `authenticate` global) para chamadas serviço-a-serviço do Cortex/Quasar. `whatsappService.js`/`routes/whatsapp.js` novos, instância Evolution API `{tenantSlug}-{unidadeSlug}` resolvida via `GET /internal/resolve-instancia` (join exato no SQL, evita ambiguidade de parsing client-side quando um slug contém hífen). Nova coluna `unidades.atendimento_ia` (JSONB) alimenta o FAQ do Quasar em tempo real. Bug pré-existente corrigido: `POST /notificacoes/gerar` perdia o estado `lida` dos alertas a cada chamada — portado o padrão `sincronizarAlertas` (upsert) do thieco. Cortex/Quasar (microservices compartilhadas, fora deste repo) passam a resolver tenant/unidade dinamicamente por instância, sem dicionário fixo por cliente. Role `cortex_readonly` dedicada avaliada e descartada — desenho final é 100% mediado por API, sem conexão direta ao Postgres compartilhado. Testado localmente ponta a ponta (resolução de instância, bundle de FAQ, webhook simulado); não testado com credenciais reais de produção (WhatsApp pareado + OpenRouter). Ver [[registro-de-decisoes-kernel]]. Gap encontrado no processo, documentado em [[backlog-tarefas-kernel]]: falta CRUD de unidade e taxa de cartão por unidade. |
| 2.3 | 2026-07-28 | **CRUD de unidade + taxa de cartão por unidade**, fechando o gap da v2.2. `routes/unidades.js` novo (`GET/POST/PATCH`, slug derivado do nome e imutável após criado). Nova coluna `unidades.taxas` (JSONB, mesma convenção de `atendimento_ia`), validada contra whitelist `CHAVES_TAXA_VALIDAS`. `GET/PUT /configuracoes/taxas` muda de lista flat tenant-wide pra `{ <unidadeSlug>: {...taxas} }`. `calcularValorLiquido()` (`routes/vendas.js`) ganha parâmetro `unidade`, cache passa a ser por `tenant_id`+`unidade`. Frontend: `useUnidades()` (hook real, `GET /unidades`) substitui o fallback estático `VITE_UNIDADES` como fonte de verdade em `SeletorUnidade`; `AbaTaxas` reescrita no layout de cards do thieco; nova aba "Unidades" (admin-only) com lista + criar + editar + ativar/inativar. Testado via API (`docker compose`, stack `orbita-test`): taxas diferentes por unidade aplicadas corretamente no `valor_liquido` de vendas reais. Não testado visualmente em navegador. Ver [[registro-de-decisoes-kernel]]. |
| 2.4 | 2026-07-28 | Botão "Desconectar" do WhatsApp exposto direto no card de remetente (por unidade, resolvida dinamicamente via `useUnidades()` + pseudo-canal `admin`), sem precisar abrir o modal de QR Code — porta pro whitelabel o mesmo ajuste do sistema-thieco, só faltava expor `api.whatsapp` (`status`/`qrcode`/`conectar`/`desconectar`) no `api.js`, backend já pronto desde v2.2. Fix no PDV (`RegistroVenda.jsx`): seletor de Serviço/Produto passa a dividir o catálogo pela `categoria` do item, não por `controla_estoque` (que segue sendo a fonte da verdade só pra classificação de comissão/upsell/alertas de estoque) — mesmo fix aplicado no thieco no mesmo dia. Ver [[registro-de-decisoes-kernel]]. |
| 3.0 | 2026-08-02 | **Rebrand pra "Kernel" + domínio `kercellwc.online` registrado** (deploy ainda pendente). Fix de gap real: `<title>` da aba do navegador era estático, incompatível com 1 build atendendo N tenants — `TenantConfigContext` agora seta `document.title` em runtime a partir do branding. `FRONTEND_URL` (usado em recuperação de senha/confirmação de agendamento) ganhou entrada em `.env.example`/`docker-compose.yml` — antes não existia, fallback caía sempre em `localhost:5173`. **Painel Admin de Onboarding** (`/admin`, nova seção nesta doc): substitui `INSERT` manual por CRUD de verdade — `routes/admin.js` (auth própria, `authenticateAdmin`), `Tenant.create/update/findAll`, criação transacional (tenant + unidade + usuário admin), reset de senha de usuário do tenant (gap real: conta admin não tinha nenhum caminho de recuperação). `AdminApp.jsx`/`AdminAuthContext.jsx`/`pages/admin/*` no frontend, árvore React separada de `App.jsx`. Ver [[registro-de-decisoes-kernel]]. |
| 3.1 | 2026-08-02/03 | **Modelo KERNEL OS** (nova seção nesta doc) substitui a estrutura "Nível 1/2/3": `tenants.nivel` renomeada pra `plano` (`start`/`pro`/`full`), coluna nova `limite_profissionais` (trava real em `POST /profissionais/admin/cadastrar`, HTTP 403 ao atingir) e `usa_comissao` (esconde/renomeia a palavra "Comissão" na UI pra tenant sem comissão — dono solo ou time assalariado; não muda cálculo). `MODULOS`/`BASE_SEMPRE_LIGADO`/`LEGADO_VALIDAS`/`PLANO_MODULOS` em `routes/admin.js` substituem `FEATURES_VALIDAS`/`NIVEL_FEATURES`. Dois bugs de mapeamento encontrados e corrigidos testando com o Willians: (1) migration com `RENAME COLUMN` em duas etapas causava crash loop em todo restart (`column already exists`) — simplificada pra uma `ADD COLUMN` só; (2) módulo Autoatendimento apontava pra mesma flag da Agenda interna (`agenda`), deixando tenant sem esse módulo sem acessar a própria agenda — separado em `agenda` (Base, sempre ligada) e `autoatendimentoPublico` (módulo pago, só o link público). Dashboard/Relatório do operador viram Base (só `GET /relatorios/inteligencia` continua atrás do módulo Financeiro) — corrige um erro técnico que aparecia pra tenant sem esse módulo logo após login. Gatilho de Google Review a partir da Agenda (automático ao concluir + manual sob demanda). UX de módulo bloqueado: menu mostra tudo, item sem módulo fica visível mas travado (cadeado), em vez de sumir ou gerar erro. Features do tenant passam a atualizar sem exigir logout/login (`GET /auth/me` recalcula do banco, frontend revalida a cada 60s). Ver [[registro-de-decisoes-kernel]] (6 entradas, uma por item) para o detalhamento completo. |
| 3.2 | 2026-08-18 | **Sessão de incidentes + features em produção real (tenant "Lukinhas Barber"), 6 deploys ao longo do dia.** Login: colisão de username case-insensitive entre admin e gestor de um mesmo tenant travava o login do gestor pra sempre (backend sempre resolvia a conta errada) — checagem de disponibilidade de username ficou case-insensitive na criação, login ganhou `ORDER BY` como segunda camada. Notificações: `CHECK` constraint desatualizado (`ticket_medio` faltando) derrubava `GET /configuracoes/notificacoes` com 500 pra **todo** tenant, silenciosamente. Mobile: sidebar ficava presa aberta em qualquer celular no Safari — `window.innerWidth` no `useState` inicial podia capturar o viewport "ideal" do WebKit antes da `<meta viewport>` assentar; correção roda a checagem de novo logo após o mount. PWA: ícone de "Adicionar à Tela de Início" no iOS (ver seção "Sistema de Branding por Tenant") — HTML de `/t/:slug` passa a ser renderizado no backend; um cache mal desenhado nessa mesma feature causou um outage real (login de qualquer tenant em branco), corrigido removendo o cache. **Gestor pode ser atribuído a um login de barbeiro já existente** (`usuarios.eh_gestor`) — evita precisar de 2 credenciais pra quem corta cabelo e administra; 3 novas chaves de `permissoes_extra` (`estoque`, `gatilhos`, `campanhas`). Consumo Interno replicado no login do barbeiro. **Duração de serviço personalizável por profissional** (nova tabela `catalogo_duracao_profissional`) — Motor de Agendamento e Kalel passam a calcular disponibilidade considerando quem efetivamente vai atender, não mais um tempo padrão único. Bug de mapeamento corrigido no Painel Admin: 2 dos 4 módulos avulsos (Financeiro/Brainiac) sempre apareciam desmarcados ao reabrir um tenant, mesmo já salvos — `id` do módulo divergia do nome da feature real. Ver [[registro-de-decisoes-kernel]] (10 entradas) e [[modelo-de-dados-kernel]] para o detalhamento completo. |
