---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# Protocolo de Colaboração com IA — kernel-hq

Define como Claude e outros agentes devem operar dentro do ecossistema kernel-hq.

---

## Propósito

Este documento define como as IAs colaboram dentro do kernel-hq para:
- reduzir regressões arquiteturais
- manter consistência entre sistemas
- preservar contexto operacional entre sessões
- evitar decisões conflitantes com artefatos aprovados
- transformar conhecimento em infraestrutura persistente

---

## Princípios

### contexto-explícito

IAs não devem depender de memória conversacional como source of truth.

Contexto importante deve existir em markdown persistente dentro de `kernel-hq/`.

---

### output-não-é-verdade

Outputs de IA são material bruto.

Apenas conteúdos validados, revisados e aprovados por Willians podem virar contexto oficial nos artefatos de sistema.

---

### domínio-acima-da-ia

Conhecimento pertence ao domínio operacional — não à IA que gerou o conteúdo.

Correto:
```
arquitetura-thieco.md
modelo-de-dados-thieco.md
registro-de-decisoes-thieco.md
```

Incorreto:
```
claude-arquitetura.md
chatgpt-modelo.md
```

---

### approved-deve-ser-protegido

Arquivos com status `approved` ou `stable` não devem sofrer alterações casuais.

Qualquer mudança em artefato `stable` exige:
- justificativa arquitetural documentada
- registro em `registro-de-decisoes-{sistema}.md`
- atualização do campo `updated` no frontmatter

---

## Bootstrap de contexto — leitura obrigatória antes de trabalhar

Antes de qualquer sessão operacional em um sistema, a IA deve ler nesta ordem:

```
1. kernel-hq/00-governance/system-rules.md
2. kernel-hq/00-governance/ai-collaboration-protocol.md  (este documento)
3. kernel-hq/arquitetura-{sistema}/indice-{sistema}.md
4. kernel-hq/arquitetura-{sistema}/registro-de-decisoes-{sistema}.md  →  última entrada
```

Para o Sistema Thieco:
```
kernel-hq/arquitetura-thieco/indice-thieco.md
kernel-hq/arquitetura-thieco/registro-de-decisoes-thieco.md
```

Para o Sistema VillaMill:
```
kernel-hq/arquitetura-villamill/indice-villamill.md
kernel-hq/arquitetura-villamill/registro-de-decisoes-villamill.md
```

---

## Fluxo operacional de colaboração

### 1. problema identificado

Willians identifica problema, dúvida ou evolução necessária.

---

### 2. contexto fornecido

IA recebe:
- artefato(s) relevante(s) do sistema
- `registro-de-decisoes-{sistema}.md` com histórico de mudanças
- contexto específico da sessão

---

### 3. output bruto

Output da IA permanece como rascunho até validação por Willians.

---

### 4. validação

Willians revisa:
- coerência com artefatos existentes do sistema
- aderência às regras de negócio documentadas
- impacto em outros artefatos do mesmo sistema

---

### 5. consolidação

Conteúdo validado migra para o artefato correspondente:

| Tipo de mudança | Artefato destino |
|---|---|
| Decisão arquitetural ou regra nova | `registro-de-decisoes-{sistema}.md` |
| Regra de negócio alterada | `requisitos-funcionais-{sistema}.md` |
| Mudança técnica estrutural | `arquitetura-{sistema}.md` |
| Entidade ou atributo de banco | `modelo-de-dados-{sistema}.md` |
| Padrão visual alterado | `design-system-{sistema}.md` |
| Componente novo ou modificado | `ui-kit-{sistema}.md` |
| Jornada ou fluxo alterado | `ux-flows-{sistema}.md` |

---

## Regras para IAs

### nunca-assumir-contexto-total

IAs devem operar assumindo contexto parcial.

Ao iniciar sessão sem ter lido os artefatos do sistema, declarar explicitamente: "Preciso ler o contexto antes de propor mudanças."

---

### evitar-regressão

Antes de sugerir qualquer mudança em um sistema:
- verificar se conflita com decisões em `registro-de-decisoes-{sistema}.md`
- verificar se altera regras documentadas em `requisitos-funcionais-{sistema}.md`

---

### regras-de-negócio-são-lei

As regras documentadas nos artefatos são a fonte de verdade operacional — não a conversa atual.

Para o Sistema Thieco, não propor mudanças que alterem sem registro:
- percentual de comissão por tipo de item (serviço 40% / produto 10%)
- taxas PagBank por unidade e bandeira (RN-004)
- comissão de Thieco Leandro (permanece zero — regra de negócio permanente, RN-006)
- distinção entre unidades Tambore e Mutinga

---

### sistemas-não-são-genéricos

Os sistemas em kernel-hq têm lógica de negócio específica e não devem ser tratados como CRUD genérico.

- `arquitetura-thieco` — sistema financeiro de barbearia com duas unidades, comissionamento diferenciado por tipo de item, taxas de maquininha distintas por unidade e bandeira de cartão
- `arquitetura-villamill` — sistema com sua própria lógica de negócio específica

---

## Estrutura mínima de contexto

Toda interação operacional relevante deve considerar:

```
kernel-hq/00-governance/system-rules.md
kernel-hq/arquitetura-{sistema}/indice-{sistema}.md
kernel-hq/arquitetura-{sistema}/registro-de-decisoes-{sistema}.md
```

---

## Objetivo final

Criar uma infraestrutura operacional onde:
- conhecimento persiste entre sessões
- contexto é explícito e legível por qualquer IA
- decisões possuem rastreabilidade
- arquitetura evolui sem perder coerência
- regras de negócio são preservadas contra regressões acidentais
