---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
O **Design System** é o **sistema que transforma decisão em percepção consistente**.

Ele garante que:
- o produto seja compreendido
- o comportamento seja guiado
- a experiência seja coerente

# Função no sistema
Converter decisão → experiência → comportamento

Ele pega:
- o que foi decidido (PRD)

E transforma em:
- como isso aparece
- como isso é sentido
- como isso influencia ação

# Papel dentro do sistema
- PRD → define o que e por quê
- Design System → define como isso impacta o usuário

Ele é a ponte entre **produto e mente do usuário**

# Princípio central
"Inconsistência visual é inconsistência cognitiva."

# Estrutura essencial (nível sistema)
## 1. Princípios de design (código-fonte)
- Quais decisões guiam tudo?

Ex:
- clareza > estética
- ação > contemplação
- confronto > conforto

## 2. Fundamentos (tokens)
- cores (com significado)
- tipografia
- espaçamento
- grid
- motion

Não é visual. É linguagem.

## 3. Componentes
- botões, inputs, cards…

Mas com:
- intenção
- contexto de uso
- limites

Sem contexto → caos reutilizável

## 4. Padrões de interação
- fluxos
- jornadas
- comportamento esperado

Aqui nasce a experiência real

## 5. Linguagem (voz e conteúdo)
- como o sistema fala
- tom emocional

Isso conecta direto com comportamento

## 6. Governança
- quem pode alterar o quê e com qual autoridade
- como novas decisões são incorporadas ao sistema
- como conflitos entre princípios são resolvidos
- versionamento com rastreabilidade de motivo
- critério para deprecação de componentes

Sem governança → o Design System vira sugestão, não lei

# Onde o Design System quebra
- vira UI Kit
- não tem princípios
- não tem regra de uso
- não conecta com comportamento

Resultado: consistência estética, caos funcional

# Insight crítico
Design System não é sobre design.

É sobre **controle da percepção**.

---

# Template de aplicação — `design-system-[sistema].md`

Use este template para definir como o produto será percebido. Comece pelos princípios — eles governam tudo que vem depois. Tokens sem princípios são apenas variáveis CSS.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# Design System — [Nome do Sistema]

> Referência: [[prd-[sistema]]]

## 1. Princípios de design

São as decisões que guiam tudo. Quando houver conflito entre duas escolhas visuais, os princípios resolvem.

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| [princípio] | [o que significa na prática] | [como isso aparece em uma decisão real] |
| [princípio] | [o que significa na prática] | [como isso aparece em uma decisão real] |

> Exemplo: "clareza > estética" significa que se um elemento bonito cria dúvida cognitiva, ele é removido ou simplificado.

## 2. Fundamentos (tokens)

### Cores

| Token | Valor | Significado | Quando usar |
|---|---|---|---|
| `color-primary` | [hex] | [o que representa] | [contexto de uso] |
| `color-secondary` | [hex] | [o que representa] | [contexto de uso] |
| `color-feedback-error` | [hex] | erro, estado inválido | formulários, alertas críticos |
| `color-feedback-success` | [hex] | confirmação, estado válido | ações concluídas |
| `color-neutral-[n]` | [hex] | hierarquia de conteúdo | texto, bordas, fundos |

### Tipografia

| Token | Família | Tamanho | Peso | Uso |
|---|---|---|---|---|
| `type-heading-1` | [fonte] | [tamanho] | [peso] | título principal de página |
| `type-body` | [fonte] | [tamanho] | [peso] | texto corrido |
| `type-label` | [fonte] | [tamanho] | [peso] | labels de formulário e UI |

### Espaçamento

| Token | Valor | Uso |
|---|---|---|
| `space-xs` | [valor] | espaço mínimo entre elementos relacionados |
| `space-sm` | [valor] | espaçamento interno de componentes |
| `space-md` | [valor] | separação entre componentes distintos |
| `space-lg` | [valor] | separação entre seções |
| `space-xl` | [valor] | separação entre blocos maiores |

### Grid

- Colunas: [número]
- Gutter: [valor]
- Margem lateral: [valor]
- Breakpoints: [lista de breakpoints e comportamento]

## 3. Componentes — intenção e limites

| Componente | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| Button primary | [para que serve] | [quando usar] | [quando NÃO usar] |
| Button secondary | [para que serve] | [quando usar] | [quando NÃO usar] |
| Input | [para que serve] | [quando usar] | [quando NÃO usar] |
| Card | [para que serve] | [quando usar] | [quando NÃO usar] |

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| [padrão] | [o que é] | [o que o usuário experimenta] |

## 5. Linguagem — voz e tom

**Personalidade:** [como o sistema "fala" com o usuário]
**Tom em situações normais:** [exemplo de mensagem de confirmação]
**Tom em erros:** [exemplo de mensagem de erro]
**Tom em estados vazios:** [exemplo de empty state]
**O que evitar:** [padrões de linguagem que quebram a identidade]

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token | qualquer membro | [owner] | entrada no registro de decisões |
| Alteração de princípio | [owner] | [owner] | registro + atualização do doc |
| Deprecação de componente | qualquer membro | [owner] | marcação + prazo de migração |

**Critério para deprecar:** [quando um componente é removido do sistema]
**Período de migração:** [quanto tempo o componente deprecated ainda pode ser usado]
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks
[[06-ui-kit-engenharia-da-execucao-visual]] — materialização concreta deste Design System
[[07-ux-engenharia-da-experiencia]] — validação de se esses princípios funcionam na realidade do usuário
[[01-prd-engenharia-da-decisao]] — decisão de produto que origina os princípios
