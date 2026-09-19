---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-16
owner: willians
---

# Modelo de Dados — Drogaria Vesale

> Referência: [[prd-vesale]] | [[arquitetura-vesale]]

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| Usuario | Pessoa que acessa o sistema (gestor ou operador de caixa) | Sustenta autenticação e controle de papel (RF-001, RF-002) |
| Produto | Item vendável da farmácia (medicamento ou perfumaria) | Base de todos os outros módulos — PDV, NF de entrada e precificação giram em torno do produto |
| CategoriaProduto | Agrupamento de produtos (ex.: genérico, referência, perfumaria, outros) | Sustenta RN-003 e a organização do catálogo |
| Fornecedor | Distribuidora/fabricante que emite nota fiscal de entrada | Origem de toda nota fiscal e de todo custo que entra no sistema |
| NotaFiscalEntrada | Documento fiscal recebido de um fornecedor (XML ou PDF) | Representa o evento que atualiza estoque e custo (Módulo 4) |
| ItemNotaFiscal | Uma linha de produto dentro de uma nota fiscal | Ponte entre o documento fiscal e o Produto — pode existir sem vínculo até ser conciliado (RN-007) |
| LoteProduto | Um lote físico de um produto, com validade própria | Sustenta RN-014/RN-015 (rastreio e baixa FEFO) — só existe para produto que passou por conciliação de nota com lote informado |
| Venda | Uma transação de venda finalizada ou cancelada no PDV | Representa o evento que gera receita e decrementa estoque (Módulo 3) |
| ItemVenda | Uma linha de produto dentro de uma venda | Detalha o que foi vendido, em qual quantidade e a qual preço no momento da venda |
| FormaPagamento | Meio de pagamento aceito (dinheiro, débito, crédito, PIX) | Sustenta a finalização da venda (RF-011) e a taxa aplicada por forma de pagamento |
| SessaoCaixa | Abertura/fechamento de caixa de um dia de operação | Sustenta RF-013 e é a base do fluxo de caixa diário (RF-025) |
| ContaFinanceira | Uma conta a pagar ou a receber | Sustenta o Módulo 6 (RF-023, RF-024) |
| CategoriaFinanceira | Classificação de despesa/receita (fixa ou variável) | Sustenta o DRE simplificado (RF-026) |

## Atributos por entidade

### Usuario

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único imutável |
| nome | string | sim | não | nome do usuário |
| email | string | sim | não | usado para login |
| senha_hash | string | sim | não | senha com hash, nunca armazenada em texto puro |
| papel | enum(gestor, operador_caixa) | sim | não | define o nível de acesso (RN-001) |
| created_at | timestamp | sim | sim | gerado automaticamente na criação |
| updated_at | timestamp | sim | sim | atualizado a cada modificação |

### Produto

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único imutável |
| nome | string | sim | não | nome do produto |
| codigo_barras | string | não | não | usado na leitura do PDV (RF-008); opcional pois nem todo item de farmácia tem EAN legível |
| categoria_id | uuid (FK CategoriaProduto) | sim | não | categoria do produto (RN-003) |
| ncm | string | não | não | código fiscal, preferencialmente extraído da nota fiscal |
| unidade | string | sim | não | unidade de venda (un, cx, etc.) |
| custo_travado | decimal | não | sim | atualizado exclusivamente por conciliação de nota fiscal (RN-009); nulo até a primeira conciliação (RN-010) |
| preco_venda | decimal | não | não | sempre editável manualmente pelo gestor (RN-009); nulo até ser definido |
| quantidade_estoque | integer | sim | sim | atualizado por venda (RF-005) e por conciliação de NF (RF-006) |
| estoque_minimo | integer | sim | não | usado para sinalizar reposição (RF-007) |
| medicamento_controlado | boolean | sim | não | exige confirmação de receita na venda (RN-013) e lote+validade na conciliação da NF que o supre (RN-014); default falso |
| status | enum(ativo, inativo) | sim | não | ver Estados e ciclo de vida |
| created_at | timestamp | sim | sim | — |
| updated_at | timestamp | sim | sim | — |

### LoteProduto

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| produto_id | uuid (FK Produto) | sim | não | produto ao qual o lote pertence |
| numero_lote | string | sim | não | identificador do lote impresso na embalagem/nota; único por produto |
| validade | date | sim | não | data de validade do lote |
| quantidade | integer | sim | sim | soma por conciliação de NF (RN-014) e consumida por venda via FEFO (RN-015); nunca editada manualmente |
| created_at | timestamp | sim | sim | — |

### CategoriaProduto

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| nome | string | sim | não | ex.: "medicamento genérico", "perfumaria" |

### Fornecedor

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| razao_social | string | sim | não | extraído da nota fiscal ou cadastrado manualmente |
| cnpj | string | sim | não | identifica o fornecedor de forma única |

### NotaFiscalEntrada

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| fornecedor_id | uuid (FK Fornecedor) | não | não | nulo até extração/vínculo do fornecedor ser confirmado |
| chave_acesso_nfe | string | não | não | presente quando o arquivo é XML padrão NFe |
| arquivo_original | string (caminho/URL) | sim | não | XML ou PDF enviado (RF-014) |
| origem_extracao | enum(xml_padrao, ia_assistida) | sim | sim | indica se veio do parser determinístico (RF-015) ou da leitura assistida por IA (RF-016) |
| valor_total | decimal | não | não | extraído do documento |
| status | enum(recebida, em_processamento, pendente_vinculo, conciliada, erro) | sim | sim | ver Estados e ciclo de vida |
| created_at | timestamp | sim | sim | data do upload |
| conciliada_em | timestamp | não | sim | preenchido quando a nota é conciliada (RF-018) |

### ItemNotaFiscal

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| nota_fiscal_id | uuid (FK NotaFiscalEntrada) | sim | não | nota à qual o item pertence |
| produto_id | uuid (FK Produto) | não | não | nulo enquanto pendente de vínculo (RF-017, RN-007) |
| descricao_fornecedor | string | sim | não | descrição do item exatamente como veio da nota |
| quantidade | decimal | sim | não | quantidade comprada |
| custo_unitario | decimal | sim | não | custo unitário extraído da nota |
| ncm | string | não | não | usado para sugerir categoria (RN-003) |
| numero_lote | string | não | não | extraído do grupo `rastro` do XML quando presente; senão preenchido manualmente na conciliação. Obrigatório antes de conciliar só quando o produto vinculado é medicamento_controlado (RN-014) |
| validade | date | não | não | idem numero_lote |

### Venda

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| operador_id | uuid (FK Usuario) | sim | não | quem finalizou a venda |
| sessao_caixa_id | uuid (FK SessaoCaixa) | sim | não | sessão de caixa em que a venda ocorreu |
| forma_pagamento_id | uuid (FK FormaPagamento) | sim | não | forma de pagamento usada |
| desconto_valor | decimal | sim | não | abatimento aplicado sobre o subtotal (RN-016); default zero |
| valor_total | decimal | sim | sim | valor líquido efetivamente cobrado — soma dos itens menos desconto_valor |
| status | enum(aberta, finalizada, cancelada) | sim | sim | ver Estados e ciclo de vida |
| created_at | timestamp | sim | sim | — |
| finalizada_em | timestamp | não | sim | preenchido na finalização (RF-011) |

### ItemVenda

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| venda_id | uuid (FK Venda) | sim | não | venda à qual o item pertence |
| produto_id | uuid (FK Produto) | sim | não | produto vendido |
| quantidade | integer | sim | não | quantidade vendida |
| preco_unitario_no_momento | decimal | sim | não | preço de venda congelado no momento da venda (histórico não muda se o preço mudar depois) |
| custo_unitario_no_momento | decimal | não | não | custo travado congelado no momento da venda — base do CMV real (RN-012) |
| lote_id | uuid (FK LoteProduto) | não | sim | de qual lote saiu a baixa por FEFO (RN-015); nulo quando o produto não tem lote |
| receita_confirmada | boolean | sim | não | obrigatório verdadeiro para item de produto medicamento_controlado antes da venda finalizar (RN-013); default falso |

### FormaPagamento

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| nome | string | sim | não | ex.: dinheiro, débito, crédito, PIX |
| taxa_percentual | decimal | não | não | taxa de maquininha aplicada, quando houver |

### SessaoCaixa

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| operador_id | uuid (FK Usuario) | sim | não | quem abriu a sessão |
| valor_abertura | decimal | sim | não | valor informado na abertura (RF-013) |
| valor_fechamento | decimal | não | não | preenchido no fechamento |
| status | enum(aberta, fechada) | sim | sim | — |
| aberta_em | timestamp | sim | sim | — |
| fechada_em | timestamp | não | sim | — |

### ContaFinanceira

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| tipo | enum(pagar, receber) | sim | não | — |
| categoria_id | uuid (FK CategoriaFinanceira) | sim | não | classifica a despesa/receita (RF-026) |
| descricao | string | sim | não | ex.: "aluguel", "fornecedor X" |
| valor | decimal | sim | não | valor da conta |
| vencimento | date | sim | não | data de vencimento |
| status | enum(pendente, paga_recebida, vencida) | sim | sim | ver Estados e ciclo de vida |
| baixada_em | timestamp | não | sim | preenchido quando paga/recebida (RF-024) |

### CategoriaFinanceira

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único |
| nome | string | sim | não | ex.: "aluguel", "energia", "fornecedores" |
| natureza | enum(fixa, variavel) | sim | não | sustenta o DRE simplificado (RF-026) |

## Relacionamentos

| De | Para | Tipo | Atributos do relacionamento | Regra |
|---|---|---|---|---|
| Produto | CategoriaProduto | N:1 | — | todo produto tem exatamente uma categoria (RN-003) |
| Produto | LoteProduto | 1:N | — | só existe lote pra produto que teve nota conciliada com lote informado; produto sem lote decrementa direto o agregado (RN-015) |
| ItemNotaFiscal | LoteProduto | N:1 (opcional, via numero_lote+produto) | — | conciliação soma no lote (cria se for a primeira entrada); RN-014 |
| ItemVenda | LoteProduto | N:1 (opcional) | — | baixa por FEFO consome do lote de validade mais próxima (RN-015) |
| NotaFiscalEntrada | Fornecedor | N:1 | — | opcional até extração/confirmação do fornecedor |
| NotaFiscalEntrada | ItemNotaFiscal | 1:N | — | uma nota tem N itens; itens não existem sem nota |
| ItemNotaFiscal | Produto | N:1 (opcional) | — | nulo até vínculo manual ou automático (RF-017); bloqueia conciliação enquanto nulo (RN-007) |
| Venda | ItemVenda | 1:N | — | uma venda tem N itens; itens não existem sem venda |
| ItemVenda | Produto | N:1 | preco_unitario_no_momento, custo_unitario_no_momento | preço e custo são congelados no momento da venda, não referenciam o valor atual do produto |
| Venda | SessaoCaixa | N:1 | — | toda venda pertence a exatamente uma sessão de caixa |
| Venda | FormaPagamento | N:1 | — | — |
| ContaFinanceira | CategoriaFinanceira | N:1 | — | toda conta tem uma categoria (fixa ou variável) |

## Estados e ciclo de vida

### NotaFiscalEntrada

```
[recebida] → [em_processamento] → [pendente_vinculo] → [conciliada]
                    ↓
                 [erro]
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| recebida | arquivo enviado, ainda não processado | → em_processamento | upload concluído (RF-014) |
| em_processamento | parser (determinístico ou IA) está extraindo os dados | → pendente_vinculo ou → erro | resultado do parsing |
| pendente_vinculo | dados extraídos, ao menos um item sem produto vinculado | → conciliada | gestor vincula todos os itens e confirma (RF-017, RF-018) |
| conciliada | todos os itens vinculados e confirmados | estado final | confirmação do gestor (RF-018) |
| erro | arquivo ilegível ou extração falhou nas duas camadas | → em_processamento (reprocessamento manual) | falha isolada, não afeta outras notas (RNF-006) |

### Venda

```
[aberta] → [finalizada]
    ↓
[cancelada]
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| aberta | venda em montagem no PDV, ainda editável | → finalizada ou → cancelada | ação do operador (RF-011, RF-012) |
| finalizada | venda concluída, imutável (RN-005) | estado final | confirmação de pagamento (RF-011) |
| cancelada | venda descartada antes de finalizar | estado final | cancelamento (RF-012) |

### ContaFinanceira

```
[pendente] → [paga_recebida]
    ↓
[vencida]
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| pendente | conta lançada, ainda não baixada | → paga_recebida ou → vencida | baixa manual (RF-024) ou passagem da data de vencimento |
| vencida | passou do vencimento sem baixa | → paga_recebida | baixa manual tardia |
| paga_recebida | conta baixada | estado final | ação do gestor |

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem edita | Quem exclui |
|---|---|---|---|---|
| Usuario | gestor | gestor | gestor | gestor |
| Produto | gestor | gestor e operador_caixa (sem custo/margem, ver RNF-002) | gestor | gestor (soft — ver Ciclo de retenção) |
| Fornecedor | gestor (upload de nota ou cadastro direto, RF-031) | gestor | gestor | gestor (sem soft delete — nunca excluído, só editado) |
| NotaFiscalEntrada / ItemNotaFiscal | gestor (upload ou lançamento manual pela chave, RF-032) | gestor | gestor | gestor |
| LoteProduto | sistema (conciliação de nota, RN-014) | gestor | ninguém (só via conciliação/venda) | ninguém |
| Venda / ItemVenda | operador_caixa | gestor e operador_caixa (a própria) | ninguém (imutável, RN-005) | ninguém — apenas cancelamento como novo estado |
| ContaFinanceira / CategoriaFinanceira | gestor | gestor | gestor | gestor |

## Ciclo de retenção

| Entidade | Retenção | Arquivado após | Excluído após | Nunca excluir |
|---|---|---|---|---|
| Venda / ItemVenda | permanente | — | nunca | sim — é a base fiscal e financeira do negócio, exigida para DRE histórico e auditoria |
| NotaFiscalEntrada / ItemNotaFiscal | permanente | — | nunca | sim — mesma razão: base do custo real de cada produto ao longo do tempo |
| Produto | ativo enquanto vendido; inativado (soft), nunca excluído fisicamente | quando marcado inativo pelo gestor | nunca (soft delete via status) | sim — produtos inativos ainda aparecem em vendas/notas históricas |
| ContaFinanceira | permanente | — | nunca | sim — histórico financeiro sustenta o DRE de meses anteriores |

---

# Links relacionados

[[arquitetura-vesale]] — onde e como estes dados vivem tecnicamente
[[requisitos-funcionais-vesale]] — requisitos que determinam estas entidades
