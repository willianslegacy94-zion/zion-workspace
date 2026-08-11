---
status: stable
domain: governance
source: claude
created: 2026-05-24
updated: 2026-06-25
owner: willians
---

# system-rules

## proposito

este documento define as regras operacionais, padrões organizacionais e protocolos cognitivos utilizados em todo o ecossistema kernel-hq.

essas regras existem para:
- preservar consistência arquitetural entre sistemas
- reduzir regressões em regras de negócio documentadas
- padronizar comportamento dos agentes e IAs
- melhorar colaboração entre sessões (qualquer LLM)
- manter continuidade operacional sem dependência de memória conversacional
- evitar conhecimento tribal — tudo que importa está no markdown

aplica-se a: arquitetura-thieco, arquitetura-villamill, e qualquer sistema futuro.

---

# naming-convention

## arquivos

todos os arquivos devem seguir:

- apenas minúsculas
- hífen no lugar de espaços
- nomes semânticos
- sem acentos
- sem caracteres especiais
- sem underscore
- sem nomes de ia nos arquivos
- sem numeração desnecessária nos arquivos
- sufixo com nome do sistema (ex: `-thieco`, `-villamill`)

---

## correto

```text
prd-thieco.md
modelo-de-dados-thieco.md
registro-de-decisoes-thieco.md
design-system-villamill.md
system-creation-thieco.md
```

---

## incorreto

```text
PRD Thieco.md
01-chatgpt-arquitetura.md
modelo_dados.md
ArquiteturaThieco.md
claude-prd.md
```

---

# folder-structure

pastas organizam domínios e sistemas.

pastas podem utilizar prefixos numéricos para preservar hierarquia e navegação.

## correto

```text
00-governance
00-governance-systems
00-types
arquitetura-thieco
arquitetura-villamill
```

## incorreto

```text
Governance
Arquitetura Thieco
THIECO SYSTEM
aiox stuff
```

---

# metadata-standard

todos os arquivos operacionais devem começar com metadata yaml.

## estrutura-obrigatoria

```yaml
---
status:
domain:
source:
created:
updated:
owner:
---
```

---

# metadata-fields

## status

define maturidade operacional e confiabilidade.

valores permitidos:

```text
draft
experimental
validating
approved
stable
deprecated
archived
```

regras detalhadas em [[status-promotion-rules]].

---

## domain

define domínio/sistema responsável.

exemplos para kernel-hq:

```text
governance
thieco
villamill
```

---

## source

define origem do documento.

exemplos:

```text
claude
chatgpt
aiox
manual
```

---

## created

data de criação.

formato:

```text
yyyy-mm-dd
```

---

## updated

última atualização.

formato:

```text
yyyy-mm-dd
```

Obrigatório atualizar sempre que o artefato for modificado.

---

## owner

responsável principal.

para kernel-hq:

```text
willians
```

---

# status-system (resumo)

referência rápida — detalhe completo em [[status-promotion-rules]].

## draft
exploração inicial.
não confiável.
altamente mutável.

## experimental
em teste operacional.
pode quebrar.
ainda não validado.

## validating
funcionando mas em observação.
feedback ainda sendo coletado.

## approved
comportamento/sistema aprovado.
não deve ser alterado casualmente.

## stable
comportamento operacional consolidado.
mudanças exigem justificativa arquitetural.

## deprecated
não recomendado para uso.
mantido apenas para histórico/referência.

## archived
material congelado.
sem manutenção ativa.

---

# operational-principles

## architecture-over-memory

conhecimento importante nunca deve existir apenas em conversa ou memória humana.

todo padrão validado deve ser documentado nos artefatos do sistema correspondente.

---

## domain-over-authorship

organização do conhecimento deve priorizar domínio operacional e não autoria da ia.

correto:
```text
arquitetura-thieco.md
registro-de-decisoes-thieco.md
```

incorreto:
```text
claude-arquitetura.md
chatgpt-decisoes.md
```

---

## semantic-over-chronological

arquivos representam conceitos e sistemas.

evitar:
- nomes temporais (sessao-2026-05-24.md)
- nomes conversacionais (resposta-claude.md)
- nomes de prompts (prompt-prd.md)

---

## explicit-context

ias performam melhor com regras operacionais explícitas.

decisões importantes devem virar contexto persistente nos artefatos — não ficam apenas na conversa.

---

## approved-behaviors-protection

regras de negócio e comportamentos aprovados devem ser protegidos contra regressões.

agentes devem:
- consultar `registro-de-decisoes-{sistema}.md` antes de propor mudanças
- evitar alterar regras aprovadas sem justificativa
- preservar comportamento operacional validado

---

# agent-rules

## agents-operate-by-domain

agentes atuam por domínio.

exemplos:
- sessao no sistema thieco → ler artefatos de arquitetura-thieco
- sessao no sistema villamill → ler artefatos de arquitetura-villamill
- sessao de governança → ler artefatos de 00-governance

---

## agents-must-read-context

antes de modificar sistemas, agentes devem consultar:

```text
00-governance/ai-collaboration-protocol.md
arquitetura-{sistema}/indice-{sistema}.md
arquitetura-{sistema}/registro-de-decisoes-{sistema}.md
```

---

## agents-must-respect-approved-status

sistemas approved e stable exigem alto cuidado antes de alterações.

---

## no-hidden-decisions

decisões importantes devem ser documentadas em `registro-de-decisoes-{sistema}.md`.

evitar:
- correções invisíveis sem registro
- mudanças silenciosas em comportamento
- alterações em regras de negócio não documentadas

---

# ordem-de-entradas-em-logs

arquivos de log acumulam entradas em **ordem cronológica crescente** — a entrada mais recente sempre no final do arquivo.

aplica-se a:
- `registro-de-decisoes-{sistema}.md`
- qualquer arquivo que acumule registros por data

**regra para IAs:** ao adicionar uma nova entrada, sempre anexar ao final do arquivo — nunca inserir no início ou no meio.

**motivo:** "leia a última entrada" significa ler o final do arquivo. Inserir no início inverte a ordem e quebra o protocolo de leitura.

---

# wikilinks

todo arquivo criado dentro do ecossistema deve ter pelo menos um `[[wikilink]]` conectando-o a outro arquivo relevante.

objetivo: manter o grafo do Obsidian como representação visual real do ecossistema — sem nós isolados.

## regras por tipo de arquivo

| tipo de arquivo | o que linkar |
|---|---|
| governança / guia | os arquivos que descreve ou referencia |
| prd / requisitos | [[indice-{sistema}]] |
| arquitetura | [[prd-{sistema}]], [[modelo-de-dados-{sistema}]] |
| modelo de dados | [[arquitetura-{sistema}]], [[prd-{sistema}]] |
| design system | [[prd-{sistema}]], [[ui-kit-{sistema}]] |
| ui-kit | [[design-system-{sistema}]] |
| ux-flows | [[prd-{sistema}]], [[design-system-{sistema}]] |
| registro de decisoes | [[prd-{sistema}]], [[requisitos-funcionais-{sistema}]], [[arquitetura-{sistema}]] |

## regra mínima

se não souber o que linkar, linke ao menos para o índice do sistema:
- arquivos em `arquitetura-thieco/` → `[[indice-thieco]]`
- arquivos em `arquitetura-villamill/` → `[[indice-villamill]]`
- arquivos em `arquitetura-kernel/` → `[[indice-kernel]]`
- arquivos em `arquitetura-horizon/` → `[[indice-horizon]]`
- arquivos em `arquitetura-pulsar/` → `[[indice-pulsar]]`
- arquivos em `arquitetura-quasar/` → `[[prd-quasar]]`
- arquivos em `arquitetura-cortex/` → `[[indice-cortex]]`
- arquivos em `arquitetura-insight/` → `[[indice-insight]]`
- arquivos em `arquitetura-prospeccao/` → `[[indice-prospeccao]]`
- arquivos em `00-governance/` → `[[ecosystem-guide]]`

---

# regras-por-sistema

regras técnicas e comportamentais específicas de cada sistema vivem dentro do próprio sistema.

| sistema | arquivo de regras |
|---|---|
| thieco | `arquitetura-thieco/registro-de-decisoes-thieco.md` |
| villamill | `arquitetura-villamill/registro-de-decisoes-villamill.md` |
| kernel | `arquitetura-kernel/registro-de-decisoes-kernel.md` |
| horizon | `arquitetura-horizon/registro-de-decisoes-horizon.md` |
| pulsar | `arquitetura-pulsar/registro-de-decisoes-pulsar.md` |
| quasar | `arquitetura-quasar/registro-de-decisoes-quasar.md` |
| cortex | `arquitetura-cortex/registro-de-decisoes-cortex.md` |
| insight | `arquitetura-insight/registro-de-decisoes-insight.md` |
| prospeccao | `arquitetura-prospeccao/registro-de-decisoes-prospeccao.md` |

---

# knowledge-system

## context-is-infrastructure

documentação é tratada como infraestrutura operacional.

não como documentação passiva.

---

## conversations-are-not-source-of-truth

conhecimento validado deve migrar para markdown persistente nos artefatos do sistema.

---

## obsidian-is-operational-memory

obsidian funciona como:
- memória persistente entre sessões
- contexto operacional explícito
- registro arquitetural rastreável
- infraestrutura de colaboração entre ias e sessões

---

# runtime-philosophy

os sistemas em kernel-hq devem priorizar:

- clareza operacional
- continuidade contextual entre sessões
- consistência comportamental
- baixa fricção cognitiva para o operador
- resiliência arquitetural
- lógica operacional explícita nos artefatos

---

# final-principle

o ecossistema kernel-hq não é tratado como um repositório de documentação tradicional.

ele é tratado como:

```text
infraestrutura de conhecimento operacional
```

portanto:
- contexto é infraestrutura — não é opcional
- comportamento é arquitetura — regras de negócio são tão importantes quanto código
- lógica operacional deve ser explícita nos artefatos
- conhecimento validado deve persistir entre sessões e entre IAs

---

# historico-de-versao

| versao | data | descricao |
|---|---|---|
| v1.0 | 2026-05-24 | criacao inicial para kernel-hq — adaptado e contextualizado para os sistemas thieco e villamill |
| v1.1 | 2026-06-25 | expansao para ecossistema completo — 10 sistemas registrados: ivsstore, orbita-whitelabel, horizon, pulsar, quasar, cortex, insight, prospeccao |
