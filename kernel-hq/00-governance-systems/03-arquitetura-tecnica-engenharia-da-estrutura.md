---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
A **Arquitetura Técnica** é o **sistema que define como o produto será estruturado para existir, escalar e se manter**.

Não é escolha de tecnologia.  
É a **engenharia das consequências** — cada decisão aqui determina o que será possível ou impossível no futuro.

# Função no sistema
Converter decisão → estrutura executável → produto sustentável

Ela pega:
- o que foi decidido (PRD)
- como será percebido (Design System)
- o que será construído (UI Kit)

E define:
- como as partes se conectam
- onde cada responsabilidade vive
- como o sistema cresce sem quebrar

# Papel dentro do sistema
- **PRD** → define o que e por quê
- **Design System + UI Kit** → define como aparece
- **Arquitetura Técnica** → define como sustenta tudo isso

Ela é a ponte entre **decisão de produto e realidade de engenharia**

# Princípio central
"Arquitetura não é sobre tecnologia. É sobre consequências."

# Estrutura essencial (nível sistema)
## 1. Stack de decisão
- Linguagens e frameworks principais
- Infraestrutura (cloud, on-premise, híbrido)
- Serviços externos essenciais

Cada escolha fecha e abre possibilidades — registrar o motivo é tão importante quanto a escolha.

## 2. Camadas do sistema
- Apresentação (interface, cliente)
- Lógica de negócio (regras, processamento)
- Dados (armazenamento, acesso)
- Integrações (APIs externas, serviços terceiros)

Sem separação clara → qualquer mudança quebra tudo

## 3. Fluxo de dados
- Como a informação entra no sistema
- Como ela é processada e transformada
- Como ela é armazenada e recuperada
- Como ela sai (resposta, notificação, exportação)

## 4. Pontos de integração
- O que o sistema consome de fora
- O que o sistema expõe para fora
- Contratos de API (formato, autenticação, versionamento)

## 5. Fronteiras de segurança
- Onde a autenticação acontece
- Onde a autorização é validada
- Quais dados são sensíveis e como são protegidos

## 6. Estratégia de escala
- O que acontece quando o volume aumenta 10x?
- Quais partes do sistema são gargalo?
- Como a arquitetura acomoda crescimento sem reescrita?

# Onde a Arquitetura Técnica quebra
- vira diagrama sem impacto real nas decisões de código
- não conecta com o PRD — existe paralela ao produto
- ignora segurança até que vire problema
- escala não é considerada até que seja urgente
- decisões de stack não têm registro de motivo

Resultado: sistema frágil que trava no primeiro crescimento real

# Insight crítico
Arquitetura não é o que você escolhe no começo.

É o que você **paga pelo resto da vida do produto**.

---

# Template de aplicação — `arquitetura-[sistema].md`

Use este template para definir como o sistema se sustenta tecnicamente. Cada decisão de stack deve ter o motivo registrado — a escolha sem motivo não é arquitetura, é chute documentado.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# Arquitetura Técnica — [Nome do Sistema]

> Referência: [[prd-[sistema]]] | [[requisitos-funcionais-[sistema]]]

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Frontend | [tecnologia] | [por que essa e não outra] | [o que fica impossível ou difícil] |
| Backend | [tecnologia] | [por que essa e não outra] | [o que fica impossível ou difícil] |
| Banco de dados | [tecnologia] | [por que essa e não outra] | [o que fica impossível ou difícil] |
| Infraestrutura | [cloud / on-premise / híbrido] | [por que] | [o que fica impossível ou difícil] |
| Serviços externos | [serviço] | [por que integrar em vez de construir] | — |

## 2. Camadas do sistema

```
[Apresentação — interface, cliente]
         ↓  ↑
[Lógica de negócio — regras, processamento]
         ↓  ↑
[Dados — armazenamento, acesso]
         ↓  ↑
[Integrações — APIs externas, serviços terceiros]
```

**Apresentação:** [o que vive aqui, responsabilidades, limites]
**Lógica de negócio:** [o que vive aqui, responsabilidades, limites]
**Dados:** [o que vive aqui, responsabilidades, limites]
**Integrações:** [lista de integrações e responsabilidade de cada uma]

## 3. Fluxo de dados

```
[Entrada] → [Como é processada] → [Onde é armazenada] → [Como é recuperada] → [Saída]
```

[Descreva o caminho principal da informação no sistema — da entrada à saída]

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Versionamento |
|---|---|---|---|---|
| [serviço] | consumo / exposição | [REST/GraphQL/webhook/etc] | [JWT/API key/OAuth] | [v1/sem versão] |

## 5. Fronteiras de segurança

- **Autenticação:** [onde acontece e como]
- **Autorização:** [onde é validada, modelo de permissões]
- **Dados sensíveis:** [lista dos dados sensíveis e como são protegidos]
- **Dados que nunca saem criptografados:** [lista]

## 6. Estratégia de escala

**Gargalos previstos:** [onde o sistema vai travar primeiro com crescimento]
**Estratégia:** [como o sistema acomoda 10x o volume sem reescrita]
**O que exige reescrita acima de X:** [quando a arquitetura atual deixa de funcionar]

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | yyyy-mm-dd | criação inicial |
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks
[[02-requisitos-funcionais-engenharia-da-especificacao]] — requisitos que essa arquitetura precisa sustentar
[[04-modelo-de-dados-engenharia-da-informacao]] — como os dados vivem dentro dessa arquitetura
[[08-registro-de-decisoes-engenharia-da-governanca]] — onde registrar decisões arquiteturais tomadas ao longo do tempo
