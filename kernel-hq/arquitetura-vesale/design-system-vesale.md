---
status: draft
domain: vesale
source: claude
created: 2026-09-12
updated: 2026-09-16
owner: willians
---

# Design System — Drogaria Vesale

> Referência: [[prd-vesale]]
> Fonte visual: `LogoVesale.png` — foto real da fachada da farmácia

## 1. Princípios de design

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| Neutralidade no fundo, cor no significado | A área de trabalho é predominantemente branca/cinza claro; azul marinho e vermelho aparecem só onde carregam significado (navegação, ação, alerta) — nunca como decoração de fundo | Painel de produtos no PDV tem fundo branco/cinza claro; só o header e o botão "Finalizar Venda" carregam azul marinho |
| Agilidade > estética | No PDV, qualquer elemento visual que atrase o operador (animação, confirmação redundante, hierarquia confusa) é removido ou simplificado | Busca de produto no PDV não tem transição/animação de abertura — aparece instantânea |
| Vermelho é alerta, nunca decoração | Vermelho é reservado para cancelar, excluir, erro e margem negativa — nunca usado como cor de destaque positivo ou puramente estética | O botão "Finalizar Venda" é azul marinho, não vermelho, mesmo sendo a ação mais frequente — vermelho ficaria associado erroneamente a "ação principal" |
| Hierarquia da marca reflete a fachada | "DROGARIA" sempre menor que "VESALE" em qualquer aplicação da marca dentro do sistema, replicando a hierarquia visual real da fachada | Header do sistema: "DROGARIA" em caixa alta pequena acima/ao lado de "VESALE" em destaque, fonte grossa |

## 2. Fundamentos (tokens)

### Cores

Paleta extraída visualmente da foto real da fachada (`LogoVesale.png`), reconfirmada com Willians em 2026-09-15 (ver [[registro-de-decisoes-vesale]]) — pendência de confirmação de paleta resolvida. Arquivo vetorial da marca continua não existindo, só a foto; hex abaixo é extração aproximada a partir dela.

| Token | Valor | Significado | Quando usar |
|---|---|---|---|
| `color-primary` (azul marinho) | `#17388C` | cor institucional da marca, extraída do fundo da placa da fachada | header/sidebar de navegação, botão de ação principal (ex.: "Finalizar Venda"), título "VESALE" em fundo claro |
| `color-primary-dark` | `#0D2359` | variação mais escura do azul marinho | hover/active de elementos primários, texto sobre fundo claro quando `color-primary` não tem contraste suficiente |
| `color-danger` (vermelho) | `#D9251F` | cor de alerta da marca, extraída da faixa e do símbolo da cruz na fachada | alertas, notificações, botões de exclusão/cancelamento, margem negativa (RF-021), detalhes gráficos pontuais |
| `color-danger-dark` | `#A81A16` | variação mais escura do vermelho | hover/active de botões de perigo |
| `color-surface` (branco) | `#FFFFFF` | fundo dos painéis de dados e tipografia sobre fundos escuros | cards, tabelas, formulários, texto dentro do header azul marinho |
| `color-background` | `#F5F6FA` | fundo geral da área de trabalho — neutro, não cansa a vista em uso prolongado | fundo de página por trás dos painéis |
| `color-neutral-900` | `#1A1A1A` | texto principal | corpo de texto sobre fundo claro |
| `color-neutral-600` | `#5B6270` | texto secundário/label | legendas, texto de apoio |
| `color-neutral-200` | `#E2E5EC` | bordas e divisores | linhas de tabela, bordas de input |
| `color-feedback-success` | `#2E7D32` | confirmação, estado válido (ex.: margem positiva, venda finalizada) | mensagens de sucesso, indicador de margem saudável |
| `color-feedback-warning` | `#ED8F1C` | atenção sem ser erro (ex.: estoque baixo) | sinalização de reposição (RF-007) |

### Tipografia

| Token | Família | Tamanho | Peso | Uso |
|---|---|---|---|---|
| `type-brand` | fonte de apoio grossa/condensada (ex.: Archivo Black, Barlow Condensed Bold) | 20–24px | 800/900 (black) | "VESALE" no header — reflete a fonte grossa e clara da fachada |
| `type-brand-sub` | mesma família da UI, uppercase | 10–11px, letter-spacing aumentado | 600 | "DROGARIA" acima/ao lado do nome da marca — sempre menor |
| `type-heading-1` | Inter (ou equivalente do sistema) | 24px | 700 | título principal de página/módulo |
| `type-heading-2` | Inter | 18px | 600 | título de seção/card |
| `type-body` | Inter | 14px | 400 | texto corrido, valores em tabela |
| `type-body-strong` | Inter | 14px | 600 | valores monetários e totais — precisam se destacar no PDV |
| `type-label` | Inter | 12px | 500 | labels de formulário e cabeçalho de tabela |

### Espaçamento

| Token | Valor | Uso |
|---|---|---|
| `space-xs` | 4px | espaço mínimo entre elementos relacionados (ícone + texto) |
| `space-sm` | 8px | espaçamento interno de componentes (padding de botão, input) |
| `space-md` | 16px | separação entre componentes distintos dentro de um card |
| `space-lg` | 24px | separação entre seções de uma página |
| `space-xl` | 40px | separação entre blocos maiores (ex.: header e conteúdo) |

### Grid

- Colunas: 12 (desktop), 4 (mobile/tablet estreito)
- Gutter: 16px
- Margem lateral: 24px (desktop), 16px (mobile)
- Breakpoints: mobile < 640px (uso emergencial), tablet 640–1024px (balcão do PDV — alvo principal), desktop > 1024px (telas de gestão/financeiro)

## 3. Componentes — intenção e limites

| Componente | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| Button primary (azul marinho) | ação principal da tela | "Finalizar Venda", "Salvar", "Conciliar Nota" | nunca usar vermelho para ação principal — quebra o significado de alerta |
| Button danger (vermelho) | ação destrutiva ou de cancelamento | "Cancelar Venda", "Excluir Produto" | nunca usar para ação neutra ou positiva |
| Sidebar/navegação | identidade + navegação entre módulos | fixa à esquerda, fundo azul marinho, logo no topo (migrou de header fixo no topo em 2026-09-17 — a lista de módulos cresceu além do que cabe num header horizontal) | módulo ainda não construído aparece na lista com indicação de "em breve" em vez de sumir, para o gestor ver o roadmap; nunca linkar um item sem tela por trás |
| Card de produto (PDV) | exibir produto buscado/escaneado de forma legível a distância curta no balcão | grid de resultado de busca no PDV | não incluir informação de custo/margem — PDV é visão de operador, sem dado sensível (RNF-002) |
| Badge de alerta (margem negativa / estoque baixo) | chamar atenção do gestor sem interromper o fluxo | lista de precificação (RF-021), lista de reposição (RF-007) | não usar a mesma cor para os dois alertas — margem negativa é vermelho (crítico), estoque baixo é laranja (atenção) |
| Tabela financeira | exibir dados numéricos com precisão e escaneabilidade | Financeiro, CMV, DRE | não usar zebra striping colorido — fundo branco com bordas neutras mantém foco no número |

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| Navegação por teclado no PDV | busca de produto, seleção de item e finalização de venda respondem a atalhos de teclado | operador nunca precisa tocar no mouse para o fluxo padrão (RN-006) |
| Alerta de margem negativa | quando preço ≤ custo travado | badge vermelho aparece junto ao produto em qualquer lista onde o preço é exibido ao gestor, sem precisar abrir o detalhe do produto |
| Feedback de venda finalizada | ao confirmar pagamento no PDV | confirmação visual imediata (não-bloqueante) e o PDV já limpa para a próxima venda |

## 5. Linguagem — voz e tom

**Personalidade:** direta e funcional — o sistema fala como uma ferramenta de trabalho de balcão, não como um app de consumo. Frases curtas, sem gíria.

**Tom em situações normais:** "Venda finalizada." / "Nota fiscal conciliada."

**Tom em erros:** claro sobre o que impede a ação, sem jargão técnico — "Não é possível finalizar: item sem estoque disponível." em vez de um código de erro cru.

**Tom em estados vazios:** orientado à próxima ação — "Nenhum produto cadastrado ainda. Cadastre o primeiro produto para começar a vender."

**O que evitar:** exclamações e tom "vendedor" (evitar "Ótimo! 🎉"); a farmácia é um ambiente de trabalho sério, mesmo em telas de sucesso.

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token | quem estiver implementando | Willians (dev) + validação da cliente para tokens de marca | entrada em [[registro-de-decisoes-vesale]] |
| Alteração de princípio | Willians | Willians + cliente | registro + atualização deste documento |
| Deprecação de componente | quem estiver implementando | Willians | marcação no [[ui-kit-vesale]] + prazo de migração |

**Critério para deprecar:** componente é removido quando um padrão substituto cobre o mesmo caso de uso sem perda de clareza para o operador de balcão.
**Período de migração:** sem prazo fixo definido nesta fase inicial (sistema ainda não está em produção) — a definir quando houver primeira versão publicada.

---

# Links relacionados

[[prd-vesale]] — decisão de produto que origina estes princípios
[[ui-kit-vesale]] — materialização concreta deste Design System
[[requisitos-funcionais-vesale]] — RF-021, RN-006 e RNF-002/005 referenciados acima
