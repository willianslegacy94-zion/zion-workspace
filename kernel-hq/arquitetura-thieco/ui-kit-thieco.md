---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-07-09
owner: willians
---

# UI Kit — Barbearia Thieco Leandro

> Referência: [[design-system-thieco]]
> Implementação: React + Vite (frontend/src/components/, frontend/src/pages/)

---

## Inventário de componentes

### Componentes atômicos

| Componente | Variantes | Estados | Status | Onde está |
|---|---|---|---|---|
| Button | primary, secondary, ghost, danger | default, hover, disabled, loading | aprovado | `frontend/src/components/` |
| Input text | padrão, com máscara monetária | default, focus, error, filled | aprovado | formulários de venda e gastos |
| Select | padrão | default, focus, error | aprovado | profissional, forma de pagamento, unidade |
| Badge | success, warning, error, neutral | — | aprovado | tipo de cliente, forma de pagamento, tipo de item |
| Checkbox | padrão | unchecked, checked | aprovado | filtros de relatório |
| DatePicker | padrão, range (início–fim) | default, focus | aprovado | filtros de período em relatórios |

### Componentes compostos

| Componente | O que contém | Status | Onde está |
|---|---|---|---|
| VendaForm | Select(profissional) + Input(serviço) + InputCurrency(valor) + InputCurrency(desconto) + Select(forma_pagamento) + Select(tipo_cliente) + InputCurrency(caixinha, opcional, desde 2026-07-09) + Select(forma_pagamento_caixinha) + cálculo automático | aprovado | página de registro de venda |
| VendaRow | data + profissional + serviço + valor + comissão + forma + badge(tipo_item) + ação(excluir) | aprovado | tabela de vendas do dia |
| ComissaoCard | nome do profissional + total comissão serviço + total comissão produto + total geral | aprovado | relatório de comissões |
| GastoForm | Select(categoria) + Input(descricao) + InputCurrency(valor) + DatePicker | aprovado | registro de gastos |
| ProfissionalCard | nome + unidade + percentual + badge(ativo/inativo) + ação(editar) | aprovado | listagem de profissionais |
| UpsellSection | lista de itens vinculados à comanda com badge "upsell" | aprovado | detalhamento de venda com filhos |

### Layouts (patterns)

| Layout | Uso | Status |
|---|---|---|
| PageShell | estrutura base: sidebar (admin) ou navbar (barbeiro) + área de conteúdo | aprovado |
| FormLayout | formulário centralizado com card branco + padding consistente | aprovado |
| TableLayout | cabeçalho com filtros + tabela paginada + totais no rodapé | aprovado |
| ReportLayout | filtros de período e unidade no topo + seções de métricas abaixo | aprovado |
| DashboardLayout | grid de cards de métricas + gráfico de faturamento (quando implementado) | aprovado |

### Templates de tela

| Template | Uso | Status |
|---|---|---|
| Login | email + senha + botão entrar; sem opções extras | aprovado |
| Registro de Venda | formulário principal da operação — usado por barbeiros e admin | aprovado |
| Caixa do Dia | listagem de vendas do dia + totais por forma de pagamento + total geral | aprovado |
| Relatório de Comissões | período + unidade + tabela por profissional + exportação | aprovado |
| DRE Simplificado | faturamento - gastos = resultado por período e unidade | aprovado |
| Gestão de Profissionais | listagem + criação + edição + ativação/desativação | aprovado |
| Catálogo | listagem de serviços e produtos com flag controla_estoque | aprovado |
| Painel do Barbeiro | próprias vendas + própria comissão do período | aprovado |

---

## Assets

| Asset | Tipo | Formato | Onde está |
|---|---|---|---|
| Ícones | Lucide React ou equivalente | SVG inline | via biblioteca |
| Logo | logo da barbearia (quando existir) | SVG + PNG | `frontend/public/` |

---

## Regras de uso

- Nunca adaptar um componente fora da biblioteca sem registrar no [[registro-de-decisoes-thieco]]
- VendaForm é o componente mais crítico do sistema — qualquer alteração em cálculo de comissão ou valor líquido exige teste completo do fluxo
- InputCurrency sempre usa máscara monetária (R$ X.XXX,XX) — nunca input de texto livre para campos financeiros
- Badge de tipo_item diferencia "serviço" de "produto" — não usar cores intercambiáveis
- Componente deprecated tem 30 dias para migração antes de ser removido
