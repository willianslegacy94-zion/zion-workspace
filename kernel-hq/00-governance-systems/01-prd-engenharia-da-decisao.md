---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
O **PRD (Product Requirements Document)** é o **mecanismo que transforma percepção de problema em decisão executável**.

Não é documentação.  
É um **sistema de alinhamento cognitivo** entre:
- problema
- solução
- execução

# Função no sistema
Converter caos → clareza → ação

Ele pega:
- dor difusa
- hipótese
- intenção

E transforma em:
- direção clara
- escopo controlado
- execução alinhada

# Papel dentro do sistema
- **Diagnóstico** → identifica padrões e causa raiz
- **Estratégia** → estrutura a transformação
- **PRD** → transforma isso em **produto construível**

Ele é a ponte entre **inteligência e construção**

# Princípio central
"Se não existe clareza sobre o problema, qualquer solução é ruído bem organizado."

# Estrutura essencial (engenharia, não checklist)
## 1. Contexto
- Qual sistema está em desequilíbrio?
- O que está acontecendo no mundo real?

## 2. Problema (núcleo)
- Qual dor específica existe?
- Como ela se manifesta?
- Por que ainda não foi resolvida?

Aqui está a qualidade do PRD.

## 3. Objetivo (estado futuro)
- O que muda depois da solução?
- Qual transformação é esperada?

## 4. Usuário / contexto humano
- Quem vive esse problema?
- Em qual estado emocional / comportamental?

## 5. Hipótese de solução
- O que acreditamos que resolve?
- Por que isso faria sentido?

Aqui mora o risco — e a inteligência.

## 6. Escopo (controle de realidade)
- O que entra
- O que fica de fora

Sem isso → dispersão

## 7. Métrica (verdade do sistema)
- Como sabemos que funcionou?

Sem métrica → narrativa, não produto

## 8. Requisitos
- Funcionais (o que faz)
- Não funcionais (como se comporta)

# Onde o PRD quebra
- vira lista de features
- não tem problema bem definido
- não tem critério de sucesso
- tenta resolver tudo

# Insight crítico
PRD não descreve produto.
PRD **codifica decisão**.

---

# Template de aplicação — `prd-[sistema].md`

Use este template ao criar o PRD de um sistema específico. Preencha todas as seções. Se não souber responder uma seção, o sistema não está pronto para ter PRD.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# PRD — [Nome do Sistema]

## 1. Contexto
[O que está acontecendo no mundo real que torna esse sistema necessário?
Qual sistema está em desequilíbrio? Qual situação motivou essa construção?]

## 2. Problema
**Dor específica:** [Qual é a dor — não a solução, a dor]
**Como se manifesta:** [Como ela aparece no dia a dia de quem a vive?]
**Por que ainda não foi resolvida:** [Qual é a barreira atual?]

## 3. Objetivo
[O que muda depois que o sistema existir?
Qual transformação concreta é esperada no comportamento, operação ou resultado?]

## 4. Usuário
**Quem:** [Quem vive esse problema e vai usar o output do sistema?]
**Estado no uso:** [Em qual estado emocional ou operacional está quando acessa?]
**Contexto:** [Onde, quando e por que acessa o sistema?]

## 5. Hipótese de solução
[O que acreditamos que resolve o problema?
Por que essa abordagem faz sentido para essa dor específica?
Qual é o risco central dessa hipótese?]

## 6. Escopo

**Dentro:**
- [funcionalidade ou comportamento incluído]
- [funcionalidade ou comportamento incluído]

**Fora:**
- [o que explicitamente não está neste sistema]
- [o que fica para versão futura ou sistema diferente]

## 7. Métrica de sucesso
[Como saberemos que o sistema funcionou?
Liste métricas quantitativas e qualitativas — uma resposta subjetiva não é métrica.]

| Métrica | Referência atual | Meta |
|---|---|---|
| [métrica] | [valor atual ou desconhecido] | [valor esperado] |

## 8. Requisitos de alto nível

**Funcionais:** [o que o sistema faz — comportamentos principais]
**Não funcionais:** [como o sistema se comporta — performance, segurança, disponibilidade]
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks e ordem de uso
[[02-requisitos-funcionais-engenharia-da-especificacao]] — próximo passo após o PRD
[[system-creation-threshold]] — threshold que precisa ser aprovado antes do PRD
