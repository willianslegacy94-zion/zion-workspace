---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-09-07
owner: willians
---

# Requisitos Funcionais — Jocley Grill

> Referência: [[prd-jocley-lanchonete]]

---

## Módulo 1 — Autenticação e Controle de Acesso

Gerencia identidade, sessão e permissões de cada perfil, tanto na navegação (páginas) quanto nas rotas de API de escrita sensíveis.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | Autentica o usuário | dado usuário (login) e senha válidos via NextAuth Credentials | cria sessão JWT com role (ADMIN / SUPERVISOR / CAIXA / ATENDENTE / COZINHA) |
| RF-002 | Redireciona por role na Início | dado usuário autenticado acessa `/` | CAIXA/ATENDENTE/SUPERVISOR → `/mesas`; COZINHA → `/cozinha`; ADMIN permanece no dashboard financeiro |
| RF-003 | Protege todas as páginas | dado requisição sem sessão válida | middleware redireciona para `/login` |
| RF-004 | Libera todas as rotas de API para qualquer role autenticado | dado `pathname` iniciando com `/api/` | middleware não aplica restrição de role — a restrição de página não deve quebrar as chamadas de API que a própria tela do role precisa fazer |
| RF-005 | Restringe páginas por role | dado usuário CAIXA, ATENDENTE, SUPERVISOR ou COZINHA acessando rota fora da própria allowlist | redireciona para a home do role (`/mesas` para CAIXA/ATENDENTE/SUPERVISOR, `/cozinha` para COZINHA) |
| RF-006 | Reforça restrição de escrita no servidor (defesa em profundidade) | dado requisição de escrita (POST/PATCH/DELETE) em Produtos, Insumos, Ficha Técnica ou Usuários vinda de role fora de ADMIN/SUPERVISOR | API retorna 403, independente do que a UI esconde |
| RF-007 | Realiza logout | dado usuário autenticado que clica em Sair | encerra sessão e redireciona para `/login` |

#### Regras de negócio
- **RN-001:** ATENDENTE acessa apenas `/`, `/mesas`, `/balcao`, `/comanda/*` e `/produtos` (visualização)
- **RN-002:** CAIXA acessa `/`, `/mesas`, `/balcao`, `/comanda/*`, `/produtos` e `/estoque` (ambos em visualização)
- **RN-003:** SUPERVISOR acessa `/`, `/mesas`, `/balcao`, `/comanda/*`, `/cozinha`, `/produtos`, `/estoque`, `/lancamentos`, `/despesas`, `/time` e `/usuarios` — nunca `/inteligencia`, `/cmv` ou `/configuracoes`
- **RN-004:** COZINHA acessa exclusivamente `/cozinha`
- **RN-005:** ADMIN não tem restrição de página nem de API

---

## Módulo 2 — PDV: Mesas e Balcão

Dois pontos de entrada para o mesmo fluxo de comanda — mesa física (grid numerado) ou balcão (retirada/consumo rápido, sem mesa).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-008 | Exibe grid de mesas com status | dado acesso a `/mesas` | renderiza as 12 mesas cadastradas com cor por status (LIVRE / OCUPADA / CONTA) |
| RF-009 | Atualiza grid em tempo real | dado polling SWR a cada 3s | grid reflete mudança feita por outro operador sem recarregar |
| RF-010 | Abre mesa | dado clique em mesa LIVRE | cria `Order` (tipo MESA) vinculado à mesa, muda `Table.status` para OCUPADA, navega para a comanda |
| RF-011 | Reabre comanda de mesa ocupada | dado clique em mesa OCUPADA/CONTA | navega para a comanda já existente daquela mesa |
| RF-012 | Lista comandas de balcão abertas | dado acesso a `/balcao` | lista todas as comandas tipo BALCAO com `paymentStatus=PENDENTE`, ordenadas por criação |
| RF-013 | Cria nova comanda de balcão | dado clique em "Nova Comanda" | gera número sequencial diário via `ContadorComanda` (upsert atômico por data) e cria `Order` tipo BALCAO |
| RF-014 | Compartilha a mesma tela de itens entre mesa e balcão | dado navegação para `/comanda/[id]` | exibe "Mesa N" ou "Comanda #N" conforme o tipo, com o mesmo fluxo de adicionar item, split payment e cupom |
| RF-117 | Fecha comanda (solicita a conta) e imprime a comanda completa no Caixa | dado clique em "Fechar Comanda" por qualquer papel operacional (tipicamente ATENDENTE, pelo celular, na mesa) numa comanda `PENDENTE` com itens | seta `Order.contaSolicitada=true` + `contaSolicitadaEm`/`contaSolicitadaPor`; se `tipo=MESA`, muda `Table.status` para `CONTA` (RF-008); enfileira a **ficha de conta** (itens + subtotal + desconto + total + nome do cliente, sem forma de pagamento) na impressora do **Caixa** via o mesmo mecanismo fila+Agente do Módulo 7 — funciona mesmo disparado do celular, pois não depende de `window.print()` no aparelho de quem clicou; o caixa recebe a comanda completa automaticamente pra finalizar. Não cobra pagamento, não baixa estoque, não fecha a comanda (`paymentStatus` continua `PENDENTE`) — quem finaliza é sempre o Caixa (RF-017). Idempotente: chamar de novo só reimprime a ficha. *(Desde 2026-09-06 o enfileiramento é aguardado e o resultado volta pra tela — ver RF-131)* |
| RF-131 | Dá retorno visível de que a conta entrou (ou não) na fila do Caixa | dado "Fechar Comanda" concluído | a resposta de `solicitar-conta` inclui `impressao: { ok, erro }`; se a ficha **não** entrou na fila (sem `Impressora(papel=CAIXA, ativa)` cadastrada, etc.), a tela mostra um aviso âmbar ("Comanda fechada, mas …") em vez da mensagem verde de sucesso, e segura o redirect um pouco mais. Antes de 2026-09-06 o enfileiramento era `fire-and-forget` e a tela sempre dizia "Conta impressa no caixa", mesmo quando nada saía |

#### Regras de negócio
- **RN-006:** Mesa não pode ser aberta se já estiver OCUPADA ou CONTA — clique nela reabre a comanda existente em vez de criar uma nova
- **RN-007:** Numeração de comanda de balcão **reseta todo dia** — `ContadorComanda` é uma tabela chaveada por data (`YYYY-MM-DD`), incrementada atomicamente
- **RN-008:** Fechamento de comanda MESA libera a mesa (`Table.status = LIVRE`); fechamento de comanda BALCAO não afeta nenhuma mesa
- **RN-061 (2026-09-05):** "Fechar" (RF-117, qualquer papel operacional) e "Finalizar" (RF-017, cobra pagamento) são ações **distintas** desde esta data — antes um único botão fazia as duas coisas. Finalizar (`POST /api/orders/[id]/close`) passou a exigir `guardCaixa()` no servidor (`role` ADMIN/SUPERVISOR/CAIXA) — reforçado na API, não só escondido na UI; ATENDENTE que tentar chamar o endpoint direto recebe 403. A tela `/comanda/[id]` mostra "Fechar Comanda" pra quem não é caixa e "Finalizar Comanda" pra quem é
- **RN-062 (2026-09-05):** Enquanto `Order.contaSolicitada=true` e o papel logado é ATENDENTE, a comanda fica travada pra leitura — não é possível adicionar, remover ou alterar quantidade de item (`POST/PATCH/DELETE .../items*` retornam 403 com essa condição). CAIXA/SUPERVISOR/ADMIN continuam podendo editar itens a qualquer momento, mesmo com a conta já solicitada — podem precisar corrigir algo antes de finalizar

---

## Módulo 3 — Pedidos e Itens

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-015 | Adiciona item à comanda | dado `productId` e quantidade | persiste `OrderItem` com `precoUnit` e `custoUnit` (snapshot do produto no momento) e recalcula `Order.total` |
| RF-016 | Remove item da comanda | dado `itemId`, comanda ainda `PENDENTE` | exclui o item e recalcula o total |
| RF-017 | Finaliza comanda com pagamento simples ou dividido | dado array de pagamentos `{forma, valor, bandeira?}` cuja soma bate com o total menos desconto, chamado por CAIXA/SUPERVISOR/ADMIN | seta `paymentStatus=FECHADO`, `closedAt`, calcula `formaPagamento` (maior valor) e `pagamentosSplit` (se houver mais de uma forma), calcula `taxaTotal` — botão "Finalizar Comanda" na tela, imprime o cupom de pagamento via `window.print()` na máquina de quem finalizou (Módulo 8). *(Renomeado de "Fecha comanda" em 2026-09-05 — ver RF-117/RN-061: fechar e finalizar viraram ações distintas)* |
| RF-018 | Deduz estoque no fechamento | dado comanda fechada com sucesso | para cada item, se o produto tem ficha técnica, decrementa `Ingredient.quantidadeAtual` de cada insumo proporcionalmente e registra `MovimentacaoEstoque` tipo VENDA; produtos sem ficha técnica mas com `trackInventory=true` decrementam o próprio `Product.estoque` |
| RF-019 | Cancela comanda | dado `orderId` sem itens fechados | seta `paymentStatus=CANCELADO`, libera a mesa se for tipo MESA |
| RF-020 | Aplica desconto | dado valor de desconto informado no fechamento | subtrai do total antes de validar a soma dos pagamentos |
| RF-087 | Seleciona quantidade ao adicionar item | dado clique num produto do catálogo | abre seletor com +/- (padrão 1) antes de lançar o item — evita precisar clicar o produto N vezes para lançar quantidade N |
| RF-088 | Ajusta quantidade de item já lançado | dado item ainda `status=PENDENTE` (cozinha não marcou pronto) na comanda | botões +/- no próprio item recalculam `subtotal` (`precoUnit × novaQuantidade`) e o total da comanda; item já `PRONTO` não pode mais ter a quantidade alterada, só removido |
| RF-118 | Altera o preço unitário de um item já lançado | dado clique no valor de um item na tela da comanda, por CAIXA/SUPERVISOR/ADMIN | `PATCH /api/orders/[id]/items/[itemId] { precoUnit }` recalcula `subtotal = precoUnit × quantidade` e o total da comanda; ATENDENTE não vê o controle de edição (nem consegue via chamada direta — `guardCaixa()` no servidor) |
| RF-119 | Digita a quantidade e adiciona com Enter | dado seletor de quantidade aberto (RF-087) ou campo de busca de produto na tela da comanda | além dos botões +/-, o campo de quantidade aceita digitação direta (teclado numérico no celular); Enter no campo de busca abre o seletor do primeiro produto filtrado, e Enter dentro do seletor (com opcionais obrigatórios satisfeitos) já adiciona o item à comanda, sem precisar clicar em "Adicionar à comanda" |

#### Regras de negócio
- **RN-009:** `precoUnit` e `custoUnit` são capturados no momento da adição do item — mudança de preço/custo no cardápio depois não afeta itens já lançados
- **RN-010:** Dedução de estoque só acontece no **fechamento** da comanda, nunca na adição do item — decisão explícita para evitar estorno complexo em caso de remoção de item antes de fechar
- **RN-011:** A soma dos valores informados no split payment precisa bater com o total (menos desconto) em até R$0,01 de tolerância — senão a API rejeita o fechamento
- **RN-044:** Quantidade de um item só é editável enquanto `status=PENDENTE` — depois que a cozinha marca como pronto (RF-039), a quantidade fica travada (só dá para remover o item inteiro), para não descasar do que já foi fisicamente preparado
- **RN-063 (2026-09-05):** Alterar o preço de um item (RF-118) e aplicar desconto no fechamento (RF-020) são restritos a CAIXA/SUPERVISOR/ADMIN — reforçado no servidor via `guardCaixa()` em `PATCH .../items/[itemId]` (quando o body inclui `precoUnit`), `POST .../close` e `PATCH /api/orders/[id]` (quando o body inclui `desconto`), não só escondido na UI

---

## Módulo 4 — Cardápio (Produtos)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-021 | Lista todos os produtos ativos, de qualquer categoria | dado acesso a `/produtos`, `/mesas`, `/balcao` ou `/cmv` | retorna todos os produtos (filtrados por `ativo=true` quando solicitado), com a ficha técnica (`recipeItems.ingredient`) completa, ordenados por nome — sem exclusão por categoria nem por `trackInventory` (corrigido em 2026-08-07; nenhuma categoria, incluindo "Espetinhos Crus", fica de fora) |
| RF-022 | Cria produto | dado nome, categoria e preço (quem tem a permissão `produtos`) | persiste com `costPrice=0` e `costPriceManual=false` por padrão |
| RF-023 | Edita produto | dado id e campos a atualizar (quem tem `produtos`) | atualiza os campos enviados |
| RF-024 | Ativa/desativa produto | dado toggle de status (quem tem `produtos`) | alterna `Product.ativo` |
| RF-025 | Exibe cardápio em modo visualização | dado usuário sem a permissão `produtos` | mesma tabela de produtos, sem botões de criar/editar/excluir/ficha técnica |
| RF-092 | Marca produto como "sem preparo de cozinha" | dado checkbox "Enviar para a cozinha" desmarcado na criação/edição do produto | `Product.enviaParaCozinha=false` — o item nunca aparece na fila do KDS (RF-090) quando lançado numa comanda |
| RF-127 | Oferece as categorias configuradas ao cadastrar/editar produto | dado formulário de produto aberto | o `<select>` de categoria vem da lista de Configurações → Categorias do Cardápio (RF-126), **não** de uma constante fixa — as mesmas categorias usadas pra agrupar o cardápio em Mesas/Balcão. Produto antigo cuja categoria saiu da lista continua aparecendo como opção "solta" |
| RF-128 | Já desmarca "Enviar para a cozinha" para categoria sem preparo | dado que a categoria escolhida no formulário tem `vaiParaCozinha=false` (ex.: Bebidas) | o checkbox "Enviar para a cozinha" entra desmarcado (`enviaParaCozinha=false`); o usuário ainda pode alternar na mão antes de salvar. Trocar de categoria reavalia o padrão |

#### Regras de negócio
- **RN-012 (revisada em 2026-09-06):** Criar/editar/excluir/ativar produto exige a permissão `produtos` — reforçado na API via `guardPermissao("produtos")` (antes era `guardGestor()`, só ADMIN/SUPERVISOR). Quem não tem a permissão vê o cardápio só em leitura
- **RN-013:** Produto não pode ser excluído se já tiver `OrderItem` vinculado — precisa ser desativado em vez de excluído
- **RN-069 (2026-09-06):** As categorias do cardápio são uma lista única e configurável (`ConfiguracaoGeral["categorias_cardapio"]`, RF-126) — a mesma fonte alimenta o `<select>` do formulário de produto (RF-127) e a ordenação dos chips de categoria em Mesas/Balcão. Cada categoria tem `vaiParaCozinha` (default do `enviaParaCozinha` de produtos novos, RF-128/RN-046). `Product.categoria` continua string livre: remover uma categoria não mexe nos produtos que já a usavam

---

## Módulo 5 — CMV (Cálculo de Cardápio)

Aba própria, separada do Cardápio — diferente do vilamill (custo manual) e do sistema-thieco (que não tem CMV).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-026 | Calcula CMV automaticamente | dado produto com ficha técnica (`RecipeItem[]`) | `costPrice = Σ (recipeItem.quantidade × ingredient.custoUnitario)` |
| RF-027 | Recalcula ao editar ficha técnica | dado `RecipeItem` criado/editado/removido | recalcula o `costPrice` daquele produto imediatamente |
| RF-028 | Recalcula em lote ao editar custo de insumo | dado `Ingredient.custoUnitario` alterado | recalcula o `costPrice` de todos os produtos cuja ficha técnica usa aquele insumo |
| RF-029 | Permite custo manual | dado produto marcado `costPriceManual=true` (ex.: bebida revendida sem ficha técnica) | o recálculo automático ignora esse produto — custo é o valor digitado |
| RF-030 | Exibe markup e margem por produto | dado `preco` e `costPrice` do produto | calcula `markup = preco / custo` e `margem = (preco - custo) / preco`, com cor condicional (verde ≥65%, âmbar 40–65%, vermelho <40%) |
| RF-031 | Sugere preço por margem-alvo | dado clique em "Preço sugerido" | calcula `preco = custo / (1 - margemAlvo)` (margem-alvo padrão 65%) e aplica com um clique |
| RF-032 | Exibe resumo do cardápio | dado acesso a `/cmv` | cards de margem média do cardápio, produto com melhor e pior margem |

#### Regras de negócio
- **RN-014:** CMV é sempre **derivado**, nunca digitado à mão, exceto quando `costPriceManual=true`
- **RN-015:** `/cmv` é exclusivo de ADMIN — nem SUPERVISOR acessa, por ser dado de margem/estratégia

---

## Módulo 6 — Estoque (Insumos)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-033 | Lista insumos com alerta visual | dado acesso a `/estoque` | retorna insumos com badge "Baixo" quando `quantidadeAtual <= nivelMinimoAlerta` |
| RF-034 | Cria/edita insumo | dado nome, unidade (KG/UN/L), quantidade e nível mínimo (ADMIN/SUPERVISOR) | persiste/atualiza o insumo |
| RF-035 | Registra ajuste manual de estoque | dado `delta` informado (entrada ou saída manual) | incrementa/decrementa `quantidadeAtual` e cria `MovimentacaoEstoque` (ENTRADA ou AJUSTE) |
| RF-036 | Exibe estoque em modo visualização | dado role CAIXA | mesma tabela, sem botão de criar/editar (ATENDENTE não tem acesso a `/estoque` de forma alguma) |
| RF-076 | Exibe valor total em estoque | dado acesso a `/estoque` (só role ADMIN) | card soma `quantidadeAtual × custoUnitario` de todos os insumos exibidos na tabela — placeholder ("—") enquanto os dados ainda não carregaram, para não divergir entre servidor e cliente na primeira renderização |
| RF-077 | Filtra insumos por nome | dado texto digitado no campo de busca | filtra a tabela por nome (case-insensitive, contém) e recalcula o card de valor total só com os insumos filtrados — permite ver o valor parado de um insumo específico |
| RF-089 | Oculta valor monetário do estoque para não-ADMIN | dado acesso a `/estoque` por SUPERVISOR ou CAIXA | card "Valor total em estoque" e coluna "Custo unitário" somem da tela — só permanecem Insumo, Qtd. atual, Alerta mín. e badge "Baixo" (dados de quantidade, não de custo) |
| RF-104 | Registra entrada rápida de estoque | dado clique no botão de entrada (ícone de caixa) na linha de um insumo (ADMIN/SUPERVISOR), quantidade a somar informada (custo unitário opcional) | `POST /api/ingredients/[id]/entrada` incrementa `quantidadeAtual` atomicamente, atualiza `custoUnitario` se informado, cria `MovimentacaoEstoque` tipo ENTRADA com motivo "Entrada rápida de estoque (Recomposição)" — sem precisar abrir o formulário completo de edição do insumo |
| RF-105 | Corrige o custo do insumo pelo rendimento após limpeza/perda | dado `Ingredient.rendimentoPercentual` menor que 100 (ex.: carne com perda de aparas) | CMV de qualquer produto que usa esse insumo é calculado com o custo efetivo (`custoUnitario / (rendimentoPercentual / 100)`), não o custo bruto de compra |

#### Regras de negócio
- **RN-016:** Apenas ADMIN e SUPERVISOR criam/editam insumos — reforçado na API
- **RN-017:** Insumo não pode ser excluído se estiver em uso em alguma ficha técnica
- **RN-038:** O card de valor total nunca formata moeda antes de `isLoading=false` — evita mismatch de hidratação causado por diferença de `Intl`/ICU entre o Node do servidor e o navegador na primeira renderização (bug real observado e corrigido nesta sessão)
- **RN-045:** Valor em R$ do estoque (card de total e coluna de custo unitário) é exclusivo do role ADMIN — SUPERVISOR mantém acesso de edição ao estoque (RN-016), mas sem visibilidade de custo/valor monetário
- **RN-052:** Entrada rápida (RF-104) rejeita quantidade ≤ 0 (HTTP 400) e exige o mesmo papel (ADMIN/SUPERVISOR) já exigido para editar insumo — não é uma via alternativa sem controle de acesso

---

## Módulo 7 — Cozinha (KDS)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-037 | Exibe fila de pendentes em tempo real | dado acesso a `/cozinha` | renderiza um card por comanda com itens `status=PENDENTE` de produtos com `enviaParaCozinha=true`, atualizado a cada 2s via SWR |
| RF-130 | Identifica cada card do KDS por mesa/comanda **e nome do cliente** | dado card na fila do KDS, na lista de Concluídos ou no seletor de filtro | mostra "Mesa N" / "Comanda #N" e, quando `Order.clienteNome` está preenchido, o nome do cliente logo abaixo/ao lado (`identificacaoPedido()` concatena `— <clienteNome>`). Antes de 2026-09-06 o card só mostrava o número |
| RF-038 | Sinaliza urgência por tempo de espera | dado item pendente mais antigo do card | borda neutra (<8min), âmbar (8–14min) ou vermelha (≥15min) |
| RF-039 | Marca item como pronto | dado clique em "✓ PRONTO" | seta `status=PRONTO` e `prontoEm=now()`; item sai da aba Pendentes e entra em Concluídos |
| RF-040 | Exibe histórico de concluídos do dia | dado aba "Concluídos" | lista itens com `prontoEm >= hoje 00:00`, reset diário implícito via filtro de data |
| RF-041 | Exibe marca no cabeçalho do KDS | dado qualquer acesso a `/cozinha` | header dark (zinc-950) mostra "Jocley Grill" no canto superior esquerdo, independente do papel logado (COZINHA não tem sidebar/navbar — o próprio KDS é a tela inteira) |
| RF-090 | Exclui itens sem preparo da fila da cozinha | dado item cujo `Product.enviaParaCozinha=false` (ex.: refrigerante, item revendido pronto) | nunca aparece em Pendentes nem em Concluídos do KDS — nem entra na fila, nem precisa ser marcado como pronto |
| RF-091 | Filtra a fila por mesa/comanda específica | dado seletor de mesa/comanda no cabeçalho do KDS | mostra só os itens (pendentes + já prontos) daquele pedido — usado como comprovante do que a cozinha recebeu, em caso de atrito sobre o que foi ou não pedido |
| RF-110 | Renderiza a ficha de produção/bebida de um item, segmentada por papel | dado item incluído numa ficha (Confirmar Pedido, RF-123, ou reimpressão avulsa, RF-111) | o servidor **renderiza** o item em ESC/POS (quantidade, item, observações, **mesa/comanda com nome do cliente quando informado**, horário). `Product.enviaParaCozinha=true` → papel `PRODUCAO_COZINHA`; `enviaParaCozinha=false` (bebida/drink) → papel `CAIXA`. *(Revisado em 2026-09-05 duas vezes: primeiro ganhou o papel `CAIXA`; depois, no mesmo dia, deixou de enfileirar sozinho a cada item lançado — ver RF-123/RN-058. A impressão física é feita pelo Agente, RF-116)* |
| RF-111 | Reenvia a ficha manualmente pelo KDS | dado clique em "Imprimir novamente" (por item, ficha avulsa) ou "Reimprimir" (por comanda) no `/cozinha` | `POST /api/kds/reimprimir` **enfileira de novo**. "Por comanda" desde 2026-09-05 manda **uma ficha só, consolidada** com todos os itens de cozinha pendentes (antes enfileirava uma ficha por item — mesmo problema de "sai picado" do RF-123). A tela mostra sucesso/erro efêmero. Continua exclusivo dos itens de Cozinha (`enviaParaCozinha=true`) — não reenvia bebidas |
| RF-123 | Confirma pedido — envia tudo que falta numa ficha só por destino | dado clique em "Confirmar Pedido" na tela da comanda, com pelo menos 1 item ainda não enviado (`OrderItem.enviadoImpressaoEm=null`) | agrupa os itens pendentes por destino (Cozinha e/ou Caixa, conforme `enviaParaCozinha`) e enfileira **uma única ficha consolidada por destino** ("PEDIDO - COZINHA" / "PEDIDO - BAR / BEBIDAS"), em vez de uma ficha por item — resolve o pedido saindo picado em várias folhas. Marca os itens incluídos como enviados assim que o job entra na fila, e **espera até ~12s a confirmação do Agente** antes de responder, devolvendo pra tela se saiu (`IMPRESSO`), falhou (`ERRO`, com o motivo) ou ainda está na fila esperando o agente (`PENDENTE`) — resolve o segundo problema, de ninguém saber se imprimiu de verdade |
| RF-124 | Sinaliza visualmente o que ainda não foi enviado | dado item na lista da comanda cujo `enviadoImpressaoEm` é `null` | mostra uma bolinha ao lado do nome do item; o botão "Confirmar Pedido" mostra a contagem de itens pendentes (ex.: "Confirmar Pedido (3)") e fica desabilitado quando não há nada novo pra enviar |
| RF-116 | Imprime as fichas enfileiradas via Agente de Impressão | dado o Agente de Impressão rodando no PC do caixa | faz polling em `GET /api/impressao/fila` (Bearer `IMPRESSAO_AGENT_TOKEN`); por job, se `tipo=REDE` abre socket TCP no IP/porta e escreve os bytes (impressora da Cozinha, sempre; impressora do Caixa quando cadastrada como rede), se `tipo=USB_LOCAL` grava os bytes num arquivo temporário e executa `copy /b` para `\\localhost\<compartilhamento>` (impressora do Caixa ligada por cabo USB no próprio PC — RF-121); reporta em `PATCH /api/impressao/fila/[id]` (`ok` → IMPRESSO; `erro` → nova tentativa, 3× → ERRO). A aba Configurações → Impressoras mostra "Agente: online/offline" pelo heartbeat `agenteVistoEm` de cada impressora. *(Revisado em 2026-09-05 — antes só sabia imprimir via socket de rede)* |
| RF-120 | Imprime a ficha de bebida/drink no Caixa | dado item cujo `Product.enviaParaCozinha=false` incluído num "Confirmar Pedido" (RF-123), com uma `Impressora(papel=CAIXA, ativa)` cadastrada | segue o mesmo mecanismo fila+Agente de RF-110/RF-116 — antes de 2026-09-05 um item sem preparo (bebida) simplesmente não disparava impressão nenhuma |

#### Regras de negócio
- **RN-018:** KDS só exibe itens de comandas com `paymentStatus=PENDENTE`
- **RN-019:** A baixa (PRONTO) é por item individual, não por comanda inteira
- **RN-020:** COZINHA não tem acesso a nenhuma outra tela do sistema — isolamento total por role
- **RN-046 (revisada em 2026-09-06):** `Product.enviaParaCozinha` é decidido no cadastro do produto (Módulo 4) e continua editável na mão. O **default** agora vem da categoria escolhida: `true` se a categoria tem `vaiParaCozinha=true`, `false` se não (ex.: Bebidas) — RF-128. Antes o default era sempre `true` e o sistema não olhava a categoria; agora sugere pela categoria, mas não força — quem cadastra ainda pode alternar antes de salvar
- **RN-058 (revisada em 2026-09-05 — antes dizia que o lançamento do item já enfileirava sozinho, fire-and-forget):** Lançar um item **não** enfileira nada mais — só fica marcado como pendente de envio (`enviadoImpressaoEm=null`). Quem enfileira é sempre uma ação explícita: "Confirmar Pedido" (RF-123) ou "Reimprimir"/"Imprimir novamente" (RF-111). Sem impressora ativa cadastrada para o papel correspondente, nada é enfileirado, a falha vai pra `ErrorLog` e os itens **não** são marcados como enviados (ficam disponíveis pra tentar de novo no próximo "Confirmar Pedido"). Job `PENDENTE` na fila por mais de 30 min é descartado (→ `ERRO` + `ErrorLog`) — ficha fria não sai. O KDS em tela (`/cozinha`) continua sendo a fonte primária de acompanhamento da Cozinha; a ficha impressa é complemento
- **RN-059 (revisada em 2026-09-05 — antes dizia "só a impressora de rede da Cozinha, nunca a do Caixa"):** A impressão (RF-110/RF-120/RF-123) sai **só via o Agente de Impressão** (RF-116) — o servidor nunca abre socket nem toca em USB. Nunca usa `window.print()`. Existem hoje dois papéis de impressora (`PRODUCAO_COZINHA` e `CAIXA`, RF-121) — cada item vai pra um dos dois conforme `enviaParaCozinha` (RN-064). Se o agente estiver offline, os jobs ficam na fila até serem impressos ou expirarem
- **RN-067 (2026-09-05):** Apertar "Fechar Comanda" (RF-117) ou "Finalizar Comanda" (RF-017) sem ter apertado "Confirmar Pedido" antes **não perde os itens pendentes** — os dois fluxos chamam o mesmo envio consolidado (RF-123) por baixo, silenciosamente, antes de prosseguir. Evita o cenário de a cozinha nunca saber que um item existiu porque a atendente esqueceu de confirmar
- **RN-068 (2026-09-05):** Um item é marcado como enviado (`enviadoImpressaoEm`) assim que o job entra na `FilaImpressao` — **não** espera a confirmação física do Agente. Isso evita reimprimir em dobro quando o Agente demora a confirmar dentro da janela de espera do RF-123 (~12s); em compensação, se a impressão falhar de verdade (`ERRO` ou Agente offline), o item já consta como enviado e só volta a ser reimpresso via o botão manual do KDS (RF-111, exclusivo de itens de Cozinha — bebidas não têm reenvio manual ainda)
- **RN-060:** `/api/impressao/*` (rotas do agente) não passa pelo gate de sessão do middleware — autentica só pelo token compartilhado `IMPRESSAO_AGENT_TOKEN` (`guardAgenteImpressao`). Sem o token configurado no servidor, respondem 503; token errado → 401. É o único ponto do sistema que autentica sem sessão NextAuth
- **RN-064 (2026-09-05):** O papel de impressora de um item (RF-110/RF-120) é decidido só por `Product.enviaParaCozinha` — não existe categoria/flag separada para "bebida". A ficha de conta (RF-117, Módulo 2) também sai sempre no papel `CAIXA`, independente do tipo de item da comanda

---

## Módulo 8 — Cupom Térmico

> **Já implementado e testado** — não é item pendente. Confirmado no fluxo real de fechamento de comanda (Fase 3 da construção).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-042 | Imprime cupom ao fechar comanda | dado fechamento de comanda concluído com sucesso | monta `DadosCupom` (identificação, código curto, nome do cliente se houver, itens, subtotal, desconto, total, pagamentos) e dispara `window.print()` |
| RF-043 | Formata para bobina térmica 80mm | dado impressão disparada | `@page { size: 80mm auto; margin: 0 }` injetado via `<style>` escoped dentro do próprio componente `CupomImpressao` — não é uma regra CSS global |
| RF-044 | Isola o cupom do restante da página | dado modo impressão ativo | `body * { visibility: hidden }` + `.print-area { visibility: visible; position: absolute }` — só o cupom aparece na folha impressa. *(Corrigido em 2026-09-05 — era `position: fixed`, ver RN-065)* |
| RF-107 | Exibe código curto da comanda no cupom | dado cupom montado no fechamento | imprime "Cód: XXXXXX" (6 últimos caracteres do `Order.id`, maiúsculas) abaixo da identificação da mesa/comanda, para facilitar localizar o pedido no sistema em caso de conferência |
| RF-112 | Imprime o cupom em preto sólido e fonte grossa | dado cupom montado (fechamento ou reimpressão) | CSS escopado em `.cupom-termico`: `color:#000` puro, `print-color-adjust:exact` (impede o navegador de clarear a tinta), `font-weight:700`, `-webkit-font-smoothing:none`, fonte monoespaçada (Courier), corpo 12.5pt — para o cupom sair legível como os de iFood/99 na mesma impressora cabeada. Página `/cupom-teste` (ADMIN) permite comparar o modelo antigo e o novo lado a lado |

#### Regras de negócio
- **RN-021:** O `@page { size: 80mm }` é escopado ao componente do cupom (via `<style>` inline), não é uma regra global do CSS do sistema — isso evita que a impressão do DRE (relatório A4, Módulo 10) herde o tamanho de bobina térmica. Esse isolamento foi uma decisão de arquitetura específica desta lanchonete: o vilamill-sistema original, que só imprime cupom (nunca A4), usa a regra `@page` diretamente no CSS global — aqui não daria certo por causa do DRE
- **RN-022:** **O cupom do Caixa** é impresso puramente via CSS `@media print` + `window.print()` — sem driver, IP de impressora ou socket. (A ficha de produção da Cozinha, Módulo 7 RF-110, é o oposto: server-side via socket ESC/POS. São dois caminhos de impressão distintos, desde 2026-09-02 — ver RN-059 e Registro de Decisões 2026-09-02)
- **RN-054:** *(revisada em 2026-09-02 — a de 2026-08-23 dizia "não existe e não está planejada impressão de ficha física para a cozinha")* Passou a existir impressão de ficha física de produção para a Cozinha, via impressora de **rede** (ESC/POS; desde 2026-09-03 por fila `FilaImpressao` + Agente de Impressão no PC do caixa — Módulo 7 RF-110/RF-111/RF-116, entidade `Impressora`). O KDS (`/cozinha`, Módulo 7) continua sendo a fonte primária de acompanhamento em tempo real; a ficha impressa é complemento e nunca bloqueia o fluxo. A impressora do Caixa continua exclusiva do cupom de fechamento
- **RN-055:** O código curto (RF-107) é derivado do `Order.id` em tempo de impressão — não é um campo persistido no schema, não pode ser usado como identificador oficial em integrações futuras (usar `Order.id` completo nesses casos)
- **RN-065 (2026-09-05):** Cliente reportou o cupom do Caixa saindo duplicado/triplicado (mesmas informações repetidas em mais de uma folha) em comandas com itens suficientes para não caber numa folha só. Causa raiz: `position: fixed` em mídia paginada é **repetido em toda página impressa** por especificação de CSS — quando o driver da impressora não respeita à risca o `@page { size: 80mm auto }` (RF-043) e quebra o cupom em mais de uma página física, o navegador reimprimia o `.print-area` inteiro em cada página extra. Corrigido trocando para `position: absolute` (RF-044) — o conteúdo aparece uma única vez e flui normalmente entre páginas, sem repetição. Sem impressora física disponível para reproduzir o bug durante a correção — validação ficou por conta do raciocínio de especificação + teste do cliente em produção

---

## Módulo 9 — Financeiro (Dashboard / Início)

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-045 | Exibe cards de resultado do dia | dado acesso à Início (ADMIN) | Receita Bruta, CMV, Despesas, Resultado, Pedidos Fechados, Ticket Médio, Mesas Abertas Agora, Receita Líquida — mesmo layout de cores do vilamill (verde/vermelho/laranja/azul) |
| RF-046 | Exibe receita por forma de pagamento | dado comandas fechadas no período | soma por forma (Dinheiro/Crédito/Débito/Pix/Voucher/Nota), considerando `pagamentosSplit` quando presente |
| RF-047 | Filtra por período | dado seletor Hoje / 7 dias / Mês (ou datas customizadas) | recalcula todos os cards para o intervalo selecionado |
| RF-048 | Calcula Resultado descontando taxa de pagamento | dado `Order.taxaTotal` de cada comanda fechada | `Resultado = Receita Bruta − CMV − Despesas − Taxa de Pagamento` |

#### Regras de negócio
- **RN-023:** `/` (Início) é exclusivo de ADMIN — os demais papéis são redirecionados para a própria home operacional
- **RN-024:** `Receita Líquida = Receita Bruta − Taxa de Pagamento total do período`

---

## Módulo 10 — Inteligência Financeira

Reaproveita o conceito do sistema-thieco, com pico de horário como funcionalidade nova (nenhum dos dois sistemas de referência tinha isso pronto).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-049 | Exibe ranking de formas de pagamento | dado período selecionado | soma por forma com percentual de participação, ordenado decrescente |
| RF-050 | Exibe ranking de pratos mais vendidos | dado período selecionado | agrupa `OrderItem` por produto, soma quantidade e faturamento, ordenado por faturamento |
| RF-051 | Exibe pico de horário | dado período selecionado | agrega comandas fechadas por hora (0–23, pela hora de abertura `createdAt` em fuso America/Sao_Paulo) e destaca a hora com mais comandas |
| RF-132 | Detalha um horário ao clicar na barra | dado clique numa barra do gráfico de Pico de Horário | abre um painel com o detalhe daquele horário: nº de comandas, **ticket médio** (receita ÷ comandas), receita e a **quebra por forma de pagamento** (valor + %, split-aware — mesmo critério de `receitaPorFormaPagamento` do RF-049). A barra clicada fica destacada; clicar de novo (ou no ×) fecha. Horário sem comanda mostra "Nenhuma comanda fechada nesse horário" |
| RF-052 | Exibe ticket médio por caixa | dado período selecionado | agrupa `Order.total` por `caixaNome`, calcula média |
| RF-053 | Exibe projeção de faturamento e break-even | dado mês corrente | soma acumulada diária real de receita e despesa, projeta os dias restantes pela média diária, identifica o dia em que a receita acumulada ultrapassa a despesa acumulada |
| RF-054 | Exporta DRE | dado clique em "Extrair DRE" | abre página isolada (`/inteligencia/dre`) com receita bruta/líquida, CMV, taxas, despesas por categoria, receita por forma e detalhamento de produtos, pronta para impressão A4 |
| RF-078 | Calcula projeção de metas por quantidade de vendas | dado quantidade de vendas desejada e canal (Presencial/iFood/99/Motoboy/Outros Delivery) | distribui a quantidade proporcionalmente ao mix histórico de vendas do período selecionado (por produto), calcula receita bruta, desconta a taxa do canal (`TaxaDelivery`), desconta CMV projetado e exibe lucro bruto e margem — mostra quanto vender de cada produto ativo para atingir a meta |

#### Regras de negócio
- **RN-025:** `/inteligencia` (e a sub-rota `/inteligencia/dre`) é exclusiva de ADMIN
- **RN-026:** Pico de horário é calculado em memória (agregação em JavaScript por hora), não via SQL raw — decisão consciente de simplicidade dado o volume de uma lanchonete, não de uma rede. Desde 2026-09-07 o endpoint já devolve, por hora, `ticketMedio` e `formasPagamento` (RF-132) no mesmo passo — o drill-down não faz chamada de API própria, é só estado de tela sobre a resposta que já veio
- **RN-027:** A impressão do DRE esconde sidebar/navbar/botões via `print:hidden` (utilitário Tailwind), não via `@page` — diferente do cupom (RN-021), porque o DRE precisa do tamanho de página padrão (A4/Letter) escolhido pelo usuário na impressora, não uma bobina fixa
- **RN-039:** Sem histórico de vendas no período selecionado, a Calculadora de Metas distribui a quantidade desejada igualmente entre os produtos ativos (fallback), com aviso visível na tela

---

## Módulo 11 — Despesas

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-055 | Registra despesa | dado descrição, valor, categoria, data e, opcionalmente, nome do cliente | persiste com `registradoPor` = nome da sessão; `clienteNome` é opcional e sem validação |
| RF-056 | Registra despesa recorrente | dado `recorrente=true` e frequência (semanal/mensal/anual) | cria a despesa origem + 11 ocorrências futuras na mesma frequência, vinculadas por `despesaOrigemId` (o `clienteNome` informado é replicado em todas as ocorrências) |
| RF-057 | Edita despesa recorrente com escolha de escopo | dado edição de uma despesa que pertence a uma série | pergunta se aplica só a esta ocorrência ou a esta e as futuras da série |
| RF-058 | Exclui despesa recorrente com escolha de escopo | dado exclusão de uma despesa que pertence a uma série | mesma pergunta de escopo do RF-057 |
| RF-108 | Exibe e filtra despesas por nome do cliente | dado acesso a `/despesas` | coluna "Cliente" na listagem + campo de busca que filtra as linhas do período pelo `clienteNome` (filtro client-side, mesmo padrão de Produtos/Estoque) |

#### Regras de negócio
- **RN-028:** `despesaOrigemId` usa `onDelete: SetNull` — excluir a origem de uma série nunca quebra por violação de chave estrangeira, as ocorrências restantes só perdem o vínculo
- **RN-029:** `/despesas` é acessível a ADMIN e SUPERVISOR
- **RN-056:** `Despesa.clienteNome` (adicionado em 2026-09-02) é campo livre opcional — não referencia `NotaCliente` nem `Order`, é só um rótulo para consulta/filtro. Trim aplicado no servidor; string vazia vira `null`

---

## Módulo 12 — Lançamentos

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-059 | Lista comandas fechadas no período | dado acesso a `/lancamentos` com filtro de data | lista cada comanda (mesa ou balcão) com horário de fechamento, cliente (`Order.clienteNome`), itens, forma(s) de pagamento (com bandeira, se houver) e total |
| RF-109 | Reabre e reimprime o cupom de uma comanda fechada | dado clique numa linha da listagem de Lançamentos | abre modal com prévia do cupom; permite editar o nome do cliente ali (`PATCH /api/orders/[id]`, salva antes de imprimir se mudou) e reimprimir via `window.print()` — funciona com ou sem cliente informado. Reaproveita `CupomImpressao`, sem rota de dados nova |

#### Regras de negócio
- **RN-030:** `/lancamentos` é acessível a ADMIN e SUPERVISOR
- **RN-057:** A reimpressão do cupom (RF-109) sai idêntica à original (mesmo componente `CupomImpressao`, mesmo código curto derivado do `Order.id`) — não há marca de "2ª via". A impressora usada é a do dispositivo que abriu a tela (Caixa), via diálogo do SO — não é a impressora de rede da Cozinha

---

## Módulo 13 — Gestão de Time

5 sub-abas dentro de `/time`, nos moldes do sistema-thieco (que usa a mesma estrutura para a barbearia).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-060 | Cadastra funcionário | dado nome, cargo, telefone e percentual de comissão | persiste `Funcionario` |
| RF-061 | Registra feedback | dado funcionário, tipo (elogio/melhoria), categoria, título e descrição | persiste `Feedback` |
| RF-062 | Cria plano de ação (PDCA) | dado funcionário, título e etapa "Planejar" | persiste `PlanoAcao` com status PENDENTE |
| RF-063 | Avança status do plano de ação | dado clique em "Iniciar" ou "Concluir" | transiciona PENDENTE → EM_ANDAMENTO → CONCLUIDO |
| RF-064 | Registra sugestão | dado categoria, título, descrição e prioridade | persiste `Sugestao` com status ABERTA |
| RF-065 | Avança status da sugestão | dado clique em "Avançar" | transiciona ABERTA → EM_ANALISE → APROVADA → IMPLEMENTADA |
| RF-066 | Exibe timeline agregada | dado acesso à sub-aba Timeline | combina Feedback + PlanoAcao + Sugestao em uma lista cronológica única |

#### Regras de negócio
- **RN-031:** `/time` é acessível a ADMIN e SUPERVISOR
- **RN-032:** Sugestão não tem vínculo com funcionário — é um canal geral da equipe, diferente de Feedback e Plano de Ação

---

## Módulo 14 — Configurações

Por decisão explícita do escopo, expõe o que afeta o cálculo financeiro (taxas), notificações, impressão, e (desde 2026-09-06) as **mesas** e as **categorias do cardápio** — mais uma aba de suporte técnico restrita (RF-081).

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-067 | Lista tipos de notificação configuráveis | dado acesso à aba Notificações | 4 tipos: Faturamento, Produtos mais vendidos, Estoque parado, Estoque baixo — cada um com toggle ativo/inativo, periodicidade e horário de disparo |
| RF-068 | Configura taxa padrão por forma de pagamento | dado percentual informado para uma forma (ex.: Crédito) | persiste/atualiza `TaxaPagamento` com `bandeira=null` (taxa padrão da forma) |
| RF-069 | Configura taxa por bandeira (opcional) | dado forma Crédito ou Débito, bandeira selecionada (Visa, Mastercard, Elo, Hipercard, Diners, American Express, Outra) e percentual | persiste `TaxaPagamento` específico daquela combinação forma+bandeira — se não cadastrado, o fechamento usa a taxa padrão da forma |
| RF-070 | Remove taxa por bandeira | dado clique em excluir numa linha de bandeira cadastrada | remove aquele `TaxaPagamento` específico, voltando a valer a taxa padrão da forma para aquela bandeira |
| RF-079 | Configura taxa por canal de delivery | dado percentual informado para um canal (iFood, 99, Motoboy, Outros Delivery) | persiste/atualiza `TaxaDelivery` (um registro por canal, sem conceito de bandeira) |
| RF-080 | Alimenta a Calculadora de Metas com a taxa do canal | dado canal selecionado na Calculadora de Metas (Módulo 10) | usa o percentual de `TaxaDelivery` daquele canal para descontar da receita bruta projetada |
| RF-093 | Cadastra telefone de WhatsApp para notificações | dado número informado (com ou sem DDI 55) na aba Notificações | persiste em `ConfiguracaoGeral` (chave `whatsapp_telefone_notificacao`); número de 10/11 dígitos sem DDI recebe `55` automaticamente antes de qualquer envio |
| RF-094 | Envia mensagem de teste via WhatsApp | dado clique em "Enviar teste" com telefone cadastrado | dispara mensagem de confirmação via Evolution API; erro (API não configurada, número inexistente no WhatsApp, instância desconectada, sessão da Evolution quebrada etc.) aparece em mensagem clara na tela, não só como falha genérica ou JSON cru repassado |
| RF-095 | Desconecta telefone de WhatsApp | dado clique em "Desconectar" (com confirmação) num telefone já cadastrado | limpa o campo e salva vazio — nenhuma notificação é enviada até um novo número ser cadastrado |
| RF-096 | Dispara notificações agendadas automaticamente | dado notificação `ativo=true` cujo horário configurado (`horaDisparo`) já passou hoje (fuso America/Sao_Paulo) e ainda não foi disparada com frequência suficiente desde o último envio | monta o conteúdo (faturamento/ranking de produtos/estoque baixo/estoque parado) e envia via WhatsApp automaticamente, sem ação manual — checado a cada 60s por um agendador em processo (`src/instrumentation.ts`) |
| RF-097 | Respeita a periodicidade escolhida na frequência do disparo | dado periodicidade Diário/Semanal/Quinzenal/Personalizado configurada | só dispara de novo depois de passar o número de dias correspondente (1/7/15/`periodicidadeDias`) desde o último disparo — não só no conteúdo do relatório, também no intervalo entre envios |
| RF-098 | Configura intervalo em dias para periodicidade Personalizada | dado periodicidade = Personalizado selecionada | exibe campo "A cada quantos dias" — sem esse campo a periodicidade Personalizada não tinha como ser configurada de fato |
| RF-106 | Recusa enviar teste com a instância desconectada | dado clique em "Enviar teste" enquanto `statusInstanciaWhatsApp().estado !== "open"` | retorna erro claro pedindo reconexão (novo QR code) sem nem chamar `POST /message/sendText` da Evolution — evita uma tentativa fadada a falhar |
| RF-113 | Cadastra a impressora de rede da Cozinha | dado nome, IP, porta (default 9100) e toggle "ativa" na aba Impressoras | persiste/atualiza a entidade `Impressora` (upsert pelo `papel=PRODUCAO_COZINHA`); IP validado como IPv4 e porta como inteiro 1–65535, com mensagem clara se inválido |
| RF-114 | Testa a impressora de rede da Cozinha | dado clique em "Testar impressão" com a impressora já salva | enfileira um cupom de teste e aguarda até 12s o Agente confirmar — sucesso (saiu), erro (agente reportou falha) ou "agente não respondeu"; a tela mostra o resultado **sem stack técnico** e uma bolinha verde/vermelha |
| RF-121 | Cadastra a impressora do Caixa (bebidas + ficha de conta), em rede ou USB local | dado nome, tipo de conexão (Rede ou USB local) e, conforme o tipo, IP+porta ou nome do compartilhamento do Windows, na aba Impressoras | persiste/atualiza a entidade `Impressora` (upsert pelo `papel=CAIXA`) com `tipo=REDE` (exige IP+porta válidos) ou `tipo=USB_LOCAL` (exige nome de compartilhamento não vazio — a impressora precisa estar compartilhada no Windows do PC do caixa). *(RF-115, que dizia que a impressora do Caixa não se configurava aqui, foi substituído por este em 2026-09-05 — passou a existir uma impressora do Caixa configurável, distinta da impressora de pagamento do navegador/SO, ver RN-066)* |
| RF-122 | Testa a impressora do Caixa | dado clique em "Testar impressão" com a impressora do Caixa já salva | mesmo mecanismo do RF-114 (enfileira cupom de teste, aguarda até 12s a confirmação do Agente), usando o alvo certo conforme `tipo` (IP:porta ou compartilhamento) |
| RF-125 | Cria e remove mesas | dado clique em "Adicionar mesa" ou no ícone de remover, na aba Mesas (quem tem `configuracoes.mesas`) | "Adicionar" cria uma `Table` com o próximo número livre (`POST /api/tables`). "Remover" (`DELETE /api/tables/[id]`) só é permitido quando a mesa está `LIVRE` e sem comanda `PENDENTE`; comandas já fechadas ligadas a ela são desvinculadas (`mesaId=null`), não apagadas. A lista mostra o status atual de cada mesa |
| RF-126 | Edita a lista de categorias do cardápio | dado a aba Categorias do Cardápio (quem tem `configuracoes.categorias`) | CRUD da lista inteira (`PUT /api/configuracoes/categorias`, substitui tudo): nome + toggle "Vai para a cozinha" por linha, adicionar/remover linha, salvar. Persiste em `ConfiguracaoGeral["categorias_cardapio"]` (JSON). Rejeita lista vazia e nomes duplicados. Alimenta o formulário de produto (RF-127) e a ordenação dos chips em Mesas/Balcão |

#### Regras de negócio
- **RN-033 (revisada em 2026-09-06):** `/configuracoes` como página é alcançável por quem tem a permissão `configuracoes` (hoje, na prática, ADMIN) — a aba Logs de Erro (RF-081) é ainda mais restrita: só a conta `devmaster`. Cada sub-aba aparece conforme a permissão de subtópico (`configuracoes.notificacoes` / `.taxas` / `.impressoras` / `.mesas` / `.categorias`), e **desde 2026-09-06 essas mesmas chaves governam a autorização das rotas de API correspondentes** via `guardPermissao()` — não mais `guardGestor()` por papel. Ver RN-070
- **RN-070 (2026-09-06):** Autorização de API de gestão passou de papel (`guardGestor()`/`guardAdmin()`, removidos) para permissão granular (`guardPermissao(chave)` / `guardPermissaoQualquer(chaves[])` em `src/lib/api-guard.ts`) — ADMIN sempre passa; qualquer outro passa se tiver a chave (pelo padrão do papel ou por override do ADMIN). Mapa: Produtos→`produtos`, Insumos→`estoque`, Ficha Técnica→`produtos`|`cmv`, Configurações/Impressoras→`configuracoes.impressoras`, Configurações/WhatsApp→`configuracoes.notificacoes`, Configurações/Categorias→`configuracoes.categorias`, Mesas→`configuracoes.mesas`, Notas→`notas`. Fica **de fora, por papel de propósito**: `guardCaixa()` (separação atendente×caixa — finalizar comanda, alterar preço de item, desconto), os checks de `/api/users/*` (qual papel gerencia qual) e `guardDevmaster()` (`/api/error-logs`)
- **RN-071 (2026-09-06):** A remoção de mesa (RF-125) nunca apaga histórico de comanda — comandas `FECHADO`/`CANCELADO` ligadas à mesa têm o `mesaId` zerado antes do `DELETE`. Mesa com comanda `PENDENTE` (ou status ≠ `LIVRE`) não é removível
- **RN-072 (2026-09-06):** A lista de categorias (RF-126) nunca fica vazia — o `PUT` rejeita lista sem itens, e a leitura (`GET /api/configuracoes/categorias`, sem guard, usada por qualquer papel pra montar o cardápio) cai no padrão `CATEGORIAS_CARDAPIO_PADRAO` se a chave não existir ou estiver corrompida
- **RN-066 (2026-09-05):** A "impressora do Caixa" cadastrável em Configurações (RF-121, papel `CAIXA` — bebidas/drinks + ficha de conta, RF-117/RF-120) é uma entidade **diferente** da impressora de pagamento usada pelo `window.print()` no fechamento (Módulo 8, RN-022) — essa continua sendo escolhida pelo navegador/SO da máquina do caixa, sem cadastro nenhum. Na prática, costumam ser o **mesmo aparelho físico** (a térmica cabeada no PC do caixa), só que acessado por dois caminhos distintos: um pela fila+Agente (ESC/POS cru, USB local via compartilhamento do Windows ou rede), outro pelo diálogo de impressão do navegador (HTML renderizado)
- **RN-034:** Taxa por bandeira é **opcional** — nenhuma forma de pagamento exige bandeira cadastrada; o cálculo de `taxaTotal` no fechamento sempre cai de volta na taxa padrão da forma quando a bandeira informada não tem taxa própria
- **RN-035 (superada em 2026-08-04):** ~~O disparo real das notificações configuradas (RF-067) não está implementado~~ — implementado via Evolution API + agendador em processo (RF-096/RF-097), ver Registro de Decisões
- **RN-047:** Sem telefone cadastrado (RF-093), o agendador (RF-096) não tenta enviar nada — verifica a existência do telefone antes de montar qualquer mensagem, evitando processamento desperdiçado
- **RN-048:** Falha ao disparar uma notificação (ex.: Evolution API fora do ar num tick específico) não impede as demais notificações ativas de tentarem no mesmo ciclo — cada uma é isolada em try/catch própria no agendador
- **RN-053:** Estado `open` reportado por `statusInstanciaWhatsApp()` (RF-106) não garante sessão viva — a Evolution API pode devolver um erro interno do Baileys (`response.message[]` contendo `sendMessage`) mesmo com status `open`; esse caso específico é traduzido em mensagem amigável pedindo reconexão, nunca repassado como JSON cru

---

## Módulo 15 — Usuários

Tela que resolve a necessidade do dono de criar login para a equipe sem depender de deploy ("eu dou os acessos").

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-071 | Lista usuários cadastrados | dado acesso a `/usuarios` (ADMIN/SUPERVISOR) | lista nome, login, papel e status de todos os usuários |
| RF-072 | Cria usuário | dado nome, login, senha e papel (ADMIN) | persiste `User` com qualquer papel, incluindo ADMIN/SUPERVISOR |
| RF-073 | Cria usuário com papel restrito | dado nome, login, senha e papel (SUPERVISOR) | só aceita papel CAIXA, ATENDENTE ou COZINHA — API retorna 403 se o papel solicitado for ADMIN ou SUPERVISOR |
| RF-074 | Edita usuário | dado id e campos (nome, papel, senha, ativo) | ADMIN edita qualquer conta; SUPERVISOR só edita contas cujo papel atual seja CAIXA, ATENDENTE ou COZINHA, e só pode reatribuir para um desses três papéis |
| RF-075 | Desativa usuário | dado toggle de status | alterna `User.ativo` — usuário inativo não consegue mais autenticar |

#### Regras de negócio
- **RN-036:** A restrição de papel do SUPERVISOR (RF-073/RF-074) é reforçada no servidor (`/api/users`, `/api/users/[id]`) — não é só uma limitação de UI
- **RN-037:** Login (campo `email` no banco, usado como username) não pode ser alterado depois de criado
- **RN-040:** A conta `devmaster` nunca aparece em `/api/users` nem na tela de Usuários (filtrada explicitamente na query), e não pode ser editada nem por ADMIN via `PATCH /api/users/[id]` (bloqueio explícito no servidor, não só ausência de botão na UI)

---

## Módulo 16 — Tratamento e Registro de Erros

Nenhuma rota de API tinha tratamento de exceção até esta sessão — qualquer erro (do Prisma, de validação, de bug) vazava stack técnico cru pro cliente e não deixava rastro nenhum além do console efêmero do terminal. Este módulo cobre a infraestrutura que resolve isso, de ponta a ponta.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-082 | Converte exceção não tratada em resposta amigável | dado qualquer rota de API de negócio envolvida por `withErrorHandling` (todas exceto o handler do NextAuth) que lança exceção | responde `{ error: "mensagem em português" }` com status apropriado, nunca o stack técnico cru |
| RF-083 | Mapeia erros conhecidos do Prisma para mensagem específica | dado código de erro do Prisma (P2025 registro não encontrado, P2002 valor duplicado, P2003 violação de relacionamento) | mensagem amigável específica para o caso, em vez do genérico |
| RF-084 | Registra o erro técnico completo | dado qualquer exceção capturada | persiste em `ErrorLog` (rota, status, mensagem técnica, stack trace truncado, usuário logado, data) e também loga no console do servidor |
| RF-085 | Exibe erro amigável em tela quebrada (React) | dado erro de renderização em qualquer página, ou no layout raiz | `error.tsx`/`global-error.tsx` mostram mensagem amigável com botão "Tentar novamente", em vez da tela de erro crua do Next |
| RF-086 | Repassa mensagem amigável da API pro SWR | dado requisição SWR (`fetcher`) que recebe resposta de erro com corpo JSON | usa `body.error` como mensagem da exceção lançada no cliente, com fallback genérico se o corpo não tiver essa forma |
| RF-081 | Lista os últimos 100 erros registrados | dado acesso à aba Logs de Erro (Configurações), exclusivo da conta `devmaster` | lista rota, status, data, e permite expandir cada linha para ver mensagem técnica, usuário e stack trace completo |

#### Regras de negócio
- **RN-041:** `withErrorHandling` nunca altera lógica de negócio, formato de resposta de sucesso ou status code de erros já tratados explicitamente pela própria rota (ex.: um `return NextResponse.json({error}, {status:409})` já existente) — só captura o que **antes** quebrava sem tratamento nenhum
- **RN-042:** O handler do NextAuth (`/api/auth/[...nextauth]`) é o único endpoint de API deliberadamente fora de `withErrorHandling` — tem gerenciamento de erro próprio
- **RN-043:** Acesso a `/api/error-logs` exige especificamente a conta `devmaster` (`guardDevmaster()`), não apenas papel ADMIN/SUPERVISOR — único guard do sistema que checa identidade em vez de papel

---

## Módulo 17 — Permissões Granulares por Usuário

Até esta sessão, o controle de acesso era só por papel (5 roles fixos, allowlist de rota hardcoded no middleware). O cliente pediu poder configurar, por usuário individual, exatamente quais abas e subtópicos ele enxerga — este módulo é a camada que faz isso, **sem substituir** o RBAC por papel (RF-005/RF-006), só restringindo ainda mais dentro do que o papel já permitiria.

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-099 | Configura matriz de permissões por usuário | dado ADMIN abre "Permissões" na tela de Usuários para um usuário não-ADMIN | árvore de checkboxes com todas as abas do sistema e seus subtópicos (Gestão de Time: Equipe/Feedbacks/Planos de Ação/Sugestões/Timeline; Configurações: Notificações/Taxas/Impressoras/Mesas/Categorias do Cardápio) — salva um mapa completo `{chave: true/false}` |
| RF-100 | Aplica permissão granular no menu | dado usuário logado com permissão negada para uma aba/subtópico | item correspondente não aparece na Sidebar (ADMIN/SUPERVISOR) nem na Navbar (CAIXA/ATENDENTE) |
| RF-101 | Aplica permissão granular no acesso direto à página | dado usuário digita a URL de uma página sem permissão (não só sem o link no menu) | página redireciona para `/`, mesmo que o papel dele normalmente teria acesso à rota |
| RF-102 | Aplica permissão granular em subtópicos internos | dado usuário sem permissão para um subtópico específico (ex.: só "Notificações" dentro de Configurações, sem "Taxas") | a subaba correspondente não aparece na navegação por abas daquela tela |
| RF-103 | Restaura permissões padrão do papel | dado clique em "Restaurar padrão do papel" na matriz de um usuário | remove o override configurado — usuário volta a herdar exatamente o que o papel dele já liberava antes de qualquer customização |

#### Regras de negócio
- **RN-049 (nuance registrada em 2026-09-06):** Para **acesso a página**, permissão granular continua sendo restrição **adicional**, nunca ampliação — o middleware por papel bloqueia a rota antes da checagem granular (ex.: não dá pra abrir `/configuracoes` num CAIXA pela matriz). Para **ações de escrita de gestão**, porém, a autorização passou a ser a permissão granular (`guardPermissao()`, RN-070): conceder a chave `produtos` a um ATENDENTE — que já enxerga `/produtos` em leitura pelo padrão do papel — agora **libera de fato** o cadastro/edição de produto pra ele. É o comportamento pedido ("funcionalidade aparece pra quem tem a permissão"), mas é uma mudança de semântica em relação a antes, quando essas ações eram sempre `guardGestor()` (só ADMIN/SUPERVISOR) independentemente da matriz
- **RN-050:** Conta ADMIN nunca tem override de permissão configurável — sempre acesso total, para não haver risco de autolimitação acidental que trave a própria conta administradora
- **RN-051:** Usuário sem override configurado (`permissoesOverride=null`) usa os padrões do papel dele, idênticos ao comportamento do sistema antes deste módulo existir — zero regressão para quem nunca teve a matriz customizada

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Tempo real | Telas operacionais (mesas, balcão, financeiro, KDS) atualizam via SWR (polling 2–5s) sem recarregar a página |
| RNF-002 | Segurança | Sessão JWT via NextAuth v5 obrigatória em todas as páginas; senhas com bcryptjs; rotas de escrita sensíveis (produtos, insumos, ficha técnica, usuários) reforçadas no servidor, não só na UI |
| RNF-003 | Acessibilidade | Funciona em tablet e computador via navegador, sem instalação |
| RNF-004 | Integridade | Preço/custo do item são snapshot no momento da venda — não retroagem |
| RNF-005 | Isolamento de papel | Nenhum papel operacional (Caixa, Atendente, Cozinha) acessa telas ou dados financeiros estratégicos |

---

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| Mesa (TableStatus) | LIVRE, OCUPADA, CONTA | LIVRE → OCUPADA | abertura de comanda |
| Order (PaymentStatus) | PENDENTE, FECHADO, CANCELADO | PENDENTE → FECHADO | fechamento com pagamento |
| Order (PaymentStatus) | PENDENTE, FECHADO, CANCELADO | PENDENTE → CANCELADO | cancelamento |
| OrderItem (status, KDS) | PENDENTE, PRONTO | PENDENTE → PRONTO | clique em "✓ PRONTO" na cozinha |
| PlanoAcao (status) | PENDENTE, EM_ANDAMENTO, CONCLUIDO, CANCELADO | PENDENTE → EM_ANDAMENTO → CONCLUIDO | avanço manual no módulo Gestão de Time |
| Sugestao (status) | ABERTA, EM_ANALISE, APROVADA, IMPLEMENTADA, REJEITADA | ABERTA → EM_ANALISE → APROVADA → IMPLEMENTADA | avanço manual |

---

## Critérios de aceite gerais

- [ ] Atendente/Caixa abre mesa ou balcão, adiciona itens, fecha com split payment e cupom imprime corretamente
- [ ] Estoque de insumos é deduzido automaticamente após fechamento de comanda com ficha técnica configurada
- [ ] CMV de um produto muda automaticamente quando o custo de um insumo da sua ficha técnica é alterado
- [ ] Usuário ATENDENTE não consegue acessar `/estoque`, `/despesas`, `/inteligencia`, `/cmv`, `/configuracoes` nem `/usuarios` — nem por navegação nem por chamada direta de API de escrita
- [ ] Usuário SUPERVISOR não consegue criar nem editar uma conta ADMIN
- [ ] Comanda de balcão reinicia a numeração em `#1` no primeiro pedido de cada novo dia
- [ ] Taxa por bandeira, quando cadastrada, é usada no cálculo do fechamento em vez da taxa padrão da forma
- [ ] Produto com `enviaParaCozinha=false` nunca aparece na fila do KDS, mesmo lançado numa comanda ativa
- [ ] Usuário com permissão de aba negada não vê o item no menu **e** é redirecionado se acessar a URL direta
- [ ] Notificação ativa dispara sozinha no horário configurado, sem ação manual, respeitando a periodicidade (não dispara de novo antes do intervalo configurado)
