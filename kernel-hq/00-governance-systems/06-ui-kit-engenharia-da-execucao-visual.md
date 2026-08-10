---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
O **UI Kit** é o **conjunto de elementos visuais prontos para uso**.

É a **materialização concreta** do Design System.

Se o Design System é o "código da linguagem",  
o UI Kit é o **vocabulário pronto pra usar**.

# Função no sistema
Converter regras → elementos utilizáveis

Ele pega:
- princípios
- decisões visuais
- padrões

E transforma em:
- componentes prontos
- telas montáveis
- blocos reutilizáveis

# Papel dentro do sistema
- **Diagnóstico** → entende o humano
- **PRD** → define o que construir
- **Design System** → define como isso deve ser percebido
- **UI Kit** → permite construir isso rápido e consistente

Ele é a ponte entre **design e produção real**

# Princípio central
"Se cada tela precisa ser reinventada, o sistema falhou."

# Estrutura essencial (nível operacional)
## 1. Componentes visuais
- botões
- inputs
- dropdowns
- cards
- modais

Aqui está o "lego" do produto

## 2. Variantes e estados
- primário / secundário
- ativo / hover / disabled
- erro / sucesso / loading

Sem isso → inconsistência invisível

## 3. Layouts prontos (patterns)
- headers
- listas
- formulários
- dashboards

Acelera construção real

## 4. Templates de tela
- login
- onboarding
- checkout
- perfil

Reduz decisão repetitiva

## 5. Assets
- ícones
- ilustrações
- imagens

Padroniza estética

# Onde o UI Kit quebra
- vira bagunça de componentes
- não segue o Design System
- não tem padronização de uso
- cada implementação adapta do próprio jeito

Resultado: fragmentação visual + retrabalho

# Insight crítico
UI Kit não decide nada.

Ele **executa decisões já tomadas**.

Se a tentativa é pensar produto dentro do UI Kit,  
a operação está no nível errado.

# Ponto crítico (quase ninguém percebe)
Se o UI Kit for fraco:

- o Design System não escala
- o PRD vira interpretação
- o produto vira Frankenstein

---

# Template de aplicação — Biblioteca de Componentes

O UI Kit não vive em markdown — vive em Figma, Storybook, ou equivalente. Este documento registra o inventário e o estado de maturidade de cada componente.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# UI Kit — [Nome do Sistema]

> Referência: [[design-system-[sistema]]]
> Ferramenta principal: [Figma / Storybook / outro — link]

## Inventário de componentes

### Componentes atômicos

| Componente | Variantes | Estados | Status | Onde está |
|---|---|---|---|---|
| Button | primary, secondary, ghost, danger | default, hover, active, disabled, loading | [draft/aprovado] | [link] |
| Input | text, password, search | default, focus, error, disabled, filled | [draft/aprovado] | [link] |
| Checkbox | — | unchecked, checked, indeterminate, disabled | [draft/aprovado] | [link] |
| Badge | default, success, warning, error | — | [draft/aprovado] | [link] |
| Avatar | image, initials | — | [draft/aprovado] | [link] |

### Componentes compostos

| Componente | O que contém | Status | Onde está |
|---|---|---|---|
| FormField | Label + Input + HelperText + ErrorText | [draft/aprovado] | [link] |
| Card | Header + Body + Footer (opcionais) | [draft/aprovado] | [link] |
| Modal | Overlay + Container + Header + Content + Actions | [draft/aprovado] | [link] |
| Dropdown | Trigger + Menu + Items | [draft/aprovado] | [link] |

### Layouts (patterns)

| Layout | Uso | Status | Onde está |
|---|---|---|---|
| Page shell | estrutura base de qualquer página | [draft/aprovado] | [link] |
| Form layout | formulários de qualquer tipo | [draft/aprovado] | [link] |
| List layout | listagens com filtro e paginação | [draft/aprovado] | [link] |
| Dashboard layout | métricas, cards e gráficos | [draft/aprovado] | [link] |

### Templates de tela

| Template | Uso | Status | Onde está |
|---|---|---|---|
| Login | autenticação do usuário | [draft/aprovado] | [link] |
| Onboarding | primeiro acesso | [draft/aprovado] | [link] |
| Perfil | visualização e edição de dados do usuário | [draft/aprovado] | [link] |
| Empty state | tela sem dados | [draft/aprovado] | [link] |
| Error state | erro de sistema ou permissão | [draft/aprovado] | [link] |

## Assets

| Asset | Tipo | Formato | Onde está |
|---|---|---|---|
| Ícones | sistema de ícones | SVG / icon font | [link] |
| Logo | variantes principais | SVG + PNG | [link] |
| Ilustrações | empty states, onboarding | SVG | [link] |

## Regras de uso

- Nunca adaptar um componente fora da biblioteca sem registrar a decisão
- Todo novo componente começa como draft — não vai direto para aprovado
- Componente deprecated tem prazo de [X semanas] para migração
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks
[[05-design-system-engenharia-da-percepcao]] — fonte de verdade dos princípios e tokens que este UI Kit materializa
[[07-ux-engenharia-da-experiencia]] — validação de se os componentes funcionam na prática
