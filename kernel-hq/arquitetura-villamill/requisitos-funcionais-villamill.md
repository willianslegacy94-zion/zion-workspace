---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-12 (rev 10)
owner: willians
---

# Requisitos Funcionais — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]]

---

## Módulos funcionais

### Módulo 1 — Autenticação e Controle de Acesso

Gerencia identidade, sessão e permissões de cada perfil de operador.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica o usuário | dado email/username e senha válidos | cria sessão NextAuth com role (ADMIN / CAIXA / COZINHA) e flag isTrainee |
| RF-002 | Redireciona por role | dado usuário autenticado | CAIXA → /mesas (bloqueia /financeiro, /despesas, /dashboard); COZINHA → /cozinha (bloqueia tudo fora de /cozinha/*) |
| RF-003 | Protege todas as rotas | dado requisição sem sessão válida | redireciona para /login |
| RF-004 | Intercepta ações de treinamento | dado usuário com isTrainee = true | retorna resposta de sucesso simulado sem persistir nada no banco |
| RF-005 | Realiza logout | dado usuário autenticado que clica em sair | encerra sessão e redireciona para /login |
| RF-111 | Bloqueia acesso fora do horário de expediente (BYOD Guard) | dado usuário CAIXA/COZINHA (não treinamento) fora da janela de horário permitida | redireciona para /bloqueio-horario (páginas) ou retorna 403 com `{ outOfHours: true }` (APIs); ADMIN sempre isento |
| RF-112 | Exibe aviso de expiração de sessão | dado usuário CAIXA/COZINHA a ≤15min do fim do expediente | modal com minutos restantes e botão OK, que apenas dispensa o aviso sem estender o prazo — o corte real é garantido pelo middleware |

#### Regras de negócio
- **RN-001:** Treinamento nunca persiste dados — todas as mutações (POST/PATCH/DELETE) retornam sucesso falso interceptado no middleware
- **RN-002:** Usuário CAIXA tem acesso apenas a /mesas, /produtos e /estoque
- **RN-003:** Apenas ADMIN acessa /financeiro, /despesas e /dashboard
- **RN-050:** Janela de horário permitido para CAIXA/COZINHA (BYOD Guard), sempre calculada em America/Sao_Paulo independente do timezone do host: domingo sem acesso; segunda a quinta 05:30–20:30; sexta 05:30–23:30; sábado 07:30–18:30. Matriz fixa no código (`src/lib/horario-acesso.ts`), não configurável via UI/env

---

### Módulo 2 — Gestão de Mesas

Controle em tempo real do estado do salão com suas 15 mesas.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-006 | Exibe grid de mesas com status | dado acesso à /mesas | renderiza todas as 15 mesas com cor correspondente ao status (verde=LIVRE, vermelho=OCUPADA, vermelho escuro=CONTA) |
| RF-007 | Atualiza status em tempo real | dado polling SWR a cada 3s | grid reflete mudanças feitas por outro operador sem recarregar a página |
| RF-008 | Abre mesa com identificação do caixa | dado clique em mesa LIVRE e seleção do caixa no dropdown | exibe dropdown "Caixa responsável" (nomes de GET /api/caixas); botão "Abrir Mesa" permanece desabilitado até seleção; cria pedido PENDENTE com caixaNome preenchido e seta mesa para OCUPADA |
| RF-009 | Exibe comanda ao clicar em mesa OCUPADA | dado mesa com status OCUPADA | navega para a comanda daquela mesa com itens do pedido |
| RF-010 | Seta mesa para status CONTA | dado operador clica em fechar conta | muda status para CONTA, sinalizando que está em processo de fechamento |
| RF-011 | Libera mesa de emergência | dado mesa travada sem pedido ativo | seta status diretamente para LIVRE via PATCH /api/mesas/[id]/liberar |
| RF-061 | Lista caixas disponíveis para abertura | dado GET /api/caixas | retorna apenas caixas com ativo=true, ordenados por nome |
| RF-062 | Gerencia lista de caixas (admin) | dado acesso a /admin/caixas | exibe lista de caixas ativos; permite adicionar novo nome (POST /api/caixas) e remover existente (DELETE /api/caixas/[id] — soft delete via ativo=false) |
| RF-063 | Exibe caixa responsável no Financeiro | dado pedido com caixaNome preenchido | coluna "Caixa" visível nas tabelas "Transações" e "Mesas em Aberto" do módulo Financeiro |

#### Regras de negócio
- **RN-004:** Mesa não pode ser aberta se já estiver OCUPADA ou em CONTA
- **RN-005:** Liberar mesa de emergência é exclusivo de ADMIN
- **RN-006:** Status de mesa só muda via criação de pedido ou fechamento — nunca diretamente pelo operador
- **RN-030:** Mesa não pode ser aberta sem selecionar o caixa responsável — botão "Abrir Mesa" permanece desabilitado enquanto nenhum caixa estiver selecionado no dropdown

---

### Módulo 3 — Pedidos e Itens

Registro e gerenciamento dos itens consumidos em uma mesa.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-012 | Cria pedido para uma mesa | dado mesaId | persiste pedido com paymentStatus=PENDENTE e total=0 |
| RF-013 | Adiciona item ao pedido | dado orderId, productId, quantidade | persiste OrderItem com precoUnit e custoUnit no momento da adição; atualiza total do pedido |
| RF-014 | Atualiza quantidade de item | dado itemId e nova quantidade | recalcula subtotal do item e total do pedido |
| RF-015 | Remove item do pedido | dado itemId | exclui OrderItem e recalcula total |
| RF-016 | Aplica desconto ao pedido | dado valor do desconto | subtrai do total exibido em tempo real |
| RF-017 | Fecha pedido simples | dado orderId e formaPagamento | seta paymentStatus=PAGO, registra closedAt, deduz estoque via fichas técnicas |
| RF-018 | Fecha pedido com split payment | dado pagamentosSplit (array de {forma, valor}) | persiste JSON de split em pagamentosSplit, fecha pedido e deduz estoque |
| RF-019 | Fecha e libera mesa | dado orderId | executa fechamento E seta mesa para LIVRE em uma única transação |
| RF-020 | Cancela pedido | dado orderId e motivoCancelamento | seta paymentStatus=PAGO com forma=cancelado, registra em CancelamentoLog, libera mesa |

#### Regras de negócio
- **RN-007:** precoUnit e custoUnit são capturados no momento da adição — mudança de preço no cardápio não afeta pedidos abertos
- **RN-008:** Um produto só pode aparecer uma vez por pedido (unique constraint [orderId, productId]) — quantidade é atualizada, não duplicada
- **RN-009:** Dedução de estoque só acontece no fechamento — não na adição de itens
- **RN-010:** Cancelamento exige motivo — campo não pode ficar vazio
- **RN-011:** CancelamentoLog nunca é excluído — auditoria permanente

---

### Módulo 4 — Cardápio (Produtos)

Gerenciamento dos produtos disponíveis para pedido, com preços e custos.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-021 | Lista produtos por categoria | dado acesso à /produtos | retorna todos os produtos ordenados por categoria e nome |
| RF-022 | Cria produto | dado nome, preço, categoria | persiste produto com costPrice=0 e track_inventory=false por padrão |
| RF-023 | Edita produto | dado id e campos a atualizar | atualiza campos enviados |
| RF-024 | Ativa controle de estoque por produto | dado track_inventory=true | produto passa a ter estoque rastreado e deduzível |
| RF-025 | Gerencia ficha técnica | dado productId e ingredientes | CRUD de RecipeItem — define quanto de cada insumo é consumido por unidade do produto |

#### Regras de negócio
- **RN-012:** Produto com track_inventory=false pode ser vendido mesmo sem insumos na ficha técnica — não deduz nada do estoque
- **RN-013:** Produto com track_inventory=true que não tem ficha técnica — dedução zero (não bloqueia venda)
- **RN-014:** Um ingrediente aparece no máximo uma vez por ficha técnica (unique [productId, ingredientId])

---

### Módulo 5 — Estoque (Insumos)

Controle de ingredientes e insumos com alertas de nível mínimo.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-026 | Lista insumos com alerta visual | dado acesso à /estoque | retorna insumos com flag de crítico quando quantidadeAtual < nivelMinimoAlerta |
| RF-027 | Cria insumo | dado nome, unidade, quantidadeAtual, nivelMinimoAlerta | persiste insumo |
| RF-028 | Atualiza insumo | dado id e campos | atualiza quantidade (entrada/saída manual) ou configuração |
| RF-029 | Deduz estoque automaticamente | dado fechamento de pedido | para cada OrderItem, multiplica (quantidade do item × quantidade da receita) e subtrai do insumo correspondente |
| RF-030 | Exibe estoque crítico no dashboard | dado quantidadeAtual < nivelMinimoAlerta | card de alerta no dashboard com nome do insumo e quantidade |

#### Regras de negócio
- **RN-015:** Unidade do insumo define a casa decimal — KG e L usam 3 decimais, UN usa 3 decimais também (precisão definida no schema)
- **RN-016:** Dedução de estoque não bloqueia venda quando saldo seria negativo — registra saldo negativo e alerta visualmente
- **RN-017:** Entradas e saídas manuais são feitas via PATCH /api/insumos/[id] — não há log separado de movimentação

---

### Módulo 6 — Financeiro

Relatório de resultado do dia com faturamento, despesas e cancelamentos.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-031 | Gera relatório por período | dado from e to (datas) | retorna pedidosFechados, pedidosAbertos, cancelamentos e despesas do intervalo |
| RF-109 | Abre Financeiro com filtro padrão de hoje | dado acesso à /financeiro sem from/to na URL | `from` assume a data atual em `financeiro-content.tsx`, `GET /api/financeiro` e `GET /api/financeiro/consumo-funcionarios` — antes assumia o 1º dia do mês corrente; `to` já era a data atual e continua; atalhos "Hoje / 7 dias / Mês" em `date-selector.tsx` continuam disponíveis para trocar o período |
| RF-032 | Consolida faturamento por forma de pagamento | dado pedidos fechados | agrupa total por DINHEIRO, PIX, CREDITO, DEBITO, CARTAO — incluindo splits |
| RF-033 | Calcula ticket médio | dado pedidos fechados | total faturado / número de pedidos |
| RF-034 | Atualiza relatório em tempo real | dado SWR polling 3s | financeiro reflete novos fechamentos sem recarregar a página |
| RF-054 | Exibe extrato de caixinha no financeiro | dado período from/to com registros de CreditoFuncionario ou ConsumoFuncionario | exibe seção "Caixinha" (renomeada de "Caixinha — Lava-Rápido" — passou a cobrir múltiplos grupos) com 3 cards resumo (Total Créditos, Total Baixas, Saldo do Período), coluna "Grupo" (empresa do lançamento) e tabela extrato unificada créditos+baixas em ordem cronológica decrescente — seção omitida se não houver registros no período e o admin não tiver ação pendente |
| RF-055 | Filtra extrato de caixinha pelo período selecionado | dado filtro from/to | GET /api/financeiro retorna `creditosCaixinha` (CreditoFuncionario + funcionario) e `consumosCaixinha` (ConsumoFuncionario + funcionario + product) filtrados pelo mesmo intervalo das demais seções do relatório |
| RF-056 | Exclui transação fechada (admin) | dado role ADMIN e pedidoId com paymentStatus=PAGO | remove Order + OrderItems sem criar CancelamentoLog; mesa permanece LIVRE |
| RF-057 | Edita crédito de caixinha (admin) | dado role ADMIN, creditoId, novo valor e descrição | PATCH atualiza CreditoFuncionario.valor e .descricao |
| RF-058 | Exclui crédito de caixinha (admin) | dado role ADMIN e creditoId | DELETE remove CreditoFuncionario permanentemente |
| RF-059 | Edita baixa de caixinha (admin) | dado role ADMIN, consumoId, nova quantidade | PATCH atualiza ConsumoFuncionario.quantidade e recalcula .subtotal = quantidade × precoUnit; estoque não é reajustado |
| RF-060 | Exclui baixa de caixinha (admin) | dado role ADMIN e consumoId | DELETE remove ConsumoFuncionario permanentemente |
| RF-064 | Edita transação fechada — campos completos (admin) | dado role ADMIN e pedidoId com paymentStatus=PAGO | PATCH /api/pedidos/[id] aceita total, desconto, caixaNome, formaPagamento, pagamentosSplit, createdAt e closedAt; todos os campos são opcionais na chamada |
| RF-065 | Edita itens de pedido fechado (admin) | dado role ADMIN, orderId e lista de itens modificada | adiciona itens novos (POST /api/pedidos/[id]/items), atualiza quantidade de itens existentes (PATCH /api/pedidos/[id]/items/[itemId]) e remove itens excluídos (DELETE); total recalculado após cada operação |
| RF-066 | Seleciona produto para adicionar a pedido fechado via busca | dado modal de edição aberto com campo de busca | busca filtra os 111 produtos do cardápio por nome em tempo real; filtro por categoria (11 categorias) via pills; lista scrollável exibe nome + preço; seleção habilita campo de quantidade e botão "Adicionar" |
| RF-092 | Marca consumo de caixinha como pago (admin) | dado role ADMIN e consumoId | PATCH /api/parceiros/consumo/[id] com `{ liquidado: true }` seta liquidado=true e liquidadoEm=now(); linha exibe badge "Pago" no lugar do botão |
| RF-093 | Exibe grupo de cada lançamento de caixinha | dado registro de crédito ou consumo | coluna "Grupo" mostra a `empresa` do FuncionarioExterno associado (Lava-Rápido, Villa Mill, Equipe Villa Mill, etc.) |
| RF-094 | Inclui venda manualmente (admin) | dado role ADMIN, mesa e data/hora selecionadas | POST /api/financeiro/transacao cria Order com paymentStatus=PAGO, total=0 e 0 itens (sem alterar Table.status); abre automaticamente o modal de edição de transação (RF-064/065) para completar itens e pagamento |
| RF-095 | Inclui, edita e exclui despesa direto no Financeiro (admin) | dado role ADMIN | mesmo CRUD que já existe em /despesas (RF-035 a RF-038), replicado inline na seção Despesas do relatório — sem precisar navegar para outra tela |
| RF-096 | Edita cancelamento (admin) | dado role ADMIN, cancelamentoId e campos (mesaNumero, motivoCancelamento, canceladoPor, canceladoEm) | PATCH /api/cancelamentos/[id] atualiza os campos enviados |
| RF-097 | Exclui cancelamento (admin) | dado role ADMIN e cancelamentoId | DELETE /api/cancelamentos/[id] remove o registro permanentemente |
| RF-098 | Exibe lançamentos individuais de vale | dado período from/to | tabela lista cada LancamentoVale (data, colaborador, tipo, descrição, status, registrado por, valor) em vez do resumo agregado por colaborador anterior; cards de KPI (Total Dinheiro/Produto/Acumulado) mantidos |
| RF-099 | Inclui, edita e exclui vale individual (admin) | dado role ADMIN | incluir reaproveita POST /api/vales já existente (colaborador, tipo, descrição, valor); editar/excluir usam PATCH/DELETE /api/vales/[id] (novo), incluindo alternar status PENDENTE/PAGO |
| RF-100 | Inclui crédito de caixinha direto no Financeiro (admin) | dado role ADMIN | botão "+ Crédito" abre formulário (INDIVIDUAL ou COLETIVO) reaproveitando POST /api/parceiros/credito já existente |
| RF-101 | Inclui consumo de caixinha direto no Financeiro (admin) | dado role ADMIN | botão "+ Consumo" abre formulário (funcionário + produto + quantidade) reaproveitando POST /api/parceiros/consumo já existente |
| RF-102 | Exibe card de total em Lavagem | dado pedidos fechados do período com itens de categoria "Lavagem" | card no bloco de KPIs mostra soma do subtotal desses itens e a quantidade de lançamentos, ao lado de Pedidos fechados/Ticket médio/Mesas abertas |
| RF-103 | Exibe seção "Lavagens" | dado pedidos fechados do período com itens de categoria "Lavagem" | tabela lista cada lançamento (mesa, data/hora, responsável/caixa, serviço, valor) com total do período no rodapé; seção omitida se vazia e usuário não for admin |
| RF-104 | Exibe seção "Villamil" | dado pedidos fechados do período | tabela replica as colunas de Transações (mesa, data/hora, caixa, pagamento, CMV, total) mas exclui pedidos cujos itens são 100% da categoria "Lavagem" — mostra só o faturamento do restaurante |
| RF-105 | Mantém Transações com todos os pedidos | dado pedidos fechados do período | seção Transações continua exibindo todos os pedidos sem filtro de categoria, incluindo os de Lavagem — RF-103/RF-104 são visões adicionais, não substituem essa listagem |
| RF-107 | Exibe resumo de consumo por funcionário | dado período from/to | GET /api/financeiro/consumo-funcionarios agrupa ConsumoFuncionario por funcionarioId (SUM subtotal, COUNT itens), junta nome/empresa via FuncionarioExterno e ordena por total decrescente; seção "Consumo de Funcionários" exibe tabela (FUNCIONÁRIO, TOTAL CONSUMIDO, botão "Ver Detalhes") — omitida se não houver registros no período e o admin não tiver ação pendente |
| RF-108 | Exibe e concilia extrato individual de consumo (admin) | dado clique em "Ver Detalhes" na linha de um funcionário | abre modal com todos os itens do período (data/hora, item, qtd, subtotal) filtrados de `consumosCaixinha` já carregado (sem chamada extra); admin pode Dar baixa, Editar (quantidade) ou Excluir cada item, reaproveitando PATCH/DELETE /api/parceiros/consumo/[id] (RF-059/060/092) |

#### Regras de negócio
- **RN-018:** Split payment: cada parte do pagamentosSplit contribui para o total da forma correspondente — não apenas para a formaPagamento principal
- **RN-019:** Pedidos cancelados aparecem em seção separada — não somam ao faturamento
- **RN-020:** Saldo do período na seção Caixinha é calculado sobre os registros do intervalo filtrado (créditos − baixas do período), não o saldo acumulado histórico do pool
- **RN-021:** Exclusão de pedido PAGO (RF-056) não gera CancelamentoLog — é correção administrativa, não cancelamento operacional; exclusão de pedido PENDENTE continua gerando log e liberando mesa
- **RN-031:** Edição de itens de pedido PAGO (RF-065) não reconstrói efeitos de estoque — apenas corrige o registro financeiro; para ajuste de insumos, usar módulo de estoque diretamente
- **RN-032:** O campo total enviado no PATCH final (RF-064) sobrescreve o total calculado automaticamente pelas operações de item — a ordem de execução é: itens primeiro, depois PATCH do pedido
- **RN-042:** Todo endpoint de escrita (incluir/editar/excluir) usado pelo Financeiro exige checagem de ADMIN no servidor via `isAdmin()` (`src/lib/require-admin.ts`) — não apenas ocultação de botão na UI
- **RN-043:** Exclusão/edição de pedido com paymentStatus=PAGO (correção administrativa do Financeiro) é operação distinta de cancelamento de pedido PENDENTE (fluxo operacional de mesa) — apenas a primeira exige ADMIN; a segunda continua liberada para CAIXA
- **RN-044:** Venda incluída manualmente (RF-094) nasce sem itens e com total R$0 — só se torna uma venda "real" depois que o admin completa itens e pagamento no modal reaproveitado; se o modal for fechado sem salvar, o registro vazio permanece no banco (não afeta KPIs por ter total zero)
- **RN-046:** Um pedido só é excluído da seção Villamil (RF-104) se **todos** os seus itens forem da categoria "Lavagem" — pedido misto (ex: comida + lavagem na mesma mesa/conta) continua aparecendo em Villamil com o total do pedido inteiro (incluindo a parte de lavagem), e os itens de lavagem desse mesmo pedido também aparecem em Lavagens (RF-103); não há dedução automática da parte de lavagem do total exibido em Villamil para pedidos mistos
- **RN-047:** Os cards/KPIs do topo (Receita Bruta, CMV, Resultado, Ticket médio) continuam somando todos os pedidos fechados, incluindo Lavagem — apenas a tabela de Transações original e o novo card/seção de Lavagem (RF-102/103) têm recorte por categoria; Villamil (RF-104) tem seu próprio total de rodapé calculado só sobre os pedidos exibidos nela

---

### Módulo 7 — Despesas

Registro de saídas financeiras para compor o DRE.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-035 | Registra despesa | dado descricao, valor, categoria, data | persiste com registradoPor = email do usuário logado |
| RF-036 | Lista despesas filtradas por data | dado from e to | retorna despesas do intervalo |
| RF-037 | Edita despesa | dado id e campos | atualiza campos |
| RF-038 | Exclui despesa | dado id e role ADMIN | remove permanentemente |

#### Regras de negócio
- **RN-020:** Apenas ADMIN pode excluir despesas
- **RN-021:** registradoPor é preenchido automaticamente com o email da sessão — não pode ser alterado pelo operador

---

### Módulo 8 — Dashboard

Visão consolidada do estado atual do negócio.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-039 | Exibe estatísticas do dia | dado acesso ao dashboard | retorna total de pedidos, faturamento do dia, número de mesas abertas e insumos em nível crítico |
| RF-040 | Exibe atalhos para módulos | dado role ADMIN | exibe cards para Mesas, Cardápio, Estoque, Despesas, Financeiro |
| RF-110 | Centraliza alertas de estoque crítico em um sino de notificações | dado insumo com quantidadeAtual <= nivelMinimoAlerta | navbar exibe ícone de sino com badge de contagem (visível em todas as telas autenticadas); dropdown lista cada insumo crítico com link para /estoque; item some da lista automaticamente assim que o estoque é reposto acima do mínimo, no próximo poll de 3s — substitui os banners vermelhos que antes ficavam empilhados na tela inicial (mesmo dado de RF-039, outra apresentação) |

---

### Módulo 9 — Gestão de Parceiros

Gerenciamento de funcionários externos e seus saldos de caixinha. Tela `/parceiros` — exclusivo ADMIN.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-041 | Lista funcionários externos com saldo do pool | dado acesso à /parceiros | retorna FuncionarioExterno ativos com poolSaldo calculado para a empresa (créditos coletivos - todos os consumos da empresa, não liquidados) |
| RF-042 | Cria funcionário externo | dado nome e empresa | persiste com ativo=true |
| RF-043 | Registra caixinha individual | dado funcionarioId, valor e descrição | persiste CreditoFuncionario com tipo=INDIVIDUAL, funcionarioId preenchido e registradoPor = email do operador |
| RF-044 | Registra caixinha coletiva (pool da empresa) | dado empresa, valor e descrição | cria UM único CreditoFuncionario com funcionarioId=null, empresa=X, tipo=COLETIVO — o valor não se multiplica pelo número de funcionários; representa o pool compartilhado do grupo |
| RF-045 | Exibe preview do lançamento coletivo | dado empresa e valor | exibe "N funcionários de [empresa] receberão R$X cada" — confirma o valor unitário sem mostrar total multiplicado |
| RF-046 | Exibe histórico por funcionário | dado funcionarioId e período | retorna créditos e consumos com saldo resultante do período |
| RF-047 | Liquida ciclo | dado data de referência | marca liquidado=true e registra liquidadoEm em todos os CreditoFuncionario e ConsumoFuncionario não liquidados do período |
| RF-048 | Desativa funcionário externo | dado funcionarioId | seta ativo=false — preserva histórico, remove das listas operacionais |

#### Regras de negócio

- **RN-022:** poolSaldo calculado na API por empresa — SUM(CreditoFuncionario.valor WHERE empresa=X AND tipo=COLETIVO AND liquidado=false) - SUM(ConsumoFuncionario.subtotal WHERE funcionario.empresa=X AND liquidado=false) — sem campo desnormalizado no banco
- **RN-023:** Lançamento COLETIVO cria UM único registro de pool (funcionarioId=null) — o valor informado é o montante total disponível para o grupo, não por pessoa; pools de empresas diferentes são independentes
- **RN-024:** loteId registrado no CreditoFuncionario para rastreabilidade do lançamento
- **RN-025:** Liquidação é exclusiva de ADMIN e não pode ser desfeita

---

### Módulo 10 — Baixa de Funcionário

Registro de consumo de produtos e entrada de caixinha pelo operador de caixa. Modal acessado via **card "Caixinha Lava-Rápido" na home** (`/`) — CAIXA e ADMIN.

> **Observação (2026-07-01):** o card de acesso na home foi comentado (ver decisão "Card Caixinha Lava-Rápido ocultado do frontend" no registro-de-decisoes-villamill) — o módulo continua tecnicamente funcional (API e modal intactos), só sem atalho visível na UI. Consumo interno da equipe (sem pool de saldo) passou a ser coberto pelo Módulo 13 — Equipe (Consumo Interno sem Pagamento), mais abaixo neste documento.

O modal tem **seletor de empresa** (segmento) no topo e duas abas: **Consumo** e **Caixinha**. Toda operação é segmentada pelo empresa selecionada — Lava-Rápido e Villa Mill nunca se misturam.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-049 | Exibe saldo do pool da empresa selecionada | dado segmento ativo (empresa) | retorna poolSaldo calculado em tempo real — todos os funcionários do segmento compartilham o mesmo saldo exibido (apenas exibição — não bloqueia mais lançamento, ver RF-106) |
| RF-050 | ~~Bloqueia consumo por saldo insuficiente no pool~~ — **revogado em 2026-07-03** | — | consumo nunca é bloqueado por saldo, para nenhum grupo — ver RF-106 e RN-048 |
| RF-051 | Registra consumo de produto | dado funcionarioId, productId e quantidade | persiste ConsumoFuncionario com snapshot de precoUnit, deduz estoque via lógica de RF-029 — sem checagem de saldo (RN-026 revogada, ver RF-106) |
| RF-052 | Registra caixinha individual pelo caixa | dado funcionarioId, valor e descrição | persiste CreditoFuncionario com tipo=INDIVIDUAL, funcionarioId preenchido e registradoPor = email do operador |
| RF-053 | Registra caixinha coletiva pelo caixa | dado empresa, valor e descrição | executa o mesmo fluxo de RF-044 — caixa tem acesso ao lançamento coletivo; valor não se multiplica |
| RF-106 | Registra consumo livremente, sem trava de saldo (qualquer grupo) | dado funcionarioId, productId e quantidade, para qualquer empresa | POST /api/parceiros/consumo persiste o consumo e deduz estoque sempre — não há mais checagem de poolSaldo para nenhum grupo (Lava-Rápido, Villa Mill, Equipe Villa Mill, etc.); consumo acumula para conciliação humana posterior no Financeiro (RF-107/RF-108), não no momento do lançamento |

#### Regras de negócio

- **RN-026:** ~~Consumo é bloqueado quando subtotal > poolSaldo da empresa~~ — **revogada em 2026-07-03** (ver RN-048): consumo nunca mais é bloqueado por saldo, para nenhum grupo
- **RN-027:** Dedução de estoque no consumo segue a mesma lógica de RF-029 (ficha técnica) — sem criar Order — ConsumoFuncionario não entra no faturamento
- **RN-028:** CAIXA pode registrar crédito (caixinha) e consumo, mas não pode liquidar ciclos — liquidação é exclusiva de ADMIN (RN-025)
- **RN-029:** Serviço de Lavagem de Carro é lançado como Product com track_inventory=false e categoria "Serviços" — sem schema novo, operado pelo fluxo normal de comanda
- **RN-048:** Não há mais bloqueio de saldo no registro de consumo (ConsumoFuncionario), para nenhuma empresa/grupo — o saldo prévio/pool deixou de ser pré-condição de lançamento; a conciliação (quem deve o quê) é feita depois, manualmente, via Financeiro (RF-107/108). `liquidado`/`liquidadoEm` continuam existindo no schema e na UI ("Dar baixa") — mas como marcação de conciliação pós-fato, nunca mais como trava de entrada. RN-022 (cálculo de poolSaldo para exibição em /parceiros) e o saldo de **Vale** do modal "Parceiro Lava-Rápido" (`baixa-funcionario-modal.tsx`, conceito diferente) não foram alterados por esta regra

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Tempo real | Interface de mesas e financeiro atualiza a cada 3 segundos via SWR sem recarregar a página |
| RNF-002 | Performance | Resposta de operações principais (abrir mesa, adicionar item, fechar pedido) < 2 segundos |
| RNF-003 | Segurança | JWT via NextAuth obrigatório em todas as rotas; senhas armazenadas com bcryptjs |
| RNF-004 | Acessibilidade | Funciona em tablet e computador via browser, sem instalação |
| RNF-005 | Integridade | Cancelamentos nunca são excluídos — CancelamentoLog é append-only |
| RNF-006 | Isolamento de treinamento | Modo treinamento nunca persiste dados reais — interceptado no middleware antes de chegar ao banco |
| RNF-007 | Disponibilidade | Sistema disponível durante todo o horário de operação do restaurante |

---

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| Mesa (TableStatus) | LIVRE, OCUPADA, CONTA | LIVRE → OCUPADA | criação de pedido |
| Mesa | OCUPADA → CONTA | OCUPADA → CONTA | operador inicia fechamento |
| Mesa | CONTA → LIVRE | CONTA → LIVRE | fechamento + liberação do pedido |
| Mesa | qualquer → LIVRE | emergência | admin libera manualmente via /liberar |
| Pedido (PaymentStatus) | PENDENTE, PAGO | PENDENTE → PAGO | fechamento com pagamento registrado |

---

---

### Módulo 11 — KDS da Cozinha

Terminal de preparo dedicado para operadores de cozinha. Exibe fila de itens que exigem preparo, permite baixa individual por item e mantém histórico do dia para consulta.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-067 | Autentica operador da cozinha | dado username `cozinha` e senha via /login | cria sessão com role COZINHA e redireciona para /cozinha |
| RF-068 | Bloqueia acesso da cozinha a outras rotas | dado usuário COZINHA acessando qualquer rota fora de /cozinha/* | middleware redireciona imediatamente para /cozinha |
| RF-069 | Exibe fila de pendentes em tempo real | dado acesso à /cozinha | renderiza um card por mesa/pedido com pelo menos um item `PENDENTE` das categorias de preparo (itens `PRONTO` do mesmo pedido aparecem no mesmo card, riscados), ordenados pelo item pendente mais antigo do card (asc), com atualização automática a cada 2s via SWR — **revisado em 2026-07-09**, antes era um card por item; **revisado em 2026-07-29**, cada item passa a exibir o multiplicador de quantidade (ex: "2x X-Burguer") quando maior que 1, e os contadores "a fazer" somam quantidades em vez de contar linhas |
| RF-070 | Filtra itens por categoria de preparo | dado item adicionado ao pedido | apenas itens das categorias Pratos do Dia, Todos os Dias, Acompanhamentos, Lanches Tradicionais, Lanches na Baguete, Lanches Artesanais, Porções e Café da Manhã aparecem no KDS — bebidas, lavagem e sobremesas são excluídos |
| RF-071 | Sinaliza urgência por tempo de espera | dado item com tempo decorrido desde abertura do pedido | card com borda neutra (<8 min), âmbar (8–14 min) ou vermelha (≥15 min), calculada sobre o item pendente mais antigo do card |
| RF-072 | Exibe opcionais no card do item | dado item com observacoes preenchidas | exibe o texto de opcionais (ex: "Ao Ponto, c/ Salada") em destaque âmbar abaixo do nome do prato, apenas enquanto o item está pendente |
| RF-073 | Marca item como PRONTO | dado cozinheiro clica em "✓ PRONTO" | PATCH /api/cozinha/pedidos/[itemId] seta status=PRONTO e prontoEm=now(); o item fica riscado/apagado no mesmo card (não desaparece sozinho); o card só sai da aba Pendentes e vai para Concluídos quando **todos** os itens da mesa estiverem PRONTO — **revisado em 2026-07-09**, antes o card do item desaparecia imediatamente |
| RF-074 | Exibe histórico de concluídos do dia | dado cozinheiro acessa aba "Concluídos" | lista itens com status=PRONTO e prontoEm >= hoje 00:00, em ordem decrescente de prontoEm, com horário de conclusão visível — item a item, sem o agrupamento por mesa da aba Pendentes |
| RF-075 | Zera aba Concluídos automaticamente | dado virada do dia (meia-noite) | filtro prontoEm >= hoje 00:00 exclui itens do dia anterior sem intervenção manual |
| RF-114 | Permite ao ADMIN acompanhar a cozinha via navegação | dado usuário com role ADMIN autenticado | link "Cozinha" na navbar e card no dashboard inicial (/) levam a /cozinha, exibindo a mesma fila em tempo real e permitindo marcar itens como PRONTO — autorização já existia desde v1.13 (`role !== COZINHA && role !== ADMIN` → redirect), só não havia ponto de acesso na navegação |

#### Regras de negócio
- **RN-031:** KDS só exibe itens de pedidos com paymentStatus=PENDENTE — itens de mesas já fechadas não aparecem
- **RN-032:** A baixa (PRONTO) é por item individual, não por mesa — uma mesa com 3 pratos tem 3 botões independentes
- **RN-033:** O reset diário é implícito via filtro de data — nenhum dado é excluído; histórico completo permanece no banco
- **RN-034:** Usuário COZINHA não tem acesso ao sistema de PDV (mesas, produtos, financeiro) — isolamento total por role
- **RN-045:** A lista de categorias do RF-070 é uma allowlist fixa no código (`CATEGORIAS_COZINHA` em `src/app/api/cozinha/pedidos/route.ts`), não derivada dinamicamente do cardápio (diferente do filtro de categoria em Mesas/Equipe, RF-087) — toda nova categoria de produto que precise passar pela cozinha tem que ser adicionada manualmente nessa lista, ou os itens somem silenciosamente do KDS sem erro visível
- **RN-049:** Desde 2026-07-09, `GET /api/cozinha/pedidos` agrupa itens `PENDENTE`/`PRONTO` por `order.id` (campo `mesas` no lugar de `pendentes`) — um card representa a mesa inteira, não mais um item isolado; um novo item lançado na mesma mesa depois que todos os anteriores ficaram prontos recria o card automaticamente (não há nenhum estado de "card dispensado" persistido, tudo é recalculado a cada poll, mesmo padrão já usado no sino de notificações — RF-110)
- **RN-052:** Até 2026-07-29, `kds-board.tsx` nunca lia o campo `quantidade` do `OrderItem` (presente na API desde sempre) — um lançamento de "2x X-Burguer" gravava corretamente `quantidade=2` numa única linha, mas o card exibia só o nome do produto, indistinguível de "1x". Bug isolado na camada de apresentação, sem impacto em API, banco ou dedução de estoque (que sempre usou a quantidade real)
- **RN-053:** O acesso do ADMIN a /cozinha (RF-114) é de paridade total com o operador COZINHA — mesma tela, mesmo botão "✓ PRONTO", sem modo somente-leitura; não há trilha de auditoria separada indicando se a baixa foi feita pelo cozinheiro ou pelo admin

---

### Módulo 12 — Cupom Térmico

Impressão de recibo não-fiscal via browser nativo (sem driver). Compatível com impressoras térmicas 80mm (Epson TM-T20X e similares). Fluxo opcional — operador decide imprimir antes ou depois de fechar a conta.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-076 | Exibe botão "Imprimir Cupom" no modal de pedido | dado pedido ativo em qualquer mesa aberta | botão visível entre "Fechar Conta" e "Cancelar Pedido"; disponível com ou sem itens na comanda |
| RF-077 | Pergunta se cliente deseja cupom antes de fechar | dado operador clica em "Fechar Conta" pela primeira vez | modal "Cupom fiscal?" aparece com 2 opções: "Sim, imprimir primeiro" ou "Não, fechar conta" |
| RF-078 | Retorna ao modal ao escolher imprimir | dado operador escolhe "Sim, imprimir primeiro" | modal de confirmação fecha; operador permanece no modal da mesa com o botão "Imprimir Cupom" acessível |
| RF-079 | Fecha conta diretamente ao recusar cupom | dado operador escolhe "Não, fechar conta" | executa fechamento imediatamente sem nova confirmação |
| RF-080 | Segunda vez em "Fechar Conta" fecha sem perguntar | dado cupom já foi ofertado na mesma sessão de pagamento | clique direto em fecharConta() sem abrir o modal de confirmação novamente |
| RF-081 | Imprime cupom com layout térmico 80mm | dado operador clica em "Imprimir Cupom" | `window.print()` dispara impressão nativa; `@page { size: 80mm auto; margin: 0 }` formata para bobina; apenas o `.print-area` é renderizado (todo o resto é ocultado via `visibility: hidden`) |
| RF-082 | Exibe overlay pós-fechamento com opção de imprimir | dado fechamento de conta concluído com sucesso | overlay mostra mesa, hora, total, split payment e botão "Imprimir Cupom" para reimpressão do recibo |

#### Conteúdo do cupom

| Seção | Conteúdo |
|---|---|
| Cabeçalho | VILLA MILL TAMBORÉ · BARUERI - SP · CNPJ |
| Metadados | MESA (número 2 dígitos) · DATA (dd/mm/aa) · HORA (hh:mm) · ATEND (nome truncado 10 chars) |
| Itens | QTD × NOME (maiúsculas, truncado) alinhado à esquerda, VALOR alinhado à direita; opcionais recuados com `->` na linha seguinte |
| Totais | SUB-TOTAL, DESCONTO (se > 0), TOTAL com divisor duplo |
| Pagamentos | linha por forma (DINHEIRO / PIX / CARTÃO etc.) com valor |
| Rodapé | "OBRIGADO PELA PREFERENCIA!" centralizado |

#### Regras de negócio
- **RN-035:** Impressão é puramente via CSS `@media print` — não requer configuração de driver, IP de impressora ou WebSocket; funciona em qualquer SO com browser moderno conectado à impressora via USB/rede
- **RN-036:** Todas as categorias de produtos aparecem no cupom (sem filtro) — diferente do KDS que filtra por categorias de preparo
- **RN-037:** O snapshot do pedido é capturado no momento do clique em "Fechar Conta" (antes da chamada à API) — garante que o recibo reflita exatamente o que foi pago, mesmo que o SWR atualize os dados depois
- **RN-038:** `cupomJaOfertado` é resetado quando o modal da mesa fecha (`fecharModal`) ou quando outra mesa é selecionada — cada nova sessão de pagamento começa do zero

---

### Módulo 13 — Equipe (Consumo Interno sem Pagamento)

Aba dentro de `/mesas` (toggle "Mesas" / "Equipe" no topo da página) para registrar o que a equipe interna do Villa Mill e os operadores de caixa consomem do cardápio — sem fluxo de pedido/pagamento e sem pool de saldo pré-pago (diferente do Módulo 9/10, que é para o Lava-Rápido parceiro). Reaproveita `FuncionarioExterno`/`ConsumoFuncionario` já existentes, sem schema novo.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-083 | Exibe grid de pessoas na aba Equipe | dado toggle "Equipe" clicado em /mesas | lista todo FuncionarioExterno ativo (qualquer empresa) como card clicável, sem número de mesa |
| RF-084 | Abre seletor de produto ao clicar em pessoa | dado card clicado | abre modal com busca por nome, filtro por categoria e lista de produtos — mesmo padrão visual do seletor de item de mesa, sem opcionais/preparo/observações |
| RF-085 | Registra consumo sem pool de saldo | dado funcionarioId, productId e quantidade | POST /api/parceiros/consumo persiste o consumo direto, para qualquer empresa — a checagem de poolSaldo foi revogada por completo em 2026-07-03 (RN-048/RF-106); até então, era um bypass exclusivo de empresa="Equipe Villa Mill" |
| RF-086 | Exibe mensagem de estado vazio | dado nenhuma pessoa cadastrada (nem em Parceiros nem em Caixas) | exibe aviso com link para /parceiros e /admin/caixas em vez de área em branco |
| RF-087 | Deriva categorias de produto dinamicamente | dado produtos carregados (mesa ou Equipe) | filtro de categoria é calculado a partir do Set de categorias dos produtos existentes, não de uma lista fixa no código — categoria nova criada no cardápio aparece automaticamente, sem deploy |
| RF-088 | Permite múltiplos registros consecutivos | dado consumo registrado com sucesso | modal permanece aberto com o produto/quantidade resetados, pronto para registrar o próximo item da mesma pessoa |
| RF-089 | Reaproveita cadastro existente de FuncionarioExterno | dado pessoa cadastrada via /parceiros ou sincronizada de /admin/caixas | nenhuma tela de cadastro própria da aba Equipe — cadastro/edição/desativação continuam exclusivos de /parceiros |
| RF-090 | Sincroniza criação de Caixa com Equipe | dado POST /api/caixas (novo caixa ou reativação) | cria ou reativa um FuncionarioExterno correspondente (empresa=setor="Equipe Villa Mill") automaticamente |
| RF-091 | Sincroniza desativação de Caixa com Equipe | dado DELETE /api/caixas/[id] (soft delete) | desativa (ativo=false) o FuncionarioExterno de mesmo nome na empresa "Equipe Villa Mill" |
| RF-113 | Permite editar o valor do lançamento | dado produto e quantidade selecionados na aba Equipe | campo "Valor" pré-preenchido com quantidade × preço de cardápio, editável antes de registrar — permite dividir o custo de um item entre funcionários (ex: dois lançamentos de R$5 para uma Coca-Cola de R$10) |

#### Regras de negócio

- **RN-039:** ~~Consumo de FuncionarioExterno com empresa="Equipe Villa Mill" nunca é bloqueado por saldo — exceção explícita à RN-026~~ — **superada em 2026-07-03**: a exceção virou regra geral (RN-048) — nenhum grupo tem mais checagem de saldo no lançamento de consumo
- **RN-040:** Sincronização Caixa ↔ FuncionarioExterno é por nome (não há FK entre as tabelas) — `scripts/sync-caixas-equipe.js` faz backfill idempotente pontual quando necessário (ex: após restore de banco)
- **RN-041:** Consumo da Equipe não registra opcionais/preparo/observações — ConsumoFuncionario não tem campo para isso; decisão consciente do usuário para não exigir migration nova no schema
- **RN-051:** `POST /api/parceiros/consumo` aceita `valorTotal` opcional — quando informado, substitui o cálculo padrão (`produto.preco × quantidade`) como `subtotal`, e `precoUnit` passa a ser derivado (`subtotal / quantidade`); quando omitido, comportamento inalterado. Editável apenas via aba Equipe — os outros pontos de entrada do mesmo endpoint (Caixinha Lava-Rápido, baixa de funcionário) não expõem o campo

---

## Critérios de aceite gerais

- [ ] Operador abre mesa, adiciona itens, fecha com split payment em menos de 2 minutos
- [ ] Estoque dos insumos é deduzido automaticamente após fechamento de pedido com ficha técnica configurada
- [ ] Grid de mesas reflete mudança de outro operador em até 3 segundos sem recarregar
- [ ] Cancelamento com motivo fica registrado em CancelamentoLog mesmo após a mesa ser liberada
- [ ] Usuário CAIXA não consegue acessar /financeiro ou /despesas
- [ ] Usuário de treinamento não persiste nenhum dado real no banco após suas ações
- [ ] Relatório financeiro exibe corretamente split payment distribuído por forma de pagamento
