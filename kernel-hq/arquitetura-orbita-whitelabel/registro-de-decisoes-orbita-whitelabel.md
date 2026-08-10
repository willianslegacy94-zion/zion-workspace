---
status: stable
domain: orbita-whitelabel
source: claude
created: 2026-06-24
updated: 2026-08-03
owner: willians
---

# Registro de Decisões — Sistema Orbita Whitelabel (produto: Kernel)

> Referência: [[prd-orbita-whitelabel]] | [[requisitos-funcionais-orbita-whitelabel]] | [[arquitetura-orbita-whitelabel]]

Memória viva do produto. Registra o que mudou, por que mudou e o que isso significa para futuros deploys e clientes.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-06-24 — Fork do sistema-thieco como produto whitelabel

**Motivo:** O sistema-thieco provou ser um sistema funcional para barbearia (operando com 8.580 vendas históricas reais). A demanda por implantações em novos clientes tornou inviável customizar o código por cliente. A decisão foi extrair um produto genérico a partir do thieco.
**Impacto:**
- Remoção de todos os hardcodes específicos: nomes de unidades (Tambore/Mutinga), taxas PagBank por unidade e bandeira, regra de comissão zero do Thieco Leandro (agora qualquer profissional com `percentual_comissao = 0` tem o mesmo comportamento).
- `valor_liquido` passa a ser calculado como `valor - desconto` (sem taxas de operadora) — taxa de maquininha deve ser configurada no nível do PDV, não no sistema.
- `unidade` passa de ENUM `('tambore', 'mutinga')` para `VARCHAR(50)` livre. Valor padrão configurável via `UNIDADE_PADRAO` no env.
- Criação do sistema de feature flags: 5 módulos core (sempre ativos) + 11 módulos opcionais controlados por `FEATURE_*` no backend e `VITE_FEATURE_*` no frontend.
- Criação do sistema de branding: `VITE_TENANT_NOME`, `VITE_COR_PRIMARIA`, `VITE_COR_FUNDO`, `VITE_COR_SUPERFICIE`, `VITE_LOGO_URL` injetados no build do Vite e aplicados como tokens CSS em `:root`.
- Criação do sistema de labels por nicho: `VITE_NICHO` (barbearia/salao/clinica/generico) seleciona mapa de terminologia. Overrides individuais via `VITE_LABEL_*`.
- Seed do admin configurável via env: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NOME` — sem credenciais hardcoded.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-orbita-whitelabel, modelo-de-dados-orbita-whitelabel, requisitos-funcionais-orbita-whitelabel
**Observação:** A herança do thieco significa que o sistema nasce com maturidade de campo: todas as entidades, fluxos de comanda (upsell), cálculo de comissão por tipo de item, backfill automático no startup e migração incremental (runMigrations) já estavam testados em produção.

---

## 2026-06-24 — Estoque integrado à venda (catalogo_id FK)

**Motivo:** No thieco, o controle de estoque era visual apenas (quantidade no catálogo atualizada manualmente). A demanda de clientes com estoque maior tornou necessário debit automático ao registrar venda de produto.
**Impacto:**
- Backend `models.js`: migration `ALTER TABLE vendas ADD COLUMN IF NOT EXISTS catalogo_id INTEGER REFERENCES catalogo(id) ON DELETE SET NULL`. Nova coluna é o vínculo entre venda e item do catálogo.
- Backend `routes/vendas.js`: após criar venda, se `FEATURE_ESTOQUE = true` E `tipo_item = 'produto'` E `catalogo_id` preenchido, executa `UPDATE catalogo SET quantidade = GREATEST(0, quantidade - $qtd) WHERE id = $catalogo_id AND controla_estoque = true`. `GREATEST(0, ...)` previne estoque negativo.
- Frontend `RegistroVenda.jsx`: ao selecionar produto do catálogo (`ItemBtn.onSelect`), armazena `produto_catalogo_id = item.id`. Ao submeter, envia `catalogo_id` e `qtd_estoque` somente se `FEATURE_ESTOQUE = true` e `catalogo_id` existir.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (coluna catalogo_id em vendas), requisitos-funcionais-orbita-whitelabel (RF-050)
**Observação:** A feature é completamente transparente quando desativada — coluna `catalogo_id` aceita NULL, debit não é executado, frontend não envia o campo. Nenhuma mudança de comportamento para clientes sem `FEATURE_ESTOQUE = true`.

---

## 2026-06-24 — Ganho estimado em tempo real no Registro de Venda

**Motivo:** O colaborador não sabia quanto ia ganhar antes de confirmar um lançamento — calculava manualmente ou aguardava o painel atualizar. A transparência no ato do registro melhora motivação e reduz erros de digitação de valor.
**Impacto:**
- Backend `routes/auth.js`: `percentual_comissao` do profissional adicionado ao payload do JWT. Campo já existia na tabela — passou a ser incluído no token na geração do login.
- Frontend `RegistroVenda.jsx`: seção "Seu ganho estimado" exibida exclusivamente para `role = barbeiro` (colaborador) quando `FEATURE_PAINEL_COLABORADOR = true`. Cálculo em tempo real: `ganho_servicos = valor_servicos × (pctComissao / 100)` + `ganho_produtos = valor_produtos × (pctComissao / 100)`. Exibe zero quando `percentual_comissao = 0` — sem comissão fictícia.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel (RF-049)
**Observação:** O cálculo é estimado — não considera possíveis ajustes do backend (ex: descontos por qtd_clientes). O valor gravado no banco pelo backend é sempre o autoritativo. A exibição é oculta para admin e operador — contexto exclusivo do colaborador.

---

## 2026-06-24 — ModalFechamento no painel do colaborador

**Motivo:** O colaborador não tinha visibilidade do fechamento de caixa do próprio dia — precisava perguntar para o admin ou acessar a tela de Lançamentos. O modal de fechamento fecha essa lacuna.
**Impacto:**
- Backend `routes/painel-barbeiro.js`: endpoint `GET /painel-barbeiro/fechamento?data=YYYY-MM-DD` adicionado. Retorna: `faturamento_bruto`, `total_descontos`, `faturamento_liquido`, `comissao_bruta`, `por_forma_pagamento` (qtd_comandas, total_bruto, total_liquido por forma), `detalhamento` (lista de itens do dia com cliente, serviço, valor, comissão). `profissional_id` fixado pelo JWT — colaborador não pode consultar fechamento de outro.
- Frontend `api.js`: `painelBarbeiro.fechamento(params)` adicionado ao namespace.
- Frontend `MeuPainel.jsx`: componente `ModalFechamento` criado inline. Botão "Fechamento do Dia" exibido no painel quando `periodo === 'dia'` e `FEATURE_PAINEL_COLABORADOR = true`. Labels de forma de pagamento: mapa genérico `dinheiro/pix/credito/debito/cortesia` — sem labels específicos de operadora.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel (RF-048, RF-053)
**Observação:** A feature é guarded por `FEATURE_PAINEL_COLABORADOR`. Para clientes sem esse módulo, o botão não aparece e o endpoint retornará 404 (featureGate). O mapa de labels do ModalFechamento usa as 5 formas de pagamento padrão do sistema — sem dependência de configuração de maquininha por unidade.

---

## 2026-06-24 — DRE sync: fluxo-caixa usa SUM(comissao) armazenado

**Motivo:** O endpoint `/relatorios/fluxo-caixa` (que alimenta os cards de comissão do Dashboard) recalculava comissões ad hoc com `CASE WHEN tipo_item = 'servico' THEN valor * pct ELSE valor * 0.10 END` via JOIN com `profissionais`. Esse recálculo: (1) era hardcoded; (2) divergia do valor armazenado quando `qtd_clientes > 1` ou quando o percentual do profissional mudava após a venda. O DRE e o ModalAtendimentos já usavam `SUM(comissao)` — o fluxo-caixa era o único outlier.
**Impacto:**
- Backend `routes/relatorios.js`: query de `totaisEntrada` substituída. Antes: `LEFT JOIN profissionais + CASE WHEN`. Depois: `SUM(comissao_servico)`, `SUM(comissao_produto)`, `SUM(comissao)` diretamente das colunas armazenadas em `vendas`. Alinhado com o motor do DRE e ModalAtendimentos.
**Status:** aplicado
**Artefatos atualizados:** —
**Observação:** A regra geral passa a ser: "sempre ler `comissao` do banco, nunca recalcular". Qualquer endpoint que mostre comissão deve usar `SUM(comissao)`, `SUM(comissao_servico)` ou `SUM(comissao_produto)` — nunca multiplicar `valor × percentual` em runtime.

---

## 2026-06-24 — DRE sync: gastos_por_categoria inclui descricao no GROUP BY

**Motivo:** A query `gastos_por_categoria` agrupava apenas por `(categoria, unidade)`, ocultando itens individuais de despesa dentro de cada categoria. No DRE exportado, o accordion analítico (categoria com sub-linhas por descrição) precisava de granularidade por `descricao`. O thieco já tinha essa granularidade — o whitelabel não herdou essa correção.
**Impacto:**
- Backend `routes/relatorios.js`: GROUP BY expandido de `(categoria, unidade)` para `(categoria, descricao, unidade)`, com ORDER BY `categoria ASC, total DESC`. Cada `(categoria, descricao)` vira uma linha separada.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel (RF-046)
**Observação:** Backwards-compatible — os campos retornados (`categoria`, `descricao`, `total`, `qtd`, `unidade`) já existiam; só muda a granularidade das linhas. Frontend `buildDreHtml` agrupa em memória por categoria para renderizar o accordion.

---

## 2026-06-24 — Endpoint /origem-clientes com feature gate de clientes

**Motivo:** O thieco tinha o endpoint `/relatorios/origem-clientes` implementado. O whitelabel não herdou esse endpoint, mas a feature é útil para qualquer cliente com `FEATURE_CLIENTES = true`.
**Impacto:**
- Backend `routes/relatorios.js`: endpoint `GET /relatorios/origem-clientes` adicionado antes do `module.exports`. Requer `authenticate`, `requireAdmin` e `featureGate('clientes')`. Retorna breakdown por `origem_cliente` e `tipo_cliente` com `qtd_atendimentos` (comandas únicas via `COUNT(DISTINCT COALESCE(venda_origem_id, id))`) e `total_bruto`. Unidade filtrável via query param para admin.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel (RF-035, RF-047)
**Observação:** O endpoint só existe e responde quando `FEATURE_CLIENTES = true`. Para tenants sem esse módulo, retorna 404 — correto e esperado.

## 2026-07-10 — Paleta de fábrica idêntica ao sistema-thieco, com fallback de personalização

**Motivo:** O whitelabel derivava toda a paleta (onix, surface, sombras, tons de dourado) por fórmula `lighten/darken` sobre 3 cores base do tenant. Isso divergia visualmente do sistema-thieco original — testado: `lighten('#D4AF37', 50)` dá `#FFE169`, mas o valor real hand-tuned é `#F0E6C8`. O objetivo era que o visual "de fábrica" (sem nenhuma customização de cliente) fosse pixel-idêntico ao thieco, mantendo a capacidade de qualquer tenant customizar via `VITE_COR_*`.
**Impacto:**
- `frontend/src/config/tenant.js`: os defaults hardcoded de `corPrimaria`/`corFundo`/`corSuperficie`/`corFundoEscuro`/`corSuperficieEscuro` passam de `?? '<hex>'` para `|| null` (mesmo padrão que `corPrimariaEscuro` já usava). Novo campo `usaPaletaPersonalizada: Boolean(VITE_COR_PRIMARIA || VITE_COR_FUNDO || VITE_COR_SUPERFICIE)`.
- `frontend/src/lib/theme.js`: adicionadas as 24 constantes hex exatas do sistema-thieco (12 por modo claro/escuro — fundo, superfície, onix-50/100, surface card/hover/border, primária + light/dark/muted/shine). `applyTenantTheme(modo)` ramifica em `tenant.usaPaletaPersonalizada`: `false` → monta as cores direto das constantes exatas (paleta de fábrica); `true` → mantém a derivação lighten/darken existente (personalização por tenant), com fallback pra paleta de fábrica nos campos não informados.
- `tailwind.config.js` e `ThemeContext.jsx` não mudaram — já eram agnósticos a como as variáveis CSS são calculadas.
**Status:** aplicado
**Artefatos atualizados:** design-system-orbita-whitelabel, arquitetura-orbita-whitelabel
**Observação:** Um tenant sem nenhuma `VITE_COR_*` configurada agora recebe a identidade visual EXATA do sistema-thieco (dourado `#D4AF37`/`#A9791E`, fundo onyx `#0F0E0A`/creme `#F7F4EC`). Configurar qualquer `VITE_COR_*` liga `usaPaletaPersonalizada` e volta a usar a fórmula derivada — o mesmo comportamento que já existia antes desta mudança.

---

## 2026-07-10 — Combos V2: créditos dinâmicos por nome de serviço (JSONB)

**Motivo:** O módulo de Combos herdado do whitelabel V1 usava colunas fixas (`limite_corte`, `limite_barba`) — qualquer serviço novo exigiria migration e alteração de código. O sistema-thieco já tinha evoluído para um motor genérico baseado em JSONB, testado em produção. Portado para o whitelabel generalizando as partes que ainda eram específicas da Thieco (lista fixa de unidades, taxa de cartão negociada por unidade).
**Impacto:**
- `backend/models.js`: `combos_contratados` ganha colunas `creditos JSONB` e `creditos_originais JSONB` (`ADD COLUMN IF NOT EXISTS`, não-destrutivo). Nova tabela `catalogo_combo_creditos` (catalogo_id, servico, quantidade) — a "receita" de créditos de cada pacote vendável do catálogo (categoria='combo'). `Catalogo.findAll/findById` passam a agregar `creditos` via subselect `jsonb_object_agg`. Novo `ComboContratado.findUltimoEncerradoByCliente`, coluna computada `esgotado`, e `verificarExpiracaoCliente` passa a checar `jsonb_each_text(creditos)` além da data de validade. Backfill idempotente `backfillCombosCreditosJsonb()` migra `limite_corte`/`limite_barba` legado pra JSONB (não havia dados reais no ambiente — 0 linhas migradas).
- `backend/routes/combos.js`: reescrito. Rotas legadas V1 (`GET/POST/PATCH /combos`, `/buscar`, `/uso`, `/ativar`) removidas — substituídas por `/saldo`, `/contratar`, `/consumo`, `/consumo-lote`, `/contratados`, `/extrato/:id`, `/ranking-servicos`, `PATCH /contratados/:id/encerrar`, `PATCH /contratados/:id/data-compra`. **Não portado** (regra de negócio da Thieco): lista fixa `UNIDADES_VALIDAS = ['tambore','mutinga']` (unidade já é `VARCHAR` livre no whitelabel) e o branch de taxa de cartão negociada por unidade em `calcularValorLiquido` (mantida a versão simples já existente, só `TAXAS_PAGBANK`).
- `frontend/src/components/CardSaldoCombo.jsx` e `ChecklistCreditosCombo.jsx` (novos, genéricos — uma linha por chave de `creditos`, sem serviço fixo no código). `pages/Combos.jsx` reescrito pra V2 com seletor de pacote do catálogo, edição de data de lançamento e reativação de combo esgotado. `pages/RegistroVenda.jsx`: função `AbaCombo` inteira trocada de V1 pra V2 (maior mudança, ~900 linhas). `pages/Clientes.jsx`: card de combo ativo no modal de detalhes do cliente.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel, requisitos-funcionais-orbita-whitelabel, arquitetura-orbita-whitelabel
**Observação:** Sem seed de catálogo — um tenant que ligar `FEATURE_COMBOS` precisa que um dev insira as linhas de `catalogo_combo_creditos` via SQL manualmente (o sistema-thieco também não tem UI de admin pra isso — mesma limitação, não é regressão). Fluxo completo testado manualmente contra o banco real: contratar → consumir em lote → editar data de compra → ranking de serviços, todos OK. Zero dados reais em `combos_contratados` no momento da migration — mudança de schema sem risco.

---

## 2026-07-10 — Recorrência em Despesas

**Motivo:** Despesas fixas mensais (aluguel, contas de consumo) exigiam relançamento manual todo mês. O sistema-thieco já tinha esse recurso.
**Impacto:**
- `backend/models.js`: `gastos` ganha `recorrente BOOLEAN`, `frequencia_recorrencia VARCHAR(10)` (`semanal`\|`mensal`\|`anual`), `gasto_origem_id INTEGER` (auto-referência). Novo `Gasto.gerarOcorrenciasFuturas(gastoOrigem, quantidade=11)` — gera as próximas 11 ocorrências vinculadas à despesa original via `gasto_origem_id`, espaçadas por `proximaDataRecorrencia()`.
- `backend/routes/gastos.js`: `POST /gastos` valida `recorrente`/`frequencia_recorrencia` e chama `gerarOcorrenciasFuturas` quando `recorrente = true`. Categorias `utilidades`, `impostos`, `suprimentos` adicionadas (a doc de requisitos-funcionais já as listava — código estava desatualizado em relação à própria doc).
- `frontend/src/pages/RegistroGasto.jsx`: checkbox "Despesa recorrente" + select de frequência; badge de ícone (Repeat) na listagem para despesas recorrentes; mensagem de sucesso informa que as 11 ocorrências futuras já foram geradas.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel
**Observação:** Testado contra o banco real — criada 1 despesa recorrente mensal, confirmadas 12 linhas no total (original + 11 futuras), datas mensais corretas, todas vinculadas via `gasto_origem_id`.

---

## 2026-07-10 — Rankings do Dashboard: origem de clientes (formato) e serviços via combo

**Motivo:** O sistema-thieco tinha 2 componentes de ranking no Dashboard que o whitelabel não herdou: canal de aquisição de clientes (gráfico de barras) e serviços mais consumidos via combo.
**Impacto:**
- `backend/routes/relatorios.js`: `GET /relatorios/origem-clientes` já existia (ver entrada 2026-06-24) mas com formato de resposta diferente do que os componentes do thieco esperam. Resposta agora é `{ periodo, total_atendimentos, canais: [{ origem, total_clientes_unicos, total_atendimentos, percentual }] }` em vez de `{ periodo, dados: [...] }`.
- `frontend/src/components/RankingOrigemClientes.jsx` (novo, copiado — genérico, usa `origem_cliente` já existente). `RankingServicosCombo.jsx` (novo) — **generalizado**: a versão original do thieco usa `COR_SERVICO`/`LABEL_SERVICO` fixos pra `corte`/`barba`, que não cobrem nomes de serviço dinâmicos (ver Combos V2 acima). Trocado por paleta fixa indexada por hash do nome do serviço (`corServico(nome)`), garantindo cor estável por serviço sem mapa hardcoded.
- `frontend/src/components/Dashboard.jsx`: os dois wired lado a lado, gateados por `features.clientes` e `features.combos` respectivamente.
**Status:** aplicado
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel
**Observação:** A mudança de shape do endpoint `/origem-clientes` é breaking pra qualquer consumidor que dependesse do formato antigo `{ dados: [...] }` — não havia nenhum outro consumidor no código além do componente recém-portado.

---

## 2026-07-10 — Migração para multi-tenant real (banco compartilhado) + Supabase

**Motivo:** O modelo original ("1 deployment Docker = 1 cliente", ver PRD "fora do escopo") exigia subir um novo stack Docker inteiro por cliente novo — banco, backend e frontend próprios, branding/feature flags fixados em build-time via `.env` e build args. Isso não escala para onboarding rápido de múltiplos clientes. Decisão: ir para 1 banco Postgres compartilhado (Supabase), com `tenant_id` em toda tabela e branding/feature flags resolvidos em runtime a partir do login — onboarding de cliente novo vira "inserir uma linha em `tenants`", não "subir infraestrutura nova". Este item estava explicitamente listado como **fora do escopo** no PRD original ("Multi-tenant em banco compartilhado (cada cliente tem seu próprio deploy)") — a decisão reverte essa exclusão.
**Impacto:**
- **Schema:** nova tabela `tenants` (`id, slug UNIQUE, nome, ativo, features JSONB, branding JSONB, created_at`). Coluna `tenant_id INTEGER REFERENCES tenants(id)` adicionada (nullable, retrofit não-destrutivo) em toda tabela de negócio: `unidades, profissionais, vendas, gastos, catalogo, usuarios, feedbacks, planos_acao, sugestoes, clientes, combos, combos_contratados, combos_consumo, metas, metas_unidade, metas_diarias, configuracoes, notificacoes`. Constraints únicas que eram globais (`usuarios.username`, `profissionais.nome`, `unidades.slug`, `catalogo (nome, unidade)`, `metas_unidade (unidade, mes, ano)`, `metas_diarias (unidade, data)`) viraram compostas com `tenant_id` — duas barbearias podem ter profissional/unidade com o mesmo nome sem colidir. `configuracoes.chave` (taxas de cartão) deixou de ser PK sozinha e virou PK composta `(tenant_id, chave)` — taxa de maquininha agora é por cliente, não fixa por deploy. Tudo aplicado via extensão de `runMigrations()` em `backend/models.js` (mesma convenção existente de `ALTER TABLE ADD COLUMN IF NOT EXISTS` idempotente — nenhuma ferramenta de migration nova introduzida).
- **Auth/backend:** `POST /auth/login` passa a exigir `slug` (do tenant) além de `username`/`senha` — usuário deixa de ser único globalmente, só dentro do tenant. JWT ganha `tenant_id`, `tenant_slug` e `features` (snapshot de `tenants.features` mesclado com o conjunto core sempre-true, resolvido em `backend/config/features.js::resolveFeatures()`). `backend/server.js` reordenado: `authenticate` virou middleware global (antes: espalhado/ausente por rota) — fecha de graça um gap real que `POST /import` não tinha autenticação nenhuma. `middleware/featureGate.js` deixou de ler `process.env` e passa a checar `req.user.features[flag]` — 404 por tenant, sem precisar reiniciar o processo quando um admin muda uma flag no banco (só o próximo login pega a mudança, já que a flag fica embutida no JWT). Novo `backend/routes/public.js` — único endpoint sem autenticação além de `/auth/*`: `GET /public/tenants/:slug` retorna só branding (nunca features).
- **tenant_id propagado em ~30 funções de `backend/models.js`** (todas passam a receber `tenantId` como primeiro argumento posicional) e em todas as rotas de `backend/routes/*.js`. Corrigidos no processo, porque só ficaram exploráveis ao virar banco compartilhado: **IDOR** em várias funções que buscavam só por PK (`Profissional.findById/toggleAtivo`, `Cliente.findById`, `ComboContratado.*ByCliente`, `ComboConsumo.findByCombo`, `ativarProximoNaFila`, `verificarExpiracaoCliente`) — todas passaram a exigir `tenant_id` no WHERE; **SQL injection latente** em `routes/relatorios.js` e `routes/metas.js`, que interpolavam o query param `unidade` direto na string SQL (`` `AND unidade = '${unidade}'` ``) — agora parametrizado; **cache cross-tenant** em `routes/vendas.js` (`getTaxas()` tinha cache global de taxas de cartão — viraria vazamento de taxa entre clientes — virou `Map` por `tenant_id`).
- **Frontend:** `config/tenant.js` e `config/features.js` (lidos de `import.meta.env.VITE_*` no build) **removidos**. Novo `contexts/TenantConfigContext.jsx` resolve o tenant fazendo parse manual de `/t/:slug` na URL (sem react-router — projeto usa state manual, mesmo estilo) e busca branding via `GET /public/tenants/:slug` antes do login. `lib/theme.js`/`contexts/ThemeContext.jsx`: `applyTenantTheme`/`getModoInicial` passam a receber `branding` como argumento em vez de importar `tenant` estático — primeiro paint usa paleta de fábrica neutra (`main.jsx` chama sem branding resolvido ainda), reaplicada quando o fetch assíncrono resolve. Feature flags no frontend não são mais um módulo estático — vêm embutidas no JWT decodificado (`useAuth().user.features`), mesmo padrão que `unidade`/`role` já usavam. `App.jsx`: `GRUPOS_ADMIN/OPERADOR/BARBEIRO` (constantes de módulo) viraram funções `gruposAdmin(features)/gruposOperador(features)/gruposBarbeiro(features)` chamadas dentro dos componentes com `user.features`.
- **Infra:** `docker-compose.yml` e `frontend/Dockerfile` perdem os build args `VITE_TENANT_*`/`VITE_COR_*`/`VITE_FEATURE_*` — um único build de frontend atende todos os tenants agora (só `VITE_NICHO` continua build-time, ver observação). `backend/db.js` ganha suporte a SSL (`DB_SSL=true`) para conectar no Supabase; Postgres local via Docker continua existindo só para dev.
**Status:** aplicado — schema, backend e frontend testados (build limpo, migração idempotente rodada 2x, login cross-tenant isolado via curl, IDOR bloqueado com 404 + lista vazia, feature flag por tenant funcionando). **Não conectado ao Supabase de verdade ainda** (falta o projeto existir e a connection string ser configurada) e **não testado visualmente em navegador** (sessão sem ferramenta de browser disponível). **A Thieco não migra para este banco — nunca vai existir esse movimento.** O `sistema-thieco` permanece definitivamente como instância própria, separada; este banco multi-tenant é exclusivamente para clientes novos.
**Artefatos atualizados:** prd-orbita-whitelabel (escopo), requisitos-funcionais-orbita-whitelabel (variáveis de ambiente, módulo de auth), arquitetura-orbita-whitelabel (camadas, feature flags, branding, segurança, escala), modelo-de-dados-orbita-whitelabel (tabela tenants + tenant_id), design-system-orbita-whitelabel (branding runtime), indice-orbita-whitelabel (tabela de diferenças com o sistema-thieco)
**Observação:** `VITE_NICHO`/`config/labels.js` (terminologia por nicho de negócio — barbearia/salão/clínica) **não entrou no escopo desta migração** e continua build-time — é a última coisa presa a um build único; se dois tenants no mesmo deployment precisarem de nichos diferentes, isso ficará inconsistente e precisará da mesma tratativa (runtime, resolvida por tenant) numa rodada futura. RLS (Row Level Security) no Postgres também ficou fora de escopo por decisão explícita — a isolação primária é `tenant_id` obrigatório em toda query (já feito); RLS via `SET LOCAL app.tenant_id` exigiria trocar o padrão atual de `pool.query()` direto por checkout de conexão + transação por request em todas as rotas, mudança maior e separada. Plano completo da migração documentado fora do repositório (histórico de sessão Claude Code).

<!-- novas entradas sempre abaixo desta linha, nunca acima -->

## 2026-07-13 — Paridade de funcionalidades com o sistema-thieco: Motor de Agendamento, Campanhas e Notificações avançadas

**Motivo:** Auditoria comparando a árvore de arquivos do `sistema-thieco` (implementação de referência da arquitetura, TASK-23/24/27/28) com o `sistema-orbita-whitelabel` encontrou 3 blocos de funcionalidade inteiros ausentes: motor de agendamento (agenda interna + autoagendamento público do cliente + confirmação de presença), campanhas de marketing (segmentação + disparo manual) e a maior parte dos gatilhos de notificação (o whitelabel só tinha os 3 geradores mais simples — estoque, meta, ranking — sem cron nenhum registrado em `server.js`). Pedido explícito: replicar **funcionalidades e botões**, não regras de negócio específicas da Thieco.

**Impacto:**
- **Schema:** tabelas novas `jornada_unidade`, `agendamentos` (+ `EXCLUDE USING gist` anti-overlap via `btree_gist`), `configuracoes_notificacoes`, `configuracoes_gatilhos_cliente`, `campanhas_promocionais`, `campanhas_destinatarios` — todas nascem com `tenant_id INTEGER NOT NULL REFERENCES tenants(id)` desde a criação (diferente do retrofit de 2026-07-10: essas tabelas são posteriores ao multi-tenant, não têm dado legado pra migrar). Colunas novas: `unidades.whatsapp_remetente`/`unidades.link_avaliacao` (no thieco isso vivia em chaves string `whatsapp_remetente_<unidade>` na tabela genérica `configuracoes`, porque lá unidade era um `ENUM` fixo — aqui `unidades` já é tabela de verdade por tenant, então o dado ganhou coluna própria, mecanismo equivalente com storage mais natural); `usuarios.email`/`notif_canal_whatsapp`/`notif_canal_email` (perfil de notificação do admin); `catalogo.duracao_minutos`; `notificacoes.enviado_email`.
- **Adaptação multi-tenant sistemática:** toda função/query portada do thieco que era `unidade`-scoped virou `tenant_id`-scoped (primeiro parâmetro `tenantId`, toda query com `WHERE tenant_id = $1`). `UNIDADES_VALIDAS = ['tambore', 'mutinga']` (allowlist hardcoded presente em `agendamentos.js` e `campanhas.js` do thieco) foi **removida** — `unidade` passa a ser validada como string livre não-vazia, já que cada tenant tem suas próprias unidades. `NOME_BARBEARIA` (constante hardcoded usada nos templates de mensagem) virou uma consulta a `tenants.nome` em runtime.
- **Backend — rotas novas:** `routes/agendamentos.js` (autenticado — CRUD, cálculo de disponibilidade, jornada) e `routes/agendamentos-publico.js` (sem `authenticate`, montada em `server.js` **antes** do middleware global, junto de `/public`). Diferente do thieco, que resolve a rota pública só por `unidade` (sistema single-tenant), aqui as rotas públicas recebem **dois níveis**: `tenantSlug` (resolvido via `Tenant.findBySlug`, mesma função que `routes/public.js` já usa) + `unidade`. `routes/campanhas.js` (novo). `routes/notificacoes.js` ganhou `getTelefonesRemetente`, `gerarLembretesAgendamento`, `gerarGatilhoAniversariante`, `gerarGatilhoClienteSumido`, `gerarGatilhoAvaliacaoPosVenda`, `verificarNotificacoesConfiguradas` e as filas `GET/PATCH /notificacoes/whatsapp|email/*`. `routes/configuracoes.js` ganhou CRUD para as 2 tabelas de configuração acima + remetente WhatsApp + link de avaliação + perfil do admin — com criação lazy das linhas padrão (`garantirConfiguracoesNotificacoes`/`garantirGatilhosCliente`) na primeira consulta de cada unidade, já que não há seed fixo em migration (o thieco fazia `CROSS JOIN` com as 2 unidades hardcoded no seed; aqui as unidades de cada tenant não existem no momento da migration).
- **`routes/public.js`:** `GET /public/tenants/:slug` passou a devolver também a lista de unidades do tenant (`slug`, `nome`) — necessário pra página de autoagendamento mostrar o nome da unidade sem exigir login; continua sem devolver features nem dado de negócio.
- **`server.js`:** cron reescrito para iterar **todos os tenants ativos** (`Tenant.findAllAtivos()`, nova função em `models.js`) a cada disparo, só chamando o gerador se a feature do tenant estiver ligada (`paraCadaTenantAtivo(featureNecessaria, fn)`) — o thieco roda 1 processo por cliente e nunca precisou disso. Mesmos dois timers do thieco (5min: lembrete de agendamento + avaliação pós-venda; 15min: notificações configuráveis + aniversariante + cliente sumido).
- **Frontend:** páginas novas `Agenda.jsx`, `AgendamentoPublico.jsx`, `ConfirmarPresenca.jsx`, componentes `AgendaGrid.jsx`/`DiasMenorMovimentoCard.jsx` (este último preenchendo um gap que já existia antes desta rodada: o endpoint `/relatorios/inteligencia` nunca expunha `dias_menor_movimento`, mesmo a query já existindo no thieco). `Configuracoes.jsx` ganhou abas condicionadas a feature flag (`notificacoes` → Notificações + Gatilhos ao Cliente; `campanhas` → Campanhas) — a aba "Taxas de Cartão" pré-existente do whitelabel (modelo global por tenant, sem bandeira/unidade) foi mantida como estava, **não** substituída pela versão por-unidade-e-bandeira do thieco (regra de negócio distinta, fora do escopo do pedido). `App.jsx`: link público reaproveita o path `/t/:tenantSlug` já existente (branding) + query params `?agendar=:unidadeSlug` / `?confirmar=:codigo`, resolvidos em `AppRoot` antes do gate de autenticação — decisão tomada com o usuário (opção recomendada) em vez de um path dedicado `/agendar/:tenant/:unidade` novo.
- **Feature flags novas em `tenants.features`:** `agenda`, `campanhas` (ambas opcionais, seguem o mesmo padrão de `featureGate()`/menu condicional já usado pelos módulos existentes).
**Status:** aplicado e testado localmente ponta a ponta via `docker compose up -d --build` (stack `orbita-test`) — migrations rodaram limpo (7 tabelas novas confirmadas via `\dt`), login retorna `features.agenda`/`features.campanhas` no JWT, `GET /agendamentos/publico/:slug/servicos` e `/disponibilidade` responderam corretamente com dados de catálogo/jornada semeados manualmente pro tenant de teste (`principal`), `GET /campanhas` e `GET /configuracoes/notificacoes` responderam com criação lazy das linhas padrão. Não testado: envio real de WhatsApp/e-mail (não existe — ver observação), fluxo completo de autoagendamento até confirmação de presença via UI de navegador (verificado só via curl/API).
**Artefatos atualizados:** requisitos-funcionais-orbita-whitelabel (módulos 12/13/14 + tabela de feature flags), arquitetura-orbita-whitelabel (camadas, novas seções "Sistema de Agendamento Público"/"Sistema de Notificações e Gatilhos Automáticos"/"Sistema de Campanhas de Marketing", fronteiras de segurança, histórico de versão), modelo-de-dados-orbita-whitelabel (entidades Unidade, Notificação, Jornada da Unidade, Agendamento, Configuração de Notificações, Configuração de Gatilho ao Cliente, Campanha Promocional, Campanha Destinatário + relacionamentos + estados + retenção)
**Observação:** confirmado durante a auditoria do thieco que o envio de WhatsApp **não é uma integração real** em nenhum dos dois sistemas — é fila-só-em-banco (`notificacoes.canal='whatsapp'`, `enviado_whatsapp`), consumida manualmente hoje; a automação real fica pro Órbita Horizon/Cortex assumirem no futuro. Isso foi decisivo pra não inventar uma integração de terceiro nesta rodada. A tabela `configuracoes_gatilhos_cliente`/`configuracoes_notificacoes` não tem seed fixo (diferente do thieco, que faz `CROSS JOIN` com 2 unidades hardcoded no `runMigrations`) — a criação das linhas padrão é lazy, na primeira consulta de cada unidade pela tela de configurações; isso significa que um tenant que nunca abriu essas abas simplesmente não tem linhas ainda, o que é o comportamento esperado, não um bug.

---

## 2026-07-28 — Motor de disparo real (WhatsApp/e-mail) e concierge de IA (Cortex/Quasar) portados pro whitelabel, sem redeploy por cliente

**Motivo:** A observação da entrada de 2026-07-13 ficou obsoleta antes de completar duas semanas: o sistema-thieco recebeu envio real de WhatsApp (Evolution API, self-hosted) e e-mail (Resend), além de um concierge conversacional de IA (Órbita Quasar) e um canal administrativo de relatório sob demanda (Órbita Cortex) — ambos rodando como microservices Python compartilhadas fora do sistema-thieco. Pedido explícito: portar essa mesma capacidade pro whitelabel **sem** criar infraestrutura nova por cliente (nada de 1 instância Evolution/Cortex/Quasar por tenant) — usar a mesma arquitetura multi-tenant já decidida em 2026-07-10 (1 deployment atende todos).

**Impacto:**
- **`backend/middleware/auth.js`:** nova `authenticateInternal` (chave compartilhada via header `X-Internal-Key`, env `INTERNAL_SERVICE_KEY`) — auth serviço-a-serviço pro Cortex/Quasar chamarem o whitelabel sem JWT de usuário. Idêntica à do sistema-thieco.
- **`backend/services/whatsappService.js` + `backend/routes/whatsapp.js`** (novos, não existiam): canal válido deixa de ser array fixo — vira `SELECT slug FROM unidades WHERE tenant_id = $1` + pseudo-canal `admin` sempre presente. Nome da instância Evolution API muda de `{prefixo}-{canal}` (thieco) pra `{tenantSlug}-{unidadeSlug}` (ou `{tenantSlug}-admin`) — necessário porque duas barbearias diferentes no mesmo deployment compartilhado poderiam ter uma unidade com o mesmo slug.
- **`backend/routes/internal.js`** (novo, mounted **antes** do `app.use(authenticate)` global — achado de integração: diferente do thieco, que aplica auth por rota, o whitelabel tem auth global desde a migração multi-tenant de 2026-07-10, então rotas serviço-a-serviço têm que ficar fora dessa fronteira, mesmo tratamento de `/public` e `/agendamentos/publico`): `/transbordo` (Quasar aciona humano), `/relatorio-sob-demanda` (Cortex responde admin), `/admin-autorizado` (checagem de telefone contra loop infinito), `/tenant-nome`, `/tenant-by-slug`, `/unidade-atendimento` (bundle de FAQ pro Quasar: jornada, equipe, catálogo, regras — monta em tempo real, sem cache), `/cliente-atendimento` (contexto de churn pro Quasar, réplica em JS da lógica de `buscar_cliente_thieco`), e o mais crítico, `/resolve-instancia`.
- **`GET /internal/resolve-instancia`** — decisão de design chave: `{tenantSlug}-{unidadeSlug}` **não pode ser parseado no client (Cortex/Quasar) via `string.partition("-")`** porque tanto `tenantSlug` quanto `unidadeSlug` são slugs livres que podem conter hífen (ex.: `barbearia-exemplo-jardim-mutinga` é genuinamente ambíguo). Resolvido fazendo o parsing no lado do whitelabel via join exato no SQL: `WHERE (t.slug || '-' || u.slug) = $1`. O sufixo `-admin` continua seguro de parsear client-side (string fixa, não um slug variável) — usado pelo Cortex via `/tenant-by-slug` em vez de `/resolve-instancia`.
- **`unidades.atendimento_ia` (JSONB)** — nova coluna, ver [[modelo-de-dados-orbita-whitelabel]]. Estabelece a convenção de "config por unidade vira coluna em `unidades`", explicitamente para não repetir o padrão de chave string `taxa_{unidade}_x` do thieco (que pressupõe lista de unidades fixa).
- **Bug pré-existente encontrado e corrigido:** `POST /notificacoes/gerar` apagava e recriava os alertas voláteis a cada chamada, perdendo o estado `lida` toda vez que o painel era aberto. Corrigido portando o padrão `sincronizarAlertas` (upsert) do sistema-thieco. Confirmado com teste local: marcar como lida → rodar `/gerar` de novo → continua lida.
- **`orbita-cortex/main.py` e `orbita-quasar/main.py`** (fora deste repo, microservices compartilhadas): removido todo hardcode de tenant (`INSTANCIA_ADMIN_POR_TENANT`, `TENANTS_ATENDIMENTO_SUPORTADOS`, `UNIDADES_INFO` fixo). Ambas passam a decidir "thieco vs. whitelabel" pelo formato da instância recebida no webhook da Evolution API: bate num dicionário fixo → thieco (comportamento antigo, preservado); senão → consulta `/internal/resolve-instancia` (Quasar) ou `/internal/tenant-by-slug` (Cortex, canal admin) e monta o contexto em tempo real via `/internal/unidade-atendimento` / `/internal/cliente-atendimento`. Nenhum código novo é exigido por cliente novo do whitelabel.
- **Papel de leitura dedicada (`cortex_readonly`) — avaliado e descartado.** O plano original (ver Playbook DevOps) previa uma role Postgres só-leitura pro Cortex/Quasar acessarem `clientes`/`usuarios` direto no banco compartilhado. O desenho que emergiu tornou isso desnecessário: toda leitura passa pela API do whitelabel (`/internal/cliente-atendimento`, `/internal/admin-autorizado`), autenticada por `X-Internal-Key` — nenhuma das duas microservices abre conexão direta com o Postgres do whitelabel. Diferente do sistema-thieco legado, que mantém `THIECO_DATABASE_URL` + `cortex_readonly` própria (cliente antigo, banco dedicado, não migra).
**Status:** aplicado e testado localmente ponta a ponta via `docker compose up -d --build` (stacks `orbita-quasar`, `orbita-cortex` e `orbita-test` na rede compartilhada `orbita_shared`): resolução de instância (`resolve-instancia`) confirmada pros 3 casos (tenant conhecido, tenant whitelabel via API, instância desconhecida ignorada sem erro), bundle `/internal/unidade-atendimento` retornando dado real semeado (jornada, equipe, catálogo), webhook do Quasar simulado ponta a ponta (`fromMe: true` ignorado corretamente, mensagem de cliente gera resposta e tenta enviar via Evolution API real com o nome de instância correto). **Não testado:** envio de WhatsApp/IA com credenciais reais de produção (chave OpenRouter e instância Evolution pareada de verdade só existem pro tenant Thieco hoje) — a mecânica de roteamento está validada, falta um cliente whitelabel real com número pareado pra validar a mensagem ponta a ponta de verdade.
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (coluna `atendimento_ia`), backlog-tarefas-orbita-whitelabel (gap de CRUD de unidade + taxa por unidade)
**Observação:** Corrige a observação da entrada de 2026-07-13 — o envio de WhatsApp/e-mail deixou de ser fila-só-em-banco nesse meio-tempo (ver histórico do sistema-thieco), e agora essa automação real também está disponível pro whitelabel, pela mesma arquitetura de deployment único. Ficou um gap descoberto testando local, não relacionado à integração de WhatsApp em si: não existe tela nem rota pra cadastrar uma 2ª unidade (só a unidade de bootstrap existe), e a aba de taxas de cartão do whitelabel perdeu a diferenciação por unidade que o thieco tem. Resolvido na entrada seguinte, mesmo dia.

---

## 2026-07-28 — CRUD de unidade + taxa de cartão por unidade, repetindo o layout do sistema-thieco

**Motivo:** Gap descoberto testando localmente a integração de WhatsApp (entrada anterior): a tela de taxas do whitelabel não diferenciava por unidade, e não existia nenhuma forma de cadastrar uma 2ª unidade pra um tenant — mesmo o schema já suportando N unidades desde a migração multi-tenant (2026-07-10). Pedido explícito: repetir o layout do sistema-thieco (seletor de unidade em botões toggle + cards agrupados por forma de pagamento), sem reinventar o design.

**Impacto:**
- **`backend/routes/unidades.js`** (novo): `GET /unidades` (ativas), `GET /unidades/admin` (todas, admin), `POST /unidades` (slug derivado do nome via slugify, deduplicado com sufixo numérico, **imutável** depois de criado — `unidade` é gravado como texto livre em `vendas`/`profissionais`/`catalogo`/`clientes`, não FK, então mudar o slug quebraria essas referências), `PATCH /unidades/:id` (nome), `PATCH /unidades/:id/ativo`.
- **`unidades.taxas` (JSONB, nova coluna)** — mesma convenção de `unidades.atendimento_ia` (ver entrada anterior e [[modelo-de-dados-orbita-whitelabel]]): chaves `debito`/`credito`/`pix`/`dinheiro`/`cortesia` + variantes por bandeira (`{forma}_{bandeira}`, mesmas 5 bandeiras do thieco — visa/mastercard/elo/hipercard/diners), validadas contra uma whitelist (`CHAVES_TAXA_VALIDAS`) em vez da regex hardcoded de 2 unidades que o thieco usa.
- **`GET/PUT /configuracoes/taxas`** — shape mudou de "lista flat de 9 chaves tenant-wide" pra `{ <unidadeSlug>: {...taxas} }`, mesmo padrão de `atendimento_ia`. Breaking change de contrato aceitável — nenhum tenant real em produção ainda.
- **`calcularValorLiquido()` em `backend/routes/vendas.js`** — mudança real na cadeia de cálculo financeiro, não só na tela: ganhou parâmetro `unidade`, e o cache de taxas (que antes era só por `tenant_id`) passou a ser por `tenant_id`+`unidade`, lendo de `unidades.taxas` em vez do cache tenant-wide antigo (`configuracoes` com chave `taxa_%`). Os dois call-sites (`POST /vendas`, `PATCH /vendas/:id`) passaram a repassar a unidade da própria venda.
- **Frontend:** `config/unidades.js` ganhou `useUnidades()` — hook real que busca `GET /unidades`, com `UNIDADES_FALLBACK` (estático, via `VITE_UNIDADES`) só como valor inicial/rede de segurança, nunca mais fonte de verdade. `SeletorUnidade` (componente já existente, reusado em 3 das 4 abas de Configurações) passou a consumir esse hook em vez do fallback estático — corrige de graça o mesmo problema nas abas de Notificações/Gatilhos/Campanhas, que também liam a lista errada. `AbaTaxas` reescrita: grid de cards agrupados por forma de pagamento (Débito/Crédito/Outros), mesmo layout do `sistema-thieco/frontend/src/pages/Configuracoes.jsx` — só a fonte do dado mudou (JSONB por unidade em vez de chave string). Nova aba "Unidades": lista + criar + editar nome + ativar/inativar.
**Status:** aplicado e testado via API (`docker compose up -d --build`, stack `orbita-test`): criada unidade nova (`filial-jardim`), configuradas taxas diferentes por unidade (Principal 3% crédito, Filial Jardim 5% crédito), registrada venda de R$100 em cada uma — `valor_liquido` retornou R$97,00 e R$95,00 respectivamente, confirmando que o cálculo real usa a taxa certa por unidade. Validação testada: chave de taxa inválida e unidade inexistente retornam 422. Build de produção do frontend (`docker compose build frontend`, fora do host Windows — `npm run build` local falha por um bug conhecido do rollup/npm com binários nativos em Windows, não relacionado a este código) passou limpo.
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (coluna `taxas`), backlog-tarefas-orbita-whitelabel (gap fechado)
**Observação:** Não testado visualmente em navegador (sem ferramenta de browser disponível na sessão) — a verificação foi inteiramente via chamadas de API reais contra o banco Docker do tenant de teste (`principal`), incluindo o efeito de ponta a ponta no valor calculado de uma venda real.

---

## 2026-07-28 — Botão de desconectar WhatsApp + fix seletor Serviço/Produto do PDV (portados do sistema-thieco)

**Motivo:** Os dois ajustes já tinham sido aplicados no sistema-thieco no mesmo dia (ver `registro-de-decisoes-thieco`): o botão "Desconectar" do WhatsApp só existia dentro do modal de QR Code, e o PDV dividia Serviço/Produto por `controla_estoque` em vez de `categoria`. O backend do whitelabel já tinha as rotas de WhatsApp prontas desde a entrada de motor de disparo real (`8b4470d`, 2026-07-28) — faltava só expor em `api.js` e no front.

**Impacto:**
- **`frontend/src/lib/api.js`:** novo bloco `api.whatsapp` (`status`, `qrcode`, `conectar`, `desconectar`, todos parametrizados por `canal`) — as rotas de backend já existiam, mas não estavam expostas no client ainda.
- **`frontend/src/pages/Configuracoes.jsx`:** card de remetente WhatsApp passa a carregar o status de pareamento de cada canal e alternar "QR Code"/"Desconectar" direto, mesmo padrão do thieco — mas os canais são resolvidos dinamicamente via `useUnidades()` (hook da entrada anterior, 2026-07-28) + pseudo-canal `admin` fixo, não uma lista hardcoded (`tambore`/`mutinga`) — o whitelabel é multi-tenant e cada tenant tem seu próprio conjunto de unidades.
- **`frontend/src/pages/RegistroVenda.jsx`:** mesmo fix do thieco — `separarServicosProdutos(catalogo)` divide o seletor do PDV pela `categoria` do item (`servico`/`combo` → Serviço; resto → Produto), não mais por `controla_estoque`, que segue sendo a fonte da verdade só pra classificação de comissão/upsell/alertas de estoque.
**Status:** aplicado.
**Artefatos atualizados:** —
**Observação:** Fix idêntico ao registrado em `registro-de-decisoes-thieco` (2026-07-28) — essa entrada existe pra documentar a portabilidade, com a diferença real de design: canais resolvidos dinamicamente por unidade do tenant, não uma lista fixa de duas unidades.

---

## 2026-08-02 — Rebrand: produto passa a se chamar Kernel, domínio `kercellwc.online` registrado

**Motivo:** Decisão do Willians de nomear o produto whitelabel "Kernel" (era só "sistema-orbita-whitelabel"/"Órbita" em textos soltos, sem nome comercial fechado) e registrar o domínio de produção correspondente.

**Impacto:**
- `TENANT_PADRAO_NOME` (`.env`) e o registro `tenants.nome` do tenant `principal` (seed local) passaram de "Orbita Barber" pra "Kernel" — via `UPDATE tenants SET nome = 'Kernel'` direto no banco de teste local, já que o seed só roda uma vez (`ON CONFLICT DO NOTHING`) e não retroage em tenant já existente.
- **Gap de verdade encontrado no processo:** o `<title>` da aba do navegador era estático (`frontend/index.html`, `"Sistema de Gestão"`) — não fazia sentido num produto onde 1 build de frontend atende N tenants com nomes diferentes (ver decisão de 2026-07-10). Corrigido: `TenantConfigContext.jsx` ganhou um `useEffect` que seta `document.title = branding.nome` assim que o branding resolve — cada tenant passa a ver o nome certo na aba, em runtime, sem depender do `<title>` do HTML.
- Domínio `kercellwc.online` registrado — **ainda sem VPS/DNS apontado, sem deploy em produção.** `FRONTEND_URL` (usado em link de recuperação de senha e confirmação de agendamento por WhatsApp) ganhou entrada em `.env.example`/`docker-compose.yml` (gap real encontrado: não existia antes, o fallback caía sempre em `http://localhost:5173`) — valor local aponta pra `http://localhost:8080`; produção vai apontar pro domínio quando o deploy existir.
**Status:** aplicado (rebrand local) — domínio registrado, deploy pendente.
**Artefatos atualizados:** —
**Observação:** Rebrand de nome/domínio não muda nada de arquitetura por si só — registrado aqui porque abriu a investigação que achou o bug do `<title>` estático, e porque o domínio novo é referenciado nas decisões seguintes (Painel Admin, link de onboarding).

---

## 2026-08-02 — Painel Admin de Onboarding de Tenant

**Motivo:** Criar um cliente novo era 100% manual — `INSERT` direto em `tenants`/`unidades`/`usuarios` via SQL (ver seção "Como configurar um cliente novo" do Playbook DevOps, agora obsoleta), sem tela, sem validação, sem CRUD (`backend/models.js` só tinha `findBySlug`/`findById`/`findAllAtivos`). Não escalava além de 1-2 clientes sem risco de erro de digitação. Pedido explícito do Willians: construir a tela.

**Impacto:**
- **Auth separada do JWT de tenant:** `authenticateAdmin` (`backend/middleware/auth.js`) — token com `role: 'super_admin'`, sem `tenant_id`, gerado por `POST /admin/login` contra `ADMIN_PANEL_USERNAME`/`ADMIN_PANEL_PASSWORD` (env var; recomendação aplicada — migrar pra tabela `admin_users` só quando precisar de 2º usuário do painel). Comparação com `crypto.timingSafeEqual`, não `===` direto.
- **`backend/routes/admin.js`** (novo, montado em `server.js` **antes** do `app.use(authenticate)` global, mesma fronteira de `/public`/`/agendamentos/publico`/`/internal` — `POST /admin/login` é público, tudo depois de `router.use(authenticateAdmin)` dentro do próprio arquivo): `GET/POST /admin/tenants`, `GET/PUT /admin/tenants/:id`, `PATCH /admin/tenants/:id/ativo`, `GET /admin/tenants/:id/usuarios`, `PATCH /admin/tenants/:id/usuarios/:usuarioId/redefinir-senha`.
- **`Tenant.create/update/findAll/findByIdAny/findBySlugAny/toggleAtivo`** novos em `models.js` — `findAll`/`findByIdAny` enxergam tenant inativo também (diferente de `findBySlug`/`findById`, que são pro fluxo de login/branding público e só veem `ativo=true`).
- **Criação de tenant é transacional** (`getClient()` + `BEGIN`/`COMMIT`): tenant + 1 unidade (`principal`) + 1 usuário admin com senha temporária (`crypto.randomBytes(8)`, mesmo padrão já usado em `POST /profissionais/admin/cadastrar`) — sem isso o tenant ficava no ar mas ninguém conseguia logar. Slug validado por regex (`^[a-z0-9]+(-[a-z0-9]+)*$`) e checado contra `findBySlugAny` (ignora `ativo`, mesma regra da UNIQUE constraint do banco) — **imutável depois de criado**, `PUT` nunca aceita `slug` no corpo.
- **Gap real fechado no mesmo dia:** a conta admin de um tenant (criada aqui, sem `profissional_id`) não tinha NENHUM caminho de recuperação de senha — `/auth/esqueci-senha` exige e-mail de um `profissional` vinculado (que ela não tem), e o reset que já existia em `GestaoProfissionais`/`profissionais.js` só aceita `role='barbeiro'`. `PATCH /admin/tenants/:id/usuarios/:usuarioId/redefinir-senha` cobre esse caso — reset simples pelo Willians, mesma mecânica de senha temporária.
- **Frontend:** árvore React inteiramente separada de `App.jsx` — `AdminApp.jsx`, montada por `main.jsx` quando `window.location.pathname.startsWith('/admin')` (não passa por `TenantConfigProvider` nem pelo `Login` de tenant, já que não é tenant nenhum). `AdminAuthContext.jsx` (token próprio, chave de `localStorage` própria — `orbita_admin_token`, nunca colide com o token de tenant). Telas em `pages/admin/`: `AdminLogin.jsx`, `AdminTenantsList.jsx`, `AdminTenantForm.jsx` (criar/editar, mesmo componente).
**Status:** aplicado e testado localmente ponta a ponta (`docker compose up -d --build`, stack `orbita-test`): login admin → criar tenant → tenant novo loga com a senha temporária gerada → reset de senha de usuário via painel confirmado.
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (tabela `tenants`), arquitetura-orbita-whitelabel (nova seção)
**Observação:** Decisões da fase de mapeamento original (registradas antes de existir código, ver histórico de sessão) foram aplicadas como estavam recomendadas, sem esperar validação item a item: env var pro login do painel, logo como link colado manualmente (sem upload), lista fechada de features (não JSONB livre). Nenhuma delas é difícil de reverter se o Willians quiser mudar depois.

---

## 2026-08-02/03 — Modelo KERNEL OS: reestruturação de plano/módulo, correções encontradas testando com o Willians

**Motivo:** O Painel Admin (decisão anterior) nasceu com uma estrutura "Nível 1/2/3" que já estava desatualizada — o Willians apontou um documento mais novo (`kernel-hq/kernel-hq-arquitetura/06-precificação-Kernel.md`) como fonte da verdade: módulos à la carte + 3 pacotes fechados (Start/Pro/Full), com limite de profissionais por pacote ("cadeira", cobrança de excedente) em vez de progressão linear por nível. Pedido explícito: refazer o painel pro modelo novo.

**Impacto:**
- **Schema:** `tenants.nivel` (VARCHAR) renomeado pra `tenants.plano` (`start`/`pro`/`full`/`NULL`=avulso) — só existiam tenants de teste local, sem dado real a perder. Coluna nova `tenants.limite_profissionais` (INTEGER, `NULL`=ilimitado).
  - **Bug de migration encontrado e corrigido no mesmo dia:** a primeira versão desse rename tinha duas etapas (`ADD COLUMN IF NOT EXISTS nivel` + `RENAME nivel TO plano`) — em todo restart do backend, a primeira recriava `nivel` (já tinha sido renomeada, "IF NOT EXISTS" passava de novo) e a segunda batia de frente com `plano` já existente, derrubando o container num loop de erro (`column "plano" of relation "tenants" already exists`). Corrigido pra uma única `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plano VARCHAR(20)` — sem as duas etapas, sem dado real envolvido pra justificar a complexidade do rename.
- **`backend/routes/admin.js` — `MODULOS`** (combos/estoque/financeiro/cortex/autoatendimento, cada um mapeado a 1+ `featureGate(...)` reais já existentes) substitui `FEATURES_VALIDAS`/`NIVEL_FEATURES`. `BASE_SEMPRE_LIGADO` (agenda/clientes/painelColaborador, sempre `true`, não é checkbox) + `LEGADO_VALIDAS` (metas/metasDiarias/gestaoTime/campanhas/atendimentoWhatsapp — módulos reais do produto que o documento novo não menciona, seguem disponíveis como ajuste manual fora do modelo padrão de venda). `PLANO_MODULOS`/`PLANO_LIMITE_PROFISSIONAIS` — presets por pacote fechado, só o ponto de partida que a UI pré-marca.
- **Trava de capacidade de verdade, não só documentação:** `POST /profissionais/admin/cadastrar` (`routes/profissionais.js`) passou a checar `tenants.limite_profissionais` contra a contagem de profissionais ativos antes de criar — bloqueia com HTTP 403 quando atingido ("cadeira adicional" do modelo novo). Testado: tenant no plano Pro (limite 5) — 5º profissional cadastrado, 6º bloqueado.
- **Bug de mapeamento encontrado durante o teste do Willians (não durante a implementação):** `autoatendimento` (módulo pago, "link público de agendamento") apontava pra `features.agenda` — o mesmo flag que a Agenda Nativa **interna** (uso da equipe) usa, e que o documento diz que é parte do Módulo Base, sempre incluída. Na prática, um tenant sem o módulo pago Autoatendimento ficava **sem acesso nenhum à agenda interna** (bloqueada em `featureGate('agenda')`, `/agendamentos`) — quebraria inclusive o fluxo de "barbeiro marca serviço como concluído" que motivou a decisão seguinte. Corrigido: `agenda` entrou em `BASE_SEMPRE_LIGADO`; o módulo Autoatendimento passou a controlar uma flag própria, `features.autoatendimentoPublico`, usada só em `resolverTenantComAgenda` (`agendamentos-publico.js`) pra bloquear o link público. Testado: tenant Pro (sem Autoatendimento) — agenda interna funciona, link público 404; tenant Full (com) — os dois funcionam.
- **`tenants.usa_comissao`** (BOOLEAN, default `true`) — pedido do Willians: "tem barbearia que não trabalha com comissão porque não tem funcionário" (dono solo, ou time inteiro assalariado) — pra essas, a palavra "Comissão" espalhada pela UI não faz sentido, mesmo o cálculo continuando correto (`percentual_comissao` já resolvia isso matematicamente, configurável em 100%). **Não muda nenhum cálculo** — só esconde/renomeia rótulo em: Dashboard (admin: "Comissão Total"/"Comissões Pagas" → "Repasse..."; barbeiro: card "Minhas Comissões" some), Ranking de Performance (linha secundária "Comissão:" some), Modal de Atendimentos (coluna/total somem), Cadastro de Profissional (campos de % somem do formulário, coluna da tabela vira "Remuneração"), relatório DRE impresso (Inteligência Financeira: "Comissões" → "Repasses" nos cabeçalhos). Configurável no Painel Admin, junto de plano/módulos.
**Status:** aplicado e testado via API em cada etapa (criação de tenant por plano confirmando módulos/limite corretos, trava de cadeira, `usa_comissao=false` propagando em login e `/auth/me`).
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (tabela `tenants`), arquitetura-orbita-whitelabel (nova seção)
**Observação:** O documento `06-precificação-Kernel.md` supersede a estrutura "Nível 1/2/3" anterior (ver `kernel-hq-arquitetura/05-niveis-de-assinatura-escopo-de-funcionalidades.md`, agora histórico). `financeiro` (módulo) continua mapeado pra `features.relatorios`, mas o significado dessa flag mudou na decisão seguinte (Dashboard vira Base) — só a Inteligência Financeira de verdade fica atrás dela agora.

---

## 2026-08-03 — Dashboard e Relatório do operador viram Base; só Inteligência Financeira fica atrás do módulo pago

**Motivo:** Testando com uma conta de tenant real (plano Start, sem módulo Financeiro), o Dashboard — primeira tela depois do login, pra admin e pra barbeiro — mostrava um erro técnico assustador (**"Erro: Módulo não disponível nesta configuração — verifique se o servidor está rodando"**) em vez de qualquer dado, porque `useBarbeariaData.js` disparava `fluxo-caixa`/`dre`/`comissoes` sem checar se o tenant tinha `features.relatorios`, e o router `/relatorios` inteiro estava atrás de `featureGate('relatorios')` no mount (`server.js`). Willians: "a aba Dashboard tem que ser plano inicial" — decisão que bate com o modelo antigo (Nível 1 já listava "Relatórios básicos: fluxo de caixa, DRE simples" como Base, não módulo pago).

**Impacto:**
- `featureGate('relatorios')` saiu do mount de `/relatorios` em `server.js` — o router inteiro (`fluxo-caixa`, `dre`, `comissoes`, `resumo-operador`) virou acessível pra qualquer tenant autenticado, sem depender de módulo. Ficou só na rota `GET /relatorios/inteligencia` (aplicado direto nela, dentro de `routes/relatorios.js`) — a única parte genuinamente "avançada" (break-even, projeção, ranking de canal, dias fracos), que é exatamente o que a página Inteligência Financeira (`IntelFinanceira.jsx`) consome.
- `/relatorios/origem-clientes` mantém seu próprio `featureGate('clientes')`, sem relação com essa mudança.
- Frontend: os checks de `bloqueado`/card de "módulo não incluso" que tinham sido adicionados em `Dashboard.jsx`/`RelatorioOperador.jsx`/`useBarbeariaData.js` (numa correção anterior no mesmo dia, pra mostrar mensagem amigável em vez do erro técnico) foram **revertidos** — não fazem mais sentido depois que o backend parou de bloquear essas rotas. `ModuloBloqueadoCard.jsx` (componente criado nessa correção anterior) removido por ficar sem nenhum uso.
**Status:** aplicado e testado via API: tenant no plano Start (`relatorios=false`) — `GET /relatorios/fluxo-caixa` responde 200, `GET /relatorios/inteligencia` continua 404.
**Artefatos atualizados:** arquitetura-orbita-whitelabel (seção Feature Flags), modelo-de-dados-orbita-whitelabel
**Observação:** `features.relatorios` como nome de flag ficou um pouco enganoso depois dessa mudança — hoje ela representa só "Inteligência Financeira avançada", não relatórios em geral (que são Base). Não renomeada pra não quebrar tenants já configurados com essa chave; documentado aqui pra quem for mexer não se confundir.

---

## 2026-08-03 — Gatilho de Google Review a partir da Agenda (automático + manual)

**Motivo:** Pedido do Willians: o pedido de avaliação no Google deve disparar tanto automaticamente (quando o barbeiro marca o atendimento como concluído na Agenda) quanto manualmente (quando o barbeiro quiser, sem esperar nada) — não só pelo scanner de vendas do caixa que já existia (`gerarGatilhoAvaliacaoPosVenda`, roda a cada 15min sobre `vendas`, precisa casar por nome com a tabela `clientes`).

**Impacto:**
- **`gerarAvaliacaoParaAgendamento(tenantId, agendamentoId)`** (novo, `backend/routes/notificacoes.js`) — parte de um agendamento específico, já tem `cliente_nome`/`cliente_contato` na própria linha (sem precisar casar por nome). Idempotente por `agendamento_id` (nunca manda duas vezes pro mesmo atendimento). Reaproveita `getLinksAvaliacao`/`getTelefonesRemetente`/`getNomeTenant`/`preencherTemplate`, já existentes.
- **Automático:** `PATCH /agendamentos/:id/status` (`routes/agendamentos.js`) dispara na transição PARA `concluido` (não repete em toque idempotente no mesmo status), só se `features.notificacoes` (módulo Cortex) estiver ligado. Não bloqueia a resposta do PATCH se o disparo falhar (fire-and-forget com log de erro).
- **Manual:** `POST /agendamentos/:id/pedir-avaliacao` (novo) — barbeiro/admin dispara quando quiser, mesmo com o agendamento ainda não concluído. Mesma trava de módulo. Botão "Pedir avaliação no Google" no modal de detalhe da Agenda (`Agenda.jsx`), visível quando o agendamento está concluído e o cliente tem contato salvo.
**Status:** aplicado e testado ponta a ponta: marcar agendamento como concluído gerou a notificação automaticamente; reenviar no mesmo agendamento bloqueou com HTTP 409 (idempotência); disparo manual num agendamento ainda não concluído funcionou (HTTP 201).
**Artefatos atualizados:** —
**Observação:** Pré-requisito inalterado: o gatilho `avaliacao_pos_venda` em `configuracoes_gatilhos_cliente` nasce desligado por padrão (`ativo=false`) e `unidades.link_avaliacao` vem vazio — o admin do tenant precisa configurar os dois na tela de Configurações antes de qualquer um dos dois disparos (automático ou manual) funcionar.

---

## 2026-08-03 — UX de módulo bloqueado: menu mostra tudo, mas trava o que não está no plano

**Motivo:** Pedido do Willians: itens de menu de módulo que o tenant não contratou não devem sumir nem gerar erro — devem aparecer visíveis, mas travados (informação de "contratar módulo"), pra funcionar como upsell em vez de esconder o que existe.

**Impacto:**
- `frontend/src/components/Sidebar.jsx` — `disabled` (já existia pra restrição de role admin) passou a considerar também `item.bloqueado`: item cinza, cadeado, `disabled` de verdade no `<button>` (não dispara `onClick`), tooltip "Não disponível no seu plano" (distinto de "Acesso restrito a administradores").
- `frontend/src/App.jsx` — `gruposAdmin(features)`/`gruposOperador(features)`/`gruposBarbeiro(features)` pararam de **omitir** o item quando a feature está off (`features.combos && {...}`) e passaram a sempre incluir o item com `bloqueado: !features.combos`. Mesmo tratamento na sub-aba "Metas por Dia" dentro de `MetasPage`.
- **Achado no processo, não relacionado ao pedido:** o item "Inteligência Financeira" nunca teve flag real por trás — checava `features.intelFinanceira`, uma chave que não existe em lugar nenhum do schema (nem `tenants.features`, nem JWT). A tela sempre esteve bloqueada pra 100% dos tenants, silenciosamente. Corrigido pra checar `features.relatorios` (a flag real, confirmada rastreando o hook `useInteligencia`/`api.inteligencia()` → `GET /relatorios/inteligencia`, já gate por essa flag no backend desde sempre) — não é módulo novo, é a mesma coisa do DRE, só o menu apontava pro nome errado.
**Status:** aplicado. Validação: dados corretos confirmados via API (tenant Start com a maioria das flags `false` gera exatamente os itens bloqueados esperados); renderização visual (cadeado, cor, cursor) não confirmada em navegador — sem ferramenta de browser disponível na sessão.
**Artefatos atualizados:** —
**Observação:** O padrão `bloqueado` fica só no menu — as condições de render das páginas em si (`paginaAtual === 'combos' && user.features.combos && <Combos/>`) continuam existindo como segunda camada de proteção, caso `pagina` chegue a um id bloqueado por outro caminho que não o clique no menu.

---

## 2026-08-03 — Features do tenant deixam de exigir logout/login pra atualizar

**Motivo:** Testando o painel admin: editar os módulos de um tenant não tinha nenhum efeito em quem já estava logado (nem um F5 resolvia) — `user.features` no frontend vinha só do snapshot congelado no JWT de login, e `/auth/me` nem devolvia `features`. Bug de arquitetura pré-existente, exposto pela primeira vez pelo caso de uso real do painel admin (editar cliente já ativo).

**Impacto:**
- `GET /auth/me` (`routes/auth.js`) passou a recalcular `features` **do tenant, agora** (`Tenant.findById` + `resolveFeatures()`) em vez de só devolver dados do usuário — mesmo padrão, `usaComissao` também incluído (decisão anterior no mesmo dia).
- `frontend/src/contexts/AuthContext.jsx` — `refreshFeatures()` novo, chama `api.auth.me()` no mount e a cada 60s (mesmo intervalo do check de expiração de token já existente), mescla `features`/`usaComissao` atualizados em `user` sem gerar token novo nem exigir relogin.
**Status:** aplicado e testado: token de login antigo (nunca renovado) — editar o tenant no painel admin (desligar um módulo, ligar outro) e chamar `/auth/me` com o **mesmo** token já reflete a mudança, sem relogin.
**Artefatos atualizados:** arquitetura-orbita-whitelabel (seção Feature Flags — a frase antiga "só reflete depois de logout + login novo" ficou incorreta e foi corrigida)
**Observação:** O JWT em si continua "carimbado" no momento do login (`role`, `tenant_id`, etc. não mudam) — só `features`/`usaComissao` passaram a ter uma segunda fonte de verdade, viva, consultada por request separado. Uma consequência ainda não tratada: se o tenant for desativado (`ativo=false`) enquanto alguém está logado, o próximo `/auth/me` falha silenciosamente (`catch` vazio em `refreshFeatures`) e a sessão continua com as últimas features conhecidas até o token expirar — não é um bug crítico (o backend ainda bloqueia todo o resto via `Tenant.findBySlug`/`findById` que já filtram `ativo=true`), mas vale revisitar se um caso real de desativação no meio de uma sessão aparecer.
