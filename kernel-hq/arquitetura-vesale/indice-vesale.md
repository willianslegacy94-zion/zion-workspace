---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-16
owner: willians
---

# Índice — Drogaria Vesale

Mapa completo dos artefatos de governança do sistema.
Todos os arquivos vivem em `kernel-hq/arquitetura-vesale/` com sufixo `-vesale`.
Código-fonte real vive em `vesale/` (fora do Obsidian) — implementação em andamento desde
2026-09-12, com rodadas de atualização em 2026-09-15 e 2026-09-16 (ver
[[registro-de-decisoes-vesale]]).

---

## Threshold

| Documento | O que define |
|---|---|
| [[system-creation-vesale]] | As 6 perguntas respondidas antes da criação do sistema — threshold aprovado a partir de briefing estruturado do Willians + foto real da fachada, sem levantamento presencial com a cliente ainda |

---

## Camada 1 — O quê (decisão e especificação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[prd-vesale]] | @pm | Contexto de farmácia de bairro, problema de PDV/NF/precificação desconectados, hipótese de sistema único, escopo (lote/validade e produto controlado confirmados em 2026-09-15 — já não são mais pendência) e métricas |
| [[requisitos-funcionais-vesale]] | @pm | 35 RFs em 7 módulos: autenticação/usuários, cadastro de produtos/estoque (com lote/validade e medicamento controlado), PDV (com desconto, recibo, diferença de caixa), notas fiscais de entrada (parsing XML + fallback IA + lançamento manual pela chave), fornecedores, precificação/CMV (implementado em 2026-09-17) e gestão financeira; + Painel como resumo transversal |

---

## Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente | O que cobre |
|---|---|---|
| [[arquitetura-vesale]] | @architect | Stack (Next.js + Prisma + PostgreSQL + NextAuth v5), parser determinístico de XML NFe com fallback via Claude API para PDF/XML fora do padrão, deploy em VPS Hostinger com Docker Compose + Nginx, fronteiras de segurança por papel (gestor vs. operador) |
| [[modelo-de-dados-vesale]] | @data-engineer | 13 entidades — Produto com custo travado, preço editável e flag de medicamento controlado; LoteProduto para rastreio/baixa FEFO; NotaFiscalEntrada/ItemNotaFiscal com estado de conciliação e lote/validade; Venda/ItemVenda com preço, custo e desconto congelados no momento da venda; retenção permanente de venda e nota fiscal |

---

## Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente | O que cobre |
|---|---|---|
| [[design-system-vesale]] | @ux-design-expert | 4 princípios de design, paleta recalibrada a partir da foto real da fachada em 2026-09-15 (azul marinho `#17388C`, vermelho `#D9251F`, fundo neutro `#F5F6FA`), hierarquia de marca "DROGARIA" pequeno + "VESALE" em destaque, símbolo da cruz isolado como SVG |
| [[ui-kit-vesale]] | @ux-design-expert | Templates de tela: Login, PDV, Estoque, Notas Fiscais, Financeiro, Relatórios, Painel, Fornecedores e Precificação/CMV implementados. Navegação em sidebar fixa à esquerda desde 2026-09-17 (era header no topo). Componentes atômicos/compostos seguem "planejado" — o sistema não extraiu uma biblioteca formal, usa Tailwind repetido por tela |

---

## Camada 4 — Funciona? (validação da experiência)

| Documento | Agente | O que cobre |
|---|---|---|
| [[ux-flows-vesale]] | @ux-design-expert | Jornadas pretendidas (venda no PDV, conciliação de nota fiscal) a partir dos requisitos — ainda não revisado desde a implementação; segue marcado como não validado com uso real |

---

## Governança — Memória viva do sistema

| Documento | Agente | O que cobre |
|---|---|---|
| [[registro-de-decisoes-vesale]] | @pm / todos | 3 decisões registradas (governança inicial em 2026-09-12; confirmação de lote/validade+controlado e implementação de Estoque/Financeiro/Relatórios em 2026-09-15; Painel, Fornecedores, recibo, diferença de caixa e nota fiscal pela chave em 2026-09-16) + 3 pendências abertas (arquivo vetorial completo da logo, catálogo real de produtos/fornecedores, emissão de NFC-e) |

---

## Ordem de leitura recomendada

```
system-creation-vesale
        ↓
   prd-vesale
        ↓
requisitos-funcionais-vesale
        ↓
arquitetura-vesale  ←→  design-system-vesale
        ↓                       ↓
modelo-de-dados-vesale       ui-kit-vesale
        ↓                       ↓
        └────── ux-flows-vesale ┘
                        ↓
        registro-de-decisoes-vesale (atualização contínua)
```

---

## Fluxo de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-vesale  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-vesale  ←  regra de negócio alterada
  - arquitetura-vesale            ←  decisão técnica estrutural
  - modelo-de-dados-vesale        ←  entidade ou campo alterado no schema Prisma
  - design-system-vesale          ←  cor semântica ou padrão visual alterado
```

---

## Estado da implementação (2026-09-16)

Implementado e no ar (local): Autenticação, PDV (com desconto, recibo, receita de controlado,
fechamento de caixa com diferença), Estoque (com lote/validade, sinalização de vencimento),
Notas Fiscais de Entrada (upload de XML + lançamento manual pela chave), Fornecedores, Financeiro
(contas a pagar/receber), Relatórios de vendas, Painel, Módulo 5 — Precificação/CMV (trava de
custo × preço, alerta de margem negativa, cálculo de CMV do período, em `/rentabilidade`). Ver
`vesale/AGENTS.md` → "Estado atual" para o detalhe RF a RF.

**Ainda não implementado:** RF-025 (fluxo de caixa consolidado) e RF-026 (DRE simplificado,
depende do RF-025 acima — o CMV do Módulo 5 do qual RF-026 também depende já está pronto).

## Próximos artefatos/passos (backlog de governança)

| Item | Quando fazer |
|---|---|
| Fluxo de caixa consolidado (RF-025) e DRE simplificado (RF-026) | próximo — RF-026 depende de RF-025 |
| Resolver as 3 pendências abertas com a cliente (vetorial da logo, catálogo real, NFC-e) | antes de considerar o sistema pronto pra uso real na farmácia |
| Primeira rodada real de [[ux-flows-vesale]] (pesquisa e testes) | após a cliente usar o sistema pela primeira vez |
| `playbook-devops-vesale.md` | quando o deploy em VPS Hostinger for configurado — segue o padrão de `playbook-devops-thieco.md` e `playbook-devops-lane-confeitaria.md` |
| Reclassificação fina do [[ui-kit-vesale]] (planejado → construído) | se/quando os padrões visuais forem extraídos como componentes reaproveitáveis |
