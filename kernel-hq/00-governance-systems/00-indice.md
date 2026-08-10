---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-06-25
owner: willians
---

# Índice — Governança de Sistemas

Dois tipos de documento vivem aqui:

1. **Threshold** — o que precisa estar respondido antes de criar um sistema
2. **Frameworks** — os guias de como construir cada camada depois que o threshold é aprovado

---

## Threshold

| Documento | O que define |
|---|---|
| `system-creation-threshold.md` | As 6 perguntas que precisam ter resposta antes de abrir uma pasta de sistema. Sistemas aprovados: Thieco, Villamill, Horizon, Pulsar, Quasar (draft), Cortex, Insight, Prospecção, IVSSTORE, Kernel. |

---

## Frameworks de construção

Conjunto de documentos conceituais que servem como base universal para a construção de qualquer sistema digital.

Cada documento é um **framework** — não um artefato pronto, mas um guia de raciocínio. A aplicação a um sistema específico gera o artefato real.

---

## Documentos base

### Camada 1 — O quê (decisão e especificação)

| Documento                                                 | Agente principal | O que cobre                                                                                                                                   |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-prd-engenharia-da-decisao.md`                         | @pm              | Transforma percepção de problema em decisão executável. Define contexto, problema, objetivo, usuário, hipótese, escopo e métrica.             |
| `02-requisitos-funcionais-engenharia-da-especificacao.md` | @pm              | Traduz o PRD em comportamentos especificados. Cobre módulos funcionais, RF numerados, RNFs, regras de negócio, estados e critérios de aceite. |

### Camada 2 — Como sustenta (estrutura e informação)

| Documento | Agente principal | O que cobre |
|---|---|---|
| `03-arquitetura-tecnica-engenharia-da-estrutura.md` | @architect | Define como o sistema se sustenta tecnicamente. Cobre stack, camadas, fluxo de dados, integrações, segurança e estratégia de escala. |
| `04-modelo-de-dados-engenharia-da-informacao.md` | @data-engineer | Define o que o sistema conhece e como organiza esse conhecimento. Cobre entidades, atributos, relacionamentos, estados e ciclo de retenção. |

### Camada 3 — Como aparece (percepção e execução visual)

| Documento | Agente principal | O que cobre |
|---|---|---|
| `05-design-system-engenharia-da-percepcao.md` | @ux-design-expert | Define como o produto será percebido. Cobre princípios de design, tokens visuais, componentes, padrões de interação, linguagem e governança. |
| `06-ui-kit-engenharia-da-execucao-visual.md` | @ux-design-expert | Materializa o Design System em elementos prontos para uso: componentes, variantes, layouts, templates e assets. |

### Camada 4 — Funciona? (validação da experiência)

| Documento                            | Agente principal  | O que cobre                                                                                                                                   |
| ------------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `07-ux-engenharia-da-experiencia.md` | @ux-design-expert | Valida se o produto funciona na realidade do usuário. Cobre pesquisa, jornada, arquitetura de informação, fluxos, testes e iteração contínua. |

### Governança — Memória viva do sistema

| Documento | Agente principal | O que cobre |
|---|---|---|
| `08-registro-de-decisoes-engenharia-da-governanca.md` | @pm / todos | Preserva o que mudou, por que mudou e o impacto. Ponte entre o sistema desenhado e o sistema real. Um arquivo por sistema. |

---

## Artefatos gerados por sistema

Cada framework gera um artefato específico quando aplicado a um sistema real:

| Framework (base) | Artefato gerado (sistema específico) |
|---|---|
| 01 PRD | `prd-[sistema].md` — problema, hipótese, escopo e métricas |
| 02 Requisitos Funcionais | `requisitos-funcionais-[sistema].md` — RF-001, RF-002, RNFs e critérios de aceite |
| 03 Arquitetura Técnica | `arquitetura-[sistema].md` — stack, camadas e decisões técnicas |
| 04 Modelo de Dados | `modelo-de-dados-[sistema].md` — entidades, relacionamentos e ciclo de vida |
| 05 Design System | `design-system-[sistema].md` — tokens, princípios e componentes |
| 06 UI Kit | Biblioteca de componentes (Figma, Storybook ou equivalente) |
| 07 UX | `ux-flows-[sistema].md` — jornadas, fluxos e critérios de validação |
| 08 Registro de Decisões | `registro-de-decisoes-[sistema].md` — decisões tomadas, motivo e impacto |

---

## Fluxo de atualização contínua

```
Backlog de priorização
      ↓  item concluído com impacto sistêmico
08 Registro de Decisões  →  registrar o que mudou, por quê e o impacto
      ↓  decisão altera regra ou comportamento estrutural
Spec correspondente      →  atualizar o artefato afetado

  02 Requisitos Funcionais  ←  regra de negócio alterada
  03 Arquitetura Técnica    ←  decisão estrutural alterada
  04 Modelo de Dados        ←  entidade ou ciclo alterado
  05 Design System / UI Kit ←  padrão visual alterado
```

Itens concluídos **sem impacto sistêmico** (ajustes pontuais, bugs cosméticos) não precisam ir ao Registro de Decisões.

---

## Ordem de uso recomendada

```
01 PRD
↓
02 Requisitos Funcionais
↓
03 Arquitetura Técnica  ←→  05 Design System
↓                               ↓
04 Modelo de Dados          06 UI Kit
↓                               ↓
└───────────── 07 UX ───────────┘
```

As camadas 2 e 3 podem ser desenvolvidas em paralelo.
A UX valida tudo ao final — e retroalimenta o ciclo.

---

## Links relacionados

[[system-creation-threshold]] — threshold que deve ser aprovado antes de aplicar esses frameworks
[[system-rules]] — regras operacionais do ecossistema
[[operational-workflow]] — como o trabalho flui entre os frameworks
