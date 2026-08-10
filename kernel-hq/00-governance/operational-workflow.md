---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-05-24
owner: willians
---

# Workflow Operacional — kernel-hq

Modo de trabalho padrão para qualquer sistema dentro de `kernel-hq`.

Aplica-se a: [[arquitetura-thieco]], [[arquitetura-villamill]] e qualquer sistema futuro.

---

## Dois modos de trabalho

| Modo | Quando usar | O que fazer |
|---|---|---|
| **Criação de sistema** | Novo sistema sendo cogitado | Threshold → criar pasta → preencher 10 artefatos |
| **Evolução de sistema existente** | Sistema já em produção | Ler contexto → trabalhar → registrar decisão → atualizar artefatos |

---

## Modo 1 — Criação de sistema

### Passo 1 — Verificar threshold

Ler `00-governance-systems/system-creation-threshold.md` e responder as 6 perguntas:

| Pergunta | O que valida |
|---|---|
| Qual problema esse sistema resolve? | Dor específica e real |
| Para quem? | Usuário com papel definido |
| Qual é o output esperado? | Resultado concreto e mensurável |
| Quais inputs o sistema precisa? | Dependências de dados definidas |
| Qual é o primeiro artefato concreto? | Entregável imediato claro |
| Por que isso é um sistema e não uma pasta de apoio? | Lógica própria que justifica existência |

Se todas as 6 perguntas têm respostas claras → threshold aprovado → avançar.

Exemplo aprovado: Barbearia Thieco Leandro (2024) — todas as 6 respondidas antes da construção.

---

### Passo 2 — Criar pasta do sistema

```
kernel-hq/arquitetura-{nome}/
```

Nome da pasta: `arquitetura-{nome}` — minúsculas, sem acentos, sem espaços, sem underscore.

---

### Passo 3 — Preencher os 10 artefatos

Usar os templates de `00-governance-systems/` como base, na ordem:

| # | Artefato | Template de base |
|---|---|---|
| 1 | `system-creation-{nome}.md` | `system-creation-threshold.md` |
| 2 | `indice-{nome}.md` | `00-indice.md` |
| 3 | `prd-{nome}.md` | `01-prd-engenharia-da-decisao.md` |
| 4 | `requisitos-funcionais-{nome}.md` | `02-requisitos-funcionais-engenharia-da-especificacao.md` |
| 5 | `arquitetura-{nome}.md` | `03-arquitetura-tecnica-engenharia-da-estrutura.md` |
| 6 | `modelo-de-dados-{nome}.md` | `04-modelo-de-dados-engenharia-da-informacao.md` |
| 7 | `design-system-{nome}.md` | `05-design-system-engenharia-da-percepcao.md` |
| 8 | `ui-kit-{nome}.md` | `06-ui-kit-engenharia-da-execucao-visual.md` |
| 9 | `ux-flows-{nome}.md` | `07-ux-engenharia-da-experiencia.md` |
| 10 | `registro-de-decisoes-{nome}.md` | `08-registro-de-decisoes-engenharia-da-governanca.md` |

---

### Passo 4 — Registrar no folder-purpose

Adicionar entrada da nova pasta em `00-governance/folder-purpose.md`.

---

## Modo 2 — Evolução de sistema existente

### Fase 1 — Planejamento

**1. Ler o contexto antes de qualquer decisão**

```
kernel-hq/arquitetura-{sistema}/indice-{sistema}.md
kernel-hq/arquitetura-{sistema}/registro-de-decisoes-{sistema}.md  ←  última entrada
```

**2. Identificar o artefato impactado**

| Tipo de mudança | Artefato principal |
|---|---|
| Regra de negócio nova ou alterada | `requisitos-funcionais-{sistema}.md` |
| Decisão técnica estrutural | `arquitetura-{sistema}.md` |
| Entidade ou atributo de banco | `modelo-de-dados-{sistema}.md` |
| Padrão visual alterado | `design-system-{sistema}.md` |
| Componente novo ou modificado | `ui-kit-{sistema}.md` |
| Jornada ou fluxo alterado | `ux-flows-{sistema}.md` |

---

### Fase 2 — Execução

**3. Trabalhar no artefato correspondente**

Manter frontmatter atualizado: `updated: YYYY-MM-DD`.

**4. Registrar a decisão**

Se a mudança tem impacto sistêmico, registrar em `registro-de-decisoes-{sistema}.md`:
- Motivo da mudança
- Impacto nos outros artefatos
- Status da aplicação

Não registrar: ajustes pontuais sem impacto sistêmico, correções cosméticas.

Entradas em ordem cronológica crescente — a mais recente sempre ao final do arquivo.

---

### Fase 3 — Handoff

**5. Contexto ao encerrar sessão**

Ao encerrar uma sessão de trabalho, registrar em `registro-de-decisoes-{sistema}.md` ou em nota de sessão:
- O que foi trabalhado
- Decisões tomadas
- Onde paramos
- O que retomar na próxima sessão

---

### Fase 4 — Retomada

**6. Início da próxima sessão com IA**

Fornecer à IA nesta ordem:
```
1. kernel-hq/00-governance/ai-collaboration-protocol.md
2. kernel-hq/arquitetura-{sistema}/indice-{sistema}.md
3. kernel-hq/arquitetura-{sistema}/registro-de-decisoes-{sistema}.md  →  última entrada
```

Funciona com qualquer IA — Claude, ChatGPT, Gemini.

---

## Regras de atualização contínua

```
Desenvolvimento concluído com impacto sistêmico
        ↓
registro-de-decisoes-{sistema}.md  →  registrar o que mudou, por quê e o impacto
        ↓  decisão altera regra ou comportamento
Artefato correspondente atualizado:
  - requisitos-funcionais-{sistema}.md  ←  regra de negócio alterada
  - arquitetura-{sistema}.md            ←  decisão técnica estrutural
  - modelo-de-dados-{sistema}.md        ←  entidade ou atributo alterado
  - design-system-{sistema}.md          ←  padrão visual alterado
```

Alterações sem impacto sistêmico (bugs cosméticos, ajustes pontuais) não precisam atualizar estes documentos.

---

## Exemplo aplicado — Sistema Thieco

### Iniciar sessão de trabalho

```
1. Ler: arquitetura-thieco/indice-thieco.md
2. Ler: arquitetura-thieco/registro-de-decisoes-thieco.md  →  última entrada
3. Identificar artefato impactado pela mudança necessária
4. Trabalhar no artefato
5. Registrar decisão se houve impacto sistêmico
```

### Exemplo de evolução registrada (referência)

Em 2026-05 foi identificado que Thieco Leandro estava sendo inserido com encoding corrompido e sem `percentual_comissao = 0`. A correção foi implementada no processo de inicialização e registrada em `registro-de-decisoes-thieco.md` com impacto declarado em `modelo-de-dados-thieco.md`.

Este é o padrão: qualquer mudança com impacto sistêmico vira entrada no registro — não fica apenas no git ou na conversa.
