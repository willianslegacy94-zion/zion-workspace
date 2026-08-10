---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-02
owner: willians
---

# Design System — Lane Confeitaria

## 1. Princípios de design

- **A marca vem da cliente, não do sistema.** Toda cor, tom e referência visual foi extraída literalmente de material de divulgação real (fotos de cardápio/menu enviadas pela Lane) — nenhuma paleta foi inventada.
- **Acolhedor, mas funcional.** A confeitaria é artesanal e "fofa" na comunicação, mas quem usa o sistema é uma confeiteira no meio da produção — telas priorizam ação rápida sobre estética pesada.
- **Mobile é o caso principal, não o caso extra.** Toda decisão de layout parte do celular.
- **Limite nunca vira erro visível quando não deveria ser.** O limite de filas (7) é uma regra de sistema, não um fato de negócio — a interface esconde, não avisa. O limite de agenda (5 bolos/dia), ao contrário, É um fato do negócio (capacidade real de produção) — esse é mostrado abertamente.

## 2. Fundamentos (tokens)

### Cores

Extraídas de `lane-confeitaria/docs/brand/brand-context.md`, aplicadas via Tailwind v4 `@theme inline` em `globals.css` (não há `tailwind.config.ts` — Tailwind v4 é CSS-first):

| Token | Valor | Uso |
|---|---|---|
| `brand-rose` | `#e3a9b5` | Cor primária — headers, cards de destaque |
| `brand-rose-light` | `#e8aeb8` | Variação clara |
| `brand-cream` | `#ede8d0` | Superfície secundária |
| `brand-cream-light` | `#f0ebda` | Fundo geral da aplicação |
| `brand-ink` | `#1a1a1a` | Texto de alto contraste |
| `brand-brown` | `#4a2c1d` | Texto secundário/blocos de menu |
| `brand-rose-vivid` | `#f06fa0` | Accent — CTAs, badges de preço, botões primários |
| `brand-gold` | `#c9a227` | Destaque — meta atingida, detalhes de conquista |

### Tipografia

Fonte padrão do sistema (Geist, herdada do `create-next-app`) — a cliente não forneceu fonte de marca própria.

### Espaçamento

Escala padrão do Tailwind (`p-4`, `gap-3`, etc.) — sem tokens customizados de espaçamento.

## 3. Componentes — intenção e limites

| Componente | Intenção | Limite |
|---|---|---|
| `AppShell` + `Nav` | Navegação persistente (lateral desktop / inferior mobile) | Não deve conter lógica de negócio, só roteamento |
| `KanbanBoard` / `PedidoCard` / `PedidoForm` | Funil de pedidos | Drag-and-drop é conveniência desktop; o `<select>` de fila é o caminho garantido em qualquer dispositivo |
| `CalendarioAgenda` | Visualizar ocupação diária | Não permite criar agendamento diretamente — agendamento nasce sempre de um pedido no CRM |
| `KpiCard` | Indicador numérico isolado | Não deve conter mais de um número por card |
| `GraficoFluxoCaixa` / `RankingPeso` / `RelatorioCmv` | Visualização de dados agregados | Consomem Route Handlers via SWR, nunca chamam Prisma diretamente |
| `MetaProgress` | Progresso de meta com destaque dourado | Destaque visual só dispara em ≥100%, nunca antes |
| `CalculadoraProjecao` | Simulação sem persistência | Não deve, em nenhuma hipótese, criar `Pedido` real |

## 4. Padrões de interação

- **Mover pedido entre filas:** drag-and-drop HTML5 nativo no desktop; `<select>` "mover para" sempre visível como alternativa universal (não só mobile — também acessibilidade)
- **Ações destrutivas** (excluir fila, cancelar pedido): `confirm()` nativo do browser antes de executar
- **Detalhe/ação sobre um card (desde 2026-08-02):** clique no card do pedido abre `PedidoDetalheModal` — primeiro modal customizado do sistema, usado pra aprovar/rejeitar comprovante sinalizado pela IA e marcar sinal/saldo pago manualmente. Overlay escuro (`bg-black/40`) fecha ao clicar fora
- **Card sinalizado precisando de atenção da Lane:** badge âmbar (`bg-amber-100`/`text-amber-700`) — cor reservada especificamente pra "algo que a IA fez e precisa de validação humana", distinta do verde (confirmado) e do neutro (pendente comum)
- **Limite de filas:** botão "+ nova fila" desaparece silenciosamente ao atingir o limite — nunca uma mensagem de erro
- **Limite de agenda:** dia "cheio" destacado visualmente em rosa vivo no calendário — comunicado abertamente
- **Dado ausente (preço/custo não cadastrado):** badge neutro ("preço não definido" / "custo não calculado"), nunca um valor numérico zerado que possa ser confundido com dado real

## 5. Linguagem — voz e tom

Interface em português informal-profissional, na perspectiva da própria Lane ("Bem-vinda, Lane!"). Mensagens de erro diretas e sem jargão técnico (ex.: "Esse dia já está com todos os bolos agendados. Escolha outra data." em vez de um código de erro).

## 6. Governança

- Alteração de paleta de marca deve vir de novo material da cliente, não de preferência estética do time técnico
- Novos componentes de dashboard devem seguir o padrão `KpiCard`/Route Handler + SWR já estabelecido, não introduzir uma nova forma de buscar dado
- Design system ainda **não validado com uso real da Lane** — aprovado com base em revisão de código e build limpo, não em teste de usuário

---

## Links relacionados

[[prd-lane-confeitaria]] — visão de UX e branding que originou estes tokens
[[ui-kit-lane-confeitaria]] — componentes reais que materializam este design system
[[indice-lane-confeitaria]] — mapa completo dos artefatos do sistema
