---
status: stable
domain: kernel
source: claude
created: 2026-06-24
updated: 2026-08-27
owner: willians
---

# Registro de Decisões — Sistema Orbita Whitelabel (produto: Kernel)

> Referência: [[prd-kernel]] | [[requisitos-funcionais-kernel]] | [[arquitetura-kernel]]

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
- **`unidades.atendimento_ia` (JSONB)** — nova coluna, ver [[modelo-de-dados-kernel]]. Estabelece a convenção de "config por unidade vira coluna em `unidades`", explicitamente para não repetir o padrão de chave string `taxa_{unidade}_x` do thieco (que pressupõe lista de unidades fixa).
- **Bug pré-existente encontrado e corrigido:** `POST /notificacoes/gerar` apagava e recriava os alertas voláteis a cada chamada, perdendo o estado `lida` toda vez que o painel era aberto. Corrigido portando o padrão `sincronizarAlertas` (upsert) do sistema-thieco. Confirmado com teste local: marcar como lida → rodar `/gerar` de novo → continua lida.
- **`cortex/main.py` e `quasar/main.py`** (fora deste repo, microservices compartilhadas): removido todo hardcode de tenant (`INSTANCIA_ADMIN_POR_TENANT`, `TENANTS_ATENDIMENTO_SUPORTADOS`, `UNIDADES_INFO` fixo). Ambas passam a decidir "thieco vs. whitelabel" pelo formato da instância recebida no webhook da Evolution API: bate num dicionário fixo → thieco (comportamento antigo, preservado); senão → consulta `/internal/resolve-instancia` (Quasar) ou `/internal/tenant-by-slug` (Cortex, canal admin) e monta o contexto em tempo real via `/internal/unidade-atendimento` / `/internal/cliente-atendimento`. Nenhum código novo é exigido por cliente novo do whitelabel.
- **Papel de leitura dedicada (`cortex_readonly`) — avaliado e descartado.** O plano original (ver Playbook DevOps) previa uma role Postgres só-leitura pro Cortex/Quasar acessarem `clientes`/`usuarios` direto no banco compartilhado. O desenho que emergiu tornou isso desnecessário: toda leitura passa pela API do whitelabel (`/internal/cliente-atendimento`, `/internal/admin-autorizado`), autenticada por `X-Internal-Key` — nenhuma das duas microservices abre conexão direta com o Postgres do whitelabel. Diferente do sistema-thieco legado, que mantém `THIECO_DATABASE_URL` + `cortex_readonly` própria (cliente antigo, banco dedicado, não migra).
**Status:** aplicado e testado localmente ponta a ponta via `docker compose up -d --build` (stacks `quasar`, `cortex` e `orbita-test` na rede compartilhada `orbita_shared`): resolução de instância (`resolve-instancia`) confirmada pros 3 casos (tenant conhecido, tenant whitelabel via API, instância desconhecida ignorada sem erro), bundle `/internal/unidade-atendimento` retornando dado real semeado (jornada, equipe, catálogo), webhook do Quasar simulado ponta a ponta (`fromMe: true` ignorado corretamente, mensagem de cliente gera resposta e tenta enviar via Evolution API real com o nome de instância correto). **Não testado:** envio de WhatsApp/IA com credenciais reais de produção (chave OpenRouter e instância Evolution pareada de verdade só existem pro tenant Thieco hoje) — a mecânica de roteamento está validada, falta um cliente whitelabel real com número pareado pra validar a mensagem ponta a ponta de verdade.
**Artefatos atualizados:** modelo-de-dados-orbita-whitelabel (coluna `atendimento_ia`), backlog-tarefas-orbita-whitelabel (gap de CRUD de unidade + taxa por unidade)
**Observação:** Corrige a observação da entrada de 2026-07-13 — o envio de WhatsApp/e-mail deixou de ser fila-só-em-banco nesse meio-tempo (ver histórico do sistema-thieco), e agora essa automação real também está disponível pro whitelabel, pela mesma arquitetura de deployment único. Ficou um gap descoberto testando local, não relacionado à integração de WhatsApp em si: não existe tela nem rota pra cadastrar uma 2ª unidade (só a unidade de bootstrap existe), e a aba de taxas de cartão do whitelabel perdeu a diferenciação por unidade que o thieco tem. Resolvido na entrada seguinte, mesmo dia.

---

## 2026-07-28 — CRUD de unidade + taxa de cartão por unidade, repetindo o layout do sistema-thieco

**Motivo:** Gap descoberto testando localmente a integração de WhatsApp (entrada anterior): a tela de taxas do whitelabel não diferenciava por unidade, e não existia nenhuma forma de cadastrar uma 2ª unidade pra um tenant — mesmo o schema já suportando N unidades desde a migração multi-tenant (2026-07-10). Pedido explícito: repetir o layout do sistema-thieco (seletor de unidade em botões toggle + cards agrupados por forma de pagamento), sem reinventar o design.

**Impacto:**
- **`backend/routes/unidades.js`** (novo): `GET /unidades` (ativas), `GET /unidades/admin` (todas, admin), `POST /unidades` (slug derivado do nome via slugify, deduplicado com sufixo numérico, **imutável** depois de criado — `unidade` é gravado como texto livre em `vendas`/`profissionais`/`catalogo`/`clientes`, não FK, então mudar o slug quebraria essas referências), `PATCH /unidades/:id` (nome), `PATCH /unidades/:id/ativo`.
- **`unidades.taxas` (JSONB, nova coluna)** — mesma convenção de `unidades.atendimento_ia` (ver entrada anterior e [[modelo-de-dados-kernel]]): chaves `debito`/`credito`/`pix`/`dinheiro`/`cortesia` + variantes por bandeira (`{forma}_{bandeira}`, mesmas 5 bandeiras do thieco — visa/mastercard/elo/hipercard/diners), validadas contra uma whitelist (`CHAVES_TAXA_VALIDAS`) em vez da regex hardcoded de 2 unidades que o thieco usa.
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

---

## 2026-08-16 — Cargo "gestor": vê o operacional, não mexe em dado financeiro sensível por padrão

**Motivo:** Pedido do Willians: um cargo intermediário entre `operador` e `admin` — alguém que administra o dia a dia mas não deve, por padrão, alterar salário/comissão de profissional nem outros dados financeiros sensíveis. Com a ressalva explícita de que o próprio admin possa liberar exceções caso a caso, em vez de a restrição ser rígida.

**Impacto:**
- Novo valor `gestor` no enum de role de `usuarios`. Coluna nova `usuarios.permissoes_extra` (JSONB, default `{}`) guarda as exceções liberadas por um admin pra um gestor específico.
- `backend/config/permissoesGestor.js` (novo) — chaves fechadas: `comissaoSalario`, `taxasCartao`, `gastos`, `apagarVenda`, `importarDados`, cada uma com label pra UI.
- `backend/middleware/auth.js`: `requireAdmin` passou a aceitar `admin` OU `gestor` (a maioria das rotas hoje "admin-only" vira "admin ou gestor" automaticamente). `requireApenasAdmin` (novo, estrito) protege as rotas de gestão de outros gestores — evita que um gestor promova/edite outro gestor (auto-escalonamento). `requireAdminOuPermissao(chave)` (novo, factory) protege as 5 ações restritas por padrão — libera se `role==='admin'` ou se `permissoes_extra[chave]===true`.
- `backend/routes/usuarios.js` (novo, montado em `/usuarios`, todo `requireApenasAdmin`): CRUD de conta gestor + `PATCH /:id/permissoes` (liga/desliga cada chave) + `PATCH /:id/ativo` + `PATCH /:id/redefinir-senha`.
- Rotas ajustadas pra usar `requireAdminOuPermissao`: `gastos.js` (POST/PUT/DELETE), `configuracoes.js` (`PUT /taxas`), `vendas.js` (`DELETE /:id`), `import.js` (`POST /`). `profissionais.js` ganhou `podeEditarComissaoSalario(req)` — cadastro/edição de profissional ignora silenciosamente campo de comissão/salário se o gestor não tiver a permissão (não erro, só não aplica o valor).
- JWT de login ganhou `permissoes` (o conteúdo de `permissoes_extra`); `GET /auth/me` também devolve, mesmo padrão do refresh de `features` (ver entrada anterior).
- Frontend: `AuthContext.jsx` ganhou `isAdmin` (agora `admin` OU `gestor`), `isAdminEstrito` (só `admin`), `isGestor`. Telas de Configurações, Gestão de Profissionais, Lançamentos e Registro de Gasto passaram a checar a permissão certa antes de mostrar/habilitar ação restrita.
**Status:** aplicado e testado end-to-end com JWT real de gestor e de admin — ver/não-editar sem permissão, liberar permissão pelo admin e o gestor passar a editar no relogin seguinte, auto-escalonamento bloqueado (gestor não alcança `/usuarios`), campo de comissão/salário ignorado silenciosamente sem a permissão.
**Artefatos atualizados:** modelo-de-dados-kernel (enum de role, `permissoes_extra`), este registro.
**Observação:** liberar uma permissão exige relogin (ou o próximo refresh de `/auth/me`, mesmo mecanismo de `features`) pra o JWT em memória do gestor refletir a mudança — coerente com a decisão de 2026-08-03 acima.

---

## 2026-08-16 — Lembrete de agendamento configurável, e um bug real corrigido no caminho: a fila de notificação nunca teve consumidor

**Motivo:** Willians reportou que "a confirmação 30min antes" não parecia estar batendo com o que ele esperava. Investigando, apareceu um problema mais sério que o prazo fixo.

**Impacto:**
- **Bug encontrado:** `gerarLembretesAgendamento` (backend/routes/notificacoes.js) só fazia `INSERT` numa fila (tabela `notificacoes`), esperando um consumidor de `GET /notificacoes/whatsapp/pendentes` que **não existe em lugar nenhum do código** — nem Kalel, nem Brainiac, nem frontend. Lembrete de agendamento nunca foi enviado de verdade, desde que essa função existe.
- **Correção:** `gerarLembretesAgendamento` passou a enviar direto via `whatsappService.enviarWhatsapp`, mesmo caminho síncrono já usado pelos avisos proativos do Brainiac — `enviado_whatsapp` grava o resultado real do envio, não mais um valor otimista de fila.
- **Campo configurável:** `regra_ausencia.minutos_lembrete` (SMALLINT, default 15, `CHECK >= 5`) — cada tenant define quanto tempo antes quer o lembrete, exposto em `Clientes.jsx` (`FormRegraAusencia`), junto do campo `horas_confirmacao_antecedencia` (ver próxima entrada) que também só existia no backend até então. O cron em `server.js` passou a ler `minutos_lembrete` por tenant a cada execução, em vez de um valor fixo (`15`) hardcoded.
**Status:** aplicado e testado — QA real feito no tenant Lukinhas Barber (produção): forçado o cenário de fila expirada, envio real falhou por WhatsApp desconectado (HTTP 404) e o registro corretamente ficou marcado como não-enviado, confirmando que o novo caminho síncrono reflete o resultado real, não mais um estado otimista.
**Artefatos atualizados:** modelo-de-dados-kernel (`regra_ausencia.minutos_lembrete`).
**Observação:** o padrão "gravar antes de confirmar sucesso" apareceu de novo na lista de espera (entrada seguinte) e foi corrigido lá também, já nascendo certo dessa vez.

---

## 2026-08-16 — Lista de espera + liberação automática de agendamento pendente sem confirmação

**Motivo:** Fase D do plano de landing/self-service: sem isso, um agendamento `pendente` que o cliente nunca confirma fica "preso" — ninguém mais consegue marcar aquele horário, mesmo que o cliente original claramente não vá aparecer.

**Impacto:**
- Nova tabela `lista_espera` (`tenant_id`, `unidade`, `profissional_id` nullable, `cliente_nome`, `cliente_contato`, `data`, `hora_inicio_desejada`, `hora_fim_desejada`, `status` — `aguardando`/`notificado`/`confirmado`/`expirado`/`cancelado`, `notificado_em`, `created_at`).
- `regra_ausencia.horas_confirmacao_antecedencia` (SMALLINT, default 3) — janela antes do horário em que o sistema passa a exigir confirmação.
- `liberarAgendamentosSemConfirmacao(tenantId)` (models.js, novo) — cancela (não `no_show`, precisa liberar a `EXCLUDE constraint` de sobreposição de verdade) agendamento `pendente` dentro da janela sem confirmação.
- `backend/services/listaEsperaService.js` (novo): `notificarProximoDaFila` (avisa só o próximo `aguardando` da fila daquele slot, via `enviarWhatsapp` direto — não a fila `notificacoes` órfã da entrada anterior), `avancarFilaExpirada` (prazo de resposta 45min — `PRAZO_RESPOSTA_MINUTOS` —, expira e passa pro próximo se ninguém confirmar a tempo). Um cliente por vez, nunca dois avisados do mesmo horário simultaneamente.
- `notificarProximoDaFila` disparado tanto no cron de liberação automática quanto em qualquer cancelamento manual/via Kalel (`PATCH /agendamentos/:id/status` → `cancelado`).
- **Bug pego em QA antes de ir pra produção:** a primeira versão marcava `notificado` ANTES de confirmar que o `enviarWhatsapp` realmente funcionou — como essa função nunca lança exceção (retorna `{ok, erro}`), um envio que falhasse silenciosamente marcava a linha como "avisada" mesmo sem o cliente ter recebido nada. Corrigido pra só marcar `notificado` quando `resultado.ok === true`.
- Novos endpoints internos (`authenticateInternal`): `POST /internal/lista-espera` (Kalel cadastra cliente na fila), `GET /internal/disponibilidade` (expõe `calcularDisponibilidade`, já existente em `agendamentos.js`, pro Kalel checar se um horário está livre antes de oferecer a fila).
**Status:** aplicado e testado ponta a ponta em produção (tenant real): forçado cenário de janela de confirmação vencida, cron liberou o agendamento e avisou o primeiro da fila; simulação de envio falho confirmou que a linha não é marcada como notificada indevidamente.
**Artefatos atualizados:** modelo-de-dados-kernel (tabela `lista_espera`, `regra_ausencia.horas_confirmacao_antecedencia`).
**Observação:** ver `registro-de-decisoes-kalel` (RD-014) pra como o Kalel usa esses endpoints na prática.

---

## 2026-08-16 — Termos de Uso com aceite obrigatório no cadastro público

**Motivo:** Pedido explícito do Willians — guardrail jurídico contra cópia/clonagem do sistema, complementar (não substituto) a qualquer medida técnica. Ele foi avisado de que o texto é um rascunho inicial e precisa de revisão por advogado antes de ser tratado como definitivo.

**Impacto:**
- Página pública `/termos` (`frontend/src/pages/Termos.jsx`, roteada fora da árvore de tenant em `main.jsx`) — 14 seções, incluindo cláusula explícita de propriedade intelectual proibindo engenharia reversa, cópia e criação de produto concorrente a partir da observação do sistema, com consequências descritas (rescisão, responsabilização civil, medidas criminais cabíveis).
- `POST /public/teste-gratis`: `aceitou_termos` passou a ser obrigatório (`body('aceitou_termos').custom(v => v === true)`) — cadastro é rejeitado sem o aceite. Prova de aceite gravada em `usuarios.termos_aceitos_em`/`termos_versao`/`termos_aceitos_ip` (IP real, exige `app.set('trust proxy', true)` em `server.js` por causa da cadeia nginx de 2 saltos).
- Rate limit novo em `POST /public/teste-gratis` (`express-rate-limit`, 5/hora/IP) — endpoint público sem autenticação, sem limite algum até então, só a checagem de contato duplicado.
- `TesteGratis.jsx` ganhou checkbox obrigatório (desabilita o submit sem marcar), linkando pro `/termos` em nova aba.
**Status:** aplicado e em produção.
**Artefatos atualizados:** este registro.
**Observação:** `TERMOS_VERSAO` precisa ficar sincronizada manualmente entre `frontend/src/pages/Termos.jsx` e `backend/routes/public.js` (`TERMOS_VERSAO_ATUAL`) — se o texto mudar sem atualizar os dois, o registro de aceite grava a versão errada. Sem revisão jurídica ainda — texto é rascunho.

---

## 2026-08-16 — Política de Privacidade publicada, e decisão consciente de não descrever nenhum canal de opt-out de WhatsApp

**Motivo:** Segunda metade do guardrail jurídico pedido pelo Willians (Termos de Uso, entrada anterior) — cobertura LGPD explícita.

**Impacto:**
- Página pública `/privacidade` (`frontend/src/pages/Privacidade.jsx`, mesmo padrão de roteamento do `/termos`) — papéis de controlador/operador (Kernel é operador dos dados dos clientes finais de cada tenant, controlador dos dados do próprio tenant/admin), dados coletados, compartilhamento com terceiros (Evolution API, provedores de IA via OpenRouter, hospedagem), direitos do titular, retenção.
- Linkada em `/termos`, `Login.jsx`, `Landing.jsx` e na tela pública de agendamento (`AgendamentoPublico.jsx`, componente `TelaBase`).
**Status:** aplicado e em produção. Sem revisão jurídica ainda — mesmo aviso do Termos de Uso.
**Artefatos atualizados:** este registro.
**Observação:** o texto menciona "direito de revogar consentimento" em termos genéricos de LGPD, mas **não** descreve nenhum mecanismo concreto de opt-out de WhatsApp — decisão deliberada do Willians, ver entrada seguinte. Ponto a revisitar se compliance (LGPD/política do WhatsApp Business) exigir um canal explícito no futuro.

---

## 2026-08-16 — Decisão de produto: sem opt-out de WhatsApp por ora — Kalel/Brainiac não devem parecer bot

**Motivo:** Foi proposto um design de opt-out (tabela `whatsapp_optout`, aviso "responda PARAR" na primeira mensagem do Kalel, checagem antes de todo envio automático — lembrete, aniversário, cliente sumido, promoção, lista de espera). Willians recusou explicitamente: a intenção do produto é que as mensagens automáticas pareçam parte do atendimento humano padrão da barbearia (confirmação de presença, aniversário, promoção), sem sinalizar que é automação — um aviso de opt-out quebraria essa percepção.

**Decisão:** nenhum mecanismo de opt-out foi implementado. Não é recusa permanente — fica como ponto em aberto pra reavaliar se virar exigência de compliance (WhatsApp Business Policy e/ou fiscalização de LGPD) no futuro.
**Status:** decisão registrada, nada implementado. Também salva na memória de longo prazo do assistente (Claude Code) pra não ser proposta de novo sem o Willians pedir.
**Artefatos atualizados:** este registro; ver também `registro-de-decisoes-kalel` (RD-015).
**Observação:** consequência prática — hoje não existe nenhuma forma de um contato pedir pra parar de receber mensagem automática do Kalel/Brainiac, além de falar diretamente com a barbearia.

---

## 2026-08-16 — Landing page redesenhada: sem preço público, módulos só com descrição

**Motivo:** Pedido do Willians: tirar os pacotes/preços da landing pública, mostrar só os módulos reais (toggle de backend) com descrição do que cada um faz, sem valor — e incluir uma prévia visual do painel, usando "Minha Barbearia" como marca de exemplo.

**Impacto:**
- `frontend/src/pages/Landing.jsx`: seção de módulos usa `MODULOS_AVULSOS` (config/precificacaoKernel.js) filtrado pros 4 módulos reais toggleáveis (`combos`, `estoque`, `financeiro`, `cortex`) — sem preço, só descrição + bullets. Módulo Base mostrado à parte, como "sempre incluso".
- `PreviaPainel` (novo componente): mockup construído com os tokens visuais reais do sistema (`card-premium`, cores via CSS var) — explicitamente **não** é screenshot real (não há como capturar tela do produto rodando a partir do ambiente de desenvolvimento). Dados fictícios, marca de exemplo "Minha Barbearia".
- `TenantConfigContext.jsx` — `BRANDING_PADRAO.nome` renomeado de `'Meu Estabelecimento'` pra `'Minha Barbearia'` (nome de fábrica usado sempre que nenhum tenant real está carregado).
**Status:** aplicado e em produção.
**Artefatos atualizados:** —
**Observação:** a landing continua linkando pro fluxo de teste grátis existente (que sim permite escolher módulo e cor) — a mudança foi só o que fica visível/precificado na página pública em si.

---

## 2026-08-16 — Raio-x de segurança de acesso (VPS + GitHub)

**Motivo:** Willians levantou preocupação sobre "criptografar o backend pra evitar cópia" — avaliação técnica mostrou que, num SaaS multi-tenant onde o código nunca sai da própria VPS, o risco real é acesso indevido à infraestrutura/repositório, não ofuscação de código (que não impede quem já tem acesso root/aos repositórios). Auditoria de acesso feita em vez de ofuscação.

**Impacto (achados, nenhuma correção de risco crítico necessária):**
- Repositórios `kernel`, `kernel-brainiac`, `kernel-kalel` — todos privados no GitHub, um único colaborador (o próprio Willians, admin).
- SSH da VPS: `PasswordAuthentication no`, `PermitRootLogin no` — só entra por chave. Único usuário unix real com sudo é `willians`.
- Portas expostas externamente: só 22 (SSH), 80 e 443 (nginx) — banco de dados e todos os serviços internos (containers de backend, Evolution API) escutam só em `127.0.0.1`.
- `.env` real de produção nunca foi commitado no histórico do git — os arquivos `.env.barbearia`/`.env.example`/`.env.simples` que estão versionados contêm valores de template idênticos entre si (confirmado por comparação), diferentes (mais curtos) dos segredos reais usados em produção.
**Gaps identificados, NÃO corrigidos ainda (pendência):**
1. `fail2ban` não está instalado na VPS — sem bloqueio automático de tentativa repetida contra SSH.
2. `.env` de produção com permissão `775` (grupo e outros conseguem ler) — deveria ser `600`. Risco baixo hoje (só existe o usuário `willians` na VPS), mas fácil de apertar.
3. Não foi possível confirmar via API se 2FA está ativo na conta GitHub do Willians — precisa checar manualmente em `github.com/settings/security`.
4. Branch protection do GitHub indisponível no plano atual (free) — não crítico hoje, só 1 colaborador com acesso.
**Status:** auditoria feita, nenhuma correção aplicada ainda — Willians vai decidir se quer que os itens 1-2 sejam corrigidos numa próxima sessão.
**Artefatos atualizados:** este registro.
**Observação:** confirma que o problema de "cópia do sistema" é majoritariamente jurídico (Termos de Uso, entradas acima) e de controle de acesso — não há solução técnica de "criptografar o backend" que faça sentido de custo/benefício num SaaS onde o código nunca sai da VPS do próprio Willians.

---

## 2026-08-18 — Colisão de username case-insensitive travava login de gestor pra sempre

**Motivo:** Cliente real (tenant "Lukinhas Barber") reportou "credencial inválida" pro gestor recém-criado ("Lucas Ribeiro"), mesmo depois de o admin gerar senha nova várias vezes. Investigado direto em produção (SELECT read-only autorizado pelo Willians).

**Impacto:**
- **Causa raiz:** `POST /login` (`routes/auth.js`) resolve o usuário por `LOWER(u.username) = LOWER($2)`, sem `ORDER BY`. A constraint única do banco (`uq_usuarios_tenant_username`) é **case-sensitive** — então um gestor com username só diferindo na capitalização do admin (`Lucas` admin vs `lucas` gestor) passava no INSERT sem erro, mas ficava indistinguível pro login: `LIMIT 1` sem ordenação sempre devolvia a linha do admin, e a senha do gestor era comparada contra o hash errado — nunca autenticava, não importa a senha.
- `routes/usuarios.js` (`POST /gestores`): loop de geração de username (que só tratava colisão exata via erro `23505`) passou a checar disponibilidade **case-insensitive** antes do INSERT (`usernameDisponivel()`, novo helper), suficiente pra nunca mais deixar essa colisão nascer.
- `routes/auth.js`: login ganhou `ORDER BY u.id` como segunda camada de defesa (determinístico em vez de arbitrário, caso alguma colisão futura escape da checagem acima).
- Correção imediata em produção pro cliente afetado: gestor duplicado renomeado (`lucasgestor` → `lucasribeiro`, ver entrada seguinte — a pessoa por trás da conta já era barbeiro no sistema).
**Status:** aplicado e testado em produção — login do gestor funcionando depois da correção de username + nova senha.
**Artefatos atualizados:** este registro.
**Observação:** o mesmo incidente expôs que `PATCH /usuarios/gestores/:id` (editar nome/username do gestor) não existia — admin não tinha como corrigir um username problemático sem acesso direto ao banco. Endpoint novo criado no mesmo commit, com a mesma checagem case-insensitive.

---

## 2026-08-18 — Bug pré-existente: CHECK constraint desatualizado derrubava notificações de TODO tenant

**Motivo:** Cliente reportou a aba "Notificações" em branco. Investigação achou um bug que não era específico daquele tenant — afetava qualquer cliente do produto.

**Impacto:**
- **Causa raiz:** commit `907504c` (Fase C, "ticket médio como novo tipo de relatório") adicionou `'ticket_medio'` em `TIPOS_NOTIF_VALIDOS` e na função que garante as 5 linhas padrão por unidade (`garantirConfiguracoesNotificacoes`), mas **não** atualizou o `CHECK` constraint da tabela `configuracoes_notificacoes` (`CREATE TABLE IF NOT EXISTS` é no-op em bancos onde a tabela já existia — o constraint ficou preso em 4 valores). O INSERT de seed (5 linhas de uma vez, `ON CONFLICT DO NOTHING`) violava o `CHECK` na linha `ticket_medio` e abortava a transação **inteira** — `GET /configuracoes/notificacoes` sempre voltava 500, mesmo pra tenant que já tinha as 4 linhas antigas salvas. Frontend não tinha `.catch` nessa chamada, então o erro nem aparecia — só a tela ficava vazia, sem nenhuma mensagem.
- Migration nova (`ALTER_CONFIGURACOES_NOTIFICACOES_TICKET_MEDIO`, `models.js`) recria o `CHECK` com os 5 valores.
- `AbaNotificacoes` (`Configuracoes.jsx`) ganhou `.catch` + estado de erro visível — não é mais possível esse tipo de falha silenciosa se acontecer de novo.
**Status:** aplicado e confirmado em produção — migration rodou sem erro, aba voltou a listar as configurações.
**Artefatos atualizados:** [[modelo-de-dados-kernel]] (`configuracoes_notificacoes.tipo`).
**Observação:** achado enquanto investigava um relato completamente diferente (login de gestor) — o cliente mencionou "módulos não salvando" de passagem, o que levou a essa descoberta. Reforça o valor de sempre checar os logs do backend, não só a queixa literal do usuário.

---

## 2026-08-18 — Sidebar presa aberta em qualquer celular (Safari/iOS) — bug de timing no viewport

**Motivo:** Cliente reportou "layout quebrado no iPhone" — investigação mostrou que era universal (qualquer mobile, confirmado testando no Safari), não específico de um aparelho.

**Impacto:**
- **Causa raiz:** `isSidebarOpen`/`isMobile` (`App.jsx`, 3 shells — Admin/Operador/Barbeiro) eram calculados **uma única vez**, no inicializador do `useState`, lendo `window.innerWidth` de forma síncrona. No Safari (iOS sobretudo), esse valor no instante exato do primeiro render pode ainda refletir o viewport "ideal" do WebKit (~980px) antes da tag `<meta viewport>` assentar de verdade — o app decidia (errado) que era desktop, deixava a sidebar aberta (`position: fixed`, 256px) permanentemente cobrindo a tela, e como o `useEffect` só **anexava** o listener de `resize` (nunca chamava a checagem uma vez já no mount), nada corrigia o estado depois se o celular ficasse parado em portrait.
- Fix: a função de checagem (`check()`) passa a rodar uma vez logo após o mount, além de ficar escutando `resize` — nos 3 shells.
**Status:** aplicado e confirmado em produção.
**Artefatos atualizados:** este registro.
**Observação:** bug crítico e universal — afetava 100% dos usuários mobile de 100% dos tenants, não só quem estava sendo testado no momento. Não foi pego antes por falta de teste em dispositivo real/Safari durante o desenvolvimento.

---

## 2026-08-18 — Ícone do PWA por tenant no iOS, e o outage causado pela própria correção

**Motivo:** Cliente reportou que o ícone ao "Adicionar à Tela de Início" no iPhone não era a logo do tenant — aparecia um ícone genérico com a primeira letra do nome.

**Impacto:**
- **Causa raiz:** iOS Safari lê `<link rel="apple-touch-icon">` direto do HTML inicial, sem esperar JS rodar — a solução existente (`TenantConfigContext.jsx` troca a tag via DOM depois que o branding chega da API) resolvia o favicon da aba, mas não esse caso. O `href` inicial (mesmo build atende todos os tenants) apontava pro favicon genérico em **SVG**, formato que `apple-touch-icon` não suporta — iOS caía no fallback padrão da Apple (ícone com a primeira letra do título).
- Solução (ver seção "Ícone do PWA por tenant" em [[arquitetura-kernel]]): `GET /t/:slug` passa a ser renderizado no **backend**, com `<title>`/`<meta apple-mobile-web-app-title>`/`<link rel="icon">`/`<link rel="apple-touch-icon">` já resolvidos pro tenant certo antes de qualquer JS rodar. `nginx.conf` roteia `/t/*` pro backend em vez de servir o `index.html` estático genérico.
- **Outage causado pela primeira versão dessa correção:** o HTML buscado do frontend (`fetch('http://frontend:80/index.html')`) ficou em **cache indefinido na memória do processo** do backend. Um deploy incremental normal (só `frontend` reconstruído — hash de JS novo — sem reiniciar `backend` junto, fluxo padrão descrito no Playbook DevOps) deixou o cache apontando pro arquivo antigo, que o build novo já tinha removido. `GET /t/:slug` — login de **qualquer** tenant, admin ou barbeiro — servia HTML com `<script src>` pra um 404: o app nunca montava, tela em branco total. Diagnosticado comparando o hash de JS referenciado no HTML servido contra os arquivos realmente presentes no container `kernel_web` (`curl` direto nos dois). Resolvido em produção com restart manual do `kernel_api` (limpa o cache), e depois na causa raiz: cache removido por completo — busca o template de novo a cada request.
**Status:** aplicado, outage resolvido em produção (restart + fix definitivo), confirmado testando `/t/:slug` em 3 deploys seguintes sem regressão.
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Ícone do PWA por tenant").
**Observação:** lição de processo — qualquer estado em memória (cache, singleton) que dependa de outro serviço/deploy precisa ou (a) ter TTL curto, ou (b) ser invalidado explicitamente no boot, ou (c), como aqui, simplesmente não existir quando o custo de recomputar é baixo. "Rota de baixo tráfego, HTML pequeno" foi o critério usado pra decidir remover o cache em vez de consertar a invalidação.

---

## 2026-08-18 — Contraste do modo escuro ilegível em paletas customizadas

**Motivo:** Cliente com paleta customizada (cor primária azul, não o dourado de fábrica) reportou texto secundário praticamente ilegível no modo escuro.

**Impacto:**
- **Causa raiz:** `applyTenantTheme` (`lib/theme.js`) deriva `--cor-primaria-muted` (usado em `text-gold-muted`, texto secundário em toda a UI) via `darken(p, 50)` no modo escuro — fórmula flat que foi calibrada visualmente pro dourado de fábrica (`#D4AF37` → resultado próximo do `#9C7B1E` fixo usado quando não há customização), mas em cores mais escuras/saturadas (o azul do tenant afetado) o mesmo `-50` por canal derrubava a luminância muito mais, quase até ilegibilidade contra o fundo quase preto.
- Fórmula ajustada pra `darken(p, 20)` — menos agressiva, mantém "mais apagado que o primário" sem derrubar tanto o contraste. Modo claro e a paleta de fábrica (hardcoded, não passa por essa fórmula) não foram tocados.
**Status:** aplicado em produção.
**Artefatos atualizados:** —
**Observação:** fórmulas de derivação de cor calibradas visualmente pra 1 paleta de referência (a de fábrica) não necessariamente generalizam pra qualquer cor que um tenant escolha — vale reavaliar as outras derivações (`lighten`/`darken` em `theme.js`) se um problema parecido aparecer em outro campo.

---

## 2026-08-18 — Gestor pode ser atribuído a um login de barbeiro já existente (`eh_gestor`)

**Motivo:** Pedido do Willians depois de um caso real: o tenant "Lukinhas Barber" tinha um barbeiro ("Lucas Ribeiro") que também precisava administrar — a única forma existente era criar uma **segunda** conta (`role='gestor'`, sem `profissional_id`), duas credenciais pra uma pessoa só. Willians queria eliminar essa duplicação: atribuir acesso de gestor direto no login de barbeiro que a pessoa já usa.

**Impacto:**
- Coluna nova `usuarios.eh_gestor` (BOOLEAN, default false) — só relevante pra `role='barbeiro'`. Continua existindo o gestor "puro" (`role='gestor'`, sem `profissional_id`) pra quem administra sem cortar cabelo — os dois caminhos coexistem.
- `middleware/auth.js`: `ehGestorEfetivo(user)` (novo helper) = `role==='gestor'` OU (`role==='barbeiro'` E `eh_gestor===true`). `requireAdmin` e `requireAdminOuPermissao` passam a usar esse helper em vez de checar `role==='gestor'` direto. `requireAdminOuBarbeiro` (novo, mais permissivo de propósito) criado à parte pra Consumo Interno (ver próxima entrada) — não reaproveita `ehGestorEfetivo` porque ali **qualquer** barbeiro (não só gestor) deve ter acesso.
- `routes/usuarios.js`: `GET /gestores` passa a listar os dois tipos juntos (`COND_GESTOR = role='gestor' OR (role='barbeiro' AND eh_gestor=true)`); `GET /barbeiros-disponiveis` (novo) lista candidatos a promover; `PATCH /:id/eh-gestor` (novo) promove/despromove — sempre `requireApenasAdmin`, nunca o próprio gestor.
- Frontend: `AuthContext.isGestor` mudou de significado — antes era `role==='gestor'` literal, agora é "tem acesso de gestor" (cobre os dois casos). 4 telas que checavam `user.role==='gestor'` direto (taxas de cartão, apagar venda, comissão/salário, gastos) foram migradas pra usar `isGestor` do contexto — **sem essa migração, um barbeiro-gestor passaria por essas restrições sem nenhum bloqueio**, brecha de permissão real que seria introduzida pela feature se não corrigida junto.
- **Roteamento raiz precisou mudar também:** `AppRoot` mandava *qualquer* `role='barbeiro'` pro shell simplificado (`AppBarbeiro`, sem Configurações/Gestão de Time/Dashboard no switch). Corrigido pra só barbeiro **sem** `eh_gestor` ir pro shell simplificado; com `eh_gestor`, cai no shell admin completo (`AppAutenticado`) — que ganhou "Meu Painel" e "Consumo Interno" condicionados a `profissional_id`, pra não perder as telas pessoais que só existiam no shell simplificado.
- Configurações → Gestores ganhou seção "Dar acesso de gestor a um barbeiro que já tem login" (dropdown dos disponíveis + botão Promover), badge "Barbeiro" na listagem, e "Remover acesso de gestor" no lugar de "Inativar" pra esse tipo (inativar desligaria o login de barbeiro inteiro, não só o acesso extra).
**Status:** aplicado e testado em produção com conta real (Lucas Ribeiro promovido, conta duplicada antiga desativada — `ativo=false`, não apagada).
**Artefatos atualizados:** [[modelo-de-dados-kernel]] (`usuarios.eh_gestor`, `permissoes_extra`).
**Observação:** liberar `eh_gestor` exige relogin pra o JWT em memória refletir a mudança — mesmo trade-off já aceito pra `permissoes_extra`/`features` (ver entrada de 2026-08-16). Dois bugs de menu duplicado apareceram testando esse fluxo em produção e foram corrigidos no mesmo dia: "Meu Painel" duplicava Registro/Lançamentos que o shell admin já mostra separado (removido do menu do barbeiro-gestor), e a seção "Link de agendamento" em Gestão de Time mostrava o link genérico da unidade além do link individual (agora mostra só o individual pra quem tem `profissional_id`, mesma regra do `MeuPainel.jsx`).

---

## 2026-08-18 — Novas permissões de gestor: estoque, gatilhos, campanhas

**Motivo:** Consequência direta da entrada anterior — com gestor podendo ser um barbeiro de confiança, Willians pediu que catálogo/estoque, gatilhos de mensagem ao cliente e campanhas promocionais também virassem restrições opt-in (antes, essas 3 áreas eram acesso total e irrestrito pra qualquer gestor, sem o admin poder limitar).

**Impacto:**
- 3 chaves novas em `backend/config/permissoesGestor.js`: `estoque`, `gatilhos`, `campanhas` (`taxasCartao` já existia desde 2026-08-16).
- `routes/catalogo.js` (POST/PUT/DELETE/PATCH quantidade), `routes/estoque.js` (`POST /entrada`), `routes/campanhas.js` (`POST /` — disparar campanha), `routes/configuracoes.js` (`PUT /gatilhos-cliente/:id`) trocam `requireAdmin` por `requireAdminOuPermissao('estoque'|'campanhas'|'gatilhos')`. Rotas de leitura (GET) continuam abertas pra qualquer gestor, mesmo padrão já usado nas 5 permissões anteriores.
- `Estoque.jsx`: sem a permissão `estoque`, gestor deixa de ver os botões de cadastrar/editar/desativar item e ajustar quantidade (só visualiza) — mesmo padrão de UI das outras permissões. Campanhas e Gatilhos ainda não ganharam esse espelhamento de UI (o botão continua visível, erro 403 aparece só ao tentar salvar) — pendência conhecida, não crítica porque o backend já bloqueia de verdade.
**Status:** aplicado em produção.
**Artefatos atualizados:** [[modelo-de-dados-kernel]] (`permissoes_extra`), tabela "Propriedade e acesso por role".
**Observação:** ver [[backlog-tarefas-kernel]] pra fechar o espelhamento de UI de Campanhas/Gatilhos, se virar prioridade.

---

## 2026-08-18 — Consumo Interno replicado no login do barbeiro

**Motivo:** Pedido do Willians: barbeiro precisa registrar consumo interno de estoque (limpeza, lavatório etc.) sem precisar de acesso de gestor — a tela já existia só pro admin (Estoque → Consumo Interno).

**Impacto:**
- `Estoque.jsx` exporta o componente `ConsumoInterno` (antes local) — reaproveitado, não duplicado, num wrapper novo (`ConsumoInternoBarbeiro.jsx`) que só troca o cabeçalho da página.
- Backend: `requireAdminOuBarbeiro` (novo guard, `middleware/auth.js`) libera `GET /estoque/movimentacoes` e `POST /estoque/consumo-interno` pra **qualquer** barbeiro (não só gestor) — mas o GET força `tipo='consumo_interno'` quando quem pede é `role='barbeiro'` puro, pra não expor custo/valor de venda e de entrada de estoque (dado financeiro que não é dele). `POST /estoque/entrada` (reposição) continua fechado, só admin/gestor com a permissão `estoque` (entrada anterior).
- Item novo no menu do barbeiro ("Consumo Interno"), condicionado a `features.estoque`.
**Status:** aplicado em produção.
**Artefatos atualizados:** —
**Observação:** o registro de consumo interno pelo barbeiro gera lançamento automático de despesa no DRE, mesmo comportamento de quando o admin registra — replicado de propósito, sem criar um caminho "mais fraco" pro barbeiro.

---

## 2026-08-18 — Bug de mapeamento no Painel Admin: 2 dos 4 módulos sempre desmarcados ao reabrir tenant

**Motivo:** Willians reportou que os módulos "Financeiro Avançado" e "Brainiac" não ficavam marcados ao reabrir um tenant pra editar, mesmo tendo selecionado e salvo antes.

**Impacto:**
- **Causa raiz:** `id` do módulo ≠ nome da feature real que ele liga, pra 2 dos 4 módulos avulsos — `financeiro` liga a flag `relatorios`, `cortex` liga `notificacoes` (`combos`/`estoque` batem por coincidência, `id` igual ao nome da flag). `frontend/src/config/planosKernel.js` não carregava esse de-para; o reverse-mapping em `AdminTenantForm.jsx` (reconstrói os checkboxes a partir de `tenant.features` ao carregar o formulário) comparava `MODULOS[].id` direto contra as chaves de feature ativas — `featuresLigadas.includes('financeiro')` nunca batia, porque a chave de verdade era `'relatorios'`. **Salvar sempre funcionou certo** (o backend, `MODULOS` em `routes/admin.js`, já tinha o de-para certo) — só a leitura ao reabrir mentia, dando a impressão de "não fica salvo".
- Confirmado direto no banco antes de corrigir: tenant "Lukinhas Barber" já estava com `relatorios: true` e `notificacoes: true` — a tela é que mostrava errado.
- `MODULOS` (`planosKernel.js`) ganhou campo `flag` explícito por módulo; `mapaDeLista()` (`AdminTenantForm.jsx`) passa a comparar por `flag` quando existe, caindo em `id` pros módulos onde já era igual (e pra lista `LEGADO`, que nunca teve esse problema).
**Status:** aplicado e confirmado em produção.
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Modelo KERNEL OS — Módulos e Pacotes").
**Observação:** mesma classe de bug do encontrado em 2026-08-02/03 (módulo Autoatendimento apontando pra flag errada) — id de UI divergindo do nome real da feature. Vale considerar, se aparecer uma terceira vez, gerar `MODULOS` a partir de uma única fonte compartilhada entre frontend/backend em vez de duas listas mantidas manualmente em sincronia.

---

## 2026-08-18 — Duração de serviço personalizável por profissional

**Motivo:** Pedido do Willians: nem todo barbeiro faz o mesmo serviço no mesmo tempo (ex.: "Corte e Barba" pode ser 45min pra um e 60min pra outro) — até então `catalogo.duracao_minutos` era um valor único, igual pra qualquer profissional, usado em todo o Motor de Agendamento.

**Impacto:**
- Tabela nova `catalogo_duracao_profissional` (`tenant_id`, `catalogo_id`, `profissional_id`, `duracao_minutos`, UNIQUE por `catalogo_id`+`profissional_id`) — override opcional; sem linha, cai no padrão do catálogo (comportamento idêntico a antes pra quem não personalizar nada).
- `calcularDisponibilidade` (`routes/agendamentos.js`, o motor que monta o grid de horários candidatos) deixou de ter um único horário de fim compartilhado por todos os profissionais candidatos — passa a receber `duracaoPorProfissional` opcional (`Map<profissional_id, minutos>`) e calcula o fim **dentro do filtro, por profissional**. Consequência direta: dois barbeiros podem ter janelas de disponibilidade diferentes pro mesmo serviço/horário (um "fecha" mais cedo que o outro pro grid, dependendo da duração de cada um).
- Todos os 6 pontos que resolviam duração antes dessa mudança foram atualizados: criar/reagendar agendamento interno (`agendamentos.js`, x2), disponibilidade e criação do autoagendamento público (`agendamentos-publico.js`, x2), e o equivalente do Kalel (`internal.js`: `POST /agendar-direto` + `GET /disponibilidade`, esse último ganhou parâmetro `catalogo_id` novo pra poder resolver a personalização — antes recebia só um `duracao_minutos` cru). No caminho "qualquer barbeiro" (sem profissional pré-escolhido), o `hora_fim` final gravado no INSERT usa a duração de QUEM efetivamente foi escolhido pro slot, não mais o padrão do catálogo.
- `GestaoProfissionais.jsx`: seção "Tempo de serviço personalizado" no editar barbeiro — lista os serviços do catálogo com campo de minutos (vazio = usa o padrão), endpoints `GET`/`PUT /profissionais/:id/duracoes`.
**Status:** aplicado e em produção — migration confirmada rodando sem erro (`\d catalogo_duracao_profissional` na VPS).
**Artefatos atualizados:** [[modelo-de-dados-kernel]] (nova tabela), [[arquitetura-kernel]] (seção "Sistema de Agendamento Público").
**Observação:** bug de UX pego em QA no mesmo fluxo — o modal "Editar Barbeiro" não tinha `max-h`/`overflow-y-auto`, então com a lista de serviços expandida o conteúdo passava da viewport sem nenhum jeito de rolar até o botão Salvar. Corrigido no mesmo commit.

---

## 2026-08-20 — Configurações reorganizada: abas no topo, Campanhas vira página própria

**Motivo:** Pedido do Willians depois de notar dois problemas na tela de Configurações: o título "Configurações" aparecia duplicado (botão da sidebar + cabeçalho da própria página), e os 3 cards cross-cutting (remetente WhatsApp, cadastro do admin, link de avaliação) ficavam soltos acima das abas, sem relação visual clara com nenhuma delas — apesar de serem, na prática, configuração por unidade.

**Impacto:**
- Cabeçalho `<h2>Configurações</h2>` (com ícone `Settings`) removido de `Configuracoes.jsx` — a barra de abas passa a ser o primeiro elemento da página, logo no topo do container.
- Aba "Unidades" (agora a aba padrão ao abrir a tela — antes era "Taxas de Cartão") passa a reunir `CardRemetenteWhatsApp`, `CardPerfilAdmin` e `CardLinkAvaliacao` no topo, antes da lista de filiais — os três continuam condicionados a `features.notificacoes`, mesma regra de antes.
- `SeletorUnidade` (usado por Taxas, Notificações, Gatilhos ao Cliente, Atendimento IA e agora Campanhas) extraído pra `frontend/src/components/SeletorUnidade.jsx` — antes vivia só dentro de `Configuracoes.jsx`, sem dar pra reaproveitar fora dali.
- Aba "Campanhas" (`AbaPromocoes`, disparo manual segmentado) saiu de dentro de Configurações inteiramente — virou página própria (`frontend/src/pages/Campanhas.jsx`), com item de menu novo no grupo "Administração & Gestão" (`App.jsx`, `gruposAdmin`), ícone `Megaphone`, mesmo gate por `features.campanhas` de antes (só mudou de lugar, não de regra).
**Status:** aplicado e em produção (commit `c067279`, deploy via `git pull` + `docker compose up -d --build` no serviço `frontend` da VPS).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Sistema de Campanhas de Marketing").
**Observação:** critério usado pra decidir onde cada coisa fica — "Unidades" porque os 3 cards são configuração pontual por filial (mesma natureza do resto da aba); "Campanhas" virou página porque é ferramenta de uso recorrente (disparo ativo, não um formulário de configurar uma vez e esquecer), não fazia sentido dividir espaço de aba com o resto de Configurações.

---

## 2026-08-27 — Login do barbeiro passa a usar o mesmo shell do admin (Header + BottomNav) + fix da sidebar fechando sozinha ao rolar no mobile

**Motivo:** Pedido do Willians. Dois problemas no login do barbeiro (`role='barbeiro'` puro, sem `eh_gestor`): (1) a tela não tinha a mesma navegação do admin — o barbeiro navegava por um seletor de abas apertado (`Registro / Lançamentos / Painel`) embutido no cabeçalho próprio da página `MeuPainel.jsx`, e não pela barra inferior fixa (`BottomNav`) que o admin tem no mobile; (2) `MeuPainel.jsx` tinha cabeçalho e wrapper `min-h-screen` próprios, empilhando **dois cabeçalhos** e fazendo a logo do tenant aparecer diferente da do admin (texto `✂ Barbearia <nome>` em vez do `Header` compartilhado com a logo grande). Tentar encaixar a logo nesse header lotado quebrava o layout. Separadamente, o Willians reportou que no mobile, ao tentar rolar a página com a sidebar aberta, ela **fechava sozinha**.

**Impacto:**
- `AppBarbeiro` (`App.jsx`) passou a renderizar `<BottomNav>` (antes só `AppAutenticado`/admin renderizava). Novo helper `bottomNavBarbeiro(features)` monta a barra espelhando o padrão do admin: 2 itens à esquerda (`Meu Painel` + `Lançamentos`, o primeiro só com `features.painelColaborador`), 1 em destaque no centro (`Agenda`, ou `Registro` como fallback quando o tenant não tem `features.agenda` — e nesse caso `Registro` sai da direita pra não duplicar), e à direita `Registro` + `Relatório`. `Metas` e `Consumo Interno` continuam acessíveis só pela sidebar/hambúrguer.
- `BottomNav.jsx` virou configurável: props opcionais `esquerda` / `centro` / `direita`. Sem elas, o comportamento do admin/gestor é **idêntico** ao anterior (constantes internas + `Agenda` no centro condicionada a `features.agenda`). O botão central deixou de ter `id`/`label`/ícone `Agenda` hardcoded.
- `MeuPainel.jsx` deixou de ser uma "shell paralela": removidos o `<header>` sticky próprio (logo textual, abas `Registro/Lançamentos/Painel`, toggle de tema, "Sair") e o wrapper `min-h-screen bg-onix-gradient`. Passou a ser só conteúdo, como as outras páginas — logo/tema/sair vêm do `Header` compartilhado; navegação vem da `BottomNav`/sidebar. Sobrou uma faixa fina no topo do conteúdo com a saudação ("Olá, `<nome>`" + data) e o botão de link pessoal de agendamento (`CompartilharAgendamento`).
- `<main>` do `AppBarbeiro` ganhou o mesmo `padding-bottom` de safe-area do admin (`calc(6rem + env(safe-area-inset-bottom))` no mobile, `md:pb-0` no desktop) — sem isso o conteúdo ficaria atrás da barra fixa.
- **Tela inicial ao logar = Agenda para todos os papéis** (antes só o admin/gestor caía na Agenda; operador caía em `Registro`, barbeiro em `Meu Painel`/`Registro`). `AppOperador` e `AppBarbeiro` passaram a inicializar `pagina` com `user.features.agenda ? 'agenda' : <padrão antigo>` — mesmo critério do `AppAutenticado`. Cai no padrão antigo só quando o tenant não tem o módulo Agenda no plano.
- **`Sidebar.jsx`: "Configurações" + "Sair" saíram do rodapé fixo (`flex-1` empurrando pra base do `<aside>`) e passaram pro fim da `<nav>` rolável, logo abaixo do último item do menu.** Com poucos itens (login do barbeiro), o rodapé ancorado ficava longe demais do resto e podia sumir abaixo da dobra no mobile (`h-full` + barra de endereço do navegador). Agora, aberta a sidebar, todos os botões — incluindo "Sair" — aparecem juntos; menu longo (admin) rola normalmente e alcança o "Sair" no fim.
- **Fix da sidebar (bug separado, mesmo commit):** o handler de `resize` (`AppAutenticado`, `AppBarbeiro`, `AppOperador` em `App.jsx` + `AdminRoot` em `AdminApp.jsx`) rodava `if (mobile) setSidebar(false)` em **todo** evento de resize. No mobile, a barra de endereço do navegador aparecendo/sumindo durante o scroll (e o teclado abrindo) dispara `resize` — então rolar a página fechava a sidebar. Agora um flag `eraMobile` no closure do `useEffect` faz o fechamento acontecer **só na transição desktop → mobile** (rotação de tela, redimensionar janela). O `check()` no mount que corrige o caso do Safari (ver v3.2, `innerWidth` inicial errado) continua funcionando: `eraMobile` começa `false`.

**Status:** aplicado e em produção (commit `f038d6b`, deploy via `git pull` + `docker compose up -d --build` nos serviços `frontend`+`backend` da VPS; smoke tests OK — `/health` e `https://kernellwc.online/` respondendo).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Shell de navegação por papel" nova + correção da cobertura do toggle de tema).
**Observação:** o `Header.jsx` já era compartilhado e a lógica de logo (`tenant.logoUrl ? <img> : divisor dourado`) é a mesma pra todos os papéis — o barbeiro só não a via porque o header próprio do `MeuPainel` a encobria. Nenhuma regra de negócio ou de dados mudou; é mudança de shell de UI.

---

## 2026-08-27 — Folga mínima obrigatória de 10min entre agendamentos do mesmo profissional

**Motivo:** Pedido do Willians ("garanta isso"). Até então a única regra entre dois agendamentos do mesmo profissional era não haver sobreposição de horário — dois atendimentos back-to-back (um termina 10:00, o próximo começa 10:00) eram permitidos, sem nenhum tempo de preparo/limpeza entre clientes.

**Impacto:**
- Constante nova `INTERVALO_MINIMO_ENTRE_AGENDAMENTOS_MIN = 10` em `backend/routes/agendamentos.js` — **hardcoded de propósito**, não é configurável por tenant. É piso de produto; se um dia virar configurável, 10min é o mínimo travado.
- `calcularDisponibilidade` (o motor do grid de horários candidatos): cada agendamento já marcado passa a "ocupar" também os 10min antes e depois — slots que encostam no anterior não são mais oferecidos. Como o autoagendamento público (`agendamentos-publico.js`) e o Kalel (`internal.js`: `POST /agendar-direto`, `GET /disponibilidade`) reusam essa mesma função, os três canais herdam a folga de uma vez.
- `existeConflito` (checagem pré-INSERT com mensagem amigável, criação e reagendamento na agenda interna): a janela do agendamento existente é expandida em ±10min no `OVERLAPS` do SQL.
- Fora do escopo: o almoço (`jornada_unidade.intervalo_inicio`/`intervalo_fim`) — já é uma janela fechada tratada à parte, não precisa de folga em volta. E a `EXCLUDE CONSTRAINT` do Postgres, que continua só anti-sobreposição (não conhece a folga) — segue sendo só o backstop de corrida.
**Status:** aplicado e em produção (commit `9f08f40`, deploy via `git pull` + `docker compose up -d --build` no serviço `backend` da VPS; `kernel_api` healthy, `/health` OK).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Sistema de Agendamento Público").
**Observação:** `OVERLAPS` é semi-aberto (`[início, fim)`), então exatos 10min de intervalo são permitidos e só < 10min é bloqueado — bate com "10min, não menos que isso". Regra também salva na memória de longo prazo do Claude Code, mesmo padrão das regras hardcoded do Kalel.

---

## 2026-08-27 — Agenda vira a tela inicial ao logar para todos os papéis + "Sair" reposicionado na sidebar

**Motivo:** Pedido do Willians, dois ajustes de UX na sequência da unificação do shell do barbeiro (entrada acima). (1) "A primeira tela que tem que cair, independente do login, tem que ser a da Agenda" — só o admin/gestor caía nela; operador caía em `Registro`, barbeiro em `Meu Painel`/`Registro`. (2) No login do barbeiro (poucos itens de menu) o botão "Sair" da sidebar, ancorado no rodapé fixo, ficava longe demais do resto e sumia abaixo da dobra no mobile.

**Impacto:**
- `AppOperador` e `AppBarbeiro` (`App.jsx`) passaram a inicializar `pagina` com `user.features.agenda ? 'agenda' : <padrão antigo>` — mesmo critério que o `AppAutenticado` já usava. Cai no padrão antigo (`Registro` / `Meu Painel`) só quando o tenant não tem o módulo Agenda no plano.
- `Sidebar.jsx`: "Configurações" (admin) + "Sair" saíram do rodapé `shrink-0` (que o `<nav flex-1>` empurrava pra base do `<aside>`) e foram pro fim da `<nav>` rolável, logo abaixo do último item do menu, com um `border-t` separando. Com a sidebar aberta agora todos os botões aparecem juntos; menu longo (admin) rola normalmente até o "Sair" no fim.
**Status:** aplicado e em produção (commits `dbc3ba0` e `421e092`, deploy via `git pull` + `docker compose up -d --build` no serviço `frontend` da VPS; `kernel_web` healthy, `https://kernellwc.online/` → 200).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Shell de navegação por papel").
**Observação:** o `bottomNavBarbeiro()` já colocava a Agenda no centro em destaque — cair nela ao logar fecha o ciclo (tela inicial = item central da barra = tela principal do produto, igual ao admin).

---

## 2026-08-27 — Resumo diário da agenda pro WhatsApp do barbeiro (só se tiver agendamento) + guard no disparo de Faturamento

**Motivo:** Pedido do Willians: o disparo da agenda só pode sair "a partir do momento que tenha um agendamento no sistema — se não existir, não dispara nada pro WhatsApp dos barbeiros cadastrados". Duas frentes: (1) não existia nenhum disparo indo pro WhatsApp do barbeiro (`profissionais.telefone` só era usado no login) — o que existia era só o lembrete pro **cliente**; o Willians quer que o barbeiro receba a agenda dele, mas nunca uma mensagem vazia; (2) a notificação de **Faturamento** disparava "R$ 0,00 em 0 atendimento(s)" mesmo sem nenhum movimento no período.

**Impacto:**
- Função nova `gerarResumoAgendaBarbeiros(tenantId)` em `routes/notificacoes.js`, no cron de 15min do `server.js` como `paraCadaTenantAtivo('agenda', ...)`. Janela de horário `07:00–11:00` (checada na função; TZ do container = `America/Sao_Paulo`, mesmo pressuposto de `verificarNotificacoesConfiguradas`); depois das 11:00 não dispara atrasado (ex.: restart no meio do dia).
- Consulta: agendamentos de `CURRENT_DATE` com `status IN ('pendente','confirmado')`, `JOIN profissionais` com `telefone` preenchido. **Se a consulta volta vazia, a função retorna sem disparar nada** — é essa a garantia pedida. Barbeiro sem telefone ou sem agendamento hoje não aparece e não recebe.
- Agrupa por profissional, monta a lista de horários (`• HH:MM  Serviço  Cliente`) e manda via `enviarWhatsapp` (canal = `unidade` do profissional). Idempotente: checa `notificacoes` por `tipo='resumo_agenda_barbeiro'` + `meta->>'profissional_id'` + `meta->>'data'` antes de inserir — uma vez por profissional/dia mesmo com o cron rodando de 15 em 15min. Registra em `notificacoes` (`canal='whatsapp'`, `enviado_whatsapp` = resultado real do envio), então também entra na fila `GET /notificacoes/whatsapp/pendentes` se o envio falhar (mesmo padrão de `gerarLembretesAgendamento`).
- `gerarNotifFaturamento` ganhou `if (atendimentos === 0) return null;` — para de enfileirar o disparo "R$ 0,00" quando não houve atendimento no período. Alinha com `gerarNotifTicketMedio`/`gerarRankingPorTipo`/`gerarNotifEstoqueParado`, que já retornavam `null` nesse caso.
**Status:** aplicado e em produção (commit `0b0659d`, deploy via `git pull` + `docker compose up -d --build` no serviço `backend` da VPS; `kernel_api` healthy, sem erro nos logs. Primeiro disparo real só na janela das 07:00 local).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Sistema de Notificações e Gatilhos Automáticos" — bloco "Quem recebe o quê" + "Disparo vazio suprimido").
**Observação:** não é configurável por tenant (liga junto com `features.agenda`); se precisar de toggle ou de escolher o horário por tenant depois, o gancho natural é uma linha em `configuracoes_notificacoes` com um `tipo` novo, reaproveitando `hora_disparo`/`ativo`. O número de destino é o `profissionais.telefone` do cadastro — o mesmo que já servia pro login.

---

## 2026-08-27 — Barbeiro só compartilha a própria agenda, nunca o link geral da unidade

**Motivo:** Pedido do Willians: "os barbeiros só devem ter na tela deles o link da agenda própria; a agenda geral da unidade sempre fica no login do administrador e de uso do agente — o login de barbeiro vê só o botão de compartilhar da própria agenda". Na tela **Agenda** (`pages/Agenda.jsx`) o botão de compartilhar o link **geral da unidade** (`CompartilharAgendamento` sem `profissionalId`) aparecia pra `isAdmin || isOperador || isBarbeiro`, então o barbeiro via **dois** botões de compartilhar (o da unidade + o dele). `MeuPainel.jsx` e `GestaoTime.jsx` já resolviam isso mostrando o link genérico só quando `!user.profissional_id`; a Agenda tinha ficado fora dessa regra.

**Impacto:**
- `pages/Agenda.jsx`: a condição do link geral da unidade passou de `(isAdmin || isOperador || isBarbeiro)` pra `(isAdmin || isOperador)`. O bloco do link individual (`profissionalId={user.profissional_id}`, label "Meu link de agendamento") continua igual — é o único botão de compartilhar que o barbeiro puro enxerga.
- Nada muda pro admin/operador (seguem vendo o link da unidade) nem pro barbeiro com `eh_gestor` (cai no `AppAutenticado`, mesma tela do admin).
- Resto da tela do barbeiro já era escopado a ele: sem seletor de unidade (`podeEscolherUnidade = isAdmin`), sem filtro por profissional (`podeFiltrarProfissional = isAdmin || isOperador`), e `carregarProfissionais` devolve só o próprio (`[{ id: user.profissional_id, nome: user.nome }]`).
**Status:** aplicado e em produção (commit `b0660d4`, deploy via `git pull` + `docker compose up -d --build` no serviço `frontend` da VPS; `kernel_web` healthy, `https://kernellwc.online/` → 200).
**Artefatos atualizados:** [[arquitetura-kernel]] (seção "Shell de navegação por papel" — bullet sobre a Agenda do barbeiro).
**Observação:** "de uso do agente" = o Kalel/Brainiac operam sobre a agenda da unidade via login admin (ou rotas internas), não via login de barbeiro — então tirar o link geral do barbeiro não afeta o agente. A regra `!user.profissional_id` (não é um colaborador) é o teste canônico pra "pode ver o link genérico da unidade" nas três telas que expõem `CompartilharAgendamento`.

