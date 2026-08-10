---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
O **Modelo de Dados** é o **sistema que define o que o produto conhece, como organiza esse conhecimento e como ele evolui**.

Não é esquema de banco de dados.  
É o **mapa de como o sistema pensa** — antes de qualquer linha de código.

# Função no sistema
Converter conceitos de negócio → informação estruturada → dados que sustentam decisão

Ele pega:
- entidades do mundo real (usuário, sessão, tarefa, evento)
- relacionamentos entre elas
- estados e mudanças ao longo do tempo

E transforma em:
- estrutura que o sistema entende
- dados que o produto pode consultar, cruzar e interpretar
- base para métricas, histórico e inteligência

# Papel dentro do sistema
- **PRD** → define o que o sistema precisa saber
- **Arquitetura Técnica** → define onde e como os dados vivem
- **Modelo de Dados** → define o quê exatamente é armazenado e como se conecta

Ele é a ponte entre **conceito de negócio e realidade de dado**

# Princípio central
"Se o modelo de dados não reflete como o negócio pensa, o sistema responde perguntas que ninguém fez."

# Estrutura essencial (nível sistema)
## 1. Entidades
- O que o sistema conhece?
- Quais são os objetos centrais do domínio?

Cada entidade representa um conceito real do negócio, não uma tabela.

## 2. Atributos
- O que o sistema precisa saber sobre cada entidade?
- Quais campos são obrigatórios, opcionais, calculados?

Menos é mais — atributo sem uso é ruído armazenado.

## 3. Relacionamentos
- Como as entidades se conectam?
- Um para um, um para muitos, muitos para muitos?
- O relacionamento tem atributos próprios?

Relacionamento mal definido → consultas impossíveis

## 4. Estados e ciclo de vida
- Como cada entidade muda ao longo do tempo?
- Quais transições de estado são válidas?
- O histórico de estados precisa ser preservado?

Sem ciclo de vida → o sistema perde memória do que aconteceu

## 5. Propriedade e acesso
- Quem cria cada entidade?
- Quem pode ler, editar, excluir?
- Há dados que pertencem ao usuário, ao sistema, à organização?

## 6. Ciclo de retenção
- Por quanto tempo os dados são mantidos?
- O que é arquivado vs. excluído?
- Há dados que nunca devem ser apagados?

Sem política de retenção → acúmulo sem controle ou perda irreversível

# Onde o Modelo de Dados quebra
- reflete a estrutura do banco, não o conceito do negócio
- entidades criadas para conveniência técnica, não para o domínio
- relacionamentos implícitos — existem no código, não no modelo
- ciclo de vida ignorado — o sistema não sabe o que ainda está ativo
- sem política de retenção — dado vira lixo ou vira risco

Resultado: sistema que funciona no início e trava quando o negócio evolui

# Insight crítico
O modelo de dados não é um detalhe técnico.

É a **memória do sistema** — e memória mal estruturada nunca é recuperada.

---

# Template de aplicação — `modelo-de-dados-[sistema].md`

Use este template para mapear o que o sistema conhece antes de qualquer decisão de banco. Primeiro o conceito de negócio, depois a estrutura técnica. Nunca o inverso.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# Modelo de Dados — [Nome do Sistema]

> Referência: [[prd-[sistema]]] | [[arquitetura-[sistema]]]

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| [Entidade] | [o que representa no mundo real] | [que problema de negócio ela resolve] |

## Atributos por entidade

### [Entidade 1]

| Atributo | Tipo | Obrigatório | Calculado | Descrição |
|---|---|---|---|---|
| id | uuid | sim | não | identificador único imutável |
| [atributo] | [tipo] | [sim/não] | [sim/não] | [o que representa] |
| created_at | timestamp | sim | sim | gerado automaticamente na criação |
| updated_at | timestamp | sim | sim | atualizado a cada modificação |

### [Entidade 2]
[...]

## Relacionamentos

| De | Para | Tipo | Atributos do relacionamento | Regra |
|---|---|---|---|---|
| [Entidade A] | [Entidade B] | 1:N / N:M / 1:1 | [se houver] | [regra de integridade] |

## Estados e ciclo de vida

### [Entidade com estados]

```
[estado-inicial] → [estado-intermediário] → [estado-final]
       ↓
  [estado-alternativo]
```

| Estado | Significado operacional | Transições válidas | O que dispara |
|---|---|---|---|
| [estado] | [o que significa para o negócio] | [→ estado-x quando Y] | [evento ou ação] |

## Propriedade e acesso

| Entidade | Quem cria | Quem lê | Quem edita | Quem exclui |
|---|---|---|---|---|
| [Entidade] | [papel/sistema] | [papel/sistema] | [papel/sistema] | [papel/sistema] |

## Ciclo de retenção

| Entidade | Retenção | Arquivado após | Excluído após | Nunca excluir |
|---|---|---|---|---|
| [Entidade] | [ativa por X] | [após Y] | [após Z] | [se condição] |
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks
[[03-arquitetura-tecnica-engenharia-da-estrutura]] — onde e como esses dados vivem tecnicamente
[[02-requisitos-funcionais-engenharia-da-especificacao]] — requisitos que determinam quais entidades são necessárias
