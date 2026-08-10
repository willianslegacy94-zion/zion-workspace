---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-12
owner: willians
---

# Design System — Villa Mill Tamboré PDV & Management

> Referência: [[prd-villamill]]

---

## 1. Princípios de design

São as decisões que governam qualquer escolha visual. Quando houver conflito entre duas opções, os princípios resolvem.

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| **Estado à primeira vista** | O operador precisa saber o estado de todas as mesas em menos de 1 segundo. Cor é linguagem — não decoração. | Verde = livre, vermelho = ocupada, vermelho escuro = aguardando fechamento — sem leitura necessária |
| **Ação > contemplação** | Telas operacionais não são dashboards analíticos. O caminho até a ação principal deve ter o mínimo de passos. | Clicar na mesa já navega para a comanda; botão "Fechar Conta" sempre visível sem scroll |
| **Toque sem erro** | PDV é operado em tablet, com pressa, durante o movimento. Elementos interativos são grandes e bem separados. | Botões de item no cardápio com área mínima de 48px; espaçamento entre ações críticas |
| **Feedback instantâneo** | Toda ação recebe resposta visual antes que o servidor confirme. Estado de loading nunca é silêncio. | Skeleton na grade de mesas ao atualizar; toast imediato após fechamento de pedido |
| **Números legíveis** | Valores financeiros são lidos em frações de segundo. Tamanho, peso e contraste garantem isso. | Total do pedido em tipografia grande e pesada; breakdown de formas de pagamento em peso secundário |

---

## 2. Fundamentos (tokens)

### Cores

| Token | Valor | Significado | Quando usar |
|---|---|---|---|
| `color-mesa-livre` | #22c55e (verde) | mesa disponível | fundo do card de mesa LIVRE |
| `color-mesa-ocupada` | #ef4444 (vermelho) | mesa com cliente | fundo do card de mesa OCUPADA |
| `color-mesa-conta` | #991b1b (vermelho escuro) | aguardando fechamento | fundo do card de mesa em CONTA |
| `color-primary` | #111827 (quase preto) | ação principal, fundo de navbar | botões CTA, navbar |
| `color-accent` | #f59e0b (âmbar) | alertas de estoque crítico, avisos | badge de estoque baixo |
| `color-surface` | #ffffff | fundo limpo | cards, modais, formulários |
| `color-bg` | #f9fafb | fundo de página | área de conteúdo |
| `color-feedback-success` | #16a34a | operação concluída | toast de pedido fechado, badge PAGO |
| `color-feedback-error` | #dc2626 | erro ou bloqueio | validação de campo, ação negada |
| `color-feedback-warning` | #d97706 | atenção | estoque crítico, vencimento próximo |
| `color-neutral-800` | #1f2937 | texto principal | corpo de texto, labels |
| `color-neutral-500` | #6b7280 | texto secundário | timestamps, metadados |
| `color-neutral-100` | #f3f4f6 | divisores sutis | linhas de tabela alternadas |

### Tipografia

| Token | Família | Tamanho | Peso | Uso |
|---|---|---|---|---|
| `type-heading-1` | Inter / system-ui | 24px | 700 | título de página |
| `type-heading-2` | Inter / system-ui | 18px | 600 | título de seção |
| `type-mesa-numero` | Inter / system-ui | 28px | 800 | número da mesa no card |
| `type-body` | Inter / system-ui | 14px | 400 | texto corrido, descrições |
| `type-label` | Inter / system-ui | 12px | 500 | labels de formulário, colunas |
| `type-value-lg` | Inter / system-ui | 22px | 700 | total do pedido, faturamento do dia |
| `type-value-sm` | Inter / system-ui | 16px | 600 | subtotais, valores de item |
| `type-caption` | Inter / system-ui | 11px | 400 | timestamps, IDs |

> Desde 2026-07-12, todos os tamanhos acima são escalados em ~12% em tela por um multiplicador global (`html { font-size: 112.5% }` em `globals.css`, escopado a `@media screen`) — os valores px da tabela são a referência nominal (base 16px), não o tamanho final renderizado. O cupom térmico impresso não é afetado (usa `@media print`).

### Espaçamento

| Token | Valor | Uso |
|---|---|---|
| `space-xs` | 4px | gap entre badge e texto |
| `space-sm` | 8px | padding interno de chips e badges |
| `space-md` | 16px | padding interno de cards e formulários |
| `space-lg` | 24px | separação entre seções |
| `space-xl` | 40px | separação entre blocos maiores |
| `space-touch` | 48px | altura mínima de elemento tocável |

### Grid

- Colunas: 2 (mobile) / 3 (tablet portrait) / 5 (tablet landscape / desktop) para grade de mesas
- Gutter: 12px (mesas) / 16px (conteúdo geral)
- Margem lateral: 16px (mobile) / 24px (tablet+)
- Breakpoints: `sm` 640px / `md` 768px / `lg` 1024px / `xl` 1280px

---

## 3. Componentes — intenção e limites

| Componente | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| **MesaCard** | comunicar estado da mesa em um olhar | grade de mesas — card clicável com número e status | texto longo dentro do card; ícones sem cor semântica |
| **Button primary** | ação principal e de alto impacto | "Fechar Conta", "Confirmar Pagamento" | mais de um por contexto visível |
| **Button secondary** | ação complementar | "Adicionar Item", "Aplicar Desconto" | para ações destrutivas |
| **Button danger** | ação com consequência irreversível | "Cancelar Pedido" — com confirmação | sem modal de confirmação |
| **OrderItemRow** | exibir item de pedido com quantidade e valor | lista de itens na comanda | informação que exige leitura longa |
| **SplitPaymentForm** | registrar múltiplas formas de pagamento | modal de fechamento de conta | fora do contexto de fechamento |
| **StockBadge** | sinalizar nível de estoque | tabela de insumos, dashboard | como indicador de status de pedido |
| **PaymentBadge** | identificar forma de pagamento compactamente | relatório financeiro, histórico de pedidos | como botão clicável |
| **FormField** | input com label, helper e erro integrados | formulários de produto, insumo, despesa | inputs sem label associado |
| **DataTable** | listar registros tabulares | produtos, insumos, despesas | mais de 5 colunas em tablet |
| **StatCard** | exibir métrica isolada com contexto | dashboard — faturamento, pedidos abertos | agrupar mais de 4 na mesma linha |
| **Modal** | confirmação ou ação contextual isolada | cancelamento, split payment, edição rápida | formulários longos com muitos passos |

---

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| **Polling silencioso** | Grade de mesas atualiza a cada 3s sem indicador visível para o operador | SWR com keepPreviousData — sem flicker, sem loading spinner |
| **Mesa como ponto de entrada** | Clicar na mesa abre a comanda — sem menus intermediários | Tap → navega diretamente para /comanda/[id] |
| **Fechamento em modal** | Pagamento acontece sem sair da tela de mesas | Modal de split payment cobre a comanda; confirmar libera a mesa e fecha o modal |
| **Confirmação para cancelamento** | Cancelar pedido abre dialog com campo de motivo obrigatório | "Por que está cancelando?" — submit bloqueado sem motivo |
| **Cálculo progressivo** | Total do pedido atualiza ao adicionar/remover item | Valor reflete mudança antes de salvar; otimistic UI onde possível |
| **Alerta de estoque passivo** | Insumo crítico aparece no dashboard sem interromper o fluxo operacional | Badge âmbar no card de estoque no dashboard; não bloqueia venda |

---

## 5. Linguagem — voz e tom

**Personalidade:** eficiente, sem drama — como um garçom experiente que sabe o que está fazendo.

**Tom em situações normais:**
- "Pedido fechado. Mesa 7 liberada."
- "Item adicionado à comanda."
- "Despesa registrada por emilly@villamill.com"

**Tom em erros:**
- "Selecione ao menos uma forma de pagamento."
- "O valor dos pagamentos não cobre o total da conta."
- "Motivo do cancelamento é obrigatório."

**Tom em estados vazios:**
- "Nenhum pedido fechado neste período."
- "Todas as mesas estão livres."
- "Nenhuma despesa registrada hoje."

**O que evitar:**
- Linguagem técnica visível ao operador ("orderId", "null", "500")
- Mensagens de sucesso excessivamente entusiasmadas
- Confirmações para ações não destrutivas (adicionar item não precisa de confirmação)
- Modal dentro de modal

---

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token | Willians | Willians | entrada no [[registro-de-decisoes-villamill]] |
| Alteração de cor semântica de mesa | Willians | Willians | registro de decisão — impacto operacional alto |
| Novo componente | Willians | Willians | adicionado ao [[ui-kit-villamill]] como draft |
| Deprecação de componente | Willians | Willians | marcado como deprecated + prazo de 30 dias |

**Critério para deprecar:** componente substituído por versão mais adequada ao princípio de ação > contemplação, ou não usado em nenhuma tela ativa.
**Período de migração:** 30 dias após marcação como deprecated.
