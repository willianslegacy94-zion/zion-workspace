---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
O **Registro de Decisões** é o **sistema que preserva a memória viva do produto**.

Não é changelog técnico.  
É o **registro do que mudou, por que mudou e o que isso significa** — a ponte entre o sistema como foi desenhado e o sistema como existe hoje.

# Função no sistema
Converter mudança → decisão registrada → memória operacional

Ele captura:
- o que foi alterado em relação ao design original
- o motivo real da mudança
- o impacto nos outros artefatos do sistema

E garante:
- rastreabilidade de decisões ao longo do tempo
- contexto para quem retoma o trabalho
- base para atualização dos documentos quando necessário

# Papel dentro do sistema
- **Specs do sistema** → representam o estado desenhado (intenção original)
- **Backlog** → representa o que fazer a seguir (priorização)
- **Registro de Decisões** → representa o que mudou e por quê (memória)

Ele é a ponte entre **intenção original e realidade atual**

# Princípio central
"Decisão sem registro é conhecimento que só existe na cabeça de quem estava presente."

# Estrutura essencial (nível operacional)
## Cabeçalho de cada entrada

```
## [DATA] — [TÍTULO DA DECISÃO]
**Motivo:** por que essa mudança foi necessária
**Impacto:** quais artefatos, módulos ou regras foram afetados
**Status:** aplicado / parcial / revertido
**Observação:** contexto adicional relevante para o futuro
```

## Critério para registrar
Registrar quando:
- uma funcionalidade é adicionada, removida ou alterada
- uma regra de negócio muda
- uma decisão visual (cor, tipografia, componente) muda
- uma decisão arquitetural ou de dados é tomada
- algo do backlog é concluído com impacto sistêmico

Não registrar:
- correções de bug sem impacto em regras ou comportamento
- ajustes cosméticos sem alteração de padrão
- mudanças revertidas imediatamente

## Agrupamento recomendado
Agrupar por ciclo operacional (sprint, fase, período) para facilitar revisão histórica.

# Onde o Registro de Decisões quebra
- vira changelog técnico de commits — não captura o motivo
- vira ata de reunião — captura tudo, não filtra o que importa
- não é atualizado — decisões ficam apenas na cabeça ou no código
- não conecta com os artefatos afetados

Resultado: equipe toma a mesma decisão duas vezes, ou reverte algo que tinha motivo

# Insight crítico
O registro não é burocracia.

É a diferença entre um sistema que **evolui com consciência** e um sistema que **esquece por que existe**.

# Relação com os outros documentos
- Quando uma decisão altera uma **regra estrutural** → atualizar também o doc de Requisitos Funcionais
- Quando altera **visual ou comportamento** → atualizar Design System ou UI Kit
- Quando altera **estrutura de dados** → atualizar Modelo de Dados
- Quando altera **arquitetura** → atualizar Arquitetura Técnica
- Decisões operacionais do dia a dia → ficam apenas aqui

---

# Template de aplicação — `registro-de-decisoes-[sistema].md`

Um arquivo por sistema. Entradas em ordem cronológica crescente — a mais recente sempre no final. Não é changelog de commits. É memória de intenção.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# Registro de Decisões — [Nome do Sistema]

> Referência: [[prd-[sistema]]] | [[requisitos-funcionais-[sistema]]] | [[arquitetura-[sistema]]]

---

## [yyyy-mm-dd] — [Título da Decisão]

**Motivo:** [por que essa mudança foi necessária — o contexto que forçou a decisão]
**Impacto:** [quais artefatos, módulos, regras ou comportamentos foram afetados]
**Status:** aplicado / parcial / revertido
**Artefatos atualizados:** [lista dos docs que foram alterados junto com esta decisão]
**Observação:** [contexto adicional relevante para quem retomar o trabalho no futuro]

---

## [yyyy-mm-dd] — [Título da Decisão]

**Motivo:** [...]
**Impacto:** [...]
**Status:** aplicado / parcial / revertido
**Artefatos atualizados:** [...]
**Observação:** [...]

---

<!-- novas entradas sempre abaixo desta linha, nunca acima -->
```

## Critério rápido de "devo registrar?"

| Situação | Registrar? |
|---|---|
| Funcionalidade adicionada ou removida | sim |
| Regra de negócio alterada | sim |
| Decisão visual com impacto no Design System | sim |
| Decisão arquitetural ou de dados | sim |
| Backlog concluído com impacto sistêmico | sim |
| Bug corrigido sem impacto em regras | não |
| Ajuste cosmético sem alteração de padrão | não |
| Mudança revertida imediatamente | não |

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks e fluxo de atualização contínua
[[02-requisitos-funcionais-engenharia-da-especificacao]] — atualizar quando decisão altera regra estrutural
[[03-arquitetura-tecnica-engenharia-da-estrutura]] — atualizar quando decisão altera arquitetura
[[04-modelo-de-dados-engenharia-da-informacao]] — atualizar quando decisão altera estrutura de dados
[[05-design-system-engenharia-da-percepcao]] — atualizar quando decisão altera visual ou comportamento
