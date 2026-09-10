---
status: stable
domain: kernel
source: claude
created: 2026-06-24
updated: 2026-09-10
owner: willians
---

# Modelo de Dados — Sistema Kernel Whitelabel

> Referência: [[arquitetura-kernel]] | [[requisitos-funcionais-kernel]]

---

## Multi-tenant — `tenant_id` (desde 2026-07-10)

> Ver [[registro-de-decisoes-kernel]] 2026-07-10 para a decisão completa.

Toda tabela de negócio abaixo tem uma coluna `tenant_id INTEGER REFERENCES tenants(id)` (nullable — retrofit não-destrutivo sobre tabelas com dado existente; a aplicação sempre popula, o banco não força `NOT NULL`). Não repetido campo a campo em cada tabela abaixo para não poluir — **assuma presente em todas**, exceto `tenants` em si.

**Constraints que eram únicas globalmente e viraram compostas com `tenant_id`** (dois tenants podem ter o mesmo valor sem colidir):
`usuarios.username`, `profissionais.nome`, `unidades.slug`, `catalogo (nome, unidade)`, `metas_unidade (unidade, mes, ano)`, `metas_diarias (unidade, data)`, `configuracoes.chave` (era PK sozinha, virou PK composta `(tenant_id, chave)`).

**Tabelas sem `tenant_id`:** apenas `tenants` (é o próprio tenant) e tabelas puramente derivadas de outra já escopada por tenant via FK (ex.: `catalogo_combo_creditos` é escopada transitivamente via `catalogo_id`).

---

## Tenant (`tenants`)

Fonte da verdade de identidade, branding, plano e feature flags de cada cliente. Substitui o antigo modelo de 1 `.env`/deploy por cliente.

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| slug | VARCHAR(100) | sim | não | Único — identifica o tenant na URL (`/t/:slug`) e no login. **Imutável após criado** (validado em `POST/PUT /admin/tenants`, ver seção Painel Admin em [[arquitetura-kernel]]) |
| nome | VARCHAR(255) | sim | não | Nome do estabelecimento |
| ativo | BOOLEAN | sim | não | Default true |
| plano | VARCHAR(20) | não | não | `start` \| `pro` \| `full` \| `NULL` (avulso, sem pacote fechado) — modelo KERNEL OS, desde 2026-08-02/03. Só rótulo/preset de módulo pro Painel Admin, não gate nada sozinho — quem gate é `features` abaixo. Renomeada de `nivel` (modelo Nível 1/2/3, supersedido) |
| limite_profissionais | INTEGER | não | não | **Sem uso desde 2026-09-08** — barbeiro é ilimitado em todos os planos, não há mais "cadeira adicional". A coluna fica no schema; nenhum código a aplica (o 403 em `POST /profissionais` foi removido). Diferenciação de preço por porte é só `permite_multi_unidade` (+50% do plano por unidade extra) |
| limite_campanhas_mes | INTEGER | não | não | Cota de campanhas de marketing que o tenant pode **criar** por mês-calendário, por unidade (desde 2026-09-01). Módulo cobrado à parte — o Willians define no Painel Admin. **`NULL` ou `0` = módulo não contratado, criação bloqueada** (semântica oposta a `limite_profissionais`, onde `NULL` = ilimitado). Contado por `created_at` de `campanhas_promocionais`; arquivar/excluir não devolve vaga. Travado em `POST /campanhas` (422) |
| usa_comissao | BOOLEAN | sim | não | Default true. `false` = tenant não trabalha com comissão (dono solo sem funcionário, ou time assalariado) — não muda nenhum cálculo (`percentual_comissao` continua existindo e sendo somado normalmente), só esconde/renomeia a palavra "Comissão" no frontend (Dashboard, cadastro de profissional, relatório DRE) |
| features | JSONB | sim | não | Default `{}`. Flags opcionais do tenant, ex. `{"combos": true, "metas": true}`. Mescladas com o core sempre-true em `resolveFeatures()` (backend) — recalculada a cada `POST /auth/login` **e a cada `GET /auth/me`** desde 2026-08-03 (antes só no login; ver [[registro-de-decisoes-kernel]]) |
| branding | JSONB | sim | não | Default `{}`. `nome, slogan, logoUrl, loginBgUrl, temaPadrao, corPrimaria, corPrimariaEscuro, corFundo, corFundoEscuro, corSuperficie, corSuperficieEscuro` — servido publicamente (sem auth) via `GET /public/tenants/:slug` |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Bootstrap:** o primeiro tenant de um banco novo é criado por `seedTenantPadrao()` a partir de `TENANT_PADRAO`/`TENANT_PADRAO_NOME` no `.env` (mesma ideia de `UNIDADE_PADRAO`). **Qualquer tenant depois desse** é criado pelo Painel Admin (`POST /admin/tenants`, `/admin` no frontend, ver [[arquitetura-kernel]]) — não é mais `INSERT` manual.

**Módulos KERNEL OS → `features` (chaves reais, cada uma gate um `featureGate(...)` em `server.js`):**

| Módulo (Painel Admin) | Chave(s) em `features` | Sempre ligado? |
|---|---|---|
| Base (obrigatório) | `agenda`, `clientes`, `painelColaborador`, `autoatendimentoPublico`, `combos` | Sim — `BASE_SEMPRE_LIGADO` em `routes/admin.js`, não é checkbox |
| ~~Combos & Assinaturas~~ | `combos` | **Virou Base desde 2026-09-08** — `CORE_FEATURES`. Clube de Assinaturas (recorrente) fica "em breve" até adquirente |
| Estoque, Suprimentos & Compras Internas | `estoque` | Não — inclui ficha técnica (`catalogo_insumos`, baixa de insumo por serviço) |
| Financeiro Avançado & DRE Analítico | `relatorios` | Não — só gate `GET /relatorios/inteligencia` desde 2026-08-03; `fluxo-caixa`/`dre`/`comissoes`/`resumo-operador` viraram Base |
| Cortex — Notificações & Raio-X do Gestor | `notificacoes` | Não |
| Autoatendimento & Google Reviews | `autoatendimentoPublico` | Não — flag própria desde 2026-08-03 (antes reusava `agenda` por engano, ver [[registro-de-decisoes-kernel]]); gate só o link público de agendamento (`agendamentos-publico.js`), não a agenda interna |
| Legado (fora do documento de precificação, ajuste manual) | `metas`, `metasDiarias`, `gestaoTime`, `campanhas`, `atendimentoWhatsapp` | Não |

---

## Entidades

| Entidade | Tabela | Módulo | Feature flag |
|---|---|---|---|
| Tenant | `tenants` | Multi-tenant | core |
| Usuário | `usuarios` | Auth | core |
| Profissional | `profissionais` | Profissionais | core |
| Venda | `vendas` | Vendas | core |
| Gasto | `gastos` | Gastos | core |
| Item de catálogo | `catalogo` | Catálogo | core |
| Receita de créditos de combo | `catalogo_combo_creditos` | Combos | `tenants.features.combos` |
| Combo contratado (V2) | `combos_contratados` | Combos | `tenants.features.combos` |
| Consumo de combo (V2) | `combos_consumo` | Combos | `tenants.features.combos` |
| Combo (legado V1, não usado por rotas ativas) | `combos` | Combos | `tenants.features.combos` |
| Cliente | `clientes` | Clientes | `tenants.features.clientes` |
| Meta individual | `metas` | Metas | `tenants.features.metas` |
| Meta por unidade | `metas_unidade` | Metas | `tenants.features.metas` |
| Meta diária | `metas_diarias` | Metas Diárias | `tenants.features.metasDiarias` |
| Feedback | `gestao_feedbacks` | Gestão de Time | `tenants.features.gestaoTime` |
| Plano PDCA | `gestao_pdca` | Gestão de Time | `tenants.features.gestaoTime` |
| Sugestão | `gestao_sugestoes` | Gestão de Time | `tenants.features.gestaoTime` |
| Token de reset | `password_reset_tokens` | Auth | core |

---

## Usuário (`usuarios`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| username | VARCHAR(50) | sim | não | Único — login do usuário |
| password_hash | TEXT | sim | sim | bcrypt hash da senha |
| nome | VARCHAR(100) | sim | não | Nome exibido na interface |
| email | VARCHAR(100) | não | não | Recuperação de senha; desde 2026-07-13 também destino de notificações agregadas por e-mail (ver `notif_canal_email`) |
| role | VARCHAR(20) | sim | não | `admin` \| `gestor` \| `operador` \| `barbeiro` (`gestor` desde 2026-08-16) |
| eh_gestor | BOOLEAN | sim | não | Default false. Desde 2026-08-18 — só relevante pra `role='barbeiro'`: libera o mesmo nível de acesso de um `role='gestor'` (`permissoes_extra`, `requireAdmin`) direto na conta de barbeiro que já existe, sem precisar de uma segunda credencial. Ver `ehGestorEfetivo()` em `middleware/auth.js` |
| ativo | BOOLEAN | sim | não | Default true; inativo = sem acesso |
| profissional_id | INTEGER | não | não | FK → profissionais; obrigatório para role=barbeiro. Continua preenchido quando `eh_gestor=true` — é o mesmo login, não um segundo cadastro |
| telefone | VARCHAR(20) | não | não | Destino de notificações agregadas via WhatsApp (desde 2026-07-13) |
| notif_canal_whatsapp | BOOLEAN | sim | não | Default false. Admin optou por receber notificações agregadas via WhatsApp — exige `telefone` preenchido (desde 2026-07-13) |
| notif_canal_email | BOOLEAN | sim | não | Default false. Idem, via e-mail — exige `email` preenchido (desde 2026-07-13) |
| permissoes_extra | JSONB | sim | não | Default `{}`. Desde 2026-08-16 — relevante pra `role='gestor'` OU `role='barbeiro'` com `eh_gestor=true` (desde 2026-08-18): chaves de `backend/config/permissoesGestor.js` liberadas individualmente pelo admin — `comissaoSalario`, `taxasCartao`, `gastos`, `apagarVenda`, `importarDados`, e desde 2026-08-18 também `estoque`, `gatilhos`, `campanhas` |
| termos_aceitos_em | TIMESTAMPTZ | não | não | Desde 2026-08-16 — prova de aceite dos Termos de Uso no cadastro público (`/teste-gratis`) |
| termos_versao | VARCHAR(20) | não | não | Desde 2026-08-16 — versão do texto aceita (`TERMOS_VERSAO`), pra saber se um reaceite é necessário quando o texto mudar |
| termos_aceitos_ip | VARCHAR(45) | não | não | Desde 2026-08-16 — IP de origem no momento do aceite (`req.ip`, exige `trust proxy` no Express) |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

---

## Regra de Ausência (`regra_ausencia`) — configuração por tenant

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| tenant_id | INTEGER | sim | não | PK/FK → tenants — 1 linha por tenant |
| limiar_faltas | INTEGER | sim | não | Nº de faltas na janela que dispara a régua de ausência |
| janela_dias | INTEGER | sim | não | Janela de dias considerada pro limiar acima |
| marcar_ausencia_automatico | BOOLEAN | sim | não | Liga/desliga a marcação automática de `no_show` |
| tolerancia_minutos | INTEGER | sim | não | Minutos de tolerância antes de marcar falta |
| horas_confirmacao_antecedencia | SMALLINT | sim | não | Default 3. Desde 2026-08-16 — quantas horas antes do horário o sistema passa a exigir confirmação; vencida a janela sem confirmação, `liberarAgendamentosSemConfirmacao` cancela e libera o slot pra lista de espera |
| minutos_lembrete | SMALLINT | sim | não | Default 15, `CHECK >= 5`. Desde 2026-08-16 — quanto tempo antes do horário o lembrete de agendamento é enviado, configurável por tenant |

---

## Lista de Espera (`lista_espera`) — desde 2026-08-16

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| tenant_id | INTEGER | sim | não | FK → tenants |
| unidade | VARCHAR | sim | não | Unidade desejada |
| profissional_id | INTEGER | não | não | FK → profissionais; NULL = qualquer profissional serve |
| cliente_nome | VARCHAR | sim | não | Campo livre |
| cliente_contato | VARCHAR | sim | não | WhatsApp — é por onde o cliente é avisado quando o horário libera |
| data | DATE | sim | não | Data desejada |
| hora_inicio_desejada / hora_fim_desejada | TIME | sim | não | Janela de horário desejada |
| status | VARCHAR | sim | não | `aguardando` \| `notificado` \| `confirmado` \| `expirado` \| `cancelado` |
| notificado_em | TIMESTAMPTZ | não | não | Quando o cliente foi avisado que o horário abriu |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Regra de fila:** um cliente por vez é notificado por slot liberado (`notificarProximoDaFila`); se não confirmar em 45 minutos (`PRAZO_RESPOSTA_MINUTOS`), `avancarFilaExpirada` marca `expirado` e notifica o próximo `aguardando` da mesma fila.

**Quem cadastra (desde 2026-09-10):** o Kalel (`POST /internal/lista-espera`, quando o cliente pede horário e não tem vaga) **e** o staff — `GET/POST/PATCH /agendamentos/lista-espera` (`requireAdmin`), tela Agenda → "Lista de Espera". Mesma tabela pros dois.

---

## Inscrição de Web Push (`push_subscriptions`) — desde 2026-09-10

Uma linha por dispositivo/navegador inscrito pra notificação nativa (PWA). O
envio (`services/push.js`, `enviarPush`) manda pros usuários `admin`/`gestor`
ativos do tenant e **apaga a linha no primeiro 404/410** (endpoint morto). VAPID
keys no env (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`) — sem elas, push é no-op e
só WhatsApp + sino funcionam.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| usuario_id | INTEGER | não | FK → usuarios `ON DELETE CASCADE` — quem inscreveu o device |
| endpoint | TEXT | sim | URL do push service do navegador — **UNIQUE** (reinscrever o mesmo device só atualiza as chaves) |
| p256dh / auth | TEXT | sim | Chaves da `PushSubscription` (criptografia da mensagem) |
| user_agent | TEXT | não | Só pra debug |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

Rotas: `GET /push/chave` (VAPID public key), `POST /push/inscrever` / `desinscrever` — montadas **sem featureGate** (qualquer usuário logado inscreve o próprio device).

---

## Profissional (`profissionais`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| nome | VARCHAR(100) | sim | não | Único **por tenant** — índice `uq_profissionais_tenant_nome (tenant_id, nome)`. Dois tenants podem ter um "Lucas Ribeiro" cada. O antigo `UNIQUE(nome)` global (`uq_prof_nome`) foi aposentado em 2026-09-10 (re-adicioná-lo no boot quebrava o servidor assim que surgia nome repetido entre tenants) |
| unidade | VARCHAR(50) | não | não | Identificador da unidade; NULL = sem unidade fixa |
| percentual_comissao | NUMERIC(5,2) | sim | não | Default 0. Percentual de comissão sobre serviços. 0 = sem comissão |
| ativo | BOOLEAN | sim | não | Default true; inativo = não aparece em selects de venda |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

---

## Venda (`vendas`)

Entidade central do sistema. Cada registro representa um item de atendimento.

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| unidade | VARCHAR(50) | não | não | Unidade onde ocorreu o atendimento |
| profissional_id | INTEGER | sim | não | FK → profissionais |
| servico | VARCHAR(200) | sim | não | Nome do serviço ou produto |
| valor | NUMERIC(10,2) | sim | não | Valor cobrado ao cliente (líquido de desconto) |
| comissao | NUMERIC(10,2) | sim | sim | Total = comissao_servico + comissao_produto |
| comissao_servico | NUMERIC(10,2) | não | sim | Comissão do item quando tipo_item = 'servico' |
| comissao_produto | NUMERIC(10,2) | não | sim | Comissão do item quando tipo_item = 'produto' |
| forma_pagamento | VARCHAR(30) | sim | não | `dinheiro` \| `pix` \| `credito` \| `debito` \| `cortesia` |
| data | DATE | sim | não | Data do atendimento |
| observacao | TEXT | não | não | Observação livre |
| importado | BOOLEAN | não | não | True = dado importado de sistema legado |
| desconto | NUMERIC(10,2) | não | não | Valor de desconto concedido |
| tipo_cliente | VARCHAR(20) | não | não | NOT NULL DEFAULT `agendado`. Valores: `agendado` \| `esporadico` \| `primeira_vez` (validado em `routes/vendas.js`, sem CHECK no banco) |
| upsell | BOOLEAN | não | não | True = item adicional vinculado à comanda pai |
| venda_origem_id | INTEGER | não | não | FK auto-referencial → vendas; vincula item ao pai da comanda |
| qtd_clientes | INTEGER | não | não | Default 1; para atendimentos em grupo |
| nome_cliente | VARCHAR(100) | não | não | Nome do cliente (sem FK — campo livre) |
| origem_cliente | VARCHAR(30) | não | não | Canal de origem informado na venda: `whatsapp` \| `indicacao` \| `organico` (nullable; validado em `routes/vendas.js`). O relatório `GET /relatorios/origem-clientes` deriva o canal final por precedência — ver nota abaixo |
| bandeira_cartao | VARCHAR(30) | não | não | Bandeira do cartão quando forma_pagamento = debito/credito |
| valor_liquido | NUMERIC(10,2) | não | sim | Valor menos a taxa de cartão da unidade (`unidades.taxas`) no momento da venda. Unidade sem taxa cadastrada → `valor_liquido == valor` (taxa 0, sem fallback PagBank desde 2026-09-10). Calculado por `backend/services/taxas.js` (usado por `routes/vendas.js` e `routes/combos.js`). O DRE / fluxo de caixa derivam a taxa como `valor - valor_liquido`, não recomputam |
| tipo_item | VARCHAR(20) | não | não | `servico` (default) \| `produto` |
| catalogo_id | INTEGER | não | não | FK → catalogo; preenchido quando item vem do catálogo |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Regra de comissão (sem hardcode):**
- `comissao_servico = valor × (percentual_comissao / 100)` quando `tipo_item = 'servico'`
- `comissao_produto = valor × (percentual_comissao / 100)` quando `tipo_item = 'produto'`
- O percentual_comissao é lido do profissional vinculado no momento da criação

**Regra de comanda (upsell):**
- Item principal: `venda_origem_id = NULL`, `upsell = false`
- Item adicional: `venda_origem_id = id_do_pai`, `upsell = true`
- Total de atendimentos únicos: `COUNT(DISTINCT COALESCE(venda_origem_id, id))`

**Canal de aquisição derivado** (`GET /relatorios/origem-clientes`, desde 2026-09-01) — precedência linha a linha, fallbacks 2–4 só em venda `importado = false` (histórico importado sempre cai em "não informado"):
1. `origem_cliente` preenchido → `whatsapp` \| `indicacao` \| `organico`
2. `tipo_cliente = 'agendado'` **e** existe `agendamentos.venda_id` apontando pra essa venda → `agendado` (reserva feita na Agenda interna, inclusive link público)
3. `tipo_cliente = 'agendado'` **sem** vínculo interno → `app_externo` (reserva veio de app de terceiros, ex.: Booksy)
4. `tipo_cliente IN ('primeira_vez', 'esporadico')` → o próprio valor
5. resto → `não informado`

---

## Gasto (`gastos`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| unidade | VARCHAR(50) | não | não | Unidade responsável pelo gasto |
| categoria | VARCHAR(50) | sim | não | `aluguel` \| `produtos` \| `salario` \| `marketing` \| `manutencao` \| `equipamentos` \| `utilidades` \| `impostos` \| `suprimentos` \| `outros` |
| descricao | VARCHAR(200) | sim | não | Descrição individual (ex: "Aluguel ponto comercial") |
| valor | NUMERIC(10,2) | sim | não | Valor realizado |
| valor_previsto | NUMERIC(10,2) | não | não | Para comparação orçamentária |
| data | DATE | sim | não | Data do gasto |
| observacao | TEXT | não | não | Observação livre |
| recorrente | BOOLEAN | sim | não | Default false. True = gera 11 ocorrências futuras automaticamente na criação |
| frequencia_recorrencia | VARCHAR(10) | não | não | `semanal` \| `mensal` \| `anual` — obrigatório quando `recorrente = true` |
| gasto_origem_id | INTEGER | não | não | FK auto-referencial → gastos; presente nas 11 ocorrências geradas, NULL na despesa original |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Regra de recorrência:** ao criar um gasto com `recorrente = true`, o backend gera automaticamente as próximas 11 ocorrências (mensal/semanal/anual conforme `frequencia_recorrencia`), cada uma com `gasto_origem_id` apontando para o gasto original. Geração acontece uma única vez, na criação — não há job recorrente nem regeneração.

---

## Catálogo (`catalogo`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| nome | VARCHAR(200) | sim | não | Nome do serviço ou produto; UNIQUE por unidade |
| preco_venda | NUMERIC(10,2) | não | não | Preço sugerido ao selecionar na venda |
| tipo | VARCHAR(20) | não | não | `servico` \| `produto` |
| controla_estoque | BOOLEAN | não | não | True = produto físico com quantidade controlada |
| quantidade | INTEGER | não | não | Estoque atual; só relevante se controla_estoque = true |
| ativo | BOOLEAN | sim | não | Default true; inativo = não aparece em selects |
| unidade | VARCHAR(50) | não | não | NULL = disponível em todas as unidades |
| duracao_minutos | INTEGER | não | não | Duração do serviço em minutos — usado pelo Motor de Agendamento (`tenants.features.agenda`) para calcular o grid de horários; NULL = fallback de 30min na criação manual de agendamento (desde 2026-07-13) |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Regra de estoque (produto vendido):** quando `controla_estoque = true` e uma venda é registrada com `catalogo_id` e `tipo_item = 'produto'`, o backend debita automaticamente: `UPDATE catalogo SET quantidade = GREATEST(0, quantidade - $qtd) WHERE id = $catalogo_id AND tenant_id = $tenantId AND controla_estoque = true`. Requer `tenants.features.estoque = true`. Desde 2026-09-08 esse débito também grava uma linha em `estoque_movimentacoes` (tipo `venda`).

**Regra de estoque (insumo por serviço — desde 2026-09-08):** quando `tipo_item = 'servico'` e o serviço tem ficha técnica (`catalogo_insumos`), cada insumo com `controla_estoque = true` é debitado por `qtd_da_ficha × qtd_clientes` (arredondado — `quantidade` é INTEGER) e gera linha em `estoque_movimentacoes` (tipo `venda`, motivo "Insumo de: <serviço>"). Envolvido em try/catch: erro de estoque nunca derruba a venda.

---

## Ficha Técnica — Insumos por Serviço (`catalogo_insumos`) — desde 2026-09-08

Liga um item de catálogo `categoria` `servico` (ou `combo`) aos produtos que ele consome. Alimenta a baixa automática de insumo no `POST /vendas` e o editor "Ficha técnica" na tela Estoque.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → `tenants` |
| servico_id | INTEGER | sim | FK → `catalogo` (ON DELETE CASCADE) — o serviço |
| insumo_id | INTEGER | sim | FK → `catalogo` (ON DELETE CASCADE) — o produto consumido |
| quantidade | NUMERIC(10,3) | sim | CHECK > 0. Quantidade por atendimento, na `unidade_medida` do insumo |
| criado_em | TIMESTAMPTZ | sim | Default NOW() |

Constraints: `UNIQUE (servico_id, insumo_id)`, `CHECK (servico_id <> insumo_id)`. Índices por `servico_id` e `tenant_id`. Editada só por `PUT /estoque/ficha/:servicoId` (substitui a ficha inteira numa transação).

**Limitação conhecida:** `catalogo.quantidade` é INTEGER — a baixa arredonda. Cadastrar o insumo já na unidade consumida (ml/g/un), não em "frascos". Excluir a venda não estorna o insumo.

---

## Duração de Serviço por Profissional (`catalogo_duracao_profissional`) — desde 2026-08-18

Override opcional de `catalogo.duracao_minutos` por barbeiro — nem todo barbeiro faz o mesmo serviço no mesmo tempo (ex.: "Corte e Barba" pode ser 45min pra um e 60min pra outro). Sem linha aqui, o Motor de Agendamento usa o padrão do catálogo (comportamento idêntico a antes dessa feature).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| catalogo_id | INTEGER | sim | FK → catalogo (ON DELETE CASCADE) |
| profissional_id | INTEGER | sim | FK → profissionais (ON DELETE CASCADE) |
| duracao_minutos | INTEGER | sim | `CHECK BETWEEN 5 AND 600` |

UNIQUE(`catalogo_id`, `profissional_id`). Gerenciada em Gestão de Equipe → editar barbeiro → "Tempo de serviço personalizado" (`GET`/`PUT /profissionais/:id/duracoes`, admin/gestor).

**Impacto no Motor de Agendamento:** `calcularDisponibilidade` (`backend/routes/agendamentos.js`) deixou de usar um único horário de fim compartilhado por todos os candidatos — agora calcula o fim do slot **por profissional** (`duracaoPorProfissional` opcional, `Map<profissional_id, minutos>`), então dois barbeiros podem ter janelas de disponibilidade diferentes pro mesmo serviço/horário. Todos os pontos que resolvem duração (criar/reagendar agendamento interno, autoagendamento público, `POST /internal/agendar-direto` e `GET /internal/disponibilidade` do Kalel) passam pela personalização de quem efetivamente vai atender.

---

## Receita de Créditos de Combo (`catalogo_combo_creditos`)

Define quantos créditos de cada serviço um pacote vendável do catálogo (`catalogo.categoria = 'combo'`) concede na contratação. Sem essa tabela populada, o pacote aparece no catálogo mas não pode ser contratado (créditos vazios). **Sem seed automático nem UI de admin** — cadastro é feito via SQL direto por um dev no onboarding do tenant.

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| catalogo_id | INTEGER | sim | não | FK → catalogo (ON DELETE CASCADE) |
| servico | VARCHAR(120) | sim | não | Nome exato do serviço (chave livre — não FK, casa com o texto usado em `combos_consumo.servico_utilizado`) |
| quantidade | SMALLINT | sim | não | Quantos créditos desse serviço o pacote concede |

UNIQUE constraint em `(catalogo_id, servico)`. Ex.: pacote "Combo 4x1" → 2 linhas: `(catalogo_id=10, servico='Corte', quantidade=2)` + `(catalogo_id=10, servico='Barba', quantidade=2)`.

---

## Combo Contratado (`combos_contratados`)

Motor genérico de créditos — nenhum nome de serviço é fixo no schema ou no código. Um pacote novo (ex.: "Corte + Risco") não exige migration.

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| cliente_id | INTEGER | sim | não | FK → clientes |
| unidade | VARCHAR(50) | não | não | Unidade do contrato |
| profissional_id | INTEGER | não | não | FK → profissionais; colaborador responsável |
| data_compra | DATE | sim | não | Data de contratação — editável via `PATCH /combos/contratados/:id/data-compra` (cadastro retroativo) |
| data_validade | DATE | não | sim | `data_compra + 30 dias`; NULL enquanto o combo está `na_fila` |
| creditos | JSONB | sim | não | Saldo atual — objeto dinâmico `{ [nome_do_servico]: quantidade }`, decrementado a cada consumo |
| creditos_originais | JSONB | sim | não | Total concedido na contratação — imutável, usado para exibir "X/Y" no card de saldo |
| limite_corte / limite_barba | SMALLINT | não | não | Colunas legado (V1) — mantidas só para o backfill `backfillCombosCreditosJsonb()`; código novo usa `creditos`/`creditos_originais` |
| status | VARCHAR(20) | sim | sim | `em_uso` \| `na_fila` \| `encerrado` |
| esgotado | BOOLEAN | — | sim (só em `findAll`) | `status='encerrado' OR (status='em_uso' AND (data_validade vencida OR todos os creditos = 0))` — critério idêntico ao usado em `verificarExpiracaoCliente`, nunca deve divergir |
| valor | NUMERIC(10,2) | sim | não | Valor pago na contratação |
| forma_pagamento | VARCHAR(30) | não | não | Forma de pagamento da contratação |
| bandeira_cartao | VARCHAR(30) | não | não | Quando forma_pagamento = crédito/débito |
| venda_id | INTEGER | não | não | FK → vendas; a venda de faturamento gerada na contratação |
| servicos_descricao | TEXT | não | sim | Ex.: "2 Corte(s) + 2 Barba(s)" — gerado a partir de `creditos` |
| origem_venda | VARCHAR(20) | não | não | `upsell` \| `reativacao` \| NULL (contratação normal) |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Ciclo de vida de fila:** um cliente só tem 1 combo `em_uso` por vez. Contratar um novo combo enquanto já existe um ativo cria o novo com `status = 'na_fila'` (sem `data_validade` ainda). Quando o combo `em_uso` se esgota (vence ou zera créditos), `verificarExpiracaoCliente` marca `encerrado` e ativa automaticamente o próximo `na_fila` (`data_validade` recalculada a partir de hoje).

---

## Combo Consumo (`combos_consumo`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| combo_contratado_id | INTEGER | sim | não | FK → combos_contratados |
| servico_utilizado | VARCHAR(100) | sim | não | Nome livre do serviço consumido — deve casar com uma chave de `creditos` no momento do consumo |
| data_uso | DATE | sim | não | Data do atendimento |
| profissional_id | INTEGER | não | não | FK → profissionais; colaborador que atendeu |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

Registrado via `POST /combos/consumo` (1 serviço) ou `POST /combos/consumo-lote` (N serviços em uma transação — usado quando o barbeiro debita vários créditos de uma vez na mesma visita).

---

## Combo — Template legado V1 (`combos`)

Tabela mantida pelo schema (`CREATE TABLE IF NOT EXISTS`) mas **sem rotas ativas** — o whitelabel nunca teve dados reais nela. Existe apenas para compatibilidade com o schema herdado do sistema-thieco; não é escrita nem lida por nenhum endpoint atual.

---

## Cliente (`clientes`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| nome | VARCHAR(100) | sim | não | Nome do cliente |
| contato | VARCHAR(50) | não | não | Telefone ou WhatsApp |
| email | VARCHAR(100) | não | não | Email do cliente |
| observacao | TEXT | não | não | Observação livre |
| ativo | BOOLEAN | sim | não | Default true |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

---

## Meta Individual (`metas`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| profissional_id | INTEGER | sim | não | FK → profissionais |
| tipo | VARCHAR(20) | sim | não | `faturamento` |
| periodo | VARCHAR(7) | sim | não | YYYY-MM |
| meta_bronze | NUMERIC(10,2) | não | não | Piso mínimo |
| meta_prata | NUMERIC(10,2) | não | não | Piso intermediário |
| meta_ouro | NUMERIC(10,2) | não | não | Piso máximo |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

UNIQUE constraint em `(profissional_id, tipo, periodo)`.

---

## Meta por Unidade (`metas_unidade`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| unidade | VARCHAR(50) | sim | não | Identificador da unidade |
| mes | INTEGER | sim | não | 1–12 |
| ano | INTEGER | sim | não | YYYY |
| valor_global | NUMERIC(10,2) | não | não | Meta total da unidade no mês |
| piso_bronze | NUMERIC(10,2) | não | não | Primeiro piso de gamificação |
| piso_prata | NUMERIC(10,2) | não | não | Segundo piso |
| piso_ouro | NUMERIC(10,2) | não | não | Piso máximo |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

UNIQUE constraint em `(unidade, mes, ano)`.

---

## Meta Diária (`metas_diarias`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| unidade | VARCHAR(50) | sim | não | Identificador da unidade |
| data | DATE | sim | não | Data da meta |
| meta_total | NUMERIC(10,2) | sim | não | Meta total da casa para o dia |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

UNIQUE constraint em `(unidade, data)`.

**Cota individual:** calculada em runtime: `meta_total ÷ nº de colaboradores ativos da unidade`. Denominador mínimo = 1.

---

## Feedback (`gestao_feedbacks`)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| profissional_id | INTEGER | sim | FK → profissionais |
| tipo | VARCHAR(20) | sim | `elogio` \| `melhoria` |
| titulo | VARCHAR(100) | sim | Título do feedback |
| descricao | TEXT | sim | Detalhe |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

---

## Plano PDCA (`gestao_pdca`)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| profissional_id | INTEGER | sim | FK → profissionais |
| titulo | VARCHAR(100) | sim | Título do plano |
| planejar | TEXT | sim | O quê e por quê |
| executar | TEXT | não | Como executar |
| verificar | TEXT | não | Como medir resultado |
| agir | TEXT | não | Aprendizado |
| status | VARCHAR(20) | sim | `pendente` \| `em_andamento` \| `concluido` \| `cancelado` |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

---

## Sugestão (`gestao_sugestoes`)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| categoria | VARCHAR(50) | sim | Categoria livre |
| titulo | VARCHAR(100) | sim | Título |
| descricao | TEXT | sim | Detalhe |
| prioridade | VARCHAR(20) | sim | `baixa` \| `media` \| `alta` |
| status | VARCHAR(20) | sim | `aberta` \| `em_analise` \| `aprovada` \| `implementada` \| `rejeitada` |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

---

## Unidade (`unidades`)

Filial/endereço físico do tenant. Ao contrário do sistema-thieco (unidade era um `ENUM` fixo com 2 valores hardcoded), aqui é uma tabela de verdade — cada tenant cadastra as suas.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| slug | VARCHAR(100) | sim | Identificador usado em queries/URLs; UNIQUE por tenant (`uq_unidades_tenant_slug`) |
| nome | VARCHAR(255) | sim | Nome exibido |
| ativo | BOOLEAN | sim | Default true |
| whatsapp_remetente | VARCHAR(20) | não | Número que aparece como remetente das mensagens dessa unidade (lembrete de agendamento, gatilhos ao cliente) — desde 2026-07-13 |
| link_avaliacao | TEXT | não | Link de avaliação (Google Meu Negócio ou similar) usado no gatilho de pedido de avaliação pós-venda; sem link = gatilho não dispara pra essa unidade — desde 2026-07-13 |
| atendimento_ia | JSONB | não | Default `{}`. Conteúdo consumido pelo Quasar (concierge de WhatsApp) pra montar o FAQ dessa unidade em tempo real — sem redeploy por cliente. Campos livres dentro do objeto: `nome_assistente, tom_voz, endereco, mapa_url, instagram, link_agendamento, regras_atendimento, mensagem_transbordo` (whitelist em `CAMPOS_ATENDIMENTO_IA`, `backend/routes/configuracoes.js`). Editado por `GET/PUT /configuracoes/atendimento-ia`, shape `{ <slug>: {...campos} }` — mesmo padrão de `whatsapp_remetente`/`link_avaliacao` acima. Desde 2026-07-28, ver [[registro-de-decisoes-kernel]] |
| taxas | JSONB | não | Default `{}`. **Fonte única** da taxa de cartão/meios de pagamento dessa unidade — chaves `debito`, `credito`, `pix`, `dinheiro`, `cortesia` + variantes por bandeira (`debito_visa`, `credito_mastercard`, etc. — whitelist em `CHAVES_TAXA_VALIDAS`, `backend/routes/configuracoes.js`), valores decimais (`0.0349` = 3,49%). **Chave ausente = 0** — não há fallback pra taxa "padrão" (a tabela `configuracoes` deixou de seedar `taxa_debito`/`taxa_credito` em 2026-09-10; ninguém lia esses rows). Consumido em tempo real por `calcularValorLiquido()` (`backend/services/taxas.js`, usado por `routes/vendas.js` e `routes/combos.js`) — cache de 5min por `tenant_id`+`unidade`. Editado por `GET/PUT /configuracoes/taxas`, shape `{ <slug>: {...taxas} }`. Substitui o padrão `taxa_{unidade}_{forma}` do sistema-thieco — desde 2026-07-28 |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

**Convenção estabelecida:** qualquer configuração nova que seja "um valor por unidade" deve virar coluna em `unidades` (escalar simples como `whatsapp_remetente`, ou JSONB como `atendimento_ia` se forem vários campos livres) — não uma chave string tipo `configuracoes.chave = "algo_{unidade}"`. Esse segundo padrão é o que o sistema-thieco usa (`unidade` lá é um ENUM fixo, não uma tabela de verdade) e **não deve ser replicado aqui**, porque pressupõe uma lista de unidades hardcoded — quebra assim que um tenant tem uma 3ª unidade.

---

## Notificação (`notificacoes`)

> Desde 2026-07-13. Fila única que atende três casos de uso: alertas voláteis pro admin (estoque/meta/ranking), relatórios agregados configuráveis e mensagens individuais ao cliente (aniversário, cliente sumido, avaliação pós-venda, promoção, lembrete de agendamento). O envio de fato (WhatsApp/e-mail) é responsabilidade de um consumidor externo da fila — não há integração de terceiros embutida.

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| tenant_id | INTEGER | sim | não | FK → tenants |
| unidade | VARCHAR(100) | não | não | NULL = notificação geral do tenant |
| tipo | VARCHAR(60) | sim | não | `estoque_baixo` \| `estoque_zerado` \| `meta_risco` \| `ranking_semanal_servicos` \| `ranking_semanal_produtos` \| `lembrete_agendamento` \| `aniversariante_cliente` \| `cliente_sumido` \| `avaliacao_pos_venda` \| `promocao` \| `faturamento` \| `produtos_mais_vendidos` \| `servicos_mais_realizados` \| `estoque_parado` |
| nivel | VARCHAR(20) | sim | não | `info` \| `aviso` \| `critico` — define ordenação na listagem |
| titulo | TEXT | sim | não | Título curto |
| mensagem | TEXT | não | não | Corpo da mensagem, já pronta para envio |
| meta | JSONB | não | não | Dados estruturados do disparo (ex.: `cliente_id`, `telefone_destino`, `telefone_remetente`, `agendamento_id`) — usado tanto para idempotência quanto pelo consumidor externo |
| lida | BOOLEAN | sim | não | Default false — controla o badge de não lidas no admin (canal `sistema`) |
| canal | VARCHAR(20) | sim | não | `sistema` (aparece no sino do admin) \| `whatsapp` \| `email` (filas de disparo externo) |
| enviado_whatsapp | BOOLEAN | sim | não | Default false. Marcado por quem consome a fila (`PATCH /notificacoes/whatsapp/:id/enviado`) |
| enviado_email | BOOLEAN | sim | não | Idem, para canal e-mail |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() — notificações com mais de 7 dias são descartadas na próxima geração |

---

## Canal de WhatsApp por unidade (`canais_whatsapp`) — desde 2026-09-08

Diz qual **provedor** de WhatsApp atende cada canal do tenant. Preparação pra migração ao Meta Cloud API (o Evolution segue como padrão até lá).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → `tenants` |
| canal | VARCHAR(100) | sim | Slug de uma unidade ativa, ou o pseudo-canal `'admin'` |
| provedor | VARCHAR(20) | sim | Default `'evolution'`. CHECK `evolution` \| `cloud` |
| waba_id | VARCHAR(40) | não | WhatsApp Business Account ID (só `cloud`) |
| phone_number_id | VARCHAR(40) | não | Phone Number ID do Cloud API (só `cloud`) |
| numero_exibicao | VARCHAR(20) | não | Número em formato E.164 pra exibição |
| verificado_meta | BOOLEAN | sim | Default false |
| criado_em / atualizado_em | TIMESTAMPTZ | sim | Default NOW() |

Constraint: `UNIQUE (tenant_id, canal)`. **Ausência de linha = `evolution`** — por isso não há backfill; nenhum tenant precisa de registro enquanto não migrar. O token do Cloud API **não** fica aqui: é um System User token global do app Meta (`env META_*`), com o custo de mensagem consolidado na Kernel.

---

## Caixa de entrada de Atendimento (`conversas_wpp`, `mensagens_wpp`) — desde 2026-09-08

Módulo "Atendimento" (feature `atendimentoWhatsapp`) — tela onde admin/gestor/operador respondem à mão as conversas que o Kalel passou pra humano. O Kalel (repo separado) espelha toda mensagem trocada via `POST /internal/wpp/mensagem`.

### `conversas_wpp` — uma por (tenant, canal, contato)

| Campo | Tipo | Descrição |
|---|---|---|
| id | SERIAL | PK |
| tenant_id | INTEGER | FK → `tenants` |
| canal | VARCHAR(100) | slug de unidade ou `'admin'` |
| contato | VARCHAR(30) | telefone do cliente, só dígitos com DDI |
| nome_cliente | VARCHAR(120) | denormalizado |
| cliente_id | INTEGER | FK → `clientes` (ON DELETE SET NULL), opcional |
| status | VARCHAR(15) | `bot` (default) \| `humano` (transbordo — Kalel fica calado; `assumido_por` NULL = na fila) \| `resolvido` (reabre em `bot` na próxima msg do cliente) |
| assumido_por | INTEGER | FK → `usuarios`, quem clicou "assumir" |
| assumido_em | TIMESTAMPTZ | |
| nao_lidas | INTEGER | contador, zerado ao abrir a thread |
| ultima_msg_em / ultima_msg_texto / ultima_msg_direcao | | prévia pra lista |
| janela_expira_em | TIMESTAMPTZ | 24h da última msg do cliente (relevante no Cloud API) |
| criado_em / atualizado_em | TIMESTAMPTZ | |

Constraint: `UNIQUE (tenant_id, canal, contato)`.

### `mensagens_wpp` — uma por mensagem

| Campo | Tipo | Descrição |
|---|---|---|
| id | BIGSERIAL | PK |
| conversa_id | INTEGER | FK → `conversas_wpp` (ON DELETE CASCADE) |
| tenant_id | INTEGER | FK → `tenants` |
| direcao | VARCHAR(3) | `in` (cliente→sistema) \| `out` |
| autor | VARCHAR(20) | `cliente` \| `kalel` \| `humano` |
| autor_usuario_id | INTEGER | FK → `usuarios`, quando `autor='humano'` |
| texto | TEXT | |
| wpp_msg_id | VARCHAR(80) | id da Evolution/Meta — dedupe idempotente do espelhamento |
| criado_em | TIMESTAMPTZ | |

Índice único parcial `(tenant_id, wpp_msg_id) WHERE wpp_msg_id IS NOT NULL`.

---

## Jornada da Unidade (`jornada_unidade`)

Horário de funcionamento por unidade/dia da semana — usado pelo Motor de Agendamento para calcular o grid de horários disponíveis. Sem seed automático: cada tenant configura a jornada das suas próprias unidades.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| unidade | VARCHAR(100) | sim | Slug da unidade (não é FK formal — mesma convenção livre já usada em `vendas.unidade`) |
| dia_semana | SMALLINT | sim | 0=domingo … 6=sábado (padrão `EXTRACT(DOW)`) |
| hora_inicio | TIME | sim | Abertura |
| hora_fim | TIME | sim | Fechamento |
| ativo | BOOLEAN | sim | Default true; false = fechado nesse dia |

UNIQUE(`tenant_id`, `unidade`, `dia_semana`) — 1 linha por dia da semana por unidade.

---

## Agendamento (`agendamentos`)

| Campo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | SERIAL | sim | sim | PK |
| tenant_id | INTEGER | sim | não | FK → tenants |
| unidade | VARCHAR(100) | sim | não | Unidade do atendimento |
| profissional_id | INTEGER | sim | não | FK → profissionais |
| catalogo_id | INTEGER | não | não | FK → catalogo; ON DELETE SET NULL |
| servico_nome | VARCHAR(120) | sim | não | Snapshot do nome no momento do agendamento (sobrevive a renomeação do catálogo) |
| cliente_nome | VARCHAR(120) | sim | não | Campo livre — sem FK pra clientes |
| cliente_contato | VARCHAR(30) | não | não | WhatsApp do cliente — obrigatório na origem `publico` |
| data | DATE | sim | não | |
| hora_inicio / hora_fim | TIME | sim | não | `hora_fim` calculado a partir da `duracao_minutos` do serviço no momento da criação |
| status | VARCHAR(20) | sim | não | `confirmado` \| `cancelado` \| `concluido` \| `no_show` |
| origem | VARCHAR(20) | sim | não | `admin` \| `operador` \| `barbeiro` \| `publico` \| `kalel` (desde 2026-08-16 — Kalel cria agendamento direto quando o cliente pede um profissional específico por nome, ver `registro-de-decisoes-kalel` RD-014) |
| observacao | TEXT | não | não | Livre |
| venda_id | INTEGER | não | não | FK → vendas; ON DELETE SET NULL — vínculo opcional pra rastrear conversão |
| codigo_confirmacao | VARCHAR(20) | não | sim | Único globalmente (não por tenant) — link de confirmação de presença não exige o slug do tenant na URL |
| confirmado_cliente_em | TIMESTAMPTZ | não | não | NULL até o cliente clicar em "vou comparecer" |
| created_at | TIMESTAMPTZ | sim | sim | Default NOW() |

**Constraint anti-conflito:** `EXCLUDE USING gist (tenant_id WITH =, profissional_id WITH =, tsrange(data+hora_inicio, data+hora_fim, '[)') WITH &&) WHERE (status <> 'cancelado')` — impede dois agendamentos sobrepostos pro mesmo profissional no banco, mesmo que a checagem de disponibilidade da aplicação seja vencida por uma corrida (dois clientes reservando ao mesmo tempo pelo link público). Requer extensão `btree_gist`.

---

## Configuração de Notificações (`configuracoes_notificacoes`)

Relatório agregado periódico ao admin (faturamento, ranking, estoque parado, ticket médio) — liga/desliga e agenda por unidade. Sem seed em migration; `GET /configuracoes/notificacoes?unidade=X` cria as 5 linhas padrão (uma por tipo) na primeira consulta daquela unidade.

> **Bug corrigido em 2026-08-18:** `tipo='ticket_medio'` foi adicionado no código (Fase C, commit `907504c`) sem atualizar o `CHECK` constraint da tabela — em bancos onde a tabela já existia (`CREATE TABLE IF NOT EXISTS` é no-op), o `CHECK` ficou preso em 4 valores. O INSERT de seed (5 linhas de uma vez) violava o constraint na linha `ticket_medio` e abortava a transação inteira — `GET /configuracoes/notificacoes` voltava 500 pra **qualquer** tenant, mesmo quando as 4 linhas antigas já existiam (aba "Notificações" em Configurações ficava em branco, sem erro visível). Ver [[registro-de-decisoes-kernel]].

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| unidade | VARCHAR(100) | sim | |
| tipo | VARCHAR(40) | sim | `faturamento` \| `produtos_mais_vendidos` \| `estoque_parado` \| `servicos_mais_realizados` \| `ticket_medio` |
| ativo | BOOLEAN | sim | Default false |
| periodicidade | VARCHAR(20) | sim | `diario` \| `semanal` \| `quinzenal` \| `personalizado` |
| periodicidade_dias | INTEGER | não | Obrigatório quando periodicidade = `personalizado` |
| hora_disparo | TIME | sim | Default 20:00 |
| parametros | JSONB | sim | Default `{}` — ex.: `{"dias_estoque_parado": 60}` pro tipo `estoque_parado` |
| ultimo_disparo_em | TIMESTAMPTZ | não | Atualizado a cada avaliação dentro da janela de horário, mesmo sem conteúdo a reportar (evita reavaliar a cada 15min) |

UNIQUE(`tenant_id`, `unidade`, `tipo`).

---

## Configuração de Gatilho ao Cliente (`configuracoes_gatilhos_cliente`)

Mensagem individual disparada por condição do cliente (aniversário, sumiço) ou por evento (pós-venda) — diferente da tabela acima, que é relatório agregado pro admin.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| unidade | VARCHAR(100) | sim | |
| tipo | VARCHAR(40) | sim | `aniversariante` \| `cliente_sumido` \| `avaliacao_pos_venda` |
| ativo | BOOLEAN | sim | Default false |
| hora_disparo | TIME | sim | Default 09:00 — ignorado pelo tipo `avaliacao_pos_venda` (disparado por evento, não horário) |
| template_mensagem | TEXT | sim | Placeholders: `{nome_cliente}`, `{nome_barbearia}` (resolvido para `tenants.nome`), `{link_avaliacao}` |
| parametros | JSONB | sim | Default `{}` — ex.: `{"dias_sem_visita": 45}` pro tipo `cliente_sumido` |

UNIQUE(`tenant_id`, `unidade`, `tipo`).

---

## Configuração do Resumo de Agenda do Barbeiro (`configuracoes_resumo_barbeiro`) — desde 2026-09-10

Horário e liga/desliga, **por unidade**, do resumo diário que cada barbeiro com telefone e com agendamento no dia recebe no WhatsApp (`gerarResumoAgendaBarbeiros`, `backend/routes/notificacoes.js`, gated por `features.agenda`). **Sem seed** — unidade sem linha usa o default do código (`ativo`, `07:00`). A janela de disparo é `hora_disparo` .. `hora_disparo + 4h` (restart tardio não redispara; idempotência real é via `notificacoes` tipo `resumo_agenda_barbeiro`).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| unidade | VARCHAR(100) | sim | slug da unidade |
| ativo | BOOLEAN | sim | Default true |
| hora_disparo | TIME | sim | Default `07:00` |

UNIQUE(`tenant_id`, `unidade`). Editado por `GET/PUT /configuracoes/resumo-barbeiro`, shape `{ <slug>: { ativo, hora_disparo } }` (aba Unidades das Configurações).

---

## Campanha Promocional (`campanhas_promocionais`)

**Registro reutilizável** (desde 2026-09-01) — criar ≠ disparar. Uma campanha é salva com o filtro de segmentação; depois pode ser disparada quantas vezes quiser pra audiência **atual** desse filtro, ativada/inativada, editada e arquivada (soft delete). Antes de 2026-09-01 era disparo único: 1 linha = 1 envio.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| tenant_id | INTEGER | sim | FK → tenants |
| unidade | VARCHAR(100) | sim | |
| titulo | VARCHAR(120) | sim | Uso interno (não vai pro cliente) |
| mensagem | TEXT | sim | Corpo enviado a cada destinatário |
| filtro | JSONB | sim | Default `{}` — snapshot do filtro de segmentação (dias sem visita, tipo de cliente, ticket gasto, serviço consumido); reavaliado a cada disparo |
| total_destinatarios | INTEGER | sim | Default 0 — tamanho da audiência do **último** disparo |
| ativo | BOOLEAN | sim | NOT NULL DEFAULT true (desde 2026-09-01). Campanha inativa não dispara (422) |
| arquivada_em | TIMESTAMPTZ | não | Preenchido no soft delete (`DELETE /campanhas/:id`). Some da listagem padrão (`?incluir_arquivadas=true` mostra); não pode mais ser disparada nem editada. Não apaga `campanhas_destinatarios` — o histórico de conversão sobrevive |
| ultimo_disparo_em | TIMESTAMPTZ | não | Timestamp do último disparo; `NULL` = nunca disparada |
| total_disparos | INTEGER | sim | NOT NULL DEFAULT 0 — quantas vezes já foi disparada |
| criado_por | INTEGER | não | FK → usuarios; ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | sim | Default NOW() — base da contagem de cota mensal (`tenants.limite_campanhas_mes`) |

---

## Campanha Destinatário (`campanhas_destinatarios`)

Roster de quem recebeu cada campanha — base pro cálculo de conversão (`GET /campanhas/:id/resultados`, cruza com vendas/agendamentos criados até 30 dias após o envio). Cada disparo insere uma leva nova de linhas; o cálculo de resultados deduplica por venda (`DISTINCT ON (v.id)`) antes de agrupar por cliente, então disparo repetido com janelas de 30 dias sobrepostas não infla o faturamento (fix de 2026-09-01).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| campanha_id | INTEGER | sim | FK → campanhas_promocionais; ON DELETE CASCADE |
| cliente_id | INTEGER | sim | FK → clientes; ON DELETE CASCADE |
| cliente_nome | VARCHAR(100) | sim | Snapshot do nome no momento do envio |
| enviado_em | TIMESTAMPTZ | sim | Default NOW() — início da janela de atribuição de conversão |

---

## Token de Reset (`password_reset_tokens`)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| id | SERIAL | sim | PK |
| usuario_id | INTEGER | sim | FK → usuarios |
| token | VARCHAR(100) | sim | UUID gerado — enviado por email |
| expires_at | TIMESTAMPTZ | sim | TTL configurável (padrão 1 hora) |
| used | BOOLEAN | sim | Default false; true = token já consumido |
| created_at | TIMESTAMPTZ | sim | Default NOW() |

---

## Relacionamentos principais

> `X → tenants` (N:1 via `tenant_id`) existe pra toda tabela de negócio — omitido
> linha a linha abaixo (ver seção "Multi-tenant" acima). Listado aqui só o que é
> específico de cada entidade.

| De | Para | Tipo | Via |
|---|---|---|---|
| usuarios | profissionais | N:1 | `profissional_id` |
| vendas | profissionais | N:1 | `profissional_id` |
| vendas | vendas | N:1 (auto) | `venda_origem_id` (upsell) |
| vendas | catalogo | N:1 | `catalogo_id` |
| gastos | gastos | N:1 (auto) | `gasto_origem_id` (recorrência) |
| catalogo_combo_creditos | catalogo | N:1 | `catalogo_id` (ON DELETE CASCADE) |
| combos_contratados | clientes | N:1 | `cliente_id` |
| combos_contratados | profissionais | N:1 | `profissional_id` |
| combos_contratados | vendas | N:1 | `venda_id` |
| combos_consumo | combos_contratados | N:1 | `combo_contratado_id` |
| combos_consumo | profissionais | N:1 | `profissional_id` |
| metas | profissionais | N:1 | `profissional_id` |
| gestao_feedbacks | profissionais | N:1 | `profissional_id` |
| gestao_pdca | profissionais | N:1 | `profissional_id` |
| password_reset_tokens | usuarios | N:1 | `usuario_id` |
| agendamentos | profissionais | N:1 | `profissional_id` |
| agendamentos | catalogo | N:1 | `catalogo_id` (ON DELETE SET NULL) |
| agendamentos | vendas | N:1 | `venda_id` (ON DELETE SET NULL) |
| campanhas_destinatarios | campanhas_promocionais | N:1 | `campanha_id` (ON DELETE CASCADE) |
| campanhas_destinatarios | clientes | N:1 | `cliente_id` (ON DELETE CASCADE) |
| jornada_unidade / agendamentos / configuracoes_notificacoes / configuracoes_gatilhos_cliente / configuracoes_resumo_barbeiro / campanhas_promocionais | unidades | N:1 (lógico) | `unidade` — mesma convenção de campo livre (slug, sem FK formal) já usada em `vendas.unidade`; a checagem de "unidade existe" acontece na rota (`unidadeExisteNoTenant`), não no schema |

---

## Estados e ciclo de vida

### Profissional
```
ativo ──────────────→ inativo
        (admin desativa)
```
Inativo: não aparece em selects de venda, não conta no denominador de cota diária.

### Combo contratado
```
na_fila ──→ em_uso   (combo anterior do cliente se esgota — ativação automática)
em_uso  ──→ encerrado (data_validade vencida OU todos os creditos = 0 OU cancelamento manual)
```
Um cliente só tem 1 combo `em_uso` por vez; contratações extras entram em `na_fila` até o atual se esgotar.

### Plano PDCA
```
pendente → em_andamento → concluido
                        ↘ cancelado
```

### Sugestão
```
aberta → em_analise → aprovada → implementada
              ↘ rejeitada
```

### Agendamento
```
confirmado → concluido
           ↘ cancelado
           ↘ no_show
```
`confirmado_cliente_em` é um sub-estado independente do `status` (dentro de `confirmado`): NULL até o cliente clicar em "vou comparecer" no link de confirmação.

---

## Propriedade e acesso por role

| Entidade | admin | operador | colaborador |
|---|---|---|---|
| usuarios | CRUD completo | — | Própria senha |
| profissionais | CRUD completo | Leitura | Próprios dados |
| vendas | CRUD completo, qualquer unidade | CRUD, própria unidade | CRUD próprias vendas (PATCH) |
| gastos | CRUD completo | CRUD, própria unidade | — |
| catalogo | CRUD completo | Leitura | Leitura |
| combos | CRUD completo | Ativar/usar | — |
| clientes | CRUD completo | CRUD | — |
| metas | CRUD completo | — | Leitura própria |
| metas_unidade | CRUD completo | — | Leitura própria unidade |
| metas_diarias | CRUD completo | — | Leitura própria unidade |
| gestao_feedbacks | CRUD completo | Criar | — |
| gestao_pdca | CRUD completo | Criar | — |
| gestao_sugestoes | CRUD completo | Criar | — |
| agendamentos | CRUD completo, qualquer unidade | CRUD, própria unidade | CRUD próprios agendamentos |
| jornada_unidade | CRUD completo | — | — |
| campanhas_promocionais | criar / editar / ativar-inativar / disparar / arquivar, qualquer unidade — criação limitada pela cota `tenants.limite_campanhas_mes` | — | — |
| configuracoes_notificacoes / configuracoes_gatilhos_cliente / configuracoes_resumo_barbeiro | CRUD completo | — | — |

> **Gestor** (`role='gestor'` OU `role='barbeiro'` com `eh_gestor=true`) tem o mesmo acesso da coluna "admin" acima por padrão, **exceto** as chaves em `permissoes_extra` (ver tabela `usuarios`) — `comissaoSalario`, `taxasCartao`, `gastos`, `apagarVenda`, `importarDados` e, desde 2026-08-18, `estoque` (CRUD de `catalogo`/entrada de estoque), `gatilhos` (`configuracoes_gatilhos_cliente`) e `campanhas` (`campanhas_promocionais`) — cada uma só liberada se o admin marcar explicitamente. `catalogo_duracao_profissional` segue o mesmo acesso de `profissionais` (admin/gestor CRUD).

---

## Ciclo de retenção

| Entidade | Política de retenção |
|---|---|
| vendas | Permanente — dado financeiro auditável |
| gastos | Permanente — dado financeiro auditável |
| combos_consumo | Permanente — rastreio de uso do cliente |
| gestao_feedbacks / pdca | Permanente — histórico de desenvolvimento |
| password_reset_tokens | Limpeza após uso ou TTL expirado |
| catalogo (inativo) | Soft delete — `ativo = false`, sem remoção |
| profissionais (inativo) | Soft delete — `ativo = false`, sem remoção |
| agendamentos | Permanente — histórico de atendimentos/no-shows |
| campanhas_promocionais / campanhas_destinatarios | Permanente — registro reutilizável + base de conversão. `DELETE` é soft delete (`arquivada_em`), nunca remoção física |
| notificacoes | Descartadas após 7 dias (lidas ou não) — fila operacional, não histórico |
