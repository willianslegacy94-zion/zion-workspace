---
status: stable
domain: kernel
source: claude
created: 2026-06-24
updated: 2026-07-13
owner: willians
---

# Requisitos Funcionais — Sistema Orbita Whitelabel

> Referência: [[prd-kernel]]

---

## Módulos funcionais

### Módulo 1 — Autenticação, Controle de Acesso e Multi-tenant
**Feature flag:** core (sempre ativo)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica o usuário | dado slug (tenant), username e senha válidos | retorna JWT com role, profissional_id, unidade, percentual_comissao, tenant_id, tenant_slug e features |
| RF-002 | Bloqueia acesso | dado credenciais inválidas (ou tenant inexistente) | retorna 401 sem detalhar qual campo está errado nem se o tenant existe |
| RF-003 | Restringe endpoints admin | dado token de colaborador | retorna 403 para rotas que exigem role admin |
| RF-004 | Colaborador acessa apenas próprios dados | dado qualquer filtro enviado via query | substitui profissional_id pelo id vinculado ao token |
| RF-005 | Recupera senha por email | dado slug (tenant) e email cadastrado nesse tenant | envia token de uso único com TTL; link aponta para tela de reset |
| RF-006 | Reseta senha com token | dado token válido e nova_senha | atualiza hash; marca token como usado |
| RF-042 | Colaborador edita próprios lançamentos | dado PATCH /vendas/:id com role colaborador | atualiza venda se profissional_id = JWT; retorna 403 para vendas alheias |
| RF-061 | Resolve tenant pela URL antes do login | dado acesso a `/t/:slug` | busca branding via `GET /public/tenants/:slug` (sem autenticação) e exibe na tela de login antes de qualquer credencial ser digitada |
| RF-062 | Isola dado por tenant em toda leitura/escrita | dado qualquer query em qualquer tabela de negócio | filtra sempre por `tenant_id` do JWT, mesmo em buscas por ID direto (`findById`, etc.) |
| RF-063 | Restringe visibilidade de módulo por tenant | dado `tenants.features[flag] = false` | rota correspondente retorna 404; menu não exibe o item — reavaliado a cada login (flag embutida no JWT, não checada em tempo real durante a sessão aberta) |

#### Regras de negócio
- **RN-001:** Todo request a rotas protegidas exige JWT válido no header Authorization (exceto `/auth/*` e `/public/*`)
- **RN-002:** Colaborador nunca pode ver vendas de outro profissional, independente do parâmetro enviado
- **RN-003:** O campo `role` no token determina o nível de acesso — não há hierarquia intermediária
- **RN-021:** `username` é único apenas dentro do tenant (`UNIQUE (tenant_id, username)`) — dois tenants podem ter o mesmo username sem colidir; login sempre exige o `slug` junto
- **RN-022:** Nenhuma query a tabela de negócio pode omitir `tenant_id` do WHERE, mesmo quando o filtro primário já é um ID (proteção contra IDOR — chutar um ID de outro tenant deve retornar 404, nunca o dado)

---

### Módulo 2 — Registro de Vendas
**Feature flag:** core (sempre ativo)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-007 | Registra venda de serviço | dado profissional, serviço, valor, forma_pagamento | persiste venda com comissao_servico calculada e valor_liquido |
| RF-008 | Registra venda de produto | dado tipo_item = 'produto' | persiste venda com comissao_produto calculada, comissao_servico = 0 |
| RF-009 | Calcula valor líquido | dado forma_pagamento | valor_liquido = valor - desconto (sem taxas de operadora hardcoded) |
| RF-010 | Registra upsell | dado venda_origem_id preenchido | marca upsell = true e vincula ao item pai da comanda |
| RF-011 | Lista vendas do dia | dado sem filtro de data | retorna apenas vendas da data atual |
| RF-012 | Filtra vendas por período, unidade e profissional | dado qualquer combinação de filtros | retorna resultado filtrado |
| RF-013 | Exclui venda | dado id e role admin | remove venda e seus filhos (upsell) |
| RF-014 | Aplica desconto | dado valor_desconto > 0 | comissão calculada sobre valor bruto; desconto absorvido pelo estabelecimento |
| RF-049 | Exibe ganho estimado em tempo real | dado role = colaborador e valores no formulário | seção "Seu ganho estimado" atualiza em tempo real no Resumo do Pedido, segmentada por serviços e produtos; baseada em percentual_comissao do JWT; oculta para admin/operador |
| RF-050 | Debita estoque ao registrar venda de produto | dado catalogo_id e tipo_item='produto' | UPDATE catalogo SET quantidade = GREATEST(0, quantidade - $qtd) |

#### Regras de negócio
- **RN-004:** Comissão calculada sobre valor bruto (sem desconto) — desconto é absorvido pelo estabelecimento, não pelo colaborador
- **RN-005:** Colaborador com percentual_comissao = 0 não recebe comissão — nunca exibe comissão fictícia
- **RN-006:** Produto físico (`controla_estoque = true` no catálogo) não aparece no ranking de serviços nem no bloco de upsell
- **RN-016:** Para vendas com `qtd_clientes > 1`, comissão e `valor_liquido` são calculados sobre `valor × qtd_clientes`
- **RN-019:** Ganho estimado = `(valor_servicos × percentual_comissao / 100) + (valor_produtos × percentual_comissao / 100)`. Valor estimado — nunca substitui o valor gravado pelo backend.
- **RN-020:** Comissão no Dashboard e DRE sempre lida de `SUM(comissao)` da tabela `vendas` — nunca recalculada ad hoc. Valor gravado na criação é autoritativo.
- **RF-050 requer `tenants.features.estoque = true`:** se flag estiver off, catalogo_id é aceito mas o debit de estoque não é executado.

---

### Módulo 3 — Gestão de Profissionais
**Feature flag:** core (sempre ativo)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-015 | Lista profissionais ativos | dado sem filtro | retorna profissionais com ativo = true |
| RF-016 | Cria profissional | dado nome, unidade, percentual_comissao | persiste com ativo = true |
| RF-017 | Edita profissional | dado id e campos a alterar | atualiza apenas os campos enviados |
| RF-018 | Desativa profissional | dado id | seta ativo = false sem excluir o registro |
| RF-019 | Cria login para colaborador | dado nome, username, senha, percentual_comissao | persiste profissional + usuário com role = barbeiro; profissional_id vinculado ao usuário |
| RF-020 | Redefine senha de colaborador | dado id do profissional e nova_senha | atualiza hash no usuário vinculado |

#### Regras de negócio
- **RN-007:** Nome de profissional é único — constraint UNIQUE na tabela
- **RN-008:** Profissional desativado não aparece em selects de registro de venda e não conta no denominador de cota diária

---

### Módulo 4 — Gastos
**Feature flag:** core (sempre ativo)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-021 | Registra gasto | dado categoria, descricao, valor, data | persiste gasto |
| RF-022 | Lista gastos por período e unidade | dado filtros | retorna gastos filtrados |
| RF-023 | Suporta valor previsto | dado valor_previsto preenchido | armazena para comparação com valor realizado |
| RF-060 | Registra gasto recorrente | dado recorrente=true e frequencia_recorrencia | persiste o gasto original e gera automaticamente as próximas 11 ocorrências futuras (mensal/semanal/anual), cada uma vinculada via gasto_origem_id |

#### Categorias de despesa disponíveis

`aluguel` | `produtos` | `salario` | `marketing` | `manutencao` | `equipamentos` | `utilidades` | `impostos` | `suprimentos` | `outros`

---

### Módulo 5 — Catálogo
**Feature flag:** core (sempre ativo)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-024 | Lista itens do catálogo | dado sem filtro | retorna todos os itens ativos |
| RF-025 | Diferencia produto físico de serviço | dado controla_estoque = true | item tratado como produto nas comissões e excluído do ranking/upsell |
| RF-026 | Ajusta estoque manualmente | dado id e delta | UPDATE catalogo SET quantidade += delta |
| RF-027 | Backfill de tipo_item | dado inicialização do sistema | vendas com nome igual a item `controla_estoque = true` têm tipo_item corrigido para 'produto' |

---

### Módulo 6 — Combos / Pacotes (V2 — créditos dinâmicos)
**Feature flag:** `tenants.features.combos`

Motor genérico: um pacote concede N créditos de M serviços, definidos livremente no catálogo do tenant (`catalogo_combo_creditos`). Nenhum nome de serviço é fixo no código.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-028 | Define receita de créditos de um pacote | dado catalogo_id (categoria='combo'), servico, quantidade | persiste em catalogo_combo_creditos; catálogo passa a expor `creditos: { servico: quantidade }` no GET |
| RF-029 | Contrata combo para cliente | dado cliente_nome, creditos (objeto dinâmico), valor, forma_pagamento | cria/atualiza cliente, registra venda de faturamento, cria combos_contratados com status `em_uso` (ou `na_fila` se já existe um ativo para o cliente) |
| RF-029b | Ativação com up-sell (1º uso imediato) | dado tipo_contratacao='upsell' e servico_inicial preenchido | além de contratar, debita 1 crédito do servico_inicial na hora — se esgotar todos os créditos no ato, o combo já nasce `encerrado` |
| RF-030 | Registra uso de crédito do combo ativo | dado combo_contratado_id, servico_utilizado, saldo > 0 | decrementa 1 crédito de `creditos`; se todos os créditos zerarem, encerra o combo e ativa automaticamente o próximo `na_fila` |
| RF-030b | Registra múltiplos créditos em uma transação | dado combo_contratado_id, lista de servicos | consumo em lote (`/combos/consumo-lote`) — usado quando o barbeiro debita vários créditos da mesma visita de uma vez |
| RF-031 | Registra produto/serviço avulso junto ao uso | dado item selecionado fora dos créditos do combo | cria venda separada (upsell=true, tipo_item conforme o item) — não consome crédito do combo |
| RF-032 | Reativa combo esgotado/vencido | dado combo com status `encerrado` (ou `esgotado` computado) | pré-preenche formulário de novo combo com dados do cliente; nova contratação marca `origem_venda='reativacao'` |
| RF-032b | Contrata combo antecipado (pagamento adiantado) | dado cliente já tem combo `em_uso` | novo contrato entra em `na_fila`; ativa automaticamente (com nova data_validade) quando o atual se esgota |
| RF-032c | Edita data de lançamento de um combo | dado id e nova data_compra (admin) | recalcula data_validade (+30 dias) se o combo estiver `em_uso`; usado para cadastro retroativo (venda feita fora do sistema) |
| RF-032d | Encerra combo manualmente | dado id (admin) | marca `encerrado` e ativa o próximo `na_fila`, se houver |
| RF-032e | Exibe saldo/combo ativo do cliente | dado nome ou cliente_id | retorna combo `em_uso` com extrato de consumo, ou o último `encerrado` (saldo zerado) se não houver ativo, mais a fila de espera |
| RF-032f | Ranking de serviços consumidos via combo | dado período e unidade | retorna total de débitos e combos distintos por serviço, com percentual sobre o total — alimenta RankingServicosCombo no Dashboard |

#### Regras de negócio
- **RN-009:** Créditos são um objeto dinâmico `{ [servico]: quantidade }` — a chave é sempre o nome exato do serviço no catálogo. Um pacote novo não exige migration nem alteração de código.
- **RN-010:** `origem_venda` é opcional — NULL indica primeira contratação; `'upsell'` e `'reativacao'` são preenchidos automaticamente conforme o tipo de contratação escolhido.
- **RN-017:** Um cliente só tem 1 combo `em_uso` por vez. Contratações extras entram em `na_fila` e ativam automaticamente quando o combo atual se esgota (vence ou zera créditos) — a ativação do próximo recalcula `data_validade` a partir da data corrente, não da data de contratação original.
- **RN-018:** O critério de "esgotado" (vencido pela data OU sem créditos) é idêntico entre a listagem administrativa e a rotina de expiração — nunca podem divergir, senão o mesmo combo aparece "ativo" numa tela e "encerrado" em outra.

---

### Módulo 7 — Clientes
**Feature flag:** `tenants.features.clientes`

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-033 | Cadastra cliente | dado nome e contato | persiste cliente |
| RF-034 | Lista clientes ativos | dado sem filtro | retorna clientes com ativo = true |
| RF-035 | Exibe origem de clientes | dado período | retorna `{ periodo, total_atendimentos, canais: [{ origem, total_clientes_unicos, total_atendimentos, percentual }] }` — endpoint /relatorios/origem-clientes, alimenta RankingOrigemClientes no Dashboard |

---

### Módulo 8 — Metas
**Feature flag:** `tenants.features.metas` / `tenants.features.metasDiarias`

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-036 | Define meta mensal por colaborador | dado profissional_id, periodo, meta_bronze/prata/ouro | persiste ou atualiza via upsert |
| RF-037 | Define meta por unidade | dado unidade, mes, ano, valor_global, pisos | persiste MetaUnidade |
| RF-038 | Exibe progresso individual no painel do colaborador | dado mês corrente | retorna faturamento_atual, pisos e nivel_atingido |
| RF-039 | Exibe meta da unidade no painel do colaborador | dado mês corrente | retorna realizado vs. valor_global, nível atingido, falta_proximo — unidade sempre resolvida pelo JWT |
| RF-040 | Exibe card "Meta do Dia" no painel do colaborador | dado data corrente | retorna meta_individual (cota dinâmica), valor realizado no dia e percentual |
| RF-041 | Importa metas diárias via bulk | dado array de {unidade, data, meta_total} | upsert em lote; admin only |

#### Regras de negócio
- **RN-011:** Colaborador vê apenas a meta da própria unidade — `unidade` sempre lida do JWT, nunca de query param
- **RN-012:** Cota individual do colaborador para o dia = `meta_total ÷ nº colaboradores ativos da unidade`. Denominador mínimo = 1.
- **RN-013:** Quando nenhuma MetaUnidade foi cadastrada para o mês, exibe estado vazio — sem erro nem dado zerado enganoso.

---

### Módulo 9 — Relatórios
**Feature flag:** `tenants.features.relatorios` / `tenants.features.intelFinanceira`

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-042 | Gera faturamento por período | dado inicio, fim, unidade | retorna total bruto, total líquido, breakdown por forma de pagamento |
| RF-043 | Gera ranking de serviços | dado período | retorna serviços ordenados por receita, excluindo produtos físicos |
| RF-044 | Gera comissões por colaborador | dado período | retorna total de comissao_servico e comissao_produto por profissional |
| RF-045 | Gera DRE simplificado | dado período e unidade | retorna faturamento - gastos = resultado operacional |
| RF-046 | Exporta DRE completo | dado período e unidade | gera HTML imprimível com: resumo financeiro, gastos por categoria com accordion analítico (categoria + descrição), lançamentos individuais, despesas individuais, resumo dia a dia |
| RF-047 | Exibe origem de clientes | dado período e unidade | retorna canais de aquisição com clientes únicos, atendimentos e percentual — guarda de `tenants.features.clientes` (ver RF-035) |
| RF-048 | Exibe fechamento do dia no painel do colaborador | dado data e role colaborador | retorna bruto, descontos, líquido, comissão e breakdown por forma de pagamento; profissional_id fixado pelo JWT |

---

### Módulo 10 — Painel do Colaborador
**Feature flag:** `tenants.features.painelColaborador`

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-049 | Exibe resumo de desempenho | dado role colaborador e período | retorna faturamento_bruto, comissao_total, atendimentos únicos, ticket_medio |
| RF-050 | Exibe ranking de serviços próprios | dado role colaborador | retorna top serviços do colaborador no período |
| RF-051 | Exibe meta individual e da unidade | dado role colaborador | card de progresso Bronze/Prata/Ouro — mês corrente |
| RF-052 | Exibe meta diária com cota dinâmica | dado data corrente | card "Meta do Dia" com realizado vs. cota |
| RF-053 | Exibe fechamento do dia | dado clique no botão "Fechamento" | abre ModalFechamento com totais, por forma de pagamento e detalhamento por cliente |
| RF-054 | Registra vendas no login próprio | dado role colaborador | aba "Registro" com RegistroVenda — profissional_id e unidade fixados pelo JWT |

---

### Módulo 11 — Gestão de Time
**Feature flag:** `tenants.features.gestaoTime`

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-055 | Registra feedback de profissional | dado profissional_id, tipo, titulo, descricao | persiste feedback |
| RF-056 | Cria plano de ação PDCA | dado profissional_id, titulo, planejar | persiste plano com status = pendente |
| RF-057 | Avança status do plano | dado id e novo status | valida transição e atualiza |
| RF-058 | Registra sugestão | dado categoria, titulo, descricao, prioridade | persiste sugestão com status = aberta |
| RF-059 | Exibe timeline do profissional | dado profissional_id | retorna feedbacks e planos em ordem cronológica |

---

### Módulo 12 — Notificações e Gatilhos Automáticos
**Feature flag:** `tenants.features.notificacoes`

Portado do `sistema-thieco` em 2026-07-13. Duas famílias de disparo, ambas enfileiradas na tabela `notificacoes` (canal `sistema` | `whatsapp` | `email`) — o envio de WhatsApp/e-mail de fato é responsabilidade de um consumidor externo da fila (hoje manual; no roadmap, o Órbita Horizon assume). Não há integração real de terceiros embutida no sistema.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-060 | Gera alertas de estoque baixo/zerado | `POST /notificacoes/gerar` | uma notificação por item com `controla_estoque=true` e `quantidade <= quantidade_minima` (ou zerada) |
| RF-061 | Gera alerta de meta em risco | `POST /notificacoes/gerar` | compara progresso real vs. proporcional do mês por `metas_unidade`; dispara se defasagem ≥ 20% |
| RF-062 | Gera ranking semanal (serviços/produtos) | `POST /notificacoes/gerar`, uma vez por semana corrente | top 3 por faturamento, canal `sistema` |
| RF-063 | Lista notificações do tenant | `GET /notificacoes` | ordenadas por criticidade (crítico → aviso → info), `unidade`-scoped opcional |
| RF-064 | Marca notificação(ões) como lida(s) | `PATCH /notificacoes/:id/lida` ou `/lidas` | atualiza `lida=true` |
| RF-065 | Gera relatório agregado periódico configurável | cron a cada 15min, por `configuracoes_notificacoes` ativa cujo horário/periodicidade bateu | conteúdo (faturamento / produtos mais vendidos / serviços mais realizados / estoque parado) enfileirado nos canais que o admin ativou em `usuarios.notif_canal_whatsapp`/`notif_canal_email` |
| RF-066 | Gera gatilho de aniversariante | cron a cada 15min, por `configuracoes_gatilhos_cliente` tipo `aniversariante` ativa | mensagem personalizada ao cliente cujo `data_nascimento` bate com hoje; no máx. 1x/ano por cliente |
| RF-067 | Gera gatilho de cliente sumido | cron a cada 15min | mensagem ao cliente sem visita há ≥ N dias (configurável); não reenvia enquanto ele continuar sumido |
| RF-068 | Gera gatilho de avaliação pós-venda | cron a cada 5min, evento = venda fechada há 5min–2h | mensagem com link de avaliação (por unidade); exige `unidades.link_avaliacao` preenchido |
| RF-069 | Aplica cooldown de marketing entre gatilhos | qualquer gatilho de tipo `aniversariante_cliente`/`cliente_sumido`/`promocao`/`avaliacao_pos_venda` | não dispara pro mesmo cliente 2x em 14 dias, mesmo entre tipos diferentes |
| RF-070 | Consulta/marca fila de disparo WhatsApp e e-mail | `GET /notificacoes/whatsapp/pendentes`, `PATCH /notificacoes/whatsapp/:id/enviado` (e equivalente `/email/`) | consumidor externo lê a fila e confirma envio manualmente |
| RF-071 | Configura notificações agregadas e gatilhos ao cliente | `GET/PUT /configuracoes/notificacoes`, `/configuracoes/gatilhos-cliente` | liga/desliga, ajusta horário/periodicidade/template por unidade; linhas padrão criadas sob demanda na primeira consulta da unidade |
| RF-072 | Configura remetente WhatsApp e link de avaliação por unidade | `GET/PUT /configuracoes/whatsapp-remetente`, `/configuracoes/link-avaliacao` | grava em `unidades.whatsapp_remetente` / `unidades.link_avaliacao` |
| RF-073 | Configura perfil de notificação do admin | `GET/PUT /configuracoes/perfil-admin` | nome/telefone/e-mail + canais (`notif_canal_whatsapp`, `notif_canal_email`) — exige contato cadastrado pro canal correspondente antes de ativar |

---

### Módulo 13 — Motor de Agendamento
**Feature flag:** `tenants.features.agenda`

Portado do `sistema-thieco` (TASK-23) em 2026-07-13. Mistura rotas autenticadas (agenda interna) e rotas públicas sem login (autoagendamento do cliente + confirmação de presença) — as públicas resolvem o tenant pelo **slug na URL** (`/t/:tenantSlug?agendar=:unidadeSlug`), já que não há JWT.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-074 | Define jornada de funcionamento por unidade/dia da semana | `GET/PUT /agendamentos/jornada` (admin) | horário de abertura/fechamento por `dia_semana` (0=domingo…6=sábado); dia sem linha = fechado |
| RF-075 | Calcula grid de horários disponíveis | dado unidade, data, serviço (duração), profissional opcional | retorna slots de 30min livres, cruzando jornada + agendamentos já marcados + profissionais ativos |
| RF-076 | Lista agendamentos com filtro | `GET /agendamentos` | admin vê tudo (filtra por unidade/profissional/status); operador só a própria unidade; barbeiro só os próprios |
| RF-077 | Cria agendamento pela agenda interna | `POST /agendamentos` (admin/operador/barbeiro) | valida conflito de horário do profissional antes de gravar; gera `codigo_confirmacao` único |
| RF-078 | Reagenda / edita agendamento | `PUT /agendamentos/:id` | revalida conflito com o novo horário; barbeiro só edita os próprios, operador só da própria unidade |
| RF-079 | Muda status do agendamento | `PATCH /agendamentos/:id/status` | `confirmado → concluido \| cancelado \| no_show` |
| RF-080 | Impede overlap de horário no banco | qualquer INSERT/UPDATE em `agendamentos` | `EXCLUDE CONSTRAINT` (tenant_id + profissional_id + intervalo de tempo) — rede de segurança contra corrida, além da checagem em aplicação |
| RF-081 | Lista serviços agendáveis (público) | `GET /agendamentos/publico/:tenantSlug/servicos?unidade=X` | catálogo ativo, categoria serviço/combo, sem exigir login |
| RF-082 | Consulta disponibilidade (público) | `GET /agendamentos/publico/:tenantSlug/disponibilidade` | mesmo cálculo de RF-075, sem exigir login |
| RF-083 | Cliente se autoagenda (público) | `POST /agendamentos/publico/:tenantSlug/criar` | revalida disponibilidade no servidor (não confia no que o cliente calculou); `origem='publico'`; 409 se o horário foi ocupado entre a consulta e o envio |
| RF-084 | Cliente confirma presença (público) | `GET/POST /agendamentos/publico/confirmar/:codigo` | marca `confirmado_cliente_em`; o código sozinho resolve o agendamento (não precisa do slug do tenant na URL) |
| RF-085 | Gera lembrete de agendamento | cron a cada 5min, agendamento a ≤15min de começar | enfileira notificação canal `whatsapp` com link de confirmação; idempotente por agendamento |

---

### Módulo 14 — Campanhas de Marketing
**Feature flag:** `tenants.features.campanhas`

Portado do `sistema-thieco` (TASK-27/28) em 2026-07-13. Disparo manual e imediato (diferente dos gatilhos automáticos do Módulo 12) — tela em Configurações → aba "Campanhas".

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-086 | Segmenta audiência por filtro combinável | dado unidade + (dias sem visita mín. / tipo de cliente / ticket gasto mín-máx / serviço já consumido) | retorna lista de clientes que batem com todos os critérios informados |
| RF-087 | Pré-visualiza audiência antes de disparar | `GET /campanhas/preview-audiencia` | retorna total, amostra de 5 nomes, e quantos foram excluídos por cooldown de marketing |
| RF-088 | Dispara campanha | `POST /campanhas` | grava `campanhas_promocionais` + um `campanhas_destinatarios` por cliente + enfileira notificação `promocao` canal `whatsapp` para cada um; aplica o mesmo cooldown de 14 dias do Módulo 12 |
| RF-089 | Lista histórico de campanhas | `GET /campanhas?unidade=X` | ordenado por data, mais recente primeiro |
| RF-090 | Mede conversão de uma campanha | `GET /campanhas/:id/resultados` | cruza destinatários com vendas/agendamentos criados até 30 dias após o envio; retorna taxa de conversão, faturamento gerado, agendamentos gerados |

---

## Variáveis de ambiente

> **Desde 2026-07-10, branding e feature flags NÃO são mais variável de ambiente**
> — viraram dado em `tenants.branding`/`tenants.features` (JSONB), editável por
> tenant sem rebuild/redeploy. Todas as `VITE_COR_*`, `VITE_TENANT_*`,
> `VITE_FEATURE_*`, `FEATURE_*` da tabela antiga abaixo foram **removidas**. O
> que resta é infraestrutura (banco, JWT, SMTP) e o bootstrap do primeiro tenant.

### Backend

| Variável | Obrigatório | Descrição |
|---|---|---|
| DB_HOST | não | Host do Postgres. Vazio = usa o serviço `postgres` do `docker-compose.yml` (dev local). Preenchido = aponta para host externo (Supabase) |
| DB_PORT | não | Porta do Postgres (padrão 5432; Supabase Connection Pooler usa 6543) |
| DB_NAME / DB_USER / DB_PASSWORD | sim | Credenciais de conexão |
| DB_SSL | não | `true` para conectar com SSL — obrigatório no Supabase |
| JWT_SECRET | sim | Segredo para assinar tokens |
| JWT_EXPIRES_IN | não | TTL do token (padrão 8h) — também é o tempo máximo até uma mudança de feature flag refletir para uma sessão já aberta |
| PORT | não | Porta do servidor (padrão 3001) |
| ADMIN_USERNAME | sim | Username do admin padrão do tenant de bootstrap (seed) |
| ADMIN_PASSWORD | sim | Senha do admin padrão (seed) |
| ADMIN_NOME | não | Nome exibido do admin (padrão: "Administrador") |
| ADMIN_EMAIL | não | Email do admin para recuperação de senha |
| TENANT_PADRAO | não | Slug do tenant de bootstrap (padrão: "principal") — acessível em `/t/<TENANT_PADRAO>` |
| TENANT_PADRAO_NOME | não | Nome do tenant de bootstrap |
| UNIDADE_PADRAO | não | Slug da unidade padrão (padrão: "principal") |
| UNIDADE_PADRAO_NOME | não | Nome legível da unidade padrão |
| SMTP_HOST | não | Servidor SMTP (recuperação de senha) |
| SMTP_PORT | não | Porta SMTP |
| SMTP_USER | não | Usuário SMTP |
| SMTP_PASS | não | Senha SMTP |
| SMTP_FROM | não | Endereço remetente dos emails |

### Frontend (Vite — build-time)

| Variável | Obrigatório | Descrição |
|---|---|---|
| VITE_NICHO | não | `barbearia` \| `salao` \| `clinica` \| `generico` (padrão: generico) — única peça de personalização que continua build-time; ver limitação abaixo |
| VITE_LABEL_PROFISSIONAL | não | Override individual de label |
| VITE_LABEL_PROFISSIONAIS | não | Override individual de label (plural) |
| VITE_LABEL_ESTABELECIMENTO | não | Override individual de label |
| VITE_LABEL_SERVICO | não | Override individual de label |
| VITE_LABEL_CLIENTES | não | Override individual de label |
| VITE_LABEL_COMBOS | não | Override individual de label |

**Limitação conhecida:** como um único build de frontend agora atende todos os tenants (ver RAN-007), `VITE_NICHO` deixa de ser "1 valor por cliente" e vira "1 valor pro deployment inteiro". Se dois tenants no mesmo deployment precisarem de nichos diferentes (ex.: uma barbearia e uma clínica), a terminologia ficará inconsistente para um deles — não era o escopo combinado da migração de 2026-07-10 (só branding + feature flags foram movidos pra runtime).

### Branding e feature flags — não são mais env var

Editáveis diretamente em `tenants.branding` / `tenants.features` (JSONB), por tenant:

| Campo (`tenants.branding`) | Equivalente à antiga env var |
|---|---|
| `nome`, `slogan` | `VITE_TENANT_NOME`, `VITE_TENANT_SLOGAN` |
| `logoUrl`, `loginBgUrl` | `VITE_LOGO_URL`, `VITE_LOGIN_BG_URL` |
| `temaPadrao` | `VITE_TEMA_PADRAO` |
| `corPrimaria`, `corPrimariaEscuro`, `corFundo`, `corFundoEscuro`, `corSuperficie`, `corSuperficieEscuro` | `VITE_COR_*` |

| Campo (`tenants.features`, chave = nome da flag) | Equivalente à antiga env var |
|---|---|
| `combos`, `metas`, `metasDiarias`, `gestaoTime`, `clientes`, `estoque`, `relatorios`, `intelFinanceira`, `comissoes`, `painelColaborador`, `notificacoes`, `agenda` (desde 2026-07-13), `campanhas` (desde 2026-07-13) | `FEATURE_*` / `VITE_FEATURE_*` (um único par por flag, não mais duplicado backend/frontend) |

Core sempre-true (`vendas`, `gastos`, `catalogo`, `profissionais`, `dashboard`) não têm chave em `tenants.features` — são forçados por `resolveFeatures()` no backend, ver [[arquitetura-kernel]] § Sistema de Feature Flags.

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Performance | Tempo de resposta < 2 segundos para registro e listagem com filtros |
| RNF-002 | Segurança | JWT obrigatório em todas as rotas exceto `/auth/*` e `/public/*` (global desde `server.js`) |
| RNF-002b | Segurança | `tenant_id` obrigatório em toda query a tabela de negócio — nenhuma função de `models.js` pode buscar/alterar por ID sem checar o dono (proteção IDOR) |
| RNF-003 | Disponibilidade | Sistema disponível ≥ 99% no horário de operação do estabelecimento |
| RNF-004 | Integridade | Dados de comissão gravados no banco nunca recalculados ad hoc em relatórios |
| RNF-005 | Acessibilidade | Interface responsiva — funciona em celular via browser sem instalação |
| RNF-006 | Portabilidade | Deploy único reproduzível via `docker compose up -d` atende múltiplos tenants — não mais 1 deploy por cliente |
| RNF-007 | Extensibilidade | Qualquer módulo pode ser ativado ou desativado por tenant sem alterar código nem rebuild — flag em `tenants.features`, reflete no próximo login |

---

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | Disparo |
|---|---|---|---|
| Profissional | ativo, inativo | ativo → inativo | desativação manual pelo admin |
| Combo contratado | em_uso, na_fila, encerrado | na_fila → em_uso, em_uso → encerrado | ativação automática da fila; TTL de validade ou créditos zerados; cancelamento manual |
| Plano PDCA | pendente, em_andamento, concluido, cancelado | pendente → em_andamento → concluido | atualização manual |
| Sugestão | aberta, em_analise, aprovada, implementada, rejeitada | qualquer para qualquer (exceto implementada → aberta) | atualização manual |
