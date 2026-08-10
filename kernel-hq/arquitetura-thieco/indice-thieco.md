---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-08-04 (rev 11)
owner: willians
---

# Índice — Sistema de Caixa Barbearia Thieco Leandro

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/` com sufixo `-thieco`.

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-thieco]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-thieco]] | @pm | Contexto, problema, objetivo, usuário, hipótese, escopo e métricas do sistema de caixa da barbearia |
| [[requisitos-funcionais-thieco]] | @pm | 91 RFs em 17 módulos: auth, vendas (com caixinha estruturada e edição livre de data/serviço), profissionais, gastos (com recorrência opcional), catálogo (isolamento estrito por unidade em cadastro/edição/exclusão), combos (com edição de data de lançamento), clientes (isolamento por unidade no upsert automático), metas, relatórios (taxas por unidade/bandeira), gestão de time, débitos do barbeiro, configurações, notificações (alertas internos), tema escuro/claro, **agendamento nativo** (calendário + link público + confirmação de presença), **notificações administrativas configuráveis** (faturamento/ranking/estoque parado), **gatilhos ao cliente e campanhas promocionais** (aniversariante, cliente sumido, avaliação pós-venda, disparo manual segmentado com rastreamento de conversão) |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-thieco]] | @architect | Stack (Node.js + Express + React + PostgreSQL + Docker + Nginx), camadas, fluxo de dados, segurança e escala |
| [[modelo-de-dados-thieco]] | @data-engineer | 23 entidades com atributos reais do banco, relacionamentos, estados e ciclo de retenção |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-thieco]] | @ux-design-expert | 5 princípios de design, tokens de cor/tipografia/espaçamento, componentes com intenção e limites, voz e governança |
| [[ui-kit-thieco]] | @ux-design-expert | Inventário de componentes atômicos e compostos, layouts, templates de tela e regras de uso |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-thieco]] | @ux-design-expert | Jornadas do barbeiro e do admin, arquitetura de informação, fluxos principais, testes e iterações |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-thieco]] | @pm / todos | 70 decisões cronológicas: criação, expansão para Mutinga, taxas por bandeira, comissão por tipo de item, catálogo como referência, upsell, encoding UTF-8, produto na aba Combos, aba Lançamentos do barbeiro, DRE expandido, meta da barbearia + fix isolamento de unidade, importação histórica Maio/2026, origem_venda em combos + AppBarbeiro completo, fix comissão qtd_clientes > 1, metas diárias, painel barbeiro expandido (fechamento + débitos), ganho estimado em tempo real, fix comissões Dashboard, expansão categorias de despesas, DRE analítico accordion por categoria/descrição, reconciliação Junho/2026 (valor bruto x líquido), classificação servico/produto por catálogo, agrupamento de atendimentos por venda_origem_id, migração completa de combos V1→V2, botão Reativar + fix critério de esgotamento, tema claro/escuro conectado, fix de notificações (sincronização + retenção 7 dias), combos com créditos dinâmicos (JSONB) + seletor premium + UX unificada de avulsos, consolidação de infraestrutura (migração para VPS do villamill), despesas recorrentes com geração automática de ocorrências, taxas de pagamento por unidade e por bandeira individual, edição de data de lançamento de combos pelo admin, comissão do barbeiro visível por lançamento em Lançamentos, caixinha (gorjeta) estruturada em vendas e combos, fix comissão no backfill de migration (qtd_clientes, Mutinga), fix de SQL injection nos relatórios, ranking de canais de aquisição plugado, **motor de agendamento nativo com página pública** (substitui Booksy), confirmação de presença do cliente, lembrete automatizado de agendamento, notificações administrativas configuráveis (faturamento/ranking/estoque parado), arquitetura de integração com agentes de IA mapeada (Horizon/Cortex/Quasar — pendente), gatilho aniversariante + card Dias de Menor Movimento, cadastro único do administrador + roteamento por canal + remetente WhatsApp por unidade, gatilho cliente sumido + Promoções manual segmentada + cooldown anti-spam de 14 dias, gatilho pós-venda com link de avaliação Google Meu Negócio, campanhas segmentadas com rastreamento de conversão, isolamento de catálogo/profissionais/clientes por unidade no backend (GET), edição de data e serviço liberada em lançamentos para barbeiro/operador/admin, fix comissão de produto do Thieco (dono sem comissão), exclusão de lançamentos liberada para qualquer data (barbeiro), isolamento de cliente por unidade no upsert automático (TASK-36), isolamento de estoque/serviços por unidade no cadastro/edição/exclusão + categoria produto Barba, TASK-30 revisitada: disparo real de notificações direto no sistema-thieco (e-mail via Nodemailer aplicado; WhatsApp via Baileys/QR implementado e pausado, aguardando chave oficial da Meta Cloud API) — Horizon/Cortex descartados como intermediário, **TASK-37: isolamento de alertas internos (SinoBadge) por unidade — admin vê as duas unidades, barbeiro/operador só a própria, selo de unidade em cada alerta — + backoff exponencial na reconexão do WhatsApp (fix de crash)**, **pivô de Baileys pra Evolution API self-hosted (WhatsApp real sai do papel) + migração de e-mail pra Resend**, **WhatsApp multi-canal (Mutinga/Tamboré/admin) em produção com concierge de IA (Órbita Quasar: FAQ + transbordo pra humano + foto da unidade) e canal administrativo (Órbita Cortex: relatório sob demanda) — testado ponta a ponta com mensagem real e deployado na VPS**, contrato `notificar-admin` do Cortex simplificado como efeito colateral da portabilidade pro sistema-orbita-whitelabel, botão de desconectar WhatsApp direto no card de remetente (Configurações), fix do seletor Serviço/Produto no PDV por categoria em vez de `controla_estoque`, **fix do canal de notificações administrativas do Cortex fora do ar desde 28/07 (contrato não deployado + descoberta de que o deploy do Cortex/Quasar na VPS não usa git) + 3 canais WhatsApp desconectados encontrados na mesma investigação (reconexão pendente)**, Theo (Quasar) ganha regra explícita de nunca arredondar preço |

---

## Ordem de leitura recomendada

```
system-creation-thieco
        ↓
   prd-thieco
        ↓
requisitos-funcionais-thieco
        ↓
arquitetura-thieco  ←→  design-system-thieco
        ↓                       ↓
modelo-de-dados-thieco       ui-kit-thieco
        ↓                       ↓
        └────── ux-flows-thieco ┘
                      ↓
        registro-de-decisoes-thieco (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-thieco  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-thieco  ←  regra de negócio alterada
  - arquitetura-thieco            ←  decisão técnica estrutural
  - modelo-de-dados-thieco        ←  entidade ou atributo alterado
  - design-system-thieco          ←  padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes pontuais) não precisam atualizar estes documentos.
