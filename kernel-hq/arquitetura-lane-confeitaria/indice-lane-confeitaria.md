---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-07-30
updated: 2026-08-08
owner: willians
---

# Índice — Lane Confeitaria

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-lane-confeitaria/` com sufixo `-lane-confeitaria`.
Código-fonte real em `lane-confeitaria/` (fora do Obsidian).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-lane-confeitaria]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado; explica a origem como kickoff direto com a cliente, sem sistema irmão do mesmo domínio |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-lane-confeitaria]] | @pm | Contexto de confeitaria sem sistema de gestão, problema de funil/capacidade/financeiro, hipótese de combinar 3 padrões do workspace, escopo e métricas |
| [[requisitos-funcionais-lane-confeitaria]] | @pm | 45 RFs em 9 módulos: autenticação, filas do CRM, pedido/catálogo/precificação, agenda, financeiro/CMV, dashboard, integração Quasar (API interna), atendimento automático + visão computacional + desistência classificada pela Mel, conexão WhatsApp |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-lane-confeitaria]] | @architect | Stack (Next.js 16 + Prisma 7 + PostgreSQL + NextAuth v5 + SWR + Recharts), breaking changes descobertos (proxy.ts, prisma.config.ts), fluxos de dados (inclui conversa Quasar → card automático, e a integração inversa — sistema → Quasar — pra classificar motivo de desistência), integração Evolution API, segurança, decisão de deploy (VPS+Docker, produção real), histórico de versão v0.1–v2.7 |
| [[modelo-de-dados-lane-confeitaria]] | @data-engineer | 15 entidades com schema Prisma real (inclui `Atendimento`, `FormaPagamento`), flags de fila configuráveis (`disparaAgendamento`, `contaComoConcluido`, `recebePedidoAutomatico`, `disparaAtendimentoHumano`) com o funil real de produção mapeado (Novo Cliente → Em negociação → Atendimento humanizado → Agendado → Pago), campos de validação de comprovante (`comprovanteParaValidar`), `Despesa.recorrente`, `desistencia`/`desistenciaMotivo`/`desistenciaEm` (classificado pela Mel, retenção de 30 dias sem apagar o registro), regras de cálculo de precificação/CMV/faixa de peso/projeção de ganho (com taxa de forma de pagamento) |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-lane-confeitaria]] | @ux-design-expert | 4 princípios de design, tokens de cor extraídos do material real da cliente (`brand-rose`, `brand-cream`, `brand-gold`), padrões de interação (limite escondido vs. limite mostrado) |
| [[ui-kit-lane-confeitaria]] | @ux-design-expert | Inventário de 24 componentes reais (KanbanBoard, PedidoDetalheModal, AtendimentoCard, WhatsappConexao, CalendarioAgenda, PainelFinanceiro, CalculadoraProjecao etc.) e templates das 14 telas do sistema |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-lane-confeitaria]] | @ux-design-expert | Pesquisa a partir do kickoff + imagens da cliente, 4 jornadas principais (inclui conversa real com a Mel), arquitetura de navegação, fluxos de pedido/agenda/CMV/WhatsApp/validação de comprovante, 6 iterações registradas (2 de segurança/dado, 4 do primeiro teste real acompanhado) |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-lane-confeitaria]] | @pm / todos | 29 decisões cronológicas: kickoff, PRD, arquitetura, os 5 epics de implementação, validação final, criação desta documentação, validação end-to-end contra PostgreSQL real, integração Quasar (API interna, persona Mel), a sessão de 2026-08-02 (correção de ambiente dev, loop de tool-calling, modelo `Atendimento`, avanço automático de funil, visão computacional, validação de pagamento, calibração de tom, WhatsApp real conectado), a sessão de 2026-08-04 pós-deploy (bug de produção por schema drift, funil de filas replicado, despesa recorrente, logout, ícone de app/PWA), a calculadora de projeção expandida em 2026-08-05 (forma de pagamento com taxa, docinho, escopo fechado antes de implementar), o bloqueio manual de número no WhatsApp (2026-08-07), e o card "Desistência" com motivo classificado pela Mel (2026-08-07/08, incluindo os dois incidentes de deploy corrigidos na hora) |

---

## Ordem de leitura recomendada

```
system-creation-lane-confeitaria
        ↓
   prd-lane-confeitaria
        ↓
requisitos-funcionais-lane-confeitaria
        ↓
arquitetura-lane-confeitaria  ←→  design-system-lane-confeitaria
        ↓                                  ↓
modelo-de-dados-lane-confeitaria        ui-kit-lane-confeitaria
        ↓                                  ↓
        └────── ux-flows-lane-confeitaria ┘
                        ↓
        registro-de-decisoes-lane-confeitaria (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-lane-confeitaria  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-lane-confeitaria  ←  regra de negócio alterada
  - arquitetura-lane-confeitaria            ←  decisão técnica estrutural
  - modelo-de-dados-lane-confeitaria        ←  entidade ou campo alterado no schema Prisma
  - design-system-lane-confeitaria          ←  cor semântica ou padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes de texto, linting) não precisam atualizar estes documentos.

---

## Próximos artefatos a criar (backlog de governança)

| Artefato | Quando criar |
|---|---|
| Teste de uso completo em browser (mobile) pela própria Lane | 2026-08-02: usuário já acompanhou `/crm` e `/configuracoes/whatsapp` ao vivo, mas ainda falta a Lane usar o sistema inteiro sozinha, em mobile — agora com ícone de app instalável (2026-08-04), boa oportunidade de fazer esse teste via "Adicionar à tela de início" |
| Seletor de período no dashboard financeiro | endpoint já aceita `periodo`, mas a UI (`PainelFinanceiro`) ainda está fixa no mês atual |
| Rate limiting e log de auditoria nas rotas `/api/internal/*` | lacuna registrada desde a integração original do Quasar (2026-07-30), ainda não endereçada |
| Persistência do SQLite do Quasar (`orbita_quasar.db`) | descoberto em 2026-08-02: sem volume Docker, todo restart apaga memória de conversa de todos os tenants — não é deste sistema resolver, mas bloqueia produção |
| Número de WhatsApp definitivo da confeitaria | conexão validada com número de teste; recomendação registrada de nunca usar número pessoal ativo (histórico sincroniza) |
| `ui-kit-lane-confeitaria` — telas ainda sem uso real da Lane validando | inventário aprovado com base em build limpo e revisão de código, não em uso real — reclassificar após a primeira semana de operação |
| Logo real da marca | cliente forneceu fotos de material de divulgação, não um arquivo vetorial do logo — sistema usa emoji como substituto |
