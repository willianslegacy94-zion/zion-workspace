---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
UX (**User Experience**) é o **sistema que valida e ajusta a interação entre produto e comportamento humano**.

Não é só usabilidade.  
É o ponto onde o produto encontra a **realidade do usuário**.

# Função no sistema
Converter interação → compreensão → ação → aprendizado

UX observa:
- como o usuário percebe
- como ele reage
- onde ele trava
- onde ele flui

E transforma isso em:
- ajustes
- melhorias
- otimização contínua

# Papel dentro do sistema
- **Diagnóstico** → entende o humano
- **PRD** → define decisão
- **Design System** → define percepção
- **UI Kit** → executa interface
- **UX** → valida se tudo isso funciona na prática

UX é o **loop de realidade do sistema**

# Princípio central
"A verdade do produto não está no que foi pensado, mas no que é vivido."

# Estrutura essencial (nível sistema)
## 1. Pesquisa
- entender comportamento real
- contexto de uso
- dores e padrões

## 2. Mapeamento de jornada
- como o usuário percorre o produto
- pontos de entrada, fricção e saída

## 3. Arquitetura de informação
- organização lógica do conteúdo
- clareza de navegação

## 4. Fluxos
- caminhos que levam à ação
- sequência de decisões

## 5. Testes
- validação prática (usabilidade, comportamento)
- identificação de falhas reais

## 6. Iteração
- ajuste contínuo com base em dados e comportamento

# Onde UX quebra
- vira só pesquisa sem ação
- vira só wireframe estético
- não conecta com métrica
- ignora comportamento real

Resultado: produto "bonito" que não funciona

# Insight crítico
UX não cria o sistema.

UX revela se o sistema funciona.

# Conexão com comportamento
Quando o sistema trabalha com emoção, estado percebido e decisão, UX precisa responder:

- Onde o usuário foge?
- Onde ele trava?
- Onde ele decide?

Isso conecta diretamente com:
- fuga da dor
- busca de prazer
- quebra de padrão

# Integração com as outras camadas
- PRD pode estar correto na teoria
- Design System pode estar coerente
- UI Kit pode estar bem executado

UX testa isso contra a realidade

Se falhar:
- o problema pode estar na decisão
- na percepção
- ou na execução

# Ponto crítico do UX
UX quebra quando se acredita que o usuário foi compreendido — mas o que guia o comportamento dele não foi entendido.

Ou pior: quando se mede interação... mas não se mede intenção.

---

# Template de aplicação — `ux-flows-[sistema].md`

Use este template para documentar o que foi aprendido sobre como o usuário real percorre o produto. Este documento nasce da observação, não da intenção.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# UX — [Nome do Sistema]

> Referência: [[prd-[sistema]]] | [[design-system-[sistema]]]

## 1. Pesquisa

**Método:** [entrevista / teste de usabilidade / análise de dados / shadowing / outro]
**Participantes:** [perfil e número]
**Período:** [quando foi realizada]

### Descobertas principais

| Descoberta | Evidência | Impacto no produto |
|---|---|---|
| [o que foi observado] | [citação, dado ou comportamento que comprova] | [o que isso muda ou confirma] |

---

## 2. Jornada do usuário

### [Jornada principal — ex: "Primeiro acesso até ação principal"]

| Etapa | O que o usuário faz | O que pensa/sente | Ponto de fricção | Oportunidade |
|---|---|---|---|---|
| [etapa 1] | [ação] | [estado mental] | [onde trava ou sai] | [como melhorar] |
| [etapa 2] | [ação] | [estado mental] | [onde trava ou sai] | [como melhorar] |

---

## 3. Arquitetura de informação

```
[Estrutura de navegação do produto]

Home
├── [Seção 1]
│   ├── [Sub-página A]
│   └── [Sub-página B]
├── [Seção 2]
└── [Seção 3]
```

**Critério de organização:** [por que essa estrutura faz sentido para o usuário — não para o time]

---

## 4. Fluxos principais

### Fluxo: [nome do fluxo — ex: "Cadastro e primeiro acesso"]

```
[Tela de entrada]
      ↓
[Decisão ou ação do usuário]
      ↓ (caminho principal)         ↓ (caminho alternativo)
[Próxima tela]                [Tela de erro ou alternativa]
      ↓
[Conclusão ou próximo fluxo]
```

**Critério de sucesso:** [o usuário chegou em X sem precisar de suporte]
**Ponto de abandono mais comum:** [onde os usuários desistem]

---

## 5. Testes de usabilidade

| Cenário testado | Comportamento esperado | Comportamento observado | Conclusão |
|---|---|---|---|
| [tarefa pedida ao usuário] | [como imaginávamos que faria] | [o que realmente aconteceu] | [ajuste necessário ou confirmação] |

---

## 6. Iterações registradas

| Data | O que mudou | Por que mudou | Resultado observado |
|---|---|---|---|
| [data] | [mudança na UI ou fluxo] | [evidência que motivou] | [o que melhorou ou piorou] |
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks e stack completo
[[05-design-system-engenharia-da-percepcao]] — princípios que a UX valida na prática
[[06-ui-kit-engenharia-da-execucao-visual]] — componentes que a UX testa em uso real
[[01-prd-engenharia-da-decisao]] — hipótese que a UX confirma ou refuta

---

# Visão final — o stack completo

- **Diagnóstico** → entendimento profundo do humano
- **PRD** → engenharia da decisão
- **Design System** → engenharia da percepção
- **UI Kit** → engenharia da execução visual
- **UX** → engenharia da experiência

## Tradução direta
- Diagnóstico → "por que isso acontece?"
- PRD → "o que vamos fazer sobre isso?"
- Design System → "como isso será percebido?"
- UI Kit → "como isso será construído?"
- UX → "isso funciona de verdade para o usuário?"
