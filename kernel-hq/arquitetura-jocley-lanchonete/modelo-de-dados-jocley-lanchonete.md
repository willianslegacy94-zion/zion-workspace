---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-08-07
owner: willians
---

# Modelo de Dados — Jocley Grill

> Referência: [[prd-jocley-lanchonete]] | [[arquitetura-jocley-lanchonete]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| User | Pessoa que opera o sistema | Autenticação e controle de acesso por um dos 5 papéis, refinável por permissão granular de aba/subtópico (`permissoesOverride`, desde 2026-08-04) |
| Table (Mesa) | Espaço físico onde o cliente senta | Unidade central do fluxo Mesas do PDV |
| Order (Comanda) | Registro de um atendimento, em mesa ou balcão | Captura o que foi consumido, o valor e como foi pago |
| ContadorComanda | Contador atômico diário para numeração de comanda de balcão | Garante numeração sequencial sem corrida de concorrência, resetando todo dia |
| OrderItem | Linha de um produto dentro de uma comanda | Rastreia quantidade, preço e custo no momento da venda; também é a unidade do KDS |
| Product (Produto) | Item do cardápio | Define o que pode ser vendido, preço e custo (CMV) |
| Ingredient (Insumo) | Matéria-prima consumida no preparo | Base do cálculo de CMV e do controle de estoque |
| RecipeItem (Ficha Técnica) | Relação produto ↔ insumo com quantidade | Define quanto de cada insumo um produto consome — origem do CMV calculado |
| MovimentacaoEstoque | Registro de entrada/saída de insumo | Auditoria do estoque — venda, consumo interno, entrada, ajuste ou perda |
| Despesa | Saída financeira da lanchonete | Necessária para calcular o Resultado real (receita − CMV − despesas − taxa) |
| Funcionario | Membro da equipe (para fins de gestão de time) | Vincula feedbacks, planos de ação e comissão a uma pessoa |
| Feedback | Elogio ou ponto de melhoria registrado sobre um funcionário | Histórico de gestão de pessoas |
| PlanoAcao | Plano de ação estruturado (PDCA) para um funcionário | Estrutura formal de melhoria contínua |
| Sugestao | Sugestão registrada pela equipe (sem vínculo a pessoa) | Canal geral de melhoria, independente de funcionário específico |
| TaxaPagamento | Percentual de taxa por forma de pagamento (e opcionalmente por bandeira) | Base do cálculo de Receita Líquida — snapshot em `Order.taxaTotal` no fechamento |
| TaxaDelivery | Percentual de comissão por canal de delivery/marketplace | Alimenta a Calculadora de Metas (Inteligência Financeira) — desconta da receita bruta projetada conforme o canal escolhido |
| ConfiguracaoNotificacao | Configuração de um tipo de notificação (ativo, periodicidade, horário) | Define o que e quando notificar — disparo real via WhatsApp (Evolution API) implementado em 2026-08-04, consumido por um agendador em processo (`src/instrumentation.ts`) |
| ConfiguracaoGeral | Par chave-valor genérico | Reservado para configurações soltas — hoje guarda a chave `whatsapp_telefone_notificacao` (telefone que recebe as notificações, desde 2026-08-04) |
| ErrorLog | Registro técnico de uma exceção capturada no servidor | Memória persistida do que quebrou — rota, mensagem técnica, stack, usuário e data, visível só à conta `devmaster` |

---

## Atributos por entidade

### User

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome de exibição |
| email | String | sim | não | login (username) — UNIQUE |
| senhaHash | String | sim | não | hash bcrypt — nunca exposto |
| role | UserRole | sim | não | ADMIN / SUPERVISOR / CAIXA / ATENDENTE / COZINHA — default CAIXA |
| ativo | Boolean | sim | não | usuário inativo não autentica — default true |
| permissoesOverride | Json? | não | não | mapa `{chave: boolean}` de permissões granulares por aba/subtópico (Módulo 17, RF), adicionado em 2026-08-04 — `null` = usa os padrões do `role` (comportamento idêntico a antes deste campo existir); ADMIN nunca usa este campo (sempre acesso total, ver RN-050) |
| createdAt | DateTime | sim | sim | gerado na criação |

> **Conta especial `devmaster`:** mesma entidade `User`, role ADMIN, sem coluna nem flag própria distinguindo-a — a exclusividade é aplicada em código (`guardDevmaster()`, `src/lib/api-guard.ts`, checa `email === "devmaster"`) e na query de listagem (`GET /api/users` filtra `email != "devmaster"`). Seedada em `prisma/seed.ts` para sobreviver a qualquer reseed.
>
> **Permissões granulares (`permissoesOverride`):** a árvore canônica de chaves (abas + subtópicos) vive em código (`src/lib/permissions.ts`, `PERMISSION_TREE`), não no banco — o campo só guarda o mapa resolvido para aquele usuário. `resolvePermissoes()` calcula o efetivo: `role=ADMIN` → tudo `true` sempre; senão `permissoesOverride ?? defaultPermissoes(role)`. É uma camada **adicional** ao RBAC por role no middleware, nunca uma ampliação (ver RN-049).

### Table (Mesa)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| numero | Int | sim | não | número da mesa (1–12) — UNIQUE |
| status | TableStatus | sim | não | LIVRE / OCUPADA / CONTA — default LIVRE |

### Order (Comanda)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| tipo | OrderTipo | sim | não | MESA / BALCAO — default MESA |
| numero | Int? | não | não | sequencial diário — só preenchido em comandas BALCAO |
| mesaId | String? | não | não | FK → Table — null em comandas BALCAO |
| paymentStatus | PaymentStatus | sim | não | PENDENTE / FECHADO / CANCELADO — default PENDENTE |
| total | Decimal(10,2) | sim | sim | soma dos subtotais dos itens |
| desconto | Decimal(10,2) | sim | não | desconto aplicado no fechamento — default 0 |
| formaPagamento | FormaPagamento? | não | sim | forma de maior valor entre os pagamentos informados |
| pagamentosSplit | Json? | não | não | array de `{forma, valor, bandeira?}` — só preenchido quando há mais de uma forma |
| taxaTotal | Decimal(10,2) | sim | sim | soma da taxa aplicada por forma/bandeira no fechamento — snapshot, não recalculado depois |
| caixaId | String? | não | não | FK → User — quem abriu/operou a comanda |
| caixaNome | String? | não | não | snapshot do nome do operador |
| createdAt | DateTime | sim | sim | gerado na criação |
| closedAt | DateTime? | não | não | preenchido no fechamento |

### ContadorComanda

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| data | String | sim | não | chave primária — `YYYY-MM-DD` (fuso America/Sao_Paulo) |
| ultimoNumero | Int | sim | não | último número de comanda de balcão emitido naquele dia — default 0 |

### OrderItem

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| orderId | String | sim | não | FK → Order (CASCADE DELETE) |
| productId | String | sim | não | FK → Product |
| quantidade | Decimal(10,3) | sim | não | quantidade pedida |
| precoUnit | Decimal(10,2) | sim | não | preço no momento da adição (snapshot) |
| custoUnit | Decimal(10,2) | sim | não | custo no momento da adição (snapshot do `Product.costPrice`) |
| subtotal | Decimal(10,2) | sim | sim | quantidade × precoUnit |
| observacoes | String? | não | não | texto livre |
| opcionaisSel | Json? | não | não | opcionais escolhidos no pedido |
| status | String | sim | não | KDS — PENDENTE / PRONTO — default PENDENTE |
| createdAt | DateTime | sim | sim | gerado na criação |
| prontoEm | DateTime? | não | não | preenchido quando a cozinha marca como pronto |

### Product (Produto)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome no cardápio |
| categoria | String | sim | não | agrupamento — categorias canônicas desde 2026-08-07 (`CATEGORIAS_CARDAPIO`, `src/lib/constants.ts`): "Espetinhos Assados", "Espetinhos Crus", "Burgers na Brasa", "Jantinhas e Porções", "Bebidas", "Insumos", "Outros". Renomeadas de "Espetos"/"Lanches"/"Porções" (nomes antigos, inconsistentes com o cardápio real do cliente) — seed migra produtos já existentes das categorias antigas via `updateMany`, não só cadastra as novas |
| preco | Decimal(10,2) | sim | não | preço de venda |
| costPrice | Decimal(10,2) | sim | sim* | CMV — calculado a partir da ficha técnica, exceto quando `costPriceManual=true` |
| costPriceManual | Boolean | sim | não | true = custo fixado manualmente (ex.: bebida revendida sem ficha técnica) — default false |
| ativo | Boolean | sim | não | default true |
| trackInventory | Boolean | sim | não | se true, deduz o próprio `estoque` no fechamento (produto sem ficha técnica) |
| enviaParaCozinha | Boolean | sim | não | default true — quando false, o item nunca aparece na fila do KDS (Módulo 7, RF-090). Adicionado em 2026-08-04 para produtos sem preparo (ex.: bebida revendida pronta) |
| estoque | Decimal(10,3) | sim | não | usado só quando `trackInventory=true` e não há ficha técnica |
| opcionais | Json? | não | não | grupos de opcionais do produto |
| createdAt / updatedAt | DateTime | sim | sim | timestamps padrão |

### Ingredient (Insumo)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do insumo |
| unidade | IngredientUnit | sim | não | KG / UN / L |
| quantidadeAtual | Decimal(10,3) | sim | não | saldo atual — decrementado no fechamento da comanda |
| nivelMinimoAlerta | Decimal(10,3) | sim | não | abaixo deste valor, alerta visual é exibido |
| custoUnitario | Decimal(10,2) | sim | não | custo por unidade "bruta", antes da perda de limpeza — default 0 |
| rendimentoPercentual | Decimal(5,2) | sim | não | % do insumo bruto que sobra utilizável após aparas/limpeza — default 100 (sem perda). Adicionado em 2026-08-07. Usado por `custoEfetivoUnitario()` (`src/lib/cmv-calc.ts`) para corrigir o custo real por unidade líquida no cálculo de CMV (ver Regra de cálculo — CMV, abaixo) |
| ativo | Boolean | sim | não | default true |

> **Entrada rápida de estoque (desde 2026-08-07):** `POST /api/ingredients/[id]/entrada` — incrementa `quantidadeAtual` atomicamente (`$transaction`), atualiza `custoUnitario` opcionalmente e cria o `MovimentacaoEstoque` (tipo ENTRADA) correspondente, sem exigir passar pelo formulário completo de edição do insumo. Disparado pelo botão dedicado (`PackagePlus`) na tabela de Estoque (`ModalEntrada`, `src/components/estoque/modal-entrada.tsx`).

### RecipeItem (Ficha Técnica)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| productId | String | sim | não | FK → Product (CASCADE DELETE) |
| ingredientId | String | sim | não | FK → Ingredient |
| quantidade | Decimal(10,3) | sim | não | quanto do insumo é consumido por unidade do produto |

### MovimentacaoEstoque

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| ingredientId | String | sim | não | FK → Ingredient |
| tipo | TipoMovimentacaoEstoque | sim | não | VENDA / CONSUMO_INTERNO / ENTRADA / AJUSTE / PERDA |
| quantidade | Decimal(10,3) | sim | não | positiva = entrada, negativa = saída |
| motivo | String? | não | não | contexto livre |
| orderItemId | String? | não | não | rastreabilidade quando originado de venda (sem FK formal) |
| registradoPor | String? | não | não | nome de quem registrou |
| createdAt | DateTime | sim | sim | gerado na criação |

### Despesa

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| descricao | String | sim | não | descrição da despesa |
| valor | Decimal(10,2) | sim | não | valor pago |
| valorPrevisto | Decimal(10,2)? | não | não | valor orçado, se diferente do pago |
| categoria | String | sim | não | Mercadoria, Funcionários, Aluguel, Utilidades, Manutenção, Marketing, Impostos, Outros |
| data | DateTime | sim | não | data da despesa |
| registradoPor | String? | não | não | nome de quem registrou |
| recorrente | Boolean | sim | não | default false |
| frequenciaRecorrencia | String? | não | não | semanal / mensal / anual |
| despesaOrigemId | String? | não | não | auto-referência — aponta para a 1ª ocorrência da série (`onDelete: SetNull`) |
| createdAt | DateTime | sim | sim | gerado na criação |

### Funcionario

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do funcionário |
| ativo | Boolean | sim | não | default true |
| email / telefone | String? | não | não | contato |
| cargo | String? | não | não | função na equipe |
| percentualComissao | Decimal(5,2) | sim | não | comissão sobre serviço — default 0 |
| percentualComissaoProduto | Decimal(5,2) | sim | não | comissão sobre produto — default 0 |
| userId | String? | não | não | FK → User, vínculo opcional com login do sistema — UNIQUE |
| createdAt | DateTime | sim | sim | gerado na criação |

### Feedback

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| funcionarioId | String | sim | não | FK → Funcionario (CASCADE DELETE) |
| tipo | TipoFeedback | sim | não | ELOGIO / MELHORIA |
| categoria | String | sim | não | agrupamento livre |
| titulo / descricao | String | sim | não | conteúdo do feedback |
| data | DateTime | sim | não | data do evento — default now() |
| createdAt | DateTime | sim | sim | gerado na criação |

### PlanoAcao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| funcionarioId | String | sim | não | FK → Funcionario (CASCADE DELETE) |
| titulo | String | sim | não | título do plano |
| planejar | String | sim | não | etapa P do PDCA |
| executar / checar / agir | String? | não | não | etapas D-C-A do PDCA |
| status | StatusPlanoAcao | sim | não | PENDENTE / EM_ANDAMENTO / CONCLUIDO / CANCELADO |
| dataInicio / dataMeta / dataConclusao | DateTime? | não | não | datas de controle |
| createdAt | DateTime | sim | sim | gerado na criação |

### Sugestao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| categoria | String | sim | não | agrupamento livre |
| titulo / descricao | String | sim | não | conteúdo da sugestão |
| prioridade | PrioridadeSugestao | sim | não | BAIXA / MEDIA / ALTA — default MEDIA |
| status | StatusSugestao | sim | não | ABERTA / EM_ANALISE / APROVADA / IMPLEMENTADA / REJEITADA |
| autor | String? | não | não | nome de quem sugeriu |
| createdAt / updatedAt | DateTime | sim | sim | timestamps padrão |

### TaxaPagamento

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| formaPagamento | FormaPagamento | sim | não | forma associada |
| bandeira | String? | não | não | null = taxa padrão da forma; preenchido = taxa específica de bandeira (opcional) |
| percentual | Decimal(5,4) | sim | não | percentual da taxa |
| updatedAt | DateTime | sim | sim | timestamp de última alteração |

`@@unique([formaPagamento, bandeira])`

### TaxaDelivery

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| canal | CanalDelivery | sim | não | IFOOD / NOVENTA_E_NOVE / MOTOBOY / OUTROS_DELIVERY — UNIQUE (um registro por canal, sem conceito de bandeira) |
| percentual | Decimal(5,4) | sim | não | percentual de comissão do canal |
| updatedAt | DateTime | sim | sim | timestamp de última alteração |

### ConfiguracaoNotificacao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| tipo | TipoNotificacao | sim | não | FATURAMENTO / PRODUTOS_MAIS_VENDIDOS / ESTOQUE_PARADO / ESTOQUE_BAIXO — UNIQUE |
| ativo | Boolean | sim | não | default false |
| periodicidade | Periodicidade | sim | não | DIARIO / SEMANAL / QUINZENAL / PERSONALIZADO — default DIARIO |
| periodicidadeDias | Int? | não | não | usado quando PERSONALIZADO |
| horaDisparo | String | sim | não | formato HH:MM — default "08:00" |
| parametros | Json? | não | não | configuração adicional livre |
| ultimoDisparoEm | DateTime? | não | não | preenchido pelo agendador (`src/lib/notificacoes-dispatcher.ts`) a cada disparo real bem-sucedido — usado para não disparar de novo antes do intervalo da periodicidade configurada |

### ConfiguracaoGeral

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| chave | String | sim | não | chave primária — hoje só `whatsapp_telefone_notificacao` é usada |
| valor | String | sim | não | valor associado |

### ErrorLog

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| rota | String | sim | não | ex.: `"PATCH /api/ingredients/[id]"` — identifica onde a exceção ocorreu |
| status | Int | sim | sim | status HTTP retornado ao cliente (mapeado a partir do tipo de erro) |
| mensagem | String | sim | sim | mensagem técnica (`error.message` ou código Prisma), truncada em 2000 caracteres |
| stack | String? | não | sim | stack trace, truncado em 4000 caracteres |
| usuario | String? | não | sim | email/login de quem estava logado no momento do erro |
| createdAt | DateTime | sim | sim | gerado na criação |

Nunca criado manualmente — só `handleApiError` (`src/lib/api-error.ts`) grava, dentro de um `try/catch` próprio (falha ao logar nunca derruba a resposta ao cliente).

---

## Relacionamentos

| De | Para | Tipo | Regra |
|---|---|---|---|
| Order | Table | N:1 (opcional) | Mesa pode ter múltiplas comandas ao longo do tempo; apenas uma PENDENTE por vez. Comandas BALCAO não têm Table |
| Order | User | N:1 (opcional) | `caixaId` — quem operou |
| Order | OrderItem | 1:N | CASCADE DELETE |
| OrderItem | Product | N:1 | produto preservado mesmo se item for removido |
| RecipeItem | Product | N:1 | CASCADE DELETE — ficha técnica excluída com o produto |
| RecipeItem | Ingredient | N:1 | insumo preservado |
| MovimentacaoEstoque | Ingredient | N:1 | — |
| Despesa | Despesa | N:1 (auto, opcional) | série de recorrência — `onDelete: SetNull` |
| Funcionario | User | 1:0..1 | vínculo opcional com login |
| Feedback | Funcionario | N:1 | CASCADE DELETE |
| PlanoAcao | Funcionario | N:1 | CASCADE DELETE |

---

## Estados e ciclo de vida

### Mesa (TableStatus)
```
LIVRE → OCUPADA → CONTA → LIVRE
```
| Estado | Significado | O que dispara |
|---|---|---|
| LIVRE | disponível para abertura | fechamento/cancelamento de comanda anterior |
| OCUPADA | comanda aberta, itens sendo lançados | abertura de nova comanda |
| CONTA | (reservado — hoje o fluxo real vai direto de OCUPADA para LIVRE no fechamento) | — |

### Comanda (PaymentStatus)
```
PENDENTE → FECHADO
PENDENTE → CANCELADO
```
| Estado | Significado | O que dispara |
|---|---|---|
| PENDENTE | comanda aberta, itens sendo lançados | criação (abertura de mesa ou balcão) |
| FECHADO | pagamento confirmado, cupom emitido, estoque deduzido | fechamento com split payment |
| CANCELADO | comanda encerrada sem venda | cancelamento |

### Item da comanda (status — KDS)
```
PENDENTE → PRONTO
```

---

## Propriedade e acesso

| Entidade | Quem cria | Quem edita | Quem exclui |
|---|---|---|---|
| Product / Ingredient / RecipeItem | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR (reforçado via `guardGestor()`) | ADMIN, SUPERVISOR (bloqueado se em uso) |
| Order / OrderItem | qualquer role com acesso a `/mesas` ou `/balcao` (CAIXA, ATENDENTE, SUPERVISOR, ADMIN) | mesmo grupo, enquanto PENDENTE | nunca (soft via cancelamento) |
| Despesa | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR |
| Funcionario / Feedback / PlanoAcao / Sugestao | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR | — |
| TaxaPagamento / TaxaDelivery / ConfiguracaoNotificacao | ADMIN | ADMIN | ADMIN (taxa por bandeira) |
| User | ADMIN (qualquer papel), SUPERVISOR (CAIXA/ATENDENTE/COZINHA) | mesma regra; `permissoesOverride` segue a mesma restrição de papel gerenciável (ADMIN edita qualquer não-ADMIN, SUPERVISOR só CAIXA/ATENDENTE/COZINHA) e nunca é editável numa conta ADMIN | apenas desativação (`ativo=false`); conta `devmaster` nunca editável, nem por ADMIN |
| ErrorLog | sistema (via `handleApiError`, nunca por ação humana direta) | nunca editado | sem rota de exclusão implementada — cresce indefinidamente até este documento |

---

## Ciclo de retenção

| Entidade | Retenção | Nunca excluir |
|---|---|---|
| Order / OrderItem | permanente | histórico financeiro e de vendas |
| MovimentacaoEstoque | permanente | auditoria de estoque |
| Despesa | permanente | histórico financeiro |
| Feedback / PlanoAcao / Sugestao | permanente | histórico de gestão de pessoas |
| ErrorLog | permanente (por enquanto — sem rotina de expurgo) | não crítico se perdido, mas nenhuma exclusão foi implementada ainda |

---

## ENUMs

| ENUM | Valores |
|---|---|
| UserRole | ADMIN, SUPERVISOR, CAIXA, ATENDENTE, COZINHA |
| TableStatus | LIVRE, OCUPADA, CONTA |
| OrderTipo | MESA, BALCAO |
| PaymentStatus | PENDENTE, FECHADO, CANCELADO |
| FormaPagamento | DINHEIRO, CREDITO, DEBITO, PIX, VOUCHER, NOTA |
| IngredientUnit | KG, UN, L |
| TipoMovimentacaoEstoque | VENDA, CONSUMO_INTERNO, ENTRADA, AJUSTE, PERDA |
| TipoFeedback | ELOGIO, MELHORIA |
| StatusPlanoAcao | PENDENTE, EM_ANDAMENTO, CONCLUIDO, CANCELADO |
| PrioridadeSugestao | BAIXA, MEDIA, ALTA |
| StatusSugestao | ABERTA, EM_ANALISE, APROVADA, IMPLEMENTADA, REJEITADA |
| TipoNotificacao | FATURAMENTO, PRODUTOS_MAIS_VENDIDOS, ESTOQUE_PARADO, ESTOQUE_BAIXO |
| Periodicidade | DIARIO, SEMANAL, QUINZENAL, PERSONALIZADO |
| CanalDelivery | IFOOD, NOVENTA_E_NOVE, MOTOBOY, OUTROS_DELIVERY |

---

## Padrão de IDs

Todas as entidades usam `cuid()`, exceto `Table.numero` (Int único, visível ao operador) e `ContadorComanda.data` (String `YYYY-MM-DD` como chave primária).

---

## Regra de cálculo — CMV

```
custoEfetivoUnitario(Ingredient) =
    SE rendimentoPercentual <= 0 OU >= 100 → custoUnitario  // sem perda, ou não configurado
    SENÃO → custoUnitario / (rendimentoPercentual / 100)     // corrige pela perda de limpeza/aparas

Product.costPrice =
    SE costPriceManual = true → valor mantido como está (não recalculado)
    SENÃO → Σ (RecipeItem.quantidade × custoEfetivoUnitario(RecipeItem.ingredient)) para todos os insumos da ficha técnica do produto
```

Recalculado em `lib/cmv.ts` sempre que: (1) um `RecipeItem` do produto é criado/editado/removido, ou (2) o `custoUnitario` **ou** o `rendimentoPercentual` de um `Ingredient` muda (recalcula em lote todos os produtos que usam aquele insumo, desde 2026-08-07). `custoEfetivoUnitario()` vive em `src/lib/cmv-calc.ts`, reexportado por `lib/cmv.ts`.

## Regra de cálculo — Taxa de pagamento no fechamento

```
Para cada entrada de pagamentosSplit {forma, valor, bandeira?}:
    percentual = TaxaPagamento(forma, bandeira) SE existir
                 SENÃO TaxaPagamento(forma, bandeira=null)  // taxa padrão da forma
    taxa += valor × percentual

Order.taxaTotal = Σ taxa de todas as entradas — snapshot, não recalculado retroativamente
```

## Regra de cálculo — Calculadora de Metas (Inteligência Financeira)

```
totalHistorico = Σ quantidade vendida de cada produto no período selecionado (ranking-pratos)

Para cada produto ativo:
    share = quantidadeHistorica / totalHistorico  SE totalHistorico > 0
            SENÃO 1 / número de produtos ativos   // fallback: distribuição igualitária
    quantidadeProjetada = round(quantidadeDesejada × share)
    receitaBrutaProduto = quantidadeProjetada × preco
    custoProduto = quantidadeProjetada × costPrice

receitaBrutaTotal = Σ receitaBrutaProduto
taxaValor = receitaBrutaTotal × TaxaDelivery(canal).percentual   // 0 se canal = Presencial
receitaLiquida = receitaBrutaTotal − taxaValor
lucroBruto = receitaLiquida − Σ custoProduto
```

Todo o cálculo roda no cliente (não há rota de API dedicada) — combina três fontes já existentes via SWR: `/api/products?ativo=true`, `/api/inteligencia/ranking-pratos` (com `limite` alto o bastante para cobrir todo o cardápio) e `/api/configuracoes/taxas-delivery`.
