---
status: draft
domain: kernel-foodservice
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Modelo de Dados — Kernel Foodservice

> Referência: [[arquitetura-kernel-foodservice]] | [[prd-kernel-foodservice]]

Fonte: `kernel-foodservice/prisma/schema.prisma` (PostgreSQL 16, Prisma 6.4.1). **21 models, 13 enums.** Migration única: `20260809144326_init_multitenant` (510 linhas) — o banco nasceu já multi-tenant, não houve migração de um estado single-tenant.

Frente ao `lanchonete-sistema` de origem (19 models): **+2 models** (`Tenant`, `SuperAdmin`) e `tenantId` propagado por todas as tabelas de negócio.

---

## 1. Camada whitelabel (o que só existe aqui)

### Tenant

Um restaurante contratante. Raiz de todo o isolamento.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `slug` | `String @unique` | Comentário do schema: "usado só no painel super-admin e em URLs futuras — **nunca aparece na tela de login do tenant**". Validado por regex `^[a-z0-9]+(-[a-z0-9]+)*$` na criação |
| `nome` | `String` | |
| `ativo` | `Boolean @default(true)` | `false` bloqueia o login de **toda** a equipe do tenant (inadimplência, teste vencido) — verificado em `authorize()` |
| `features` | `Json @default("{}")` | `{chave: boolean}` — só módulos **opcionais**; os core vêm de `src/lib/features.ts` e sempre vencem |
| `branding` | `Json?` | `{ nome?, logoUrl?, corPrimaria?, slogan? }` — substitui a constante `NOME_LANCHONETE` do sistema de origem |
| `createdAt` | `DateTime @default(now())` | |

Relaciona-se com **17 coleções** filhas — todas as tabelas de negócio exceto `OrderItem`.

### SuperAdmin

Conta de quem faz onboarding. **Nunca pertence a um tenant** — não tem `tenantId`.

| Campo | Tipo |
|---|---|
| `id`, `nome`, `email @unique`, `senhaHash`, `createdAt` | |

Decisão registrada em `src/lib/admin-auth.ts`: manter fora do NextAuth preserva a invariante "sessão de tenant sempre tem `tenantId`". É identidade, não papel — mesmo espírito da conta `devmaster` do sistema original.

---

## 2. Auth / RBAC

### User

| Campo | Tipo | Nota |
|---|---|---|
| `tenantId` | `String` + relação | `@@index([tenantId])` |
| `email` | `String @unique` | **Único globalmente, não por tenant.** O schema documenta a consequência: dois tenants não podem ambos ter um usuário "admin" — usar `admin@nome-do-cliente`. Causa raiz: sem slug na URL, o tenant é resolvido a partir do usuário |
| `senhaHash` | `String` | bcrypt, 10 rounds |
| `role` | `UserRole @default(CAIXA)` | `ADMIN \| SUPERVISOR \| CAIXA \| ATENDENTE \| COZINHA` |
| `ativo` | `Boolean @default(true)` | |
| `permissoesOverride` | `Json?` | `null` = usa os padrões do role (`src/lib/permissions.ts`); senão mapa completo `{chave: boolean}` |

`permissoesOverride` é lido do **banco** a cada carregamento de página protegida (`require-permissao.ts`), não do JWT — mudança de permissão vale imediatamente, sem re-login. Já `features` vem do JWT (snapshot do login) — mudar o plano de um tenant **exige novo login** pra ter efeito.

---

## 3. Domínio de foodservice (herdado do Jocley Grill)

Estas 17 entidades vêm de [[modelo-de-dados-jocley-lanchonete]] sem mudança de semântica. A única alteração estrutural é a adição de `tenantId` + índices compostos.

### PDV

| Model | Papel | O que mudou na multi-tenancy |
|---|---|---|
| `Table` | Mesa (`LIVRE \| OCUPADA \| CONTA`) | `@@unique([tenantId, numero])` — numeração de mesa reinicia por tenant |
| `Order` | Comanda (`MESA \| BALCAO`), `paymentStatus` `PENDENTE \| FECHADO \| CANCELADO`, `total`/`desconto`/`taxaTotal` `Decimal(10,2)`, `pagamentosSplit` Json `[{forma, valor, bandeira?}]` | `@@index([tenantId, tipo, paymentStatus])` e `@@index([tenantId, createdAt])` |
| `ContadorComanda` | Contador atômico **diário** do número de comanda de balcão | `@@id([tenantId, data])` — chave composta, "já que a numeração diária reseta por cliente, não globalmente" |
| `OrderItem` | Item da comanda; `precoUnit`/`custoUnit` são **snapshot** no momento da venda | **Única tabela sem `tenantId`**, por decisão documentada: "nunca é consultado fora do contexto de uma `Order` já filtrada por tenant — adicionar a coluna aqui seria redundância sem ganho de isolamento real". Ver risco R7 em [[arquitetura-kernel-foodservice]] |

`OrderItem.status` (`PENDENTE \| PRONTO`) é o estado do KDS, com `prontoEm` marcando a saída da fila da cozinha.

### Cardápio, CMV e estoque

| Model | Campos de regra |
|---|---|
| `Product` | `costPrice` **calculado** a partir da ficha técnica; `costPriceManual` fixa o valor manualmente na aba CMV; `enviaParaCozinha=false` para itens sem preparo (bebida) que não devem aparecer no KDS; `trackInventory`, `estoque Decimal(10,3)`, `opcionais Json?` |
| `Ingredient` | `unidade` (`KG \| UN \| L`), `custoUnitario` = custo **bruto** (antes da perda), `rendimentoPercentual Decimal(5,2)` = % aproveitável após limpeza, `nivelMinimoAlerta` |
| `RecipeItem` | Ficha técnica: `@@unique([productId, ingredientId])` |
| `MovimentacaoEstoque` | `tipo` (`VENDA \| CONSUMO_INTERNO \| ENTRADA \| AJUSTE \| PERDA`), quantidade positiva=entrada / negativa=saída, `orderItemId` pra rastrear a venda de origem |

**Regra de custo efetivo** (`src/lib/cmv-calc.ts`, funções puras): `custoEfetivo = custoUnitario / (rendimentoPercentual / 100)`. Exemplo do próprio código: carne a R$30/kg com 74% de rendimento custa R$40,54 por kg efetivamente usado. Complementares: `calcularMargem`, `calcularMarkup`, `precoSugerido(custo, margemAlvo) = custo / (1 - margemAlvo)`.

**Dedução de estoque** (`POST /api/orders/[id]/close`): dentro de `$transaction`, para cada `OrderItem` com ficha técnica, decrementa `Ingredient.quantidadeAtual` em `recipeItem.quantidade × item.quantidade` e grava uma `MovimentacaoEstoque` tipo `VENDA` com quantidade negativa e `orderItemId`. Mesa volta a `LIVRE` na mesma transação.

### Financeiro e configuração

| Model | Nota |
|---|---|
| `Despesa` | Recorrência por auto-relação `SerieRecorrencia` (`despesaOrigemId` → `ocorrencias[]`, `onDelete: SetNull`); `valorPrevisto` opcional |
| `TaxaPagamento` | `@@unique([tenantId, formaPagamento, bandeira])`; `bandeira = null` é a taxa padrão da forma. `percentual Decimal(5,4)`. Defaults semeados: DINHEIRO/PIX/NOTA 0%, DÉBITO 1,19%, CRÉDITO 3,49%, VOUCHER 2,5% |
| `TaxaDelivery` | `@@unique([tenantId, canal])`, canais `IFOOD \| NOVENTA_E_NOVE \| MOTOBOY \| OUTROS_DELIVERY` |
| `ConfiguracaoNotificacao` | `@@unique([tenantId, tipo])`; tipos `FATURAMENTO \| PRODUTOS_MAIS_VENDIDOS \| ESTOQUE_PARADO \| ESTOQUE_BAIXO`; periodicidade `DIARIO \| SEMANAL \| QUINZENAL \| PERSONALIZADO` + `periodicidadeDias`, `horaDisparo` (default "08:00"), `ultimoDisparoEm` |
| `ConfiguracaoGeral` | `@@id([tenantId, chave])` — chave/valor. Uso conhecido: `whatsapp_telefone_notificacao` |

### Gestão de time

`Funcionario` (com `percentualComissao` e `percentualComissaoProduto`, `userId @unique` opcional ligando ao login), `Feedback` (`ELOGIO \| MELHORIA`), `PlanoAcao` (campos PDCA: `planejar`/`executar`/`checar`/`agir`; status `PENDENTE \| EM_ANDAMENTO \| CONCLUIDO \| CANCELADO`), `Sugestao` (prioridade `BAIXA \| MEDIA \| ALTA`; status `ABERTA \| EM_ANALISE \| APROVADA \| IMPLEMENTADA \| REJEITADA`).

**Timeline não é tabela** — comentário explícito no schema: é uma API route que agrega `Feedback + PlanoAcao + Sugestao` por funcionário/período, ordenado por data.

### Observabilidade

`ErrorLog` — `rota`, `status`, `mensagem`, `stack?`, `usuario?`, `createdAt`. **`tenantId` é opcional** aqui, com justificativa no schema: "um erro pode acontecer antes da sessão/tenant serem resolvidos". Índices em `createdAt` e `rota` (não em `tenantId`) — a leitura é global, pela conta `devmaster` / painel super-admin.

---

## 4. Semeadura de um tenant novo

`seedTenantBase(tenantId, numeroDeMesas = 12)` — idempotente, chamado tanto pelo seed CLI quanto por `POST /api/admin/tenants`:

```
12 Table (upsert por [tenantId, numero])
 6 TaxaPagamento (bandeira: null)
 4 ConfiguracaoNotificacao (ativo: false)
```

Cardápio, insumos e ficha técnica **não** são semeados — cada tenant cadastra o próprio.

---

## 5. Observações de dado para o próximo trabalho

- **Nenhum dado real existe.** O único tenant é `demo` / "Restaurante Demo", com 10 produtos ilustrativos e 1 insumo de exemplo, marcados no seed como "motor vazio — não é o cardápio real de nenhum cliente"
- **Sem entidade de billing:** não há plano, assinatura, fatura ou data de vencimento. `Tenant.ativo` é o único controle comercial, e é manual
- **`Tenant.features` não tem schema validado no banco** — é `Json` livre. A validação vive só no TypeScript (`FeatureOpcional`); um valor escrito à mão no banco com chave errada é silenciosamente ignorado
- **Sem `updatedAt` em `Tenant`** — não dá pra saber quando um plano foi alterado

---

## Links relacionados

[[arquitetura-kernel-foodservice]] — camadas, isolamento e riscos
[[prd-kernel-foodservice]] — problema e escopo
[[indice-kernel-foodservice]] — mapa completo dos artefatos
[[modelo-de-dados-jocley-lanchonete]] — schema de origem (19 models, single-tenant)
