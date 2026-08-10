---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-07-30
owner: willians
---

# UI Kit — Jocley Grill

> Referência: [[design-system-jocley-lanchonete]]
> Implementação: Next.js 15 + Tailwind CSS 4 (`src/components/`, `src/app/`) — sem Figma/Storybook, componentes escritos à mão no padrão shadcn (sem a lib instalada)

---

## Inventário de componentes

### Componentes atômicos (`src/components/ui/`)

| Componente | Variantes | Status | Onde está |
|---|---|---|---|
| Button | default, outline, ghost, destructive | aprovado | `button.tsx` |
| Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter | — | aprovado | `card.tsx` |
| Badge | default, success, warning, danger, neutral | aprovado | `badge.tsx` |
| Dialog | modal genérico com header + close | aprovado | `dialog.tsx` |
| Tabs | navegação por abas client-side | aprovado | `tabs.tsx` |

### Componentes compostos

| Componente | O que contém | Status | Onde está |
|---|---|---|---|
| Sidebar | grupos de navegação filtrados por role + mobile overlay + logout | aprovado | `sidebar.tsx` |
| Navbar | links filtrados por role (Caixa/Atendente) + bottom nav mobile | aprovado | `navbar.tsx` |
| MesaGrid | grid de mesas com status + abertura de comanda | aprovado | `pdv/mesa-grid.tsx` |
| BalcaoList | lista de comandas de balcão + criação de nova | aprovado | `pdv/balcao-list.tsx` |
| ComandaItens | catálogo de produtos + itens da comanda + fechamento — compartilhado mesa/balcão | aprovado | `pdv/comanda-itens.tsx` |
| PagamentoSplitDialog | formulário de split payment com bandeira opcional | aprovado | `pdv/pagamento-split.tsx` |
| CupomImpressao | layout térmico 80mm, `@page` escopado via `<style>` inline | aprovado | `cupom-impressao.tsx` |
| KdsBoard | fila de pendentes + concluídos, tema dark, urgência por cor | aprovado | `cozinha/kds-board.tsx` |
| ProdutosTable | CRUD de cardápio (ou visualização, conforme role) + acesso à ficha técnica | aprovado | `produtos/produtos-table.tsx` |
| ProdutoFormDialog | formulário de criação/edição de produto | aprovado | `produtos/produto-form-dialog.tsx` |
| FichaTecnicaEditor | lista + adição de insumos de um produto | aprovado | `cmv/ficha-tecnica-editor.tsx` |
| CardapioCalculoTable | tabela de CMV com markup/margem/preço sugerido | aprovado | `cmv/cardapio-calculo-table.tsx` |
| EstoqueTable | CRUD de insumos (ou visualização, conforme role), card de valor total (`quantidadeAtual × custoUnitario`) e filtro por nome | aprovado | `estoque/estoque-table.tsx` |
| FinanceiroCards | cards do dashboard + seletor de período | aprovado | `dashboard/financeiro-cards.tsx` |
| DateSelector | atalhos Hoje/7 dias/Mês via querystring | aprovado | `dashboard/date-selector.tsx` |
| InteligenciaContent | shell com abas Rankings/Pico/Ticket/Projeção/Calculadora de Metas + link para DRE | aprovado | `inteligencia/inteligencia-content.tsx` |
| RankingFormasCard / RankingPratosCard / PicoHorarioChart / ProjecaoPanel / TicketMedioCard / CalculadoraMetas | cada sub-view da Inteligência Financeira | aprovado | `inteligencia/*.tsx` |
| DreContent | relatório completo formatado para impressão A4 | aprovado | `inteligencia/dre-content.tsx` |
| DespesasTable / DespesaFormDialog | CRUD de despesas com recorrência e escopo | aprovado | `despesas/*.tsx` |
| LancamentosTable | listagem de comandas fechadas | aprovado | `lancamentos/lancamentos-table.tsx` |
| TimeContent + EquipeTab / FeedbacksTab / PlanosAcaoTab / SugestoesTab / TimelineTab | 5 sub-abas de Gestão de Time | aprovado | `time/*.tsx` |
| ConfiguracoesContent + NotificacoesTab / TaxasTab / LogsErroTab | 3 abas de Configurações (Notificações, Taxas de Pagamento + Taxas de Delivery, Logs de Erro exclusivo `devmaster`) | aprovado | `configuracoes/*.tsx` |
| UsuariosTable + UsuarioFormDialog | CRUD de usuários com restrição de papel por quem cria — nunca lista a conta `devmaster` | aprovado | `usuarios/*.tsx` |

### Layouts (patterns)

| Layout | Uso | Status |
|---|---|---|
| Shell Admin/Supervisor | Sidebar fixa (desktop) / overlay (mobile) + área de conteúdo | aprovado |
| Shell Caixa/Atendente | Navbar fixa no topo + bottom nav mobile + área de conteúdo | aprovado |
| Shell Cozinha | tela cheia dark, sem sidebar/navbar, próprio header com a marca | aprovado |
| TableLayout | tabela com cabeçalho de ações + linhas | aprovado |
| ErrorBoundary (`error.tsx`) / GlobalError (`global-error.tsx`) | mensagem amigável + botão "Tentar novamente" quando uma página ou o layout raiz quebra em runtime | aprovado |

### Templates de tela

| Template | Uso | Status | Rota |
|---|---|---|---|
| Login | usuário + senha | aprovado | `/login` |
| Início | dashboard financeiro (Admin) | aprovado | `/` |
| Mesas | grid de mesas | aprovado | `/mesas` |
| Balcão | lista de comandas de balcão | aprovado | `/balcao` |
| Comanda | itens + fechamento, compartilhado mesa/balcão | aprovado | `/comanda/[id]` |
| Cozinha (KDS) | fila de preparo | aprovado | `/cozinha` |
| Cardápio | CRUD/visualização de produtos | aprovado | `/produtos` |
| CMV | cálculo de custo do cardápio | aprovado | `/cmv` |
| Estoque | CRUD/visualização de insumos | aprovado | `/estoque` |
| Inteligência Financeira | rankings, pico, projeção, ticket médio | aprovado | `/inteligencia` |
| DRE | relatório para impressão | aprovado | `/inteligencia/dre` |
| Despesas | CRUD com recorrência | aprovado | `/despesas` |
| Lançamentos | listagem de comandas fechadas | aprovado | `/lancamentos` |
| Gestão de Time | 5 sub-abas | aprovado | `/time` |
| Configurações | Notificações + Taxas | aprovado | `/configuracoes` |
| Usuários | CRUD de login da equipe | aprovado | `/usuarios` |

---

## Assets

| Asset | Tipo | Onde está |
|---|---|---|
| Ícones | Lucide React | via biblioteca |
| Logo | não implementado — sistema usa apenas o texto "Jocley Grill" | cliente já forneceu arte (imagem de cardápio com chama estilizada, paleta preto/dourado) em 2026-07-30 — integração à UI ainda pendente |

---

## Regras de uso

- Item de menu (Sidebar/Navbar) nunca aparece para um role que não pode acessar aquela rota — a lista de itens já nasce filtrada, não é escondida via CSS
- `guardGestor()` no servidor é obrigatório em qualquer novo endpoint de escrita de Cardápio/Estoque/Ficha Técnica/Usuários — nunca confiar apenas na ocultação de botão no componente
- `CupomImpressao` e o `@page` de 80mm nunca devem virar regra global do `globals.css` — precisa continuar escopado ao componente, para não colidir com a impressão A4 do DRE
