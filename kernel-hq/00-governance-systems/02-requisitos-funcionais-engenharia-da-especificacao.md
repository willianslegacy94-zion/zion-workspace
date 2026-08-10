---
status: stable
domain: governance-systems
source: claude
created: 2026-05-20
updated: 2026-05-24
owner: willians
---

# O que é (definição estrutural)
Os **Requisitos Funcionais** são o **sistema que traduz decisão em comportamento especificado**.

Não é lista de features.  
É a **engenharia da especificação** — define com precisão o que o sistema faz, como se comporta e quando está correto.

# Função no sistema
Converter decisão → comportamento especificado → critério de aceitação

Ele pega:
- o que foi decidido (PRD)
- o problema que precisa ser resolvido
- o escopo que foi acordado

E transforma em:
- comportamentos numerados e rastreáveis
- regras de negócio explícitas
- critérios que definem quando algo está pronto

# Papel dentro do sistema
- **PRD** → define o que e por quê
- **Requisitos Funcionais** → define o que exatamente o sistema faz
- **Arquitetura** → define como isso é construído

Ele é a ponte entre **decisão de produto e execução de engenharia**

# Princípio central
"Se o comportamento não está especificado, cada pessoa implementa o que imaginou."

# Estrutura essencial (nível operacional)
## 1. Módulos funcionais
- Agrupamento de funcionalidades por domínio
- Cada módulo tem responsabilidade única e bem definida

Sem módulos → requisitos viram lista sem estrutura

## 2. Requisitos funcionais (RF)
- O que o sistema deve fazer — comportamento observável
- Formato: RF-XXX — [ação] — [condição] — [resultado esperado]
- Numeração contínua e rastreável ao PRD

## 3. Requisitos não funcionais (RNF)
- Como o sistema deve se comportar — qualidade, não funcionalidade
- Performance, segurança, acessibilidade, confiabilidade
- Tão importantes quanto os funcionais — ignorados com mais frequência

## 4. Regras de negócio
- Restrições e lógicas que governam o comportamento
- Ex: "apenas uma sessão ativa por vez", "senha mínima de 6 caracteres"
- São invariantes — não podem ser violadas por nenhuma implementação

## 5. Estados e transições
- Quais estados cada entidade pode ter?
- Quais transições são válidas?
- O que dispara cada transição?

## 6. Critérios de aceite gerais
- O que precisa ser verdadeiro para o sistema ser considerado funcional?
- Lista objetiva e verificável — não subjetiva

# Onde os Requisitos Funcionais quebram
- viram lista de desejos sem critério de aceitação
- não rastreiam ao PRD — especificam o que ninguém decidiu
- regras de negócio ficam implícitas no código
- RNFs são ignorados até virarem incidentes
- estados e transições não são mapeados — o sistema fica em estado inválido

Resultado: desenvolvimento correto de algo diferente do que foi decidido

# Insight crítico
Requisito não é o que o sistema tem.

É o **contrato entre quem decide e quem constrói**.

Sem contrato → cada um cumpriu o que entendeu.

---

# Template de aplicação — `requisitos-funcionais-[sistema].md`

Use este template ao especificar os requisitos de um sistema. Cada RF deve ser rastreável ao PRD. Cada regra de negócio deve ser invariante — não pode ser violada por nenhuma implementação.

```markdown
---
status: draft
domain: [nome-do-sistema]
source: claude
created: yyyy-mm-dd
updated: yyyy-mm-dd
owner: [nome]
---

# Requisitos Funcionais — [Nome do Sistema]

> Referência: [[prd-[sistema]]]

## Módulos funcionais

### Módulo 1 — [Nome do Módulo]
[Uma frase descrevendo a responsabilidade única deste módulo]

#### Requisitos Funcionais

| ID | O que o sistema faz | Condição | Resultado esperado |
|---|---|---|---|
| RF-001 | [ação do sistema] | [quando / se / dado que] | [o que acontece] |
| RF-002 | [ação do sistema] | [quando / se / dado que] | [o que acontece] |

#### Regras de negócio
- **RN-001:** [Invariante — restrição que nunca pode ser violada]
- **RN-002:** [Invariante — restrição que nunca pode ser violada]

---

### Módulo 2 — [Nome do Módulo]
[...]

---

## Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-001 | Performance | [ex: tempo de resposta máximo de 2s para consultas principais] |
| RNF-002 | Segurança | [ex: dados sensíveis nunca trafegam sem criptografia] |
| RNF-003 | Disponibilidade | [ex: uptime mínimo de 99% em dias úteis] |
| RNF-004 | Acessibilidade | [ex: interface navegável por teclado] |

## Estados e transições

| Entidade | Estados possíveis | Transições válidas | O que dispara |
|---|---|---|---|
| [Entidade] | [estado-a, estado-b, estado-c] | [a → b] | [evento ou ação] |

## Critérios de aceite gerais

- [ ] [O sistema faz X quando Y — verificável por teste ou observação]
- [ ] [O sistema impede Z quando W — verificável por teste ou observação]
- [ ] [O sistema exibe N quando o estado é M]
```

---

# Links relacionados

[[00-indice]] — mapa completo dos frameworks
[[01-prd-engenharia-da-decisao]] — PRD que deve existir antes dos requisitos
[[03-arquitetura-tecnica-engenharia-da-estrutura]] — próximo passo: como o sistema sustenta esses requisitos
