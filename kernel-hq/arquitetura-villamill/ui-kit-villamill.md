---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# UI Kit — Villa Mill Tamboré PDV & Management

> Referência: [[design-system-villamill]]
> Implementação: Next.js 15 + Tailwind CSS 4 (src/components/, src/app/)

---

## Inventário de componentes

### Componentes atômicos

| Componente | Variantes | Estados | Status | Onde está |
|---|---|---|---|---|
| Button | primary, secondary, ghost, danger | default, hover, active, disabled, loading | aprovado | `src/components/ui/button.tsx` |
| Card | padrão | — | aprovado | `src/components/ui/card.tsx` |
| Badge | success (LIVRE), danger (OCUPADA), dark (CONTA), warning (estoque crítico), neutral | — | aprovado | implementado inline com Tailwind |
| Input text | padrão | default, focus, error | aprovado | formulários de produto, insumo, despesa |
| Input number | padrão, com step decimal | default, focus | aprovado | quantidade de item, estoque |
| Select | padrão | default, focus | aprovado | categoria, forma de pagamento |
| Skeleton | padrão (bloco) | — | aprovado | loading state em grade de mesas |

### Componentes compostos

| Componente | O que contém | Status | Onde está |
|---|---|---|---|
| MesaCard | número grande + cor de status + texto de status + área clicável | aprovado | `src/app/mesas/mesas-grid.tsx` |
| MesasGrid | grid responsivo de MesaCard com SWR polling 3s | aprovado | `src/app/mesas/mesas-grid.tsx` |
| OrderItemRow | nome do produto + quantidade + preço unitário + subtotal + botão remover | aprovado | comanda /comanda/[id] |
| SplitPaymentForm | lista de formas de pagamento + valor por forma + validação de total | aprovado | modal de fechamento de pedido |
| ProductRow | nome + categoria + preço + custo + track_inventory toggle + ação editar | aprovado | `src/app/produtos/produtos-table.tsx` |
| IngredientRow | nome + unidade + quantidade atual + nível mínimo + badge crítico + ação editar | aprovado | `src/app/estoque/estoque-table.tsx` |
| DespesaRow | descrição + categoria + valor + data + registradoPor + ações | aprovado | `src/app/despesas/despesas-table.tsx` |
| StatCard | título + valor principal + subtítulo opcional | aprovado | `src/app/dashboard/dashboard-stats.tsx` |
| FinanceiroContent | filtro de data + cards de faturamento + breakdown por forma + cancelamentos + despesas | aprovado | `src/app/financeiro/financeiro-content.tsx` |
| RecipeItemRow | nome do insumo + unidade + quantidade por porção + ação remover | aprovado | modal de ficha técnica em /produtos |

### Layouts (patterns)

| Layout | Uso | Status |
|---|---|---|
| PageShell | navbar lateral (desktop) ou bottom nav (mobile) + área de conteúdo | aprovado |
| Navbar | logo + links de navegação por role + botão logout | aprovado — `src/components/navbar.tsx` |
| GridLayout | grade fluida de cards — usado para mesas | aprovado |
| TableLayout | cabeçalho com ações + tabela com linhas alternadas | aprovado |
| DashboardLayout | grid de StatCards no topo + conteúdo secundário abaixo | aprovado |
| ModalLayout | overlay escuro + container branco centralizado + header + content + actions | aprovado |

### Templates de tela

| Template | Uso | Status |
|---|---|---|
| Login | email + senha + botão entrar + logo Villa Mill | aprovado — `src/app/login/page.tsx` |
| Grade de Mesas | grid com 15 MesaCards + indicador de polling | aprovado — `src/app/mesas/page.tsx` |
| Comanda | cabeçalho (mesa + total) + lista de itens + campo desconto + botão fechar conta | aprovado — `src/app/comanda/[id]/page.tsx` |
| Fechamento de Conta | modal sobre a comanda com SplitPaymentForm + botão confirmar | aprovado |
| Dashboard | StatCards (pedidos, faturamento, mesas abertas, estoque crítico) + atalhos de módulo | aprovado — `src/app/dashboard/page.tsx` |
| Cardápio | tabela de produtos com CRUD + modal de ficha técnica | aprovado — `src/app/produtos/page.tsx` |
| Estoque | tabela de insumos com CRUD + alerta visual de nível mínimo | aprovado — `src/app/estoque/page.tsx` |
| Financeiro | filtro de período + cards de faturamento por forma + seção de cancelamentos + despesas | aprovado — `src/app/financeiro/page.tsx` |
| Despesas | formulário de registro + tabela de despesas filtrada por data | aprovado — `src/app/despesas/page.tsx` |
| Comanda Térmica | layout 80mm para impressão de comanda para cozinha/bar | draft — `src/app/comanda/[id]/page.tsx` (pendente) |

---

## Assets

| Asset | Tipo | Formato | Onde está |
|---|---|---|---|
| Logo Villa Mill | logo principal | PNG | `public/logo.png` |
| Ícones | Lucide React 1.14.0 | SVG via componente | via biblioteca |

---

## Regras de uso

- MesaCard é o componente mais crítico operacionalmente — cores de status (verde/vermelho/vermelho escuro) nunca podem ser alteradas sem decisão registrada no [[registro-de-decisoes-villamill]]
- SplitPaymentForm valida que a soma dos valores iguala o total do pedido antes de permitir submit — nunca remover essa validação
- Skeleton loader é obrigatório em telas com polling SWR — nunca substituir por spinner global que trave a interação
- Componente deprecated tem 30 dias para migração antes de ser removido
- Novos componentes entram como draft no inventário — vão para aprovado após validação em pelo menos uma tela em produção
