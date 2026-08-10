---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-07-28 (rev 9)
owner: willians
---

# Requisitos Funcionais — Sistema de Caixa Barbearia Thieco Leandro

> Referência: [[prd-thieco]]

---

## Módulos funcionais

### Módulo 1 — Autenticação e Controle de Acesso

Gerencia identidade, sessão e permissões de cada perfil de usuário no sistema.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica o usuário | dado username e senha válidos | retorna JWT com role (admin / barbeiro) e profissional_id |
| RF-002 | Bloqueia acesso | dado credenciais inválidas | retorna 401 sem detalhar qual campo está errado |
| RF-003 | Restringe endpoints admin | dado token de barbeiro | retorna 403 para rotas que exigem role admin |
| RF-004 | Barbeiro acessa apenas próprios dados | dado qualquer filtro enviado via query | substitui profissional_id pelo id vinculado ao token |
| RF-042 | Barbeiro edita próprios lançamentos | dado PUT /vendas/:id com role barbeiro | atualiza venda se profissional_id = JWT; pode alterar qualquer campo editável, incluindo `data` e `servico` (desde 2026-07-18); retorna 403 para vendas alheias |

#### Regras de negócio
- **RN-001:** Todo request a rotas protegidas exige JWT válido no header Authorization
- **RN-002:** Barbeiro nunca pode ver vendas de outro profissional, independente do parâmetro enviado
- **RN-003:** O campo `role` no token determina o nível de acesso — não há hierarquia intermediária
- **RN-012:** Barbeiro pode editar (PUT) apenas vendas onde `profissional_id` é igual ao seu `profissional_id` do JWT — guard aplicado no backend antes de qualquer modificação. Operador só edita vendas da própria unidade. `profissional_id` é exclusivo de admin.
- **RN-051:** Barbeiro edita e exclui lançamentos de qualquer data, não só do dia atual — restrição de mesma data removida em 2026-07-18 tanto para `PUT` quanto para `DELETE /vendas/:id` (admin nunca teve essa restrição).

---

### Módulo 2 — Registro de Vendas

Núcleo operacional do sistema: registra cada atendimento com todos os dados necessários para comissionamento, financeiro e rastreio.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-005 | Registra venda de serviço | dado unidade, profissional, serviço, valor, forma_pagamento | persiste venda com comissão_servico (40% do bruto) e valor_liquido calculados |
| RF-006 | Registra venda de produto | dado tipo_item = 'produto' | persiste venda com comissão_produto (10% do bruto), comissão_servico = 0 |
| RF-007 | Calcula valor líquido | dado forma_pagamento e unidade | desconta taxa PagBank correspondente (ver RN-004) |
| RF-008 | Registra upsell | dado venda_origem_id preenchido | marca upsell = true e vincula ao item pai da comanda |
| RF-009 | Lista vendas do dia | dado sem filtro de data | retorna apenas vendas da data atual |
| RF-010 | Filtra vendas por período, unidade e profissional | dado qualquer combinação de filtros | retorna resultado filtrado e paginado |
| RF-011 | Exclui venda | dado id de venda e role admin (qualquer venda) ou barbeiro (venda própria, qualquer data — ver RN-051) | remove venda; se tiver filhos (upsell), remove também |
| RF-012 | Aplica desconto | dado valor_desconto > 0 | valor_liquido calculado sobre (valor - desconto); comissão calculada sobre valor bruto (valor + desconto original) |
| RF-049 | Exibe ganho estimado em tempo real | dado role = barbeiro e valores no formulário | seção "Seu ganho estimado" atualiza em tempo real no Resumo do Pedido, segmentada em serviços e produtos; baseada em percentual_comissao do JWT; oculta para admin/operador |
| RF-074 | Registra caixinha (gorjeta) por venda | dado caixinha > 0 e caixinha_forma_pagamento informados no ato do registro | persiste `caixinha`/`caixinha_forma_pagamento` na venda principal da comanda; não afeta `valor`, `comissao` nem `financeiro_vendas` |
| RF-075 | Exibe comissão do barbeiro por lançamento já registrado | dado role = barbeiro, na tela de Lançamentos | mostra a comissão gravada de cada atendimento (card simples, total do grupo e cada item expandido) — complementa o RF-049, que só cobre o momento do registro |

#### Regras de negócio
- **RN-004:** Taxas de pagamento são lidas da tabela `configuracoes` (chaves `taxa_{unidade}_{forma}_{bandeira?}`) via `getTaxas()` com cache de 5 minutos. Editáveis via `PUT /configuracoes/taxas` sem redeploy. Valores padrão (Tambore: débito 1,19%, crédito 3,49%, PIX 0%; Mutinga: débito Visa/Master 1,00%, outras 2,00%; crédito Visa/Master 3,00%, outras 4,00%) continuam como fallback implícito nos seeds.
- **RN-005:** Comissão sempre calculada sobre valor bruto (valor de tabela sem desconto) — desconto é absorvido pela barbearia, não pelo barbeiro
- **RN-006:** Thieco Leandro (dono) tem percentual_comissão = 0 — nunca recebe comissão
- **RN-007:** Produto físico (controla_estoque = true no catálogo) não aparece no ranking de serviços populares nem no bloco de upsell
- **RN-016:** Para vendas com `qtd_clientes > 1`, comissão e `valor_liquido` são calculados sobre `valor × qtd_clientes` (valor total do atendimento). O valor unitário e a quantidade continuam gravados separadamente no banco para fins de exibição.
- **RN-019:** Ganho estimado do barbeiro = `(valor_servicos × percentual_comissao / 100) + (valor_produtos × percentual_comissao / 100)`. Se `percentual_comissao = 0`, retorna zero — nunca exibe comissão fictícia. O valor real é sempre o gravado pelo backend ao confirmar a venda.
- **RN-020:** Comissão no Dashboard e DRE sempre lida de `SUM(comissao)` da tabela `vendas` — nunca recalculada ad hoc. O valor gravado na criação da venda é o autoritativo.
- **RN-034:** Caixinha é 100% repasse ao barbeiro — nunca soma em `valor`, `comissao`, `comissao_servico`/`comissao_produto` nem em `financeiro_vendas.receita_bruta_ajustada`. Em comanda com pagamento dividido ou itens filhos (produto/upsell/extras), a caixinha é lançada uma única vez, sempre na primeira venda da comanda, nunca duplicada nos itens filhos. Tem forma de pagamento própria, independente da forma de pagamento da venda, e nunca é `cortesia` (é sempre repasse real).

---

### Módulo 3 — Gestão de Profissionais

CRUD dos barbeiros e suas configurações de comissionamento.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-013 | Lista profissionais ativos | dado sem filtro | retorna profissionais com ativo = true |
| RF-014 | Cria profissional | dado nome, unidade, percentual_comissao | persiste com ativo = true |
| RF-015 | Edita profissional | dado id e campos a alterar | atualiza apenas os campos enviados |
| RF-016 | Desativa profissional | dado id | seta ativo = false sem excluir o registro |

#### Requisitos Funcionais adicionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-055 | Cria/edita profissional com comissão de produto | dado percentual_comissao_produto | persiste valor individual; default 10,00 se omitido |

#### Regras de negócio
- **RN-008:** Nome de profissional é único — constraint UNIQUE na tabela
- **RN-009:** Profissional desativado não aparece em selects de registro de venda
- **RN-024:** `percentual_comissao_produto` é lido do banco no momento de cada venda (async) — alterações afetam vendas futuras imediatamente, sem logout/login
- **RN-052 (desde 2026-07-18):** `GET /profissionais` aceita `unidade` via query, mas para quem tem token de barbeiro/operador a unidade do JWT sempre prevalece sobre a recebida na query — impede ver colegas de outra unidade omitindo/forjando o parâmetro. Só admin (ou requisição sem token, ex. link público de agendamento) pode de fato filtrar por qualquer unidade.

---

### Módulo 4 — Gastos

Controle de despesas por unidade, necessário para gerar DRE.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-017 | Registra gasto | dado unidade, categoria, descricao, valor, data | persiste gasto |
| RF-018 | Lista gastos por período e unidade | dado filtros | retorna gastos filtrados |
| RF-019 | Suporta valor previsto | dado valor_previsto preenchido | armazena para comparação com valor realizado |
| RF-072 | Marca despesa como recorrente (opcional, desde 2026-07-05) | dado `recorrente=true` e `frequencia_recorrencia` (mensal/semanal/anual) | gera automaticamente, no ato da criação, as próximas 11 ocorrências futuras já persistidas, vinculadas à despesa original via `gasto_origem_id` |

#### Categorias de despesa disponíveis

`aluguel` | `produtos` | `salario` | `marketing` | `manutencao` | `equipamentos` | `utilidades` | `impostos` | `suprimentos` | `outros`

#### Regras de Negócio

- **RN-031:** Recorrência é opcional — despesa sem `recorrente=true` não sofre nenhuma alteração de comportamento; `frequencia_recorrencia` só é exigida quando `recorrente=true`.
- **RN-032:** Ocorrências futuras são geradas uma única vez, em lote (11 datas futuras a partir da data-base, no passo mensal/semanal/anual escolhido), no momento da criação da despesa original — não há job/cron recorrente verificando calendário. Editar ou excluir a despesa original não propaga automaticamente para as ocorrências já geradas.

---

### Módulo 5 — Catálogo

Define os serviços e produtos disponíveis para registro de venda, com controle de estoque por unidade para produtos físicos.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-020 | Lista itens do catálogo | dado sem filtro | retorna todos os itens ativos |
| RF-021 | Diferencia produto físico de serviço | dado controla_estoque = true | item é tratado como produto nas comissões e excluído do upsell |
| RF-022 | Backfill automático | dado item do catálogo com controla_estoque = true | vendas históricas com nome igual são reclassificadas como tipo_item = 'produto' na inicialização |
| RF-090 (desde 2026-07-20) | Cadastra item do catálogo | dado `POST /catalogo` com `unidade` ausente ou inválida, qualquer categoria | rejeita com 422 — `unidade` é obrigatória para qualquer categoria, não só serviço/combo |
| RF-091 (desde 2026-07-20) | Edita/exclui/ajusta quantidade de item do catálogo | dado `PUT`/`DELETE /catalogo/:id` ou `PATCH /catalogo/:id/quantidade` com `unidade_atual` divergente da unidade real do item no banco | rejeita com 404 ("Item não encontrado nesta unidade") em vez de alterar/excluir o registro |

#### Regras de negócio
- **RN-053 (desde 2026-07-20):** `unidade` (`tambore` \| `mutinga`) é obrigatória no cadastro de qualquer categoria do catálogo, não só serviço/combo. Item sem unidade aparece e pode ser editado/excluído nas duas unidades ao mesmo tempo — foi a causa raiz de um bug onde excluir um produto numa unidade excluía o mesmo produto (a mesma linha) na outra.
- **RN-054 (desde 2026-07-20):** `PUT`/`DELETE /catalogo/:id` e `PATCH /catalogo/:id/quantidade` recebem `unidade_atual` (a unidade do item carregado em tela, antes de qualquer edição) e travam a query a `WHERE id = :id AND unidade = :unidade_atual` — nunca alteram/excluem um registro que pertença a uma unidade diferente da esperada. `POST /estoque/consumo-interno` e `/entrada` aplicam a mesma checagem: rejeitam se o produto informado pertence a outra unidade.
- **RN-055 (desde 2026-07-18):** `GET /catalogo` aceita `unidade` via query, mas para quem tem token de barbeiro/operador a unidade do JWT sempre prevalece sobre a recebida na query — mesmo padrão do RN-052 de Profissionais. Link público de agendamento (sem login) e admin continuam podendo consultar qualquer unidade.
- **RN-056 (desde 2026-07-20):** Categorias de produto disponíveis: `produto_capilar`, `produto_barba`, `bebida`, `snack`, `vestuario`, `outro` (além de `servico`/`combo`).

---

### Módulo 6 — Combos (créditos dinâmicos por serviço desde 2026-07-04)

Pacotes pré-pagos por cliente com créditos fracionados por serviço (JSONB, qualquer combinação cadastrada no catálogo — não só corte/barba) e rastreamento de uso. O sistema V1 (tabela `combos`, sem controle de crédito, combo tratado como cortesia sem custo por atendimento) foi **inteiramente retirado do app** em 2026-07-01 — nenhuma tela ou rota viva grava ou lê mais essa tabela. Histórico V1 preservado só para auditoria.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-023 | Contrata novo combo | dado cliente_nome, creditos (objeto `{ servico: quantidade }`), valor, forma_pagamento, unidade e (opcional) origem_venda/servico_inicial | cria/atualiza cliente, cria venda com valor do combo (faturamento no ato da compra) e cria `combos_contratados` com status `em_uso` (se cliente sem combo ativo) ou `na_fila` (se já tem um ativo) |
| RF-024 | Registra uso de crédito do combo ativo | dado combo_contratado_id em status `em_uso` e nome de serviço presente em `creditos` com saldo > 0 | decrementa `creditos[servico]`, registra linha em `combos_consumo` (data_uso, profissional, serviço) por crédito debitado — **nenhuma venda financeira é criada no uso**, o valor já foi cobrado na contratação |
| RF-024b | Exibe último uso no painel do barbeiro e na tela de venda | dado combo ativo com ao menos 1 consumo registrado | mostra data do último uso, profissional que atendeu e qual serviço — lido de `combos_consumo` ordenado por `data_uso DESC`; exibido mesmo quando o saldo está zerado |
| RF-025 | Fecha combo esgotado ou vencido automaticamente | dado todas as chaves de `creditos` ≤ 0 OU `data_validade < hoje`, verificado a cada busca (`GET /combos/saldo`) ou contratação | muda status para `encerrado` e ativa automaticamente o próximo da fila (`na_fila` → `em_uso`), se houver |
| RF-025b | Reativa combo esgotado/vencido direto na tela de venda | dado cliente sem combo `em_uso` (esgotado, vencido ou nunca teve) | exibe o mesmo seletor de 3 abas (Cliente Novo/Up-sell/Reativação) usado para clientes novos — contrata um novo `combos_contratados` sem precisar sair da tela de venda nem ir à aba Combos |
| RF-025c | Botão "Reativar" na aba Combos (admin) | dado contrato com status `encerrado`, OU `em_uso` mas de fato esgotado/vencido (ainda não fechado pelo backend) | mostra botão que pré-preenche nome/contato/unidade/barbeiro na aba "Novo combo" com tipo "Reativação" selecionado |
| RF-040 | Registra produto junto ao uso do combo | dado produto selecionado ao registrar uso ou ao contratar | cria venda separada (`upsell: true`, `tipo_item: 'produto'`) somente com o valor do produto; serviço coberto pelo crédito do combo não gera venda adicional |
| RF-041 | Fila de combos (múltiplos combos por cliente) | dado cliente contrata novo combo enquanto já tem um `em_uso` | novo combo entra em `na_fila`; ativado automaticamente (`data_validade = hoje + 30 dias`) quando o atual esgota ou vence |
| RF-068 | Créditos por serviço totalmente dinâmicos (desde 2026-07-04) | dado pacote de combo com qualquer combinação de serviços do catálogo (ex.: "Corte + Risco", "4 Barbas", "Corte + Progressiva") | steppers de crédito e card de saldo exibem exatamente os serviços daquele contrato — nenhum serviço é hardcoded no código, nenhuma migration necessária para um pacote novo |
| RF-069 | Seletor premium de pacote na reativação/pagamento antecipado | dado barbeiro busca um combo cadastrado do catálogo para renovar ou contratar próximo | seletor customizado com busca fluída e preço ao lado do nome (mesmo padrão da aba de Venda) substitui o `<select>` nativo; ao selecionar, valor (R$) é travado (read-only) com o preço de tabela |
| RF-070 | Carrinho de serviços/produtos avulsos com quantidade | dado barbeiro adiciona item extra (fora dos créditos do combo) via seletor de Produto ou de Serviço adicional (upsell) | cada seletor tem campos de valor e quantidade e botão "+ Adicionar" próprios; itens acumulam num mini-carrinho com Subtotal Geral; split de pagamento (múltiplos métodos) aparece sempre que houver subtotal a cobrar |
| RF-071 | Renovação exposta quando o saldo do combo ativo esgota | dado combo `em_uso` com todas as chaves de `creditos` ≤ 0 (mas ainda não fechado por data) | card de saldo muda para o mesmo layout visual de "Combo expirado"; seletor de pacote para renovar ("Serviços-Combo") aparece direto, sem precisar abrir o colapsável "Contratar próximo combo" (que só aparece quando ainda há crédito) |
| RF-076 | Corrige data de lançamento de um combo (admin) | dado combo_contratado_id e nova data_compra, role admin | atualiza `data_compra`; se o combo está `em_uso`, recalcula `data_validade = data_compra + 30 dias`. Botão "Editar" na aba Gestão de Combos, disponível para qualquer status. |

#### Regras de negócio
- **RN-010:** Uso de crédito do combo nunca gera venda de serviço — o valor já foi cobrado na contratação. Só produto ou serviço avulso comprado junto gera venda financeira separada.
- **RN-011:** Critério de "esgotado" é único e compartilhado entre a listagem admin (`GET /combos/contratados`) e a consulta usada pela tela de venda (`GET /combos/saldo` → `verificarExpiracaoCliente`): `status = 'em_uso' AND (data_validade < hoje OR todas as chaves de creditos ≤ 0)`. Os dois caminhos **devem permanecer idênticos** — divergência entre eles foi um bug real corrigido em 2026-07-01 (ver registro de decisões).
- **RN-030:** A chave de `creditos`/`creditos_originais` é sempre o nome exato do serviço no catálogo (mesma grafia usada em `Catalogo.nome`) — nunca um enum fixo. `combos_consumo.servico_utilizado` é VARCHAR livre pelo mesmo motivo (era `combo_servico_enum` fixo 'corte'/'barba' antes de 2026-07-04).
- **RN-018:** `origem_venda` é opcional — NULL indica primeira contratação sem contexto especificado; 'upsell'/'reativacao' são enviados explicitamente pelo formulário de 3 abas.
- **RN-019:** Classificação serviço vs. produto na importação de histórico usa o catálogo (`catalogo.controla_estoque`) como fonte da verdade — nunca uma heurística de proporção de comissão (instável, corrigida em 2026-07-01).
- **RN-035:** Editar `data_compra` de um combo `na_fila` ou `encerrado` não recalcula `data_validade` — `na_fila` ainda não começou a contar (só ganha validade quando ativado, a partir da data de ativação real, não da `data_compra`); `encerrado` é histórico fechado. Só `em_uso` recalcula, porque é o único estado em que a validade está de fato contando.

---

### Módulo 7 — Clientes

Cadastro básico com histórico de atendimentos.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-026 | Cadastra cliente | dado nome e contato | persiste cliente |
| RF-027 | Vincula cliente a vendas | dado nome_cliente preenchido na venda | registra no histórico do cliente |

#### Regras de negócio
- **RN-057 (desde 2026-07-18):** `GET /clientes` aceita `unidade` via query, mas para quem tem token de barbeiro/operador a unidade do JWT sempre prevalece sobre a recebida na query — mesmo padrão do RN-052 de Profissionais e RN-055 de Catálogo.
- **RN-058 (desde 2026-07-19, TASK-36):** Upsert automático de cliente (criar-ou-atualizar ao registrar venda ou ao ativar combo, fluxo normal e migração V1→V2) é sempre escopado por `(nome, unidade)`, nunca só por nome — casar só por nome mesclava clientes homônimos de unidades diferentes, corrompendo `barbeiro_responsavel_id` e `ultima_visita`. O `JOIN` de `total_visitas` em `Cliente.findAll` segue a mesma regra.

### Módulo 8 — Metas

Define e acompanha metas financeiras por unidade e por profissional.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-028 | Define meta mensal por unidade | dado unidade, mes, ano, valor_global, pisos Bronze/Prata/Ouro e % comissão por nível | persiste ou atualiza MetaUnidade via upsert |
| RF-029 | Define meta por profissional | dado profissional_id, periodo (YYYY-MM), meta_bronze, meta_prata, meta_ouro | persiste meta individual com três pisos de gamificação |
| RF-030 | Exibe progresso individual no painel do barbeiro | dado mês corrente | retorna faturamento_atual, metas, percentuais por nível e nivel_atingido |
| RF-043 | Exibe meta da barbearia no painel do barbeiro | dado mês corrente | retorna realizado vs. valor_global, nível atingido, proximo_nivel e falta_proximo — unidade sempre resolvida pelo JWT (nunca por query param) |
| RF-044 | Exibe pisos de gamificação da meta de unidade | dado MetaUnidade com piso_bronze/prata/ouro preenchidos | barbeiro vê barra individual por piso com ✓ ao atingir e texto dinâmico de quanto falta para o próximo |
| RF-045 | Exibe card "Meta do Dia" no painel do barbeiro | dado data corrente | retorna meta_individual (cota dinâmica), valor realizado no dia e percentual de atingimento |
| RF-046 | Abre modal de metas do mês no card Meta do Dia | dado clique no card | exibe todas as metas diárias do mês com datas em dd-mm-yyyy e progresso por dia |
| RF-047 | Lista metas diárias por período e unidade (admin) | dado GET /metas-diarias com filtros | retorna todas as metas no intervalo ordenadas por data |
| RF-048 | Importa metas diárias via Markdown (admin) | dado conteúdo Markdown colado na tela GestaoMetasDiarias | detecta mês automaticamente, exibe preview e persiste via bulk upsert |

#### Regras de negócio
- **RN-013:** Barbeiro vê apenas a meta da própria unidade — `unidade` é sempre lida do JWT, nunca de query param. Admin pode filtrar qualquer unidade via `?unidade=X`.
- **RN-014:** O card de meta de unidade no painel do barbeiro sempre exibe o mês corrente, independente do filtro de período (Hoje/Mês/Período) selecionado no painel.
- **RN-015:** Quando nenhuma MetaUnidade foi cadastrada para o mês, o card exibe estado vazio — sem erro nem dado zerado enganoso.
- **RN-017:** A cota individual do barbeiro para o dia é calculada em tempo real: `meta_total ÷ nº de barbeiros ativos da unidade`. Barbeiros ativos = profissionais com `ativo=true` vinculados a usuários com `role='barbeiro'` e `ativo=true`. Denominador mínimo = 1 (previne divisão por zero em dias sem barbeiro ativo cadastrado).

---

### Módulo 9 — Relatórios

Geração de visões financeiras consolidadas para tomada de decisão.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-031 | Gera faturamento por período | dado inicio, fim, unidade | retorna total bruto, total líquido, breakdown por forma de pagamento |
| RF-032 | Gera ranking de serviços | dado período | retorna serviços ordenados por receita, excluindo produtos físicos |
| RF-033 | Gera comissões por profissional | dado período | retorna total de comissão_servico e comissão_produto por barbeiro |
| RF-034 | Gera DRE simplificado | dado período e unidade | retorna faturamento - gastos = resultado operacional |
| RF-035 | Exporta DRE completo | dado período e unidade | gera HTML imprimível com: resumo financeiro, gastos por categoria com accordion analítico (categoria + descrição + totais por nível), lançamentos individuais, despesas individuais e resumo dia a dia — todos filtrados por data e unidade |
| RF-050 | Exibe fechamento do dia no painel do barbeiro | dado data (padrão = hoje) e role barbeiro | retorna bruto, descontos, líquido, comissão e breakdown por forma de pagamento do dia; profissional_id fixado pelo JWT |

---

### Módulo 10 — Gestão de Time

Registro de feedbacks PDCA e sugestões operacionais.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-036 | Registra feedback de profissional | dado profissional_id, tipo (elogio/melhoria), titulo, descricao | persiste feedback |
| RF-037 | Cria plano de ação PDCA | dado profissional_id, titulo, planejar | persiste plano com status = pendente |
| RF-038 | Avança status do plano | dado id e novo status | valida transição e atualiza |
| RF-039 | Registra sugestão | dado categoria, titulo, descricao, prioridade | persiste sugestão com status = aberta |

---

### Módulo 11 — Débitos do Barbeiro

Registra consumos internos (produtos, adiantamentos) do barbeiro a serem descontados da comissão.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-051 | Registra débito para barbeiro | dado profissional_id, descricao, valor, data, periodo, unidade | persiste débito; admin only |
| RF-052 | Lista débitos do profissional | dado profissional_id e período | retorna todos os débitos do barbeiro no período |
| RF-053 | Exclui débito | dado id e role admin | remove débito |
| RF-054 | Barbeiro visualiza próprios débitos | dado role barbeiro | retorna débitos do mês corrente vinculados ao profissional_id do JWT |

#### Regras de negócio
- **RN-021:** Apenas admin pode criar e excluir débitos. Barbeiro só consulta.
- **RN-022:** `valor` deve ser positivo — débito representa saída do barbeiro, nunca crédito.
- **RN-023:** `periodo` no formato YYYY-MM — permite filtrar e exibir débitos do mês de fechamento.

---

---

### Módulo 12 — Configurações (Taxas de Pagamento)

Permite ao admin ajustar taxas de operadora de cartão sem redeploy, **por unidade** (desde 2026-07-05 — Tamboré e Mutinga têm acordos comerciais diferentes com a maquininha).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-056 | Lista taxas configuradas | dado GET /configuracoes/taxas | retorna todas as chaves `taxa_*` (Tamboré + Mutinga) com valores decimais |
| RF-057 | Salva novas taxas | dado PUT /configuracoes/taxas com objeto {chave: valor} | valida chaves contra o padrão `taxa_{unidade}_{forma}[_{bandeira}]`, valida range 0–1, persiste (upsert) e invalida cache |
| RF-073 | Seleciona unidade na tela de Configurações | dado clique no botão Tamboré/Mutinga | exibe e edita só as taxas daquela unidade — Débito, Crédito (padrão + Visa/Mastercard/Elo/Hipercard/Diners individuais) e Pix/Dinheiro/Cortesia |

#### Regras de negócio
- **RN-025:** Chave válida = `taxa_{tambore|mutinga}_{forma}[_{bandeira}]`. `pix`/`dinheiro`/`cortesia` nunca têm bandeira; `debito`/`credito` aceitam bandeira opcional restrita a `visa`/`mastercard`/`elo`/`hipercard`/`diners` — qualquer outra combinação é rejeitada com 400
- **RN-026:** Valores devem estar no range 0–1 (decimal) — ex: 0,0349 para 3,49%
- **RN-027:** Após `PUT`, `invalidarCacheTaxas()` é chamada — próxima venda usa as novas taxas imediatamente (bug corrigido em 2026-07-05: a chamada apontava pro módulo errado e nunca invalidava de fato — cache expirava só pelo TTL de 5 min)
- **RN-033:** `calcularTaxaPagamento()` busca a chave específica da bandeira informada (`taxa_{unidade}_{forma}_{bandeira}`); se não encontrar, cai para a chave "padrão" da unidade (`taxa_{unidade}_{forma}`); nunca aplica taxa de outra unidade — nem como fallback

---

### Módulo 13 — Notificações e Alertas

Sistema de alertas automáticos gerados por regras de negócio, consumidos via SinoBadge no Header.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-058 | Gera alertas de estoque | dado POST /notificacoes/gerar | consulta catalogo WHERE controla_estoque = true; cria alerta para itens com quantidade baixa ou zerada |
| RF-059 | Gera alertas de meta | dado POST /notificacoes/gerar | consulta metas_unidade do mês; calcula metaDia proporcional e faturadoHoje; cria alerta se realizado < metaDia |
| RF-060 | Gera ranking semanal | dado POST /notificacoes/gerar | top 3 serviços e produtos da semana corrente |
| RF-061 | Lista notificações | dado GET /notificacoes | barbeiro/operador: só as notificações da própria unidade (ou sem unidade); admin sem filtro na query: as das **duas** unidades juntas (ver RN-059); cada item exibe o selo da unidade de origem no frontend quando `unidade` não é nula |
| RF-062 | Marca notificação como lida | dado PATCH /notificacoes/:id/lida | seta lida = true — só se a notificação pertencer à unidade do usuário (ou não tiver unidade); tentativa contra notificação de outra unidade não altera a linha (ver RN-059) |
| RF-063 | Marca todas como lidas | dado PATCH /notificacoes/lidas | seta lida = true em todas da unidade efetiva do usuário (ver RN-059) |
| RF-064 | Exibe badge no Header | dado não lidas > 0 | SinoBadge exibe contador vermelho; polling a cada 5 min via setInterval; visível para os três papéis (barbeiro, operador, admin) — antes só aparecia para admin |

#### Regras de negócio
- **RN-028:** `gerarAlertasMetas` consulta `metas_unidade` — NÃO a tabela `metas`. Colunas: `valor_global`, `mes`, `ano`
- **RN-029:** Drawer de notificações dispara `POST /gerar` ao abrir — sempre atualizado no momento da consulta
- **RN-041 (desde 2026-07-12):** `canal='sistema'` (alertas do SinoBadge, RF-058 a RF-064) e `canal='whatsapp'` (fila de disparo externo, Módulo 15/16) compartilham a mesma tabela `notificacoes` mas são universos separados — `GET /notificacoes` só lê `sistema`; `GET /notificacoes/whatsapp/pendentes` só lê `whatsapp`. Nenhuma notificação de um canal aparece no consumo do outro.
- **RN-059 (desde 2026-07-23):** `POST /notificacoes/gerar`, `GET /notificacoes`, `PATCH /notificacoes/lidas` e `PATCH /notificacoes/:id/lida` deixaram de ser admin-only e usam `unidadeEfetiva(req)`: para barbeiro/operador, a unidade do JWT sempre prevalece sobre a recebida na query (mesmo padrão do RN-052 de Profissionais, RN-055 de Catálogo e RN-057 de Clientes); para admin sem `unidade` na query, não há filtro — vê as notificações de **ambas** as unidades numa só chamada. Corrige três bugs reais encontrados na implementação: (1) o JWT do admin carrega `unidade: 'tambore'` (herdado do vínculo como profissional) e o código antigo caía nesse valor por padrão sempre que a query vinha vazia, então o admin nunca via os alertas da Mutinga; (2) a checagem de "ranking semanal já gerado hoje" não era escopada por unidade — a unidade que abrisse o painel primeiro no dia "travava" a vaga e a outra nunca ganhava ranking gerado naquele dia; (3) `PATCH /:id/lida` não validava a que unidade a notificação pertencia, permitindo marcar como lida (por tentativa de ID) uma notificação de qualquer unidade. Testado ponta a ponta (login real admin + barbeiro, notificações de teste inseridas e removidas depois).

---

### Módulo 14 — Tema Escuro/Claro

Toggle de modo escuro/claro com persistência em localStorage.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-065 | Aplica tema ao iniciar | dado abertura do sistema | applyTenantTheme(getModoInicial()) chamado antes do primeiro render — sem flash |
| RF-066 | Alterna tema | dado clique no botão sol/lua | `toggleModo` flip escuro ↔ claro; aplica CSS vars em :root via applyTenantTheme |
| RF-067 | Persiste preferência | dado qualquer troca de tema | localStorage.setItem('thieco_tema', modo) — preservado entre sessões e reloads |

#### Cobertura do toggle
- `Login.jsx` — visível antes de logar (todos os usuários)
- `Header.jsx` — admin e operador (header compartilhado)
- `MeuPainel.jsx` — barbeiro (header PRÓPRIO, toggle ao lado do botão Sair)

---

### Módulo 15 — Agendamento Nativo (desde 2026-07-12)

Motor de agendamento próprio, substituindo a dependência do Booksy. Calendário interno pro barbeiro/admin/operador, mais uma página pública sem login onde o cliente agenda sozinho vendo horários realmente disponíveis.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-077 | Calcula disponibilidade real, sem login | dado GET /agendamentos/disponibilidade com unidade, catalogo_id, data (e opcionalmente profissional_id) | retorna horários livres cruzando jornada da unidade + agendamentos já marcados; se profissional não informado, une a disponibilidade de todos os barbeiros ativos |
| RF-078 | Cliente agenda sozinho, sem login | dado POST /agendamentos/publico com horário escolhido | revalida disponibilidade no servidor (nunca confia no cliente); cria o agendamento com origem='publico' e gera codigo_confirmacao |
| RF-079 | Cliente confirma presença via link | dado GET/POST /agendamentos/confirmar/:codigo | exibe dados do agendamento; ao confirmar, grava confirmado_cliente_em (rejeita se já cancelado ou já confirmado) |
| RF-080 | Gerencia agenda interna por papel | dado GET/POST/PUT /agendamentos e PATCH /:id/status, autenticado | barbeiro só vê/edita a própria agenda; operador só a própria unidade; admin livre, com filtro por barbeiro/unidade |
| RF-081 | Gera lembrete automatizado | dado agendamento confirmado a 15min de começar, com telefone cadastrado | enfileira mensagem pronta + link de confirmação na fila de notificações (canal whatsapp) — não envia, só prepara |

#### Regras de negócio
- **RN-036:** Anti-overbooking em duas camadas — checagem `OVERLAPS` na aplicação (erro amigável) e `EXCLUDE USING gist` no banco (rede de segurança contra corrida, ex.: dois clientes reservando o mesmo horário simultaneamente pelo link público). A segunda camada nunca falha, mesmo se a primeira for contornada.
- **RN-037:** `hora_fim` de um agendamento é sempre `hora_inicio + duracao_minutos` do serviço escolhido (`catalogo.duracao_minutos`) — nunca um bloco fixo genérico. Duração real por serviço/unidade, não estimada.
- **RN-038:** Jornada de funcionamento é por **unidade**, não por barbeiro individual — todos os barbeiros de uma unidade têm a mesma janela de horário possível; a agenda de cada um é bloqueada só pelos próprios agendamentos já marcados.
- **RN-039:** Link público de agendamento (`?agendar=<unidade>`) e de confirmação de presença (`?confirmar=<codigo>`) rodam **fora do shell autenticado**, reconhecidos antes do gate de login — mesmo padrão já usado pro reset de senha (`?token=`).

---

### Módulo 16 — Notificações Administrativas Configuráveis (desde 2026-07-12)

Diferente do Módulo 13 (alertas internos do SinoBadge): notificações periódicas configuráveis pelo admin. Desde 2026-07-21, o disparo é **direto pelo próprio sistema-thieco** (sem agente externo) — desde 2026-07-25, e-mail (Resend) e WhatsApp (Evolution API) reais e ativos, pivô do plano anterior de Nodemailer/Baileys/Meta Cloud API (ver [[registro-de-decisoes-thieco]] 2026-07-25).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-082 | Admin configura notificação periódica | dado PUT /configuracoes/notificacoes/:id com ativo, periodicidade, hora_disparo (e parametros para estoque_parado) | persiste a configuração daquele tipo/unidade; efeito imediato na próxima checagem |
| RF-083 | Sistema dispara notificação configurada | dado configuração ativa cujo horário e periodicidade já venceram | gera o conteúdo real (faturamento, ranking ou estoque parado do período), **envia de verdade** pelo canal ativado no cadastro do admin (e-mail via Resend; WhatsApp via Evolution API, desde 2026-07-25) e só então enfileira o registro com o resultado real do envio; idempotente — nunca duplica dentro do mesmo período |

#### Regras de negócio
- **RN-042:** Notificação periódica dispara em **horário fixo** configurado (default 20h), não só por intervalo solto em qualquer hora do dia — decisão explícita para que um relatório diário sempre chegue no fim do expediente, resumindo o dia que passou.
- **RN-043:** "Estoque parado" é calculado por `catalogo.created_at` (data de cadastro no sistema), não pela última venda — sinaliza item que nunca girou desde que entrou, por decisão explícita do produto.
- **RN-044 (desde 2026-07-12):** Destino da notificação administrativa vem do cadastro único do admin (`usuarios.telefone`/`email` + `notif_canal_whatsapp`/`notif_canal_email`), não mais de um campo por card. Um canal só pode ser ativado se o contato correspondente estiver preenchido (não dá pra ligar "enviar por e-mail" sem e-mail cadastrado).
- **RN-050 (desde 2026-07-21):** Falha no envio real (SMTP/Resend fora do ar, WhatsApp não conectado) nunca derruba a geração da notificação nem o processo Node — o envio retorna `{ok:false}`, a linha é gravada com `enviado_*=false` e continua disponível para reenvio manual (`GET /notificacoes/{whatsapp,email}/pendentes`). WhatsApp: desde 2026-07-25 via Evolution API, real — o plano anterior de aguardar a chave oficial da Meta Cloud API foi abandonado (ver [[registro-de-decisoes-thieco]] 2026-07-25).

---

### Módulo 17 — Gatilhos ao Cliente e Campanhas Promocionais (desde 2026-07-12)

Mensagens automáticas ou manuais direcionadas ao CLIENTE (não ao admin) — diferente do Módulo 16. Três gatilhos automáticos (condição por cliente) mais um disparo manual segmentado com rastreamento de conversão.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-084 | Dispara mensagem de aniversário | dado gatilho ativo e `clientes.data_nascimento` batendo com dia/mês atual | enfileira mensagem personalizada; nunca duas vezes no mesmo ano pro mesmo cliente |
| RF-085 | Dispara mensagem de cliente sumido | dado gatilho ativo e cliente sem visitar há X dias (configurável por unidade) | enfileira mensagem; não repete enquanto o cliente não voltar a visitar e sumir de novo |
| RF-086 | Dispara pedido de avaliação pós-venda | dado atendimento fechado (sem novos itens há 5+ minutos) com cliente identificado e link de avaliação configurado na unidade | enfileira mensagem com o link de avaliação; uma única mensagem por atendimento, mesmo com múltiplos itens |
| RF-087 | Admin vê quantos clientes um filtro alcança antes de disparar | dado GET /campanhas/preview-audiencia com filtro (unidade + dias sem visita, tipo, ticket gasto, serviço consumido) | retorna total, amostra de nomes e quantos foram excluídos pelo cooldown de marketing |
| RF-088 | Admin dispara campanha manual segmentada | dado POST /campanhas com título, mensagem e filtro | enfileira uma mensagem por cliente da audiência filtrada; grava histórico com o roster de quem recebeu; rejeita se audiência vazia |
| RF-089 | Admin consulta resultado de uma campanha | dado GET /campanhas/:id/resultados | calcula quantos destinatários voltaram a comprar (nova venda numa janela de 30 dias após o envio), taxa de conversão, faturamento gerado e agendamentos gerados na mesma janela |

#### Regras de negócio
- **RN-045:** Cooldown de marketing cross-tipo — nenhum cliente recebe mais de uma mensagem entre `aniversariante_cliente`, `cliente_sumido`, `avaliacao_pos_venda` e `promocao` dentro de 14 dias, mesmo se ele se encaixar em mais de um gatilho/campanha diferente no período. Aplicado como filtro adicional em todos os quatro geradores, não como uma coluna própria.
- **RN-046:** "Atendimento fechado" (RF-086) não é um estado explícito no sistema (não existe conceito de comanda aberta/fechada) — é inferido por polling: agrupa vendas por `COALESCE(venda_origem_id, id)` e considera fechado quando a última linha do grupo tem 5+ minutos, evitando disparar no meio de uma comanda ainda sendo montada.
- **RN-047:** Resgate de crédito de combo (`POST /combos/consumo`) não gera linha em `vendas`, então não dispara RF-086 — só vendas diretas e compra de combo (`POST /combos/contratar`, que insere em `vendas` normalmente) disparam o pedido de avaliação. Decisão documentada, não pendência esquecida.
- **RN-048:** Filtro de campanha por "ticket gasto" usa a soma histórica de TODAS as vendas do cliente (sem recorte de período) — não é o gasto num intervalo específico.
- **RN-049:** Janela de atribuição de conversão (RF-089) é de 30 dias após o envio da campanha, mais longa que o cooldown de marketing de 14 dias — medir "a campanha funcionou" exige mais tempo de observação que "não manda de novo essa semana". Métricas nomeadas "conversão/faturamento gerado", não "ROI %" — não existe custo por disparo rastreado no sistema hoje (envio de verdade depende de integração externa ainda pendente), então um percentual de retorno seria fabricado.

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Performance | Tempo de resposta < 2 segundos para operações de registro e listagem com filtros |
| RNF-002 | Segurança | JWT obrigatório em todas as rotas exceto /auth/login; tokens sem expiração não são aceitos |
| RNF-003 | Disponibilidade | Sistema disponível 100% do horário de operação da barbearia (07h–22h) |
| RNF-004 | Integridade | Dados históricos (8.580 vendas 2024-2026) não podem ser alterados por operações de rotina |
| RNF-005 | Acessibilidade | Interface responsiva — funciona em celular via browser sem app instalado |
| RNF-006 | Confiabilidade | Todas as regras de comissionamento e cálculo de taxa devem produzir resultado idêntico ao cálculo manual |

---

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| Profissional | ativo, inativo | ativo → inativo | desativação manual pelo admin |
| ComboContratado | na_fila, em_uso, encerrado | na_fila → em_uso → encerrado | ativação da fila, esgotamento de crédito (dinâmico, todas as chaves ≤ 0) ou vencimento |
| PlanoAcao | pendente, em_andamento, concluido, cancelado | pendente → em_andamento → concluido | atualização manual |
| Sugestão | aberta, em_analise, aprovada, implementada, rejeitada | qualquer para qualquer (exceto implementada → aberta) | atualização manual pelo admin |
| Agendamento | confirmado, cancelado, concluido, no_show | confirmado → qualquer um dos três | atualização manual via `PATCH /agendamentos/:id/status`, sem fechamento automático por tempo |

---

## Critérios de aceite gerais

- [ ] Admin pode registrar uma venda completa (serviço + produto + desconto + upsell) em menos de 60 segundos
- [ ] Comissão calculada pelo sistema é idêntica à calculada manualmente para o mesmo conjunto de dados
- [ ] Barbeiro logado não consegue visualizar vendas de outro profissional
- [ ] Relatório de faturamento do dia fecha com os mesmos valores do caixa físico
- [ ] Produto físico não aparece no ranking de serviços nem no bloco de upsell
- [ ] Após registrar venda com PagBank, valor_liquido reflete corretamente a taxa da unidade e bandeira
