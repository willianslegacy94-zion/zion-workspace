---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-10-02
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
| ConfiguracaoGeral | Par chave-valor genérico | Configurações soltas — `whatsapp_telefone_notificacao` (telefone que recebe as notificações, desde 2026-08-04) e `categorias_cardapio` (lista de categorias do cardápio em JSON `[{nome, vaiParaCozinha}]`, editável em Configurações → Categorias do Cardápio, desde 2026-09-06) |
| ErrorLog | Registro técnico de uma exceção capturada no servidor | Memória persistida do que quebrou — rota, mensagem técnica, stack, usuário e data, visível só à conta `devmaster` |
| Impressora | Endereço de uma impressora de rede (ESC/POS) do estabelecimento | Guarda IP/porta da impressora de rede da Cozinha + `agenteVistoEm` (heartbeat do Agente de Impressão). A impressora do Caixa **não** entra aqui — continua no `window.print()`. Adicionada em 2026-09-02 |
| FilaImpressao | Fila de trabalhos de impressão da Cozinha | Desde 2026-09-03 a VPS não fala direto com a impressora — grava aqui a ficha já renderizada em ESC/POS (base64) e o **Agente de Impressão** (PC do caixa) consome a fila, imprime na LAN e confirma. Ver Registro de Decisões 2026-09-03 |

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
> **Permissões granulares (`permissoesOverride`):** a árvore canônica de chaves (abas + subtópicos) vive em código (`src/lib/permissions.ts`, `PERMISSION_TREE`), não no banco — o campo só guarda o mapa resolvido para aquele usuário. `resolvePermissoes()` calcula o efetivo: `role=ADMIN` → tudo `true` sempre; senão `permissoesOverride ?? defaultPermissoes(role)`. É uma camada **adicional** ao RBAC por role no middleware, nunca uma ampliação (ver RN-049). Subtópicos de Configurações: `configuracoes.notificacoes`, `configuracoes.taxas`, `configuracoes.impressoras`, e (desde 2026-09-06) `configuracoes.mesas` e `configuracoes.categorias`. Desde 2026-09-06 essas chaves também governam a **autorização de API** das rotas de gestão (`guardPermissao()`/`guardPermissaoQualquer()` em `api-guard.ts`), não só a visibilidade da aba — ver RN-070.

### Table (Mesa)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| numero | Int | sim | não | número da mesa — UNIQUE. O seed cria 1–12; desde 2026-09-06 dá pra criar/remover mesas em Configurações → Mesas (`POST /api/tables` usa o próximo número livre) |
| status | TableStatus | sim | não | LIVRE / OCUPADA / CONTA — default LIVRE. Remoção da mesa (Configurações → Mesas) só é permitida quando `LIVRE` e sem comanda `PENDENTE` |

### Order (Comanda)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| tipo | OrderTipo | sim | não | MESA / BALCAO — default MESA |
| numero | Int? | não | não | sequencial diário — só preenchido em comandas BALCAO |
| clienteNome | String? | não | não | nome do cliente da comanda — informado na abertura (`abrir-comanda-dialog`) ou editável depois na tela da comanda e na aba Lançamentos. Coluna existe desde a migration `20260811151346_add_cliente_nome_e_contador_global`; passou a ser exibida na listagem de Lançamentos, impressa no cupom e editável na reimpressão em 2026-09-02 |
| mesaId | String? | não | não | FK → Table — null em comandas BALCAO |
| paymentStatus | PaymentStatus | sim | não | PENDENTE / FECHADO / CANCELADO — default PENDENTE |
| total | Decimal(10,2) | sim | sim | soma dos subtotais dos itens |
| desconto | Decimal(10,2) | sim | não | desconto aplicado no fechamento — default 0 |
| formaPagamento | FormaPagamento? | não | sim | forma de maior valor entre os pagamentos informados |
| pagamentosSplit | Json? | não | não | array de `{forma, valor, bandeira?}` — preenchido quando há mais de uma forma **ou** (desde a v1.44) quando a forma única tem bandeira (split de 1 elemento, pra conferência do cartão por bandeira no fechamento de caixa) |
| taxaTotal | Decimal(10,2) | sim | sim | soma da taxa aplicada por forma/bandeira no fechamento — snapshot, não recalculado depois |
| caixaId | String? | não | não | FK → User — quem abriu/operou a comanda |
| caixaNome | String? | não | não | snapshot do nome do operador |
| contaSolicitada | Boolean | sim | não | default `false` — vira `true` quando alguém (tipicamente ATENDENTE) aperta "Fechar Comanda" (RF-117): trava novos itens pra quem não é caixa e dispara a ficha de conta no Caixa. Não é o fechamento em si — `paymentStatus` continua `PENDENTE` até o Caixa finalizar (RF-017). Coluna nova desde a migration `20260905180000_add_caixa_printer_conta_solicitada` |
| contaSolicitadaEm | DateTime? | não | não | timestamp de quando `contaSolicitada` virou `true` |
| contaSolicitadaPor | String? | não | não | snapshot do nome de quem solicitou a conta (`session.user.name` no momento) |
| observacoes | String? | não | não | observação geral da comanda (ex.: "cliente com pressa") — até 500 caracteres, editável no painel da comanda enquanto ela pode ser editada; sai em bloco próprio em **toda** ficha (cada "Confirmar Pedido", conta, cupom) e no card do KDS. Coluna nova desde a migration `20260929120000_add_observacoes_componentes` |
| createdAt | DateTime | sim | sim | gerado na criação |
| closedAt | DateTime? | não | não | preenchido no fechamento |
| sessaoCaixaId | String? | não | não | FK → SessaoCaixa em que a comanda foi **finalizada** (v1.44) — gravado na transaction do `/close`; null nos pedidos anteriores ao controle de caixa |

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
| custoUnit | Decimal(10,2) | sim | não | custo no momento da adição — snapshot do `Product.costPrice`; quando há `componentes` (desde 2026-09-29), é a ficha técnica do produto + o custo real dos componentes escolhidos, no lugar da média da categoria |
| subtotal | Decimal(10,2) | sim | sim | quantidade × precoUnit |
| observacoes | String? | não | não | observação do item (ex.: "sem cebola"), até 300 caracteres — campo no modal do produto desde 2026-09-29 (a coluna existia, a tela não enviava) |
| opcionaisSel | Json? | não | não | opcionais escolhidos no pedido — `Record<nomeDoGrupo, string[]>`; nome repetido = quantidade (ex.: `{"Espetos": ["Espeto de Carne", "Espeto de Carne"]}`) |
| componentes | Json? | não | sim | desde 2026-09-29 — produtos escolhidos em grupos "por categoria" (ex.: espetos da Jantinha), **por unidade do item**: `[{productId, nome, quantidade}]`, resolvidos e validados no servidor a partir de `opcionaisSel`. Usado na baixa de estoque do fechamento (ficha técnica de cada componente × quantidade × `item.quantidade`) e no `custoUnit`. Coluna nova desde a migration `20260929120000_add_observacoes_componentes` |
| status | String | sim | não | KDS — PENDENTE / PRONTO — default PENDENTE |
| createdAt | DateTime | sim | sim | gerado na criação |
| prontoEm | DateTime? | não | não | preenchido quando a cozinha marca como pronto |
| enviadoImpressaoEm | DateTime? | não | não | `null` = ainda não entrou em nenhuma ficha de impressão. Preenchido assim que o item é incluído num job de `FilaImpressao` — pelo "Confirmar Pedido" (ação explícita, ficha consolidada por destino) ou por uma reimpressão manual do KDS — **não** espera a confirmação física do agente. Coluna nova desde a migration `20260905190000_add_enviado_impressao_em` |

### Product (Produto)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | nome no cardápio |
| categoria | String | sim | não | agrupamento — string livre, sem FK. Até 2026-09-05 as opções vinham de uma constante fixa (`CATEGORIAS_CARDAPIO`, `src/lib/constants.ts`: "Espetinhos Assados", "Espetinhos Crus", "Burgers na Brasa", "Jantinhas e Porções", "Bebidas", "Insumos", "Outros"). **Desde 2026-09-06 a lista é configurável** em Configurações → Categorias do Cardápio (`ConfiguracaoGeral["categorias_cardapio"]`, `src/lib/categorias.ts`); a constante virou só o padrão inicial/fallback. Cada categoria carrega `vaiParaCozinha` — ao cadastrar um produto numa categoria com `vaiParaCozinha=false` (ex.: Bebidas), o campo `enviaParaCozinha` já nasce `false` (ver RN-046). Remover uma categoria da lista **não** renomeia os produtos que a usavam — eles mantêm a string antiga e continuam aparecendo como opção "solta" no formulário |
| preco | Decimal(10,2) | sim | não | preço de venda |
| costPrice | Decimal(10,2) | sim | sim* | CMV — calculado a partir da ficha técnica, exceto quando `costPriceManual=true` |
| costPriceManual | Boolean | sim | não | true = custo fixado manualmente (ex.: bebida revendida sem ficha técnica) — default false |
| ativo | Boolean | sim | não | default true |
| trackInventory | Boolean | sim | não | se true, deduz o próprio `estoque` no fechamento (produto sem ficha técnica) |
| enviaParaCozinha | Boolean | sim | não | default true — quando false, o item nunca aparece na fila do KDS (Módulo 7, RF-090). Adicionado em 2026-08-04 para produtos sem preparo (ex.: bebida revendida pronta) |
| estoque | Decimal(10,3) | sim | não | usado só quando `trackInventory=true` e não há ficha técnica |
| opcionais | Json? | não | não | grupos de opcionais do produto — `GrupoOpcional[]` (`src/lib/opcionais.ts`): `{nome, obrigatorio, tipo: "radio"\|"checkbox", limite?, opcoes[]}` para lista fixa, ou, desde 2026-09-29, `{..., origem: "categoria", categoria, quantidade}` — as opções são os produtos ativos da categoria e o PDV exige exatamente `quantidade` escolhas (ex.: Jantinha c/ 2 Espetos Tradicionais → 2 de "Espetos Tradicionais") |
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
| clienteNome | String? | não | não | nome do cliente associado à despesa — opcional, sem validação. Adicionado em 2026-09-02 (migration `20260902120000_add_cliente_nome_despesa`); exibido como coluna na listagem de Lançamentos/Despesas e filtrável pela busca por cliente naquela tela |
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
| chave | String | sim | não | chave primária — `whatsapp_telefone_notificacao`, `categorias_cardapio` (desde 2026-09-06), `caixa_modo` (`DIARIO`/`TURNO`, default DIARIO) e `caixa_limite_quebra` (R$, default 5.00) — as duas últimas desde a v1.44, com default no código quando ausentes |
| valor | String | sim | não | valor associado — para `categorias_cardapio` é um JSON serializado `[{nome: string, vaiParaCozinha: boolean}]` (parse/serialize em `src/lib/categorias.ts`, com fallback para `CATEGORIAS_CARDAPIO_PADRAO` se a chave não existir ou estiver corrompida) |

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

> **Impressão de rede na cozinha (desde 2026-09-02):** a falha de uma tentativa de impressão automática da ficha de produção (`imprimirFichaComLog`, `src/lib/impressao.ts`) grava um `ErrorLog` com `status=502` e `mensagem` contendo identificação da comanda + item + detalhe técnico (`IP:porta (CÓDIGO_DO_SOCKET) — mensagem`), sem derrubar o lançamento do pedido. É a única origem de `ErrorLog` fora de `handleApiError`.

### Impressora

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| nome | String | sim | não | rótulo da impressora (ex.: "Impressora da Cozinha", "Impressora do Caixa") |
| tipo | TipoConexaoImpressora | sim | não | REDE / USB_LOCAL — default REDE. Adicionado em 2026-09-05 |
| ip | String? | não | não | IP da impressora na rede local (validado como IPv4 na API) — só quando `tipo=REDE`. Ficou opcional em 2026-09-05 (antes era obrigatório, só existia impressora de rede) |
| porta | Int? | não | não | porta RAW/JetDirect — só quando `tipo=REDE`; sem default fixo desde 2026-09-05 (a API aplica 9100 se omitido) |
| compartilhamento | String? | não | não | nome do compartilhamento de impressora do Windows — só quando `tipo=USB_LOCAL` (impressora ligada por cabo USB no PC do caixa, sem IP próprio). Novo em 2026-09-05 |
| ativa | Boolean | sim | não | default true — quando false, nada é enfileirado |
| papel | PapelImpressora | sim | não | PRODUCAO_COZINHA / CAIXA — UNIQUE (um registro por papel). `CAIXA` (bebidas/drinks + ficha de conta) adicionado em 2026-09-05 |
| agenteVistoEm | DateTime? | não | sim | heartbeat — atualizado a cada `GET /api/impressao/fila` do agente, pros dois papéis; a aba mostra "online" se < 30s. Adicionado em 2026-09-03 |
| createdAt / updatedAt | DateTime | sim | sim | timestamps padrão |

Configurada em Configurações → Impressoras (quem tem `configuracoes.impressoras` — `guardPermissao()` desde 2026-09-06, antes `guardGestor()`) via `PATCH /api/configuracoes/impressoras` (upsert pelo `papel`, recebido no body). Duas impressoras usam esta entidade desde 2026-09-05: Cozinha (sempre `REDE`) e Caixa (`REDE` ou `USB_LOCAL`, tipicamente USB local — impressora cabeada direto no PC do caixa). O cupom de **pagamento** do Caixa (fechamento, `window.print()`) continua fora desta entidade, sem cadastro — ver RN-066 em requisitos-funcionais. O resultado do último "Testar impressão" **não** é persistido (fica só em estado da tela).

### FilaImpressao

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| origem | String | sim | não | `AUTO` / `PEDIDO_CONFIRMADO` / `REIMPRESSAO_ITEM` / `REIMPRESSAO_COMANDA` / `CONTA` / `TESTE` / `CAIXA` (ficha de fechamento e comprovante de sangria/suprimento, v1.44) — `CONTA` (ficha de conta do "Fechar Comanda", RF-117) é novo em 2026-09-05 |
| descricao | String | sim | não | legível — "Comanda #42 — 2x Espeto de Frango" (pra UI/ErrorLog) |
| tipo | TipoConexaoImpressora | sim | não | REDE / USB_LOCAL — default REDE, snapshot de `Impressora.tipo` no momento do enfileiramento. Novo em 2026-09-05 |
| ip / porta | String? / Int? | não | não | snapshot do alvo (`Impressora`) no momento do enfileiramento — preenchido só quando `tipo=REDE`. Ficaram opcionais em 2026-09-05 |
| compartilhamento | String? | não | não | snapshot de `Impressora.compartilhamento` — preenchido só quando `tipo=USB_LOCAL`. Novo em 2026-09-05 |
| payloadBase64 | String | sim | sim | bytes ESC/POS já renderizados (`node-thermal-printer` `getBuffer()`), em base64 |
| status | StatusFilaImpressao | sim | não | PENDENTE / IMPRESSO / ERRO — default PENDENTE |
| tentativas | Int | sim | sim | incrementado a cada falha reportada pelo agente; ≥ 3 → ERRO |
| ultimoErro | String? | não | sim | mensagem amigável do último erro reportado |
| orderItemId | String? | não | não | rastreabilidade (sem FK formal) |
| criadoEm / atualizadoEm | DateTime | sim | sim | timestamps |
| impressoEm | DateTime? | não | sim | preenchido quando o agente confirma |

`@@index([status, criadoEm])`. Job PENDENTE com mais de 30 min (`VALIDADE_JOB_MS`) é descartado (→ ERRO + `ErrorLog`) no próximo poll do agente — ficha fria não sai. Só o servidor grava; só o agente (via token) atualiza `status`. Desde 2026-09-05, o Agente decide como imprimir pelo campo `tipo` do job: `REDE` → socket TCP `ip:porta`; `USB_LOCAL` → grava um arquivo temporário e executa `copy /b` para `\\localhost\<compartilhamento>` (jeito clássico de mandar bytes RAW pro spooler do Windows sem dependência npm extra).

---

### SessaoCaixa (v1.44)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| status | StatusSessaoCaixa | sim | não | ABERTA / FECHADA — default ABERTA |
| abertoPorId / abertoEm | String / DateTime | sim | não | FK → User; quem abriu e quando |
| fundoTroco | Decimal(10,2) | sim | não | dinheiro na gaveta na abertura (sugestão = `fundoProximoCaixa` do último fechamento) |
| fechadoPorId / fechadoEm | String? / DateTime? | não | não | FK → User; quem fez a contagem e quando |
| esperado | Json? | não | sim | snapshot `EsperadoSnapshot` (src/lib/caixa.ts): vendas por forma (com NOTA), bandeiras do cartão, sangrias/suprimentos, esperado por forma conferível, notas, total, nº comandas, ticket médio, formas com venda + `limiteQuebra` e `modo` vigentes no fechamento |
| contado | Json? | não | não | `ContadoCaixa`: `{porForma: {DINHEIRO, CREDITO, DEBITO, PIX, VOUCHER}, bandeiras?: {CREDITO?: {Visa: n…}, DEBITO?: …}}` |
| diferencaTotal | Decimal(10,2)? | não | sim | contado − esperado nas formas conferíveis (negativo = falta) |
| quebraAcimaLimite | Boolean | sim | sim | `|diferencaTotal| > caixa_limite_quebra` — default false |
| fundoProximoCaixa | Decimal(10,2)? | não | não | dinheiro deixado na gaveta (0..dinheiro contado); o resto é recolhido |
| justificativaPendencias | String? | não | não | obrigatória quando havia comandas abertas no escopo |
| comandasPendentes | Json? | não | sim | snapshot `[{id, tipo, mesa, comanda, clienteNome, total, contaSolicitada}]` no fechamento |
| observacao | String? | não | não | livre |

Índices: `status`, `abertoEm`, `(abertoPorId, status)`. Unicidade de sessão aberta garantida pela aplicação (advisory lock na abertura), não por índice parcial — o Prisma não representa índice parcial e tentaria dropá-lo na próxima migration.

### MovimentoCaixa (v1.44)

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | String (cuid) | sim | sim | identificador único |
| sessaoCaixaId | String | sim | não | FK → SessaoCaixa (cascade) |
| tipo | TipoMovimentoCaixa | sim | não | SANGRIA (retirada) / SUPRIMENTO (reforço de troco) |
| valor | Decimal(10,2) | sim | não | > 0; sangria não pode deixar o dinheiro esperado negativo |
| motivo | String | sim | não | obrigatório, até 300 caracteres |
| criadoPorId / criadoEm | String / DateTime | sim | sim | FK → User; quando |

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
                → LIVRE (cancelamento, com ou sem CONTA)
```
| Estado | Significado | O que dispara |
|---|---|---|
| LIVRE | disponível para abertura | fechamento/cancelamento de comanda anterior |
| OCUPADA | comanda aberta, itens sendo lançados | abertura de nova comanda |
| CONTA | conta solicitada (RF-117) — itens travados pro ATENDENTE, aguardando o Caixa finalizar | `POST /api/orders/[id]/solicitar-conta` (`Order.contaSolicitada=true`) *(passou a ser usado de fato em 2026-09-05 — antes era um valor reservado no enum, nunca setado por nenhum fluxo)* |

### Comanda (PaymentStatus)
```
PENDENTE (contaSolicitada: false → true) → FECHADO
PENDENTE → CANCELADO
```
| Estado | Significado | O que dispara |
|---|---|---|
| PENDENTE | comanda aberta, itens sendo lançados. `contaSolicitada` (bool, dentro de PENDENTE — não é um valor de `PaymentStatus`) fica `true` depois do "Fechar Comanda" (RF-117), travando itens pro ATENDENTE | criação (abertura de mesa ou balcão) |
| FECHADO | pagamento confirmado (Finalizar, RF-017, restrito a CAIXA/SUPERVISOR/ADMIN), cupom emitido, estoque deduzido | finalização com split payment |
| CANCELADO | comanda encerrada sem venda | cancelamento |

### Item da comanda (status — KDS)
```
PENDENTE → PRONTO
```

---

## Propriedade e acesso

| Entidade | Quem cria | Quem edita | Quem exclui |
|---|---|---|---|
| Product / Ingredient / RecipeItem | quem tem a permissão (`produtos` / `estoque` / `produtos`\|`cmv`) | idem (reforçado via `guardPermissao()`/`guardPermissaoQualquer()` na API desde 2026-09-06 — antes era `guardGestor()` por papel) | idem (bloqueado se em uso) |
| Order / OrderItem | qualquer role com acesso a `/mesas` ou `/balcao` (CAIXA, ATENDENTE, SUPERVISOR, ADMIN) | mesmo grupo, enquanto PENDENTE | nunca (soft via cancelamento) |
| Despesa | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR |
| Funcionario / Feedback / PlanoAcao / Sugestao | ADMIN, SUPERVISOR | ADMIN, SUPERVISOR | — |
| TaxaPagamento / TaxaDelivery / ConfiguracaoNotificacao | ADMIN | ADMIN | ADMIN (taxa por bandeira) |
| Impressora | quem tem `configuracoes.impressoras` (`guardPermissao()`) | idem | — (sem rota de exclusão; upsert por `papel`) |
| Table (Mesa) | quem tem `configuracoes.mesas` (`guardPermissao()`, desde 2026-09-06) | — (só status, via fluxo de comanda) | quem tem `configuracoes.mesas` — bloqueado se não-`LIVRE`/com comanda aberta; comandas fechadas são desvinculadas (`mesaId=null`) |
| ConfiguracaoGeral — `categorias_cardapio` | quem tem `configuracoes.categorias` (`PUT /api/configuracoes/categorias`, desde 2026-09-06) | idem (substitui a lista inteira) | — (lista sempre existe; esvaziar é rejeitado) |
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
| PapelImpressora | PRODUCAO_COZINHA, CAIXA *(CAIXA novo em 2026-09-05 — bebidas/drinks + ficha de conta)* |
| TipoConexaoImpressora | REDE, USB_LOCAL *(novo em 2026-09-05)* |
| StatusFilaImpressao | PENDENTE, IMPRESSO, ERRO |

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
          + Σ por grupo de opcionais "por categoria" (quantidade exigida × média do costPrice dos produtos ATIVOS da categoria)   // desde 2026-09-29

OrderItem.custoUnit (na venda) =
    SE não há componentes OU costPriceManual → Product.costPrice
    SENÃO → ficha técnica do produto + Σ (componente.quantidade × costPrice do produto escolhido)

CMV% (saúde, desde 2026-09-29) = costPrice ÷ preco
    < 28% → "Abaixo da faixa" | 28%–35% → "Saudável" | 35%–40% → "Atenção" | > 40% → "Crítico"
Preço sugerido pelo simulador = costPrice ÷ CMV-alvo  (padrão 32%, meio da faixa saudável)
```

Recalculado em `lib/cmv.ts` sempre que: (0) desde 2026-09-29, muda `opcionais`/`categoria`/`ativo`/custo manual do produto — e, em cascata de um nível, os produtos cujos grupos "por categoria" puxam da categoria dele (mudou um espeto → recalcula as Jantinhas); (1) um `RecipeItem` do produto é criado/editado/removido, ou (2) o `custoUnitario` **ou** o `rendimentoPercentual` de um `Ingredient` muda (recalcula em lote todos os produtos que usam aquele insumo, desde 2026-08-07). `custoEfetivoUnitario()` vive em `src/lib/cmv-calc.ts`, reexportado por `lib/cmv.ts`.

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
