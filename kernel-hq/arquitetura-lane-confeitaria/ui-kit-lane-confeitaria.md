---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-02
owner: willians
---

# UI Kit — Lane Confeitaria

Inventário real dos componentes implementados em `lane-confeitaria/src/components/`. Sem Storybook/Figma — inventário direto do código-fonte.

## Inventário de componentes

### Layout (`src/components/shared/`)

- `AppShell.tsx` — casca com header de marca + `Nav`
- `Nav.tsx` — navegação lateral (desktop) / inferior (mobile), 6 itens

### CRM (`src/components/crm/`)

- `KanbanBoard.tsx` — colunas por fila, drag-and-drop + fallback `<select>`, renderiza `PedidoCard` e `AtendimentoCard` na mesma coluna; auto-refresh a cada 5s (`router.refresh()`, sincroniza estado local otimista com a prop nova)
- `PedidoCard.tsx` — resumo do pedido (cliente, sabores, valor, sinal, status, cancelamento); badge "🔍 validar comprovante" quando `comprovanteParaValidar=true`; clique abre `PedidoDetalheModal`
- `AtendimentoCard.tsx` — card leve pra conversa em andamento sem pedido fechado ainda (cliente + contato, sem sabor/valor)
- `PedidoDetalheModal.tsx` — modal aberto ao clicar num `PedidoCard`: aprovar/rejeitar comprovante sinalizado pela IA, marcar sinal/saldo como pago manualmente
- `PedidoForm.tsx` — formulário completo de novo pedido (cliente, sabores até 2, massa, peso, entrega, referência, valor, acréscimos)

### Agenda (`src/components/agenda/`)

- `CalendarioAgenda.tsx` — grid mensal com navegação, destaque de dia cheio, painel de detalhe por dia

### Configurações (`src/components/configuracoes/`)

- `FilasManager.tsx` — CRUD de filas + checkboxes "agenda", "concluído", "recebe da IA" e "atendimento humano"
- `CardapioManager.tsx` — CRUD de sabores/docinhos com preço
- `AcrescimosForm.tsx` — edição dos 3 valores de acréscimo
- `LimiteDiarioForm.tsx` — edição do limite de bolos/dia
- `WhatsappConexao.tsx` — QR code de pareamento (Evolution API), status de conexão com polling a cada 3s, botão de desconectar

### Financeiro (`src/components/financeiro/`)

- `DespesasManager.tsx` — lançamento e listagem de despesas
- `InsumosManager.tsx` — CRUD de insumos + associação a receita de sabor
- `PainelFinanceiro.tsx` — KPIs + gráfico de fluxo de caixa (compõe `KpiCard` + `GraficoFluxoCaixa`)
- `RelatorioCmv.tsx` — lista de CMV por sabor com tratamento de dado ausente

### Dashboard (`src/components/dashboard/`)

- `KpiCard.tsx` — card numérico reutilizável, com variante de destaque dourado
- `GraficoFluxoCaixa.tsx` — `BarChart` Recharts (entradas x saídas)
- `MetaProgress.tsx` — progresso de meta com cadastro inline
- `CalculadoraProjecao.tsx` — simulador local (sem persistência)
- `RankingPeso.tsx` — ranking por faixa de peso com detalhamento por sabor
- `ResumoRecorrentes.tsx` — card de clientes recorrentes

## Templates de tela

| Tela | Rota | Componentes principais |
|---|---|---|
| Login | `/login` | Formulário próprio (sem componente reutilizável) |
| Dashboard | `/dashboard` | `MetaProgress`, `ResumoRecorrentes`, `PainelFinanceiro`, `RankingPeso`, `CalculadoraProjecao` |
| CRM | `/crm` | `KanbanBoard` |
| Agenda | `/agenda` | `CalendarioAgenda` |
| Financeiro | `/financeiro` | `PainelFinanceiro`, `RelatorioCmv` |
| Financeiro → Despesas | `/financeiro/despesas` | `DespesasManager` |
| Financeiro → Insumos | `/financeiro/insumos` | `InsumosManager` |
| Clientes | `/clientes` | listagem própria (sem componente extraído) |
| Configurações | `/configuracoes` | índice de links |
| Configurações → WhatsApp | `/configuracoes/whatsapp` | `WhatsappConexao` |
| Configurações → Filas | `/configuracoes/filas` | `FilasManager` |
| Configurações → Cardápio | `/configuracoes/cardapio` | `CardapioManager` |
| Configurações → Agenda | `/configuracoes/agenda` | `LimiteDiarioForm` |
| Configurações → Precificação | `/configuracoes/precificacao` | `AcrescimosForm` |

## Assets

Nenhum asset de marca (logo em arquivo vetorial/imagem) foi fornecido pela cliente até o momento — apenas fotos de material de divulgação, usadas para extrair a paleta de cor. Sistema usa emoji (🎂) como substituto visual do logo real.

## Regras de uso

- Todo componente client que busca dado de dashboard usa SWR com a mesma função `fetcher` local — não há um hook compartilhado `useApi` ainda (oportunidade de refatoração futura, não um problema atual)
- Nenhum componente chama `prisma` diretamente — sempre via Route Handler (leitura) ou Server Action (escrita)
- `PedidoDetalheModal` é o **primeiro modal customizado do sistema** — até 2026-08-02 toda ação (inclusive destrutiva) usava só `confirm()` nativo do browser (ver `design-system-lane-confeitaria`, seção de padrões de interação, atualizada)
- Inventário **aprovado com base em build limpo e revisão de código**, não em uso real da Lane — reclassificar como "validado em produção" após a primeira semana de operação real, mesmo critério já usado no Jocley Lanchonete

---

## Links relacionados

[[design-system-lane-confeitaria]] — tokens e princípios que este inventário materializa
[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
