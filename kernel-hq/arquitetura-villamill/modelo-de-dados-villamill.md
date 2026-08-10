---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-12 (rev 10)
owner: willians
---

# Modelo de Dados — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]] | [[arquitetura-villamill]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| Table (Mesa) | Espaço físico do salão onde o cliente senta e consome | Unidade operacional central — tudo começa e termina na mesa |
| Product (Produto) | Item do cardápio que pode ser pedido | Define o que pode ser vendido, seu preço e custo |
| Ingredient (Insumo) | Matéria-prima consumida na produção dos pratos | Controle de estoque e alerta de reposição |
| RecipeItem (Ficha Técnica) | Relação entre produto e insumo com quantidade | Define quanto de cada insumo é consumido por unidade vendida |
| Order (Pedido) | Registro de um atendimento em uma mesa | Captura o que foi consumido, o valor e como foi pago |
| OrderItem (Item do Pedido) | Linha de um produto dentro de um pedido | Rastreia quantidade, preço e custo no momento da venda |
| User (Usuário) | Pessoa que opera o sistema | Autenticação e controle de acesso por perfil |
| Caixa | Operador de caixa disponível para abertura de mesa | Lista dinâmica de nomes gerenciada pelo admin — evita hardcode no frontend |
| CancelamentoLog | Registro de cancelamento de pedido | Auditoria permanente — motivo, responsável e data |
| Despesa | Saída financeira do restaurante | Necessária para calcular resultado real (faturamento - despesas) |
| FuncionarioExterno | Colaborador do Lava-Rápido parceiro | Vincula créditos de caixinha e consumos a uma pessoa identificada |
| CreditoFuncionario | Entrada de caixinha (individual ou coletiva) para um funcionário externo | Registra o saldo disponível antes que o funcionário consuma produtos do restaurante |
| ConsumoFuncionario | Produto retirado do restaurante por um funcionário externo | Rastreia dedução de estoque e débito sem criar um Order — isolado do faturamento real |
| SystemLog | Registro de log estruturado gerado pelo sistema (info/warn/error) | Infraestrutura de logging genérico, criada junto com a rotina de manutenção do banco — hoje nenhum código grava nela ainda (o `logger.ts` atual só escreve em console), existe para receber futuros produtores de log sem exigir migration nova |

---

## Atributos por entidade

### Table (Mesa)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único gerado automaticamente |
| numero | Int | sim | não | número da mesa (1–15) — UNIQUE |
| status | TableStatus | sim | não | LIVRE / OCUPADA / CONTA — default LIVRE |

### Product (Produto)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do item no cardápio |
| preco | Decimal(10,2) | sim | não | preço de venda ao cliente |
| costPrice | Decimal(10,2) | sim | não | custo de produção — default 0 |
| categoria | String | sim | não | agrupamento no cardápio (ex: Lanches, Bebidas) |
| track_inventory | Boolean | sim | não | se true, deduz insumos da ficha técnica no fechamento |
| estoque | Decimal(10,3) | sim | não | quantidade em estoque (usado quando produto não tem ficha técnica mas tem rastreio) |

### Ingredient (Insumo)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do insumo |
| unidade | IngredientUnit | sim | não | KG / UN / L |
| quantidadeAtual | Decimal(10,3) | sim | não | saldo atual — decrementado no fechamento |
| nivelMinimoAlerta | Decimal(10,3) | sim | não | abaixo deste valor, alerta visual é exibido |

### RecipeItem (Ficha Técnica)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| productId | String | sim | não | FK → Product |
| ingredientId | String | sim | não | FK → Ingredient |
| quantidade | Decimal(10,3) | sim | não | quanto do insumo é consumido por unidade do produto |

### Order (Pedido)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| mesaId | String | sim | não | FK → Table |
| paymentStatus | PaymentStatus | sim | não | PENDENTE / PAGO — default PENDENTE |
| total | Decimal(10,2) | sim | sim | soma dos subtotais dos itens |
| desconto | Decimal(10,2) | sim | não | desconto aplicado ao total — default 0 |
| closedAt | DateTime | não | não | preenchido no fechamento |
| createdAt | DateTime | sim | sim | gerado na criação |
| formaPagamento | FormaPagamento | não | não | forma principal (DINHEIRO/PIX/CREDITO/DEBITO/CARTAO/VOUCHER) |
| pagamentosSplit | JSON | não | não | array de {forma, valor} para split entre múltiplas formas |
| caixaNome | String | não | não | nome do operador de caixa que abriu a mesa — nullable (null em pedidos anteriores à feature) |

### OrderItem (Item do Pedido)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| orderId | String | sim | não | FK → Order (CASCADE DELETE) |
| productId | String | sim | não | FK → Product |
| quantidade | Decimal(10,3) | sim | não | quantidade pedida |
| precoUnit | Decimal(10,2) | sim | não | preço no momento da adição (snapshot) |
| custoUnit | Decimal(10,2) | sim | não | custo no momento da adição (snapshot) |
| subtotal | Decimal(10,2) | sim | sim | quantidade × precoUnit |
| observacoes | String? | não | não | opcionais selecionados no caixa (ex: "Ao Ponto, c/ Salada") — texto livre gerado pelo frontend |
| status | String | sim | não | estado no KDS — `PENDENTE` (aguardando preparo) / `PRONTO` (preparado) — default `PENDENTE` |
| createdAt | DateTime | sim | sim | gerado na criação do item |
| prontoEm | DateTime? | não | não | timestamp de quando o item foi marcado como PRONTO pela cozinha — null enquanto pendente; usado para filtro diário no KDS |

### User (Usuário)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome de exibição |
| email | String | sim | não | login — UNIQUE |
| senhaHash | String | sim | não | hash bcrypt — nunca exposto |
| role | UserRole | sim | não | ADMIN / CAIXA / COZINHA — default CAIXA |

### Caixa

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do operador — UNIQUE |
| ativo | Boolean | sim | não | se false, não aparece no dropdown de abertura de mesa — default true |
| createdAt | DateTime | sim | sim | gerado na criação |

### CancelamentoLog

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| mesaNumero | Int | sim | não | número da mesa onde ocorreu o cancelamento |
| motivoCancelamento | String | não | não | motivo informado pelo operador |
| canceladoPor | String | sim | não | email do usuário que cancelou |
| canceladoEm | DateTime | sim | sim | timestamp do cancelamento |

### Despesa

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| descricao | String | sim | não | descrição da despesa |
| valor | Decimal(10,2) | sim | não | valor pago |
| categoria | String | sim | não | agrupamento (ex: insumos, aluguel, manutenção) |
| data | DateTime | sim | não | data da despesa |
| registradoPor | String | sim | não | email do usuário que registrou |
| createdAt | DateTime | sim | sim | gerado na criação |

### FuncionarioExterno

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome do funcionário |
| empresa | String | sim | não | empresa parceira (ex: "Lava-Rápido") |
| ativo | Boolean | sim | não | se false, não aparece nas listas e não recebe caixinha coletiva — default true |
| createdAt | DateTime | sim | sim | gerado na criação |

### CreditoFuncionario

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| funcionarioId | String? | não | não | FK → FuncionarioExterno — **null** para créditos COLETIVO (pool da empresa) |
| empresa | String? | não | não | empresa do pool — preenchido em COLETIVO; null em INDIVIDUAL |
| valor | Decimal(10,2) | sim | não | valor do crédito — para COLETIVO representa o montante total do pool |
| descricao | String | não | não | rótulo livre (ex: "Caixinha 27/05") |
| tipo | TipoCreditoFuncionario | sim | não | INDIVIDUAL / COLETIVO — default INDIVIDUAL |
| loteId | String | não | não | referência de rastreio gerada na criação — identificador do lançamento |
| registradoPor | String | sim | não | email do operador que registrou (padrão Despesa) |
| registradoEm | DateTime | sim | sim | gerado na criação |
| liquidado | Boolean | sim | não | true após desconto no ciclo semanal/quinzenal — default false |
| liquidadoEm | DateTime | não | não | preenchido na liquidação |

### ConsumoFuncionario

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| funcionarioId | String | sim | não | FK → FuncionarioExterno |
| productId | String | sim | não | FK → Product |
| quantidade | Decimal(10,3) | sim | não | quantidade retirada |
| precoUnit | Decimal(10,2) | sim | não | preço no momento da baixa (snapshot — padrão OrderItem) |
| subtotal | Decimal(10,2) | sim | sim | por padrão `quantidade × precoUnit`; a partir de 2026-07-12, se `valorTotal` for informado no `POST /api/parceiros/consumo`, o cálculo se inverte — `subtotal = valorTotal` e `precoUnit = subtotal / quantidade` — permitindo editar o valor debitado (ex: dividir um item entre dois funcionários) |
| registradoPor | String | sim | não | email do operador que registrou a baixa |
| registradoEm | DateTime | sim | sim | gerado na criação |
| liquidado | Boolean | sim | não | true após desconto no ciclo — default false |
| liquidadoEm | DateTime | não | não | preenchido na liquidação |

### SystemLog

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| level | String | sim | não | "info" / "warn" / "error" — default "info" |
| message | String | sim | não | mensagem do log |
| meta | Json? | não | não | dados estruturados adicionais (livre) |
| createdAt | DateTime | sim | sim | gerado na criação — índice para o pruning de 30 dias |

---

## Relacionamentos

| De | Para | Tipo | Atributos do relacionamento | Regra |
|---|---|---|---|---|
| Order | Table | N:1 | — | Mesa pode ter múltiplos pedidos ao longo do tempo; apenas um PENDENTE de cada vez |
| Order | OrderItem | 1:N | — | CASCADE DELETE — itens excluídos com o pedido |
| OrderItem | Order | N:1 | — | — |
| OrderItem | Product | N:1 | — | produto preservado mesmo se item for removido |
| RecipeItem | Product | N:1 | — | CASCADE DELETE — receita excluída com o produto |
| RecipeItem | Ingredient | N:1 | — | insumo preservado |
| CreditoFuncionario | FuncionarioExterno | N:0..1 | — | relação opcional — INDIVIDUAL tem FK; COLETIVO tem funcionarioId=null e empresa preenchida |
| ConsumoFuncionario | FuncionarioExterno | N:1 | — | — |
| ConsumoFuncionario | Product | N:1 | — | produto preservado; rastreia qual item foi retirado do estoque |

---

## Estados e ciclo de vida

### Mesa (TableStatus)

```
LIVRE → OCUPADA → CONTA → LIVRE
              ↑ emergência admin
         LIVRE ←──────────────
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| LIVRE | disponível para abertura — cor verde | → OCUPADA | criação de pedido |
| OCUPADA | cliente presente, consumindo — cor vermelha | → CONTA | operador inicia fechamento |
| CONTA | em processo de fechamento — cor vermelho escuro | → LIVRE | fechamento + liberação confirmados |

### Item do Pedido (status — KDS)

```
PENDENTE → PRONTO
```

| Estado | Significado operacional | Quem transiciona | O que dispara |
|---|---|---|---|
| PENDENTE | item lançado, aguardando preparo na cozinha | — | criação do OrderItem |
| PRONTO | item preparado — desaparece da fila da cozinha, fica em "Concluídos" até meia-noite | COZINHA | clique em "PRONTO" no KDS (PATCH /api/cozinha/pedidos/[itemId]) |

Apenas itens de categorias que exigem preparo aparecem no KDS: **Pratos do Dia, Todos os Dias, Acompanhamentos, Lanches Tradicionais, Lanches na Baguete, Lanches Artesanais, Porções, Café da Manhã**. Bebidas, Lavagem e Sobremesas são excluídas.

---

### Pedido (PaymentStatus)

```
PENDENTE → PAGO
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| PENDENTE | mesa aberta, itens sendo adicionados | → PAGO | fechamento com pagamento |
| PAGO | pedido encerrado — não pode ser editado | — | — |

---

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem edita | Quem exclui |
|---|---|---|---|---|
| Table | seed inicial | todos autenticados | admin (emergência) | nunca |
| Product | admin | todos autenticados | admin | admin |
| Ingredient | admin | todos autenticados | admin | admin |
| RecipeItem | admin | admin | admin | admin |
| Order | caixa ou admin | admin (todos), caixa (própria mesa) | admin (todos os campos via /financeiro); caixa (itens, antes de fechar) | nunca (soft via cancelamento) |
| OrderItem | caixa ou admin | admin (todos), caixa (própria mesa) | admin (quantidade, inclusive em pedidos PAGO); caixa (antes de fechar) | admin (em pedidos PAGO); caixa (antes de fechar) |
| User | seed / admin | admin | admin | admin |
| Caixa | admin | todos autenticados (GET /api/caixas) | admin (reativação via upsert) | nunca (desativação via ativo=false) |
| CancelamentoLog | sistema (automático) | admin | nunca | nunca |
| Despesa | admin | admin | admin | admin |
| FuncionarioExterno | admin | todos autenticados | admin | nunca (desativação via ativo=false) |
| CreditoFuncionario | admin e caixa | admin (todos), caixa (leitura via saldo) | admin (valor, descrição — RF-057) | admin (RF-058) |
| ConsumoFuncionario | admin e caixa | admin (todos), caixa (leitura via saldo) | admin (quantidade — RF-059; liquidado — RF-092) | admin (RF-060) |
| SystemLog | sistema (automático, hoje sem produtor ativo) | ninguém via UI (sem tela própria) | nunca | rotina de manutenção (`POST /api/admin/manutencao`, `x-api-key`) |

---

## Ciclo de retenção

| Entidade | Retenção | Arquivado após | Excluído após | Nunca excluir |
|---|---|---|---|---|
| Order | permanente | — | nunca | histórico financeiro |
| OrderItem | permanente (CASCADE com Order) | — | só com o pedido | — |
| User | permanente | desativação futura (não implementada) | nunca | integridade do log |
| Caixa | permanente | desativação via ativo=false | nunca | integridade do nome em pedidos históricos |
| CancelamentoLog | permanente | — | nunca | auditoria obrigatória |
| Despesa | permanente | — | mediante solicitação do admin | — |
| Product | permanente | — | admin pode excluir (raro) | — |
| Ingredient | permanente | — | admin pode excluir | — |
| FuncionarioExterno | permanente | desativação via ativo=false | nunca | integridade do histórico de consumo |
| CreditoFuncionario | permanente | — | nunca | histórico financeiro de caixinha |
| ConsumoFuncionario | permanente | — | nunca | auditoria de estoque e débito |
| SystemLog | 30 dias | — | rotina semanal de manutenção deleta `createdAt` > 30 dias (`POST /api/admin/manutencao`) | — (única entidade do sistema com exclusão automática programada) |

---

## ENUMs

| ENUM | Valores |
|---|---|
| TableStatus | LIVRE, OCUPADA, CONTA |
| PaymentStatus | PENDENTE, PAGO |
| FormaPagamento | DINHEIRO, CARTAO, CREDITO, DEBITO, PIX, VOUCHER, NOTA |
| UserRole | ADMIN, CAIXA, COZINHA |
| IngredientUnit | KG, UN, L |
| TipoCreditoFuncionario | INDIVIDUAL, COLETIVO |

---

## Padrão de IDs

Todas as entidades usam `cuid()` como estratégia de ID (string) — gerado pelo Prisma no momento da criação. Não há auto-increment numérico exceto em Table.numero (Int UNIQUE — número visível da mesa para o operador).

---

## Regras de cálculo — Parceria Lava-Rápido

### Saldo do pool coletivo (por empresa)

```
poolSaldo(empresa) =
    SUM(CreditoFuncionario.valor WHERE empresa = X AND tipo = COLETIVO AND liquidado = false)
  - SUM(ConsumoFuncionario.subtotal WHERE funcionario.empresa = X AND liquidado = false)
```

O saldo é **compartilhado** entre todos os funcionários da empresa. R$10 depositado = R$10 disponível para o grupo inteiro, independente do número de membros.

Calculado na API — sem campo desnormalizado no banco.

### Lançamento coletivo (pool único)

```
1. Gerar loteId = cuid()
2. INSERT CreditoFuncionario {
     funcionarioId: null,
     empresa: "Lava-Rápido",
     valor: <valor informado pelo operador>,
     tipo: COLETIVO,
     loteId,
     ...
   }
```

Um único registro representa o crédito do grupo. O valor **não se multiplica** pelo número de funcionários.

### Lançamento individual

```
INSERT CreditoFuncionario {
  funcionarioId: <id do funcionário>,
  empresa: null,
  valor: <valor informado>,
  tipo: INDIVIDUAL,
  ...
}
```

Crédito nominativo — pertence exclusivamente à pessoa indicada. Não entra no pool coletivo.

### Bloqueio de consumo — **revogado em 2026-07-03**

```
~~SE ConsumoFuncionario.subtotal > poolSaldo(funcionario.empresa) → rejeitar (HTTP 422)~~
```

Esta trava não existe mais para nenhum grupo. Histórico: primeiro havia uma exceção (2026-07-01) apenas para `empresa = "Equipe Villa Mill"`; em 2026-07-03 o usuário decidiu abandonar por completo o conceito de saldo prévio como pré-condição de lançamento — ConsumoFuncionario agora é **sempre** persistido e o estoque **sempre** deduzido, independente do `poolSaldo` da empresa. Ver decisão "Remoção universal da trava de saldo no consumo de funcionários" no registro-de-decisoes-villamill.

`poolSaldo(empresa)` (fórmula acima) continua calculado e **exibido** normalmente em `/parceiros` e no modal "Parceiro Lava-Rápido" (RF-041/049) — só deixou de ser usado como gate de escrita. A conciliação de quem consumiu além do combinado passa a ser feita manualmente depois, via seção "Consumo de Funcionários" no Financeiro (RF-107/108), usando os campos `liquidado`/`liquidadoEm` já existentes na entidade como marcador de "já foi conciliado", não como trava de entrada.

### Segmentação por empresa no modal

O modal Caixinha exibe um seletor de segmento (ex: 🚗 Lava-Rápido / 🍖 Villa Mill). Todas as operações — consumo, crédito COLETIVO e crédito INDIVIDUAL — são filtradas pelo segmento ativo. Os pools de cada empresa são completamente independentes.
