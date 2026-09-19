---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-18
owner: willians
---

# Requisitos Funcionais — Drogaria Vesale

> Referência: [[prd-vesale]]

## Módulos funcionais

### Módulo 1 — Autenticação e Usuários
Controla quem acessa o sistema e com qual nível de permissão — separa a visão de gestão (preço, custo, financeiro) da visão de operação de balcão.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica o usuário | quando informa e-mail/usuário e senha válidos | acesso liberado conforme o papel (gestor ou operador de caixa) |
| RF-002 | Restringe acesso a telas financeiras e de precificação | quando o usuário logado é operador de caixa | telas de Financeiro e Precificação/CMV ficam ocultas ou bloqueadas; em Notas Fiscais de Entrada só o upload é liberado (RN-019); em Estoque, consulta em modo leitura sem custo (RN-018) |
| RF-003 | Permite ao gestor cadastrar novos usuários | quando o gestor acessa a tela de usuários | novo usuário criado com papel definido (gestor ou operador) |

#### Regras de negócio
- **RN-001:** todo usuário pertence a exatamente um papel — gestor ou operador de caixa. Não há papel intermediário nesta versão.
- **RN-002:** o papel operador de caixa nunca visualiza custo travado, margem ou dados financeiros — apenas preço de venda.
- **RN-018:** o operador de caixa acessa a tela de Estoque em modo somente leitura — vê nome, categoria, quantidade em estoque, validade e preço de venda, nunca o custo travado (o servidor nunca envia esse campo para esse papel, reforçando RN-002/RNF-002); cadastro e edição de produto continuam exclusivos do gestor (RF-004).
- **RN-019:** o operador de caixa pode enviar (upload) uma nota fiscal de entrada (RF-014), mas a lista de notas, os valores extraídos, a busca por chave de acesso (RF-032), o vínculo de item a produto (RF-017) e a conciliação (RF-018) continuam exclusivos do gestor.

---

### Módulo 2 — Cadastro de Produtos e Estoque
Base de dados de produtos que sustenta o PDV, a entrada de notas fiscais e a precificação. Sem produto cadastrado, nenhum outro módulo tem o que processar.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-004 | Cadastra um produto | quando o gestor informa nome, categoria, unidade e código de barras | produto disponível para venda no PDV e para vínculo com itens de nota fiscal |
| RF-005 | Atualiza a quantidade em estoque | quando uma venda é finalizada no PDV | quantidade do produto vendido é decrementada do estoque |
| RF-006 | Atualiza a quantidade em estoque | quando uma nota fiscal de entrada é processada e conciliada | quantidade dos itens da nota é somada ao estoque do produto vinculado |
| RF-007 | Sinaliza estoque baixo | quando a quantidade em estoque de um produto fica abaixo do nível mínimo cadastrado | produto aparece destacado em lista de reposição |
| RF-027 | Sinaliza produto como medicamento controlado | quando o gestor marca o produto como controlado no cadastro | produto passa a exigir confirmação de receita em toda venda (RF-029) e lote+validade em toda nota fiscal que o abastece (RF-028) |
| RF-028 | Rastreia lote e validade | quando uma nota fiscal com produto controlado é conciliada | quantidade é somada a um lote (criado se novo) com número e validade próprios; produto sem lote continua com controle agregado simples |

#### Regras de negócio
- **RN-003:** todo produto tem categoria (ex.: medicamento genérico, medicamento referência, perfumaria, outros) — categoria vem preferencialmente do NCM extraído da nota fiscal, com opção de ajuste manual pelo gestor.
- **RN-004:** um produto não pode ser vendido no PDV com estoque em quantidade zero ou negativa — o sistema bloqueia a finalização da venda nesse caso.
- **RN-013:** item de venda de produto medicamento controlado exige confirmação de receita (por item, no PDV) antes de a venda poder ser finalizada.
- **RN-014:** item de nota fiscal vinculado a produto medicamento controlado exige lote e validade preenchidos (extraídos do XML ou informados manualmente) antes de a nota poder ser conciliada — mesma lógica de bloqueio de RN-007/RN-014.
- **RN-015:** baixa de estoque na venda usa FEFO (lote de validade mais próxima primeiro) quando o produto tem lote com saldo; produto sem lote continua decrementando o agregado quantidade_estoque direto.

*Pendência de [[registro-de-decisoes-vesale]] resolvida em 2026-09-15 — lote/validade e medicamento controlado confirmados como requisito real pela cliente.*

---

### Módulo 3 — Frente de Caixa (PDV)
Interface de venda no balcão. Prioridade máxima de agilidade — o operador deve conseguir finalizar a venda quase sem usar o mouse.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-008 | Localiza um produto | quando o código de barras é lido (leitor ou digitado) | produto é adicionado automaticamente à venda em andamento |
| RF-009 | Localiza um produto | quando o operador digita parte do nome na busca rápida | lista de produtos correspondentes aparece para seleção via teclado |
| RF-010 | Calcula o total da venda | a cada item adicionado ou removido | total é recalculado e exibido em tempo real |
| RF-011 | Finaliza a venda | quando o operador seleciona a forma de pagamento e confirma | venda registrada como finalizada, estoque decrementado, valor lançado no caixa do dia |
| RF-012 | Cancela um item ou a venda inteira | quando o operador aciona o atalho/ação de cancelamento antes da finalização | item ou venda removido sem afetar estoque nem caixa |
| RF-013 | Registra a abertura e o fechamento de caixa do dia | quando o operador informa o valor inicial (abertura) ou confirma o fechamento | sessão de caixa do dia criada/encerrada, servindo de base para o fluxo de caixa do Módulo 6 |
| RF-029 | Aplica desconto na venda | quando o operador informa um valor de desconto antes de finalizar | total da venda é recalculado com o desconto abatido; venda é gravada com o valor líquido e o desconto separado, para auditoria |
| RF-030 | Consolida relatório de vendas por período | quando o gestor seleciona um período (dia, 7/30 dias ou intervalo customizado) | exibe total vendido, número de vendas, ticket médio, produtos mais vendidos e total por forma de pagamento no período |
| RF-033 | Emite comprovante de venda | assim que a venda é finalizada (RF-011) | modal com itens, subtotal, desconto e total é exibido, com opção de imprimir |
| RF-034 | Calcula a diferença de caixa | quando o operador informa o valor contado no fechamento (RF-013) | sistema mostra o valor esperado (abertura + vendas) antes da confirmação; diferença (contado − esperado) fica registrada e visível no histórico de sessões em Financeiro |

#### Regras de negócio
- **RN-005:** toda venda finalizada é imutável — correções após finalização exigem uma operação de cancelamento/estorno registrada separadamente, nunca edição direta da venda original.
- **RN-006:** o fluxo principal do PDV (buscar produto → adicionar → finalizar) deve ser completável inteiramente por teclado, sem exigir clique de mouse.
- **RN-016:** desconto é sempre um valor monetário sobre o subtotal da venda, nunca negativo nem maior que o subtotal.

---

### Módulo 4 — Notas Fiscais de Entrada
Ponto crítico do sistema: transforma o documento fiscal do fornecedor em custo e estoque atualizados, sem lançamento manual linha a linha.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-014 | Recebe o upload de um arquivo de nota fiscal | quando o gestor envia um arquivo XML ou PDF | arquivo é armazenado e a nota entra em processamento |
| RF-015 | Extrai automaticamente os dados da nota | quando o arquivo enviado é um XML no padrão NFe (SEFAZ) | fornecedor, itens (descrição, quantidade, custo unitário, NCM) e valor total são extraídos sem intervenção manual |
| RF-016 | Extrai os dados da nota via leitura assistida | quando o arquivo enviado é um PDF (DANFE) ou um XML fora do padrão esperado | dados extraídos por camada de leitura assistida (IA), com a nota marcada para conferência manual antes de ser conciliada |
| RF-017 | Vincula cada item extraído a um produto do cadastro | quando o item da nota corresponde (por código de barras, NCM ou nome) a um produto já cadastrado | vínculo automático sugerido; itens sem correspondência ficam pendentes de vínculo manual pelo gestor |
| RF-018 | Concilia a nota fiscal | quando todos os itens da nota estão vinculados a um produto e o gestor confirma | estoque é incrementado (RF-006) e o custo travado de cada produto é atualizado com o valor da nota |
| RF-031 | Cadastra e edita fornecedor diretamente | quando o gestor acessa a aba Fornecedores e informa razão social e CNPJ | fornecedor fica disponível para vínculo em notas fiscais, sem precisar vir de um upload de XML primeiro; tela lista pedidos recebidos, valor total e data do último pedido por fornecedor |
| RF-032 | Lança nota fiscal manualmente a partir da chave de acesso | quando o gestor bipa/cola a chave de acesso (QR do DANFE) e ainda não enviou o XML dessa nota | nota é criada com origem "manual" e o gestor digita os itens recebidos; segue o mesmo fluxo de vínculo (RF-017) e conciliação (RF-018) de uma nota vinda de XML |

#### Regras de negócio
- **RN-007:** uma nota fiscal nunca atualiza estoque ou custo antes de ser conciliada — itens pendentes de vínculo bloqueiam a conciliação da nota inteira ou, no mínimo, dos itens pendentes.
- **RN-008:** o custo travado de um produto é sempre o valor unitário da nota fiscal mais recente conciliada para aquele produto — não é média, é o último custo real de compra.
- **RN-017:** CNPJ de fornecedor é sempre normalizado para dígitos puros antes de gravar/comparar — evita duplicar o cadastro do mesmo fornecedor por causa de pontuação digitada diferente entre o XML e o lançamento manual.

*RF-032 existe porque a chave de acesso sozinha (o que o QR do DANFE carrega) não dá acesso aos itens da nota — isso só vem do XML ou do portal da Sefaz; sem o XML, travar o gestor não seria aceitável (RNF-004).*

---

### Módulo 5 — Precificação e CMV
Painel onde a decisão humana de preço encontra o custo real travado pela nota fiscal.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-019 | Exibe o custo travado e o preço de venda de cada produto lado a lado | sempre que o painel de precificação é acessado | gestor visualiza margem (%) calculada automaticamente a partir de custo e preço |
| RF-020 | Permite editar o preço de venda | quando o gestor informa um novo valor de preço para o produto | preço atualizado e refletido imediatamente no PDV |
| RF-021 | Sinaliza margem negativa | quando o preço de venda cadastrado é menor ou igual ao custo travado do produto | produto aparece destacado visualmente (cor de alerta) na lista de precificação e no cadastro do produto |
| RF-022 | Calcula o CMV do período | quando o gestor seleciona um intervalo de datas no painel | soma do custo travado de cada unidade vendida no período é exibida, consolidando o CMV |

#### Regras de negócio
- **RN-009:** o campo de custo nunca é editável manualmente pelo gestor — só é atualizado por conciliação de nota fiscal (RF-018). O campo de preço de venda é sempre editável manualmente e nunca é preenchido automaticamente.
- **RN-010:** um produto sem custo travado (nenhuma nota conciliada ainda) não pode ter margem calculada — o sistema exibe "custo pendente" em vez de um valor de margem.

---

### Módulo 6 — Gestão Financeira
Consolida o resultado real do negócio, cruzando o que o PDV vendeu com os custos fixos e variáveis da farmácia.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-023 | Registra uma despesa (conta a pagar) | quando o gestor informa fornecedor/categoria, valor e vencimento | despesa lançada como pendente, visível no fluxo de caixa projetado |
| RF-024 | Registra o recebimento de uma conta a receber | quando o gestor confirma um recebimento pendente | conta marcada como recebida e valor lançado no fluxo de caixa realizado |
| RF-025 | Consolida o fluxo de caixa do dia | ao final de cada sessão de caixa do PDV (RF-013) | entradas de venda somadas às demais entradas/saídas financeiras do dia |
| RF-026 | Gera o DRE simplificado do mês | quando o gestor seleciona um mês de referência | receita total do PDV menos CMV do período (RF-022) menos despesas fixas/variáveis do mês, resultando no lucro do período |

#### Regras de negócio
- **RN-011:** toda entrada de receita no financeiro tem origem rastreável — venda do PDV ou lançamento manual de recebimento — nunca um valor solto sem origem.
- **RN-012:** o DRE simplificado sempre usa o CMV real (custo travado por nota fiscal), nunca um custo estimado ou médio de mercado.

*RF-023/RF-024 (lançar e dar baixa em conta a pagar/receber) têm tela implementada desde 2026-09-15. O Módulo 5 (Precificação/CMV — RF-019 a RF-022) tem tela implementada desde 2026-09-17. RF-025 (fluxo de caixa consolidado) e RF-026 (DRE simplificado) seguem planejados; RF-026 ainda depende de RF-025, mesmo com o Módulo 5 pronto.*

---

### Painel (transversal)

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-035 | Consolida um resumo do dia na tela inicial do gestor | sempre que o gestor acessa o Painel | mostra vendas de hoje, status do caixa, quantidade de produtos com estoque baixo (RF-007) e quantidade vencendo em 30 dias (RN-014), com atalho para as listas completas em Estoque |

Não é um módulo novo — é só uma consolidação visual de RF-005/RF-007/RF-013/RF-028 já existentes, sem regra de negócio própria.

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Performance | busca de produto no PDV (por nome ou código de barras) responde em menos de 500ms em catálogo de até alguns milhares de itens |
| RNF-002 | Segurança | dados de custo, margem e financeiro nunca são expostos a usuários com papel operador de caixa (ver RN-002), em nenhuma rota ou resposta de API |
| RNF-003 | Segurança | upload de arquivos de nota fiscal (XML/PDF) valida tipo e tamanho de arquivo antes de processar |
| RNF-004 | Disponibilidade | sistema disponível durante o horário comercial da farmácia; indisponibilidade não pode bloquear a finalização de uma venda em andamento sem alternativa clara ao operador |
| RNF-005 | Usabilidade | fluxo principal do PDV (Módulo 3) operável integralmente por teclado, conforme RN-006 |
| RNF-006 | Confiabilidade | uma nota fiscal mal formatada ou um XML fora do padrão nunca derruba o upload de outras notas — falha é isolada por nota |

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| Venda (PDV) | aberta, finalizada, cancelada | aberta → finalizada (RF-011); aberta → cancelada (RF-012) | ação do operador de caixa |
| Nota Fiscal de Entrada | recebida, em processamento, pendente de vínculo, conciliada, erro | recebida → em processamento (RF-014); em processamento → pendente de vínculo (itens sem match, RF-017) ou conciliada (todos os itens vinculados + confirmação, RF-018); em processamento → erro (arquivo ilegível) | upload do arquivo e ação do gestor |
| Conta a Pagar/Receber | pendente, paga/recebida, vencida | pendente → paga/recebida (RF-024); pendente → vencida (data de vencimento ultrapassada sem baixa) | ação do gestor ou passagem de tempo |
| Produto | ativo, inativo | ativo → inativo (gestor descontinua o item) | ação do gestor |

## Critérios de aceite gerais

- [ ] O operador de caixa finaliza uma venda de 1 a 3 itens usando apenas teclado, do início ao fim (RN-006, RNF-005).
- [ ] Uma venda finalizada decrementa o estoque do(s) produto(s) vendido(s) imediatamente (RF-005).
- [ ] Um XML de nota fiscal no padrão NFe é processado e apresentado para conciliação sem exigir digitação manual dos itens (RF-015).
- [ ] Um produto com preço de venda igual ou abaixo do custo travado aparece destacado visualmente em qualquer tela onde o preço é exibido ao gestor (RF-021).
- [ ] O custo travado de um produto nunca é alterado por nenhuma ação fora da conciliação de nota fiscal (RN-009).
- [ ] Um usuário com papel operador de caixa não consegue acessar, por nenhuma rota, os módulos Financeiro ou Precificação/CMV, nem a lista de valores, o vínculo de item ou a conciliação de Notas Fiscais de Entrada — mas consegue enviar (upload) uma nova nota e consultar o Estoque em modo leitura, sem nunca receber o custo travado (RF-002, RNF-002, RN-018, RN-019).
- [ ] O DRE simplificado de um mês fecha com a fórmula receita PDV − CMV real − despesas do mês, sem número inventado ou estimado (RN-012).

---

# Links relacionados

[[prd-vesale]] — PRD de origem destes requisitos
[[arquitetura-vesale]] — como o sistema sustenta tecnicamente estes requisitos
[[modelo-de-dados-vesale]] — entidades que sustentam estes requisitos
