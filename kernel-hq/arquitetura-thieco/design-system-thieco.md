---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-07-01
owner: willians
---

# Design System — Barbearia Thieco Leandro

> Referência: [[prd-thieco]]

---

## 1. Princípios de design

São as decisões que governam qualquer escolha visual. Quando houver conflito entre duas opções, os princípios resolvem.

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| **Velocidade > elegância** | O operador está em serviço — cada toque extra é custo. A interface precisa ser mais rápida que o processo manual que substituiu. | Formulário de venda com defaults inteligentes (data = hoje, unidade = unidade do barbeiro logado) |
| **Clareza numérica** | Valores financeiros nunca geram dúvida. Comissão, valor líquido e total são sempre visíveis e destacados. | Destaque tipográfico nos campos de valor; separação visual entre valor bruto e líquido |
| **Estado explícito** | O sistema sempre mostra em que estado está. Nada fica implícito. | Indicador de unidade ativa, nome do barbeiro logado visível, status do caixa do dia |
| **Hierarquia por função** | Admin e barbeiro veem coisas diferentes — a interface reflete isso sem confusão. | Navegação lateral reduzida para barbeiro; relatórios visíveis apenas para admin |
| **Operação mobile-first** | A barbearia não tem posto de desktop fixo — operadores usam celular durante o atendimento. | Layout de coluna única em mobile; botões com área de toque mínima de 44px |

---

## 2. Fundamentos (tokens)

### Cores

**Atualizado em 2026-07-01:** o sistema em produção usa uma paleta onix/dourado (não preto/branco como descrito na versão original desta seção) com suporte a dois modos — escuro (default, layout original) e claro (variante clara, mesma família dourada aprofundada para contraste). A troca é feita por variáveis CSS custom properties em `:root` (`--cor-fundo`, `--cor-primaria`, etc.), consumidas pelo Tailwind via helper `withOpacity()` (`tailwind.config.js`), e persistida em `localStorage` (`thieco_tema`). Ver [[registro-de-decisoes-thieco]] (2026-07-01 — Toggle escuro/claro).

| Token (CSS var)              | Escuro (default)         | Claro               | Significado                 | Quando usar                                                        |
| ---------------------------- | ------------------------ | ------------------- | --------------------------- | ------------------------------------------------------------------ |
| `--cor-fundo` (onix)         | `#0F0E0A`                | `#F7F5EF`           | fundo de página/base        | área de conteúdo                                                   |
| `--cor-primaria` (gold)      | `#D4AF37`                | `#A9791E`           | identidade premium da marca | destaques financeiros, ações principais, ícones de status positivo |
| `--cor-superficie` (surface) | tons de onix mais claros | tons claros neutros | cards, modais, formulários  | agrupar conteúdo                                                   |
| `color-feedback-success`     | #22c55e                  | #22c55e             | operação concluída          | venda registrada, caixa fechado                                    |
| `color-feedback-warning`     | #f59e0b                  | #f59e0b             | atenção necessária          | comissão zerada, desconto alto                                     |
| `color-feedback-error`       | #ef4444                  | #ef4444             | erro ou bloqueio            | validação de campo, ação negada                                    |
| `color-feedback-info`        | #3b82f6                  | #3b82f6             | informação neutra           | tooltips, notas                                                    |

**Regra de negócio:** o modo claro nunca introduz uma família de cor nova — é sempre a mesma paleta dourada/onix da marca, só invertida/aprofundada para legibilidade em fundo claro. Cores de feedback (sucesso/alerta/erro/info) não variam por tema.

### Tipografia

| Token | Família | Tamanho | Peso | Uso |
|---|---|---|---|---|
| `type-heading-1` | Inter | 24px | 700 | título de página (ex: "Caixa do Dia") |
| `type-heading-2` | Inter | 18px | 600 | título de seção (ex: "Resumo por Profissional") |
| `type-body` | Inter | 14px | 400 | texto corrido, descrições |
| `type-label` | Inter | 12px | 500 | labels de formulário, colunas de tabela |
| `type-value` | Inter | 20px | 700 | valores monetários destacados |
| `type-caption` | Inter | 11px | 400 | metadados, timestamps |

### Espaçamento

| Token | Valor | Uso |
|---|---|---|
| `space-xs` | 4px | espaço mínimo entre elementos relacionados |
| `space-sm` | 8px | padding interno de badges e chips |
| `space-md` | 16px | padding interno de cards e formulários |
| `space-lg` | 24px | separação entre seções |
| `space-xl` | 40px | separação entre blocos maiores de página |

### Grid

- Colunas: 4 (mobile) / 8 (tablet) / 12 (desktop)
- Gutter: 16px
- Margem lateral: 16px (mobile) / 24px (tablet+)
- Breakpoints: `sm` 640px / `md` 768px / `lg` 1024px

---

## 3. Componentes — intenção e limites

| Componente | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| **Button primary** | ação principal e irreversível da tela | "Registrar Venda", "Fechar Caixa" | mais de um por tela |
| **Button secondary** | ação secundária ou reversível | "Cancelar", "Editar" | para ações destrutivas sem confirmação |
| **Button ghost** | ação de baixa prioridade | filtros, "Ver mais" | para ações que movem dinheiro |
| **Button danger** | ação destrutiva com risco | "Excluir Venda" — com modal de confirmação | sem confirmação modal |
| **Input text** | entrada de valor livre | nome do cliente, observação | para campos com opções definidas (usar Select) |
| **Input currency** | entrada de valor monetário | valor da venda, desconto | input de texto livre — máscara monetária obrigatória |
| **Select** | escolha entre opções fixas | profissional, forma de pagamento, unidade | mais de 8 opções sem busca |
| **Badge** | comunicar estado de forma compacta | tipo de cliente, forma de pagamento, tipo de item | para informações que precisam de contexto longo |
| **Card** | agrupar informações relacionadas | resumo de comissão por barbeiro, totais do dia | aninhar cards dentro de cards |
| **Table** | listar registros com múltiplos atributos | listagem de vendas, relatório de gastos | mais de 6 colunas em mobile |
| **Modal** | confirmação de ação destrutiva | excluir venda, cancelar operação | para formulários complexos com muitos campos |

---

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| **Defaults inteligentes** | Campos com valor mais provável pré-selecionado | Data = hoje; unidade = unidade do barbeiro; tipo_cliente = agendado |
| **Cálculo em tempo real** | Campos dependentes atualizam sem submit | Ao digitar valor e desconto, comissão e valor líquido atualizam instantaneamente |
| **Confirmação para destrutivo** | Ações irreversíveis exigem modal de confirmação | "Tem certeza que deseja excluir esta venda?" com botão cancel em destaque |
| **Feedback imediato** | Toda ação retorna resposta visual em < 1s | Toast de sucesso após registro de venda; erro inline em campo inválido |
| **Estado vazio informativo** | Telas sem dados explicam o que fazer | "Nenhuma venda registrada hoje. Clique em + para registrar a primeira." |
| **Filtro persistente** | Filtros de data e unidade mantidos entre navegações da mesma sessão | Ao voltar ao relatório, período anterior continua selecionado |

---

## 5. Linguagem — voz e tom

**Personalidade:** direto, profissional, sem rodeios — como um bom contador de confiança.

**Tom em situações normais:**
- "Venda registrada com sucesso."
- "Caixa do dia: R$ 1.240,00"
- "Comissão de Igor: R$ 320,00"

**Tom em erros:**
- "Valor inválido. Informe um número maior que zero."
- "Selecione o profissional antes de registrar."
- "Não foi possível salvar. Tente novamente."

**Tom em estados vazios:**
- "Nenhuma venda registrada neste período."
- "Nenhum gasto cadastrado para Tambore em maio."

**O que evitar:**
- Linguagem técnica ("endpoint", "ID", "null")
- Mensagens de erro genéricas ("Erro 500" sem contexto)
- Confirmações redundantes para ações não destrutivas
- Emojis ou linguagem informal

---

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token de cor ou espaçamento | Willians | Willians | entrada no [[registro-de-decisoes-thieco]] |
| Alteração de princípio de design | Willians | Willians | atualização deste documento + registro de decisão |
| Novo componente | Willians | Willians | adicionado ao [[ui-kit-thieco]] com status draft |
| Deprecação de componente | Willians | Willians | marcado como deprecated com prazo de 30 dias para migração |

**Critério para deprecar:** componente não é usado em nenhuma tela ativa ou foi substituído por versão mais adequada ao princípio de velocidade.
**Período de migração:** 30 dias após marcação como deprecated.
