---
status: stable
domain: villamill
source: claude
created: 2026-05-24
updated: 2026-07-29 (rev 15)
owner: willians
---

# Índice — Villa Mill Tamboré PDV & Management

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-villamill/` com sufixo `-villamill`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-villamill]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-villamill]] | @pm | Contexto de restaurante/bar sem PDV, problema de operação manual, hipótese de PDV web, escopo e métricas |
| [[requisitos-funcionais-villamill]] | @pm | 40 RFs em 8 módulos: auth, mesas, pedidos, cardápio, estoque, financeiro, despesas, dashboard |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-villamill]] | @architect | Stack (Next.js 15 + Prisma + PostgreSQL + NextAuth + SWR + Docker), camadas, fluxo de fechamento com split payment, histórico de versão (v1.24) |
| [[modelo-de-dados-villamill]] | @data-engineer | 14 entidades com schema Prisma real (incluindo Caixa, caixaNome em Order e SystemLog), ENUMs, relacionamentos, estados de mesa e pedido, ciclo de retenção |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-villamill]] | @ux-design-expert | 5 princípios de design (estado à primeira vista, ação > contemplação), tokens de cor semântica para mesas, voz e governança |
| [[ui-kit-villamill]] | @ux-design-expert | Inventário de MesaCard, SplitPaymentForm, OrderItemRow, templates de todas as 9 telas e regras de uso |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-villamill]] | @ux-design-expert | Jornadas do operador e do admin, arquitetura de navegação, fluxos de abertura/fechamento/cancelamento/treinamento, testes e iterações |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-villamill]] | @pm / todos | 37 decisões cronológicas: schema inicial, timestamps, FormaPagamento, custo e rastreio, autenticação, CancelamentoLog, desconto, CREDITO/DEBITO, split payment JSONB, Módulo Parceria Lava-Rápido (pool coletivo), Voucher VR/VA, Dockerfile migrate deploy, edição de transações, extrato caixinha no financeiro, edição/exclusão de registros do financeiro (admin), identificação do caixa por abertura de mesa, edição completa de transações fechadas, carga inicial de operadores via SQL direto (VPS), KDS da Cozinha, Cupom Térmico 80mm, aba Equipe (consumo interno sem pool de saldo + categorias dinâmicas), sincronização Parceiros/Caixas, card Caixinha Lava-Rápido ocultado, baixa administrativa de consumo + grupo no extrato, CRUD completo (admin) no Financeiro + endurecimento de segurança, correção do KDS (categoria Café da Manhã ausente da allowlist), Financeiro — seções Lavagem/Lavagens/Villamil, remoção universal da trava de saldo no consumo de funcionários + resumo agregado no Financeiro, sino de notificações no navbar + filtro padrão "hoje" no Financeiro, coexistência com sistema-thieco na mesma VPS + fechamento de portas expostas publicamente, manutenção automática do banco (SystemLog + pruning + VACUUM, pendente produção), KDS — agrupamento de itens da cozinha por mesa em um único card, bloqueio de acesso por horário (BYOD Guard) + aviso de expiração, aumento de fonte do sistema, edição de valor no lançamento de consumo da equipe, forma de pagamento "NOTA" — **backlog-tarefas-villamill 100% concluído**, correção de quantidade não exibida no KDS da Cozinha, acesso do ADMIN à Cozinha via navbar/dashboard |

---

## Ordem de leitura recomendada

```
system-creation-villamill
        ↓
   prd-villamill
        ↓
requisitos-funcionais-villamill
        ↓
arquitetura-villamill  ←→  design-system-villamill
        ↓                          ↓
modelo-de-dados-villamill       ui-kit-villamill
        ↓                          ↓
        └────── ux-flows-villamill ┘
                        ↓
        registro-de-decisoes-villamill (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-villamill  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-villamill  ←  regra de negócio alterada
  - arquitetura-villamill            ←  decisão técnica estrutural (ex: nova migration)
  - modelo-de-dados-villamill        ←  entidade ou campo alterado no schema Prisma
  - design-system-villamill          ←  cor semântica ou padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes de texto, linting) não precisam atualizar estes documentos.

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| `design-system-villamill` — tokens para comanda térmica 80mm | cupom térmico já está em produção (2026-06-27) mas o design-system não foi atualizado formalmente com os tokens de impressão — pendente |
| entrada no `registro-de-decisoes-villamill` | a cada PR com impacto sistêmico |
| atualização do `modelo-de-dados-villamill` | quando controle de usuários pelo admin for implementado (novo campo User.ativo) |
| `arquitetura-villamill` — atualizar histórico de migrações | adicionar entradas para 20260603022543_add_caixa_nome e 20260603025637_add_caixa_model (existem no schema mas não têm linha própria na tabela de versões) |
| `modelo-de-dados-villamill` — atualizar tabela Product | campo `opcionais Json?` ainda não documentado formalmente; ponto da carne configurado em 7 produtos via update direto |
| `arquitetura-villamill` — documentar scripts operacionais | `scripts/*.js` (seed-equipe-villa-mill, sync-caixas-equipe, reset-financeiro, limpar-mesa1, limpar-cancelamento-mesa1, limpeza) rodam fora do ciclo normal de migration — ainda não têm seção própria descrevendo o padrão "script standalone via Prisma Client, executado com docker exec no container da VPS" |
| `design-system-villamill` — tokens para o sino de notificações | sino (`notifications-bell.tsx`, 2026-07-03) reaproveita paleta semântica já existente (vermelho de alerta, dropdown) sem token formal próprio — pendente, mesma situação já registrada para o cupom térmico |
| `ui-kit-villamill` — card agrupado do KDS | card por mesa do KDS (`kds-board.tsx`, 2026-07-09) nunca teve inventário formal — nem quando era um card por item (v1.13), nem agrupado por mesa (2026-07-09), nem com o multiplicador de quantidade e o acesso do ADMIN (ambos 2026-07-29); mesma lacuna do sino e do cupom térmico |
| aplicar manutenção automática do banco em produção | `SystemLog` + `POST /api/admin/manutencao` + `scripts/limpeza.js` testados só localmente (2026-07-04) — falta gerar `MAINTENANCE_API_KEY` real na VPS, configurar crontab (`docker exec`), confirmar a migration `20260704215901_add_system_log` aplicada em produção e validar uma execução manual antes de confiar no cron (checklist completo em `TODO-manutencao-banco.md` no repo) |
| decidir produtor de `SystemLog` | tabela e rotina de retenção existem, mas nenhum código grava nela ainda — infraestrutura pronta, sem consumidor até o momento |
