---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-07-29
updated: 2026-07-30
owner: willians
---

# Design System — Jocley Grill

> Referência: [[prd-jocley-lanchonete]]

---

## 1. Princípios de design

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| **Clareza de restaurante, não de barbearia** | O sistema é claro (fundo `#f8fafc`) como o vilamill-sistema, não escuro/dourado como o sistema-thieco — decisão explícita do cliente, "cores claras por se tratar de um restaurante" | Sidebar do Admin/Supervisor é clara; só o KDS (cozinha) e a navbar do Caixa/Atendente usam fundo escuro, por herança direta do padrão visual do vilamill |
| **Estado à primeira vista** | Quem está com o tablet na mão precisa saber o estado de mesas e comandas sem ler texto | Cores de status no grid de mesas (LIVRE/OCUPADA/CONTA); urgência do KDS por cor de borda (neutro/âmbar/vermelho) |
| **Ação > contemplação** | Telas operacionais (mesas, balcão, comanda, KDS) não são dashboards — o caminho até a ação principal é o mais curto possível | Clicar na mesa já abre a comanda; botão "Fechar Comanda" sempre visível |
| **Papel define o que se vê, não só o que se pode clicar** | Cada um dos 5 papéis vê apenas os itens de menu relevantes à própria função — não é uma tela genérica com botões desabilitados | Sidebar filtra grupos/itens por `role`; Navbar troca o conjunto de links entre Caixa e Atendente; menu nunca lista algo que o usuário não pode acessar |
| **Marca visível em qualquer contexto** | O nome "Jocley Grill" aparece sempre, independente de qual shell está ativo (sidebar clara, navbar escura ou tela cheia do KDS) | Cabeçalho da sidebar (Admin/Supervisor), canto superior esquerdo da navbar escura (Caixa/Atendente), header dark do KDS (Cozinha) |

---

## 2. Fundamentos (tokens)

Definidos em `@theme` no `globals.css` (Tailwind v4, CSS-first) — decisão consciente de centralização, evolução em relação ao vilamill-sistema original, que tinha cores de marca em hex hardcoded espalhadas pelos componentes.

### Cores

| Token | Valor | Significado | Quando usar |
|---|---|---|---|
| `--color-brand-primary` | `#d64000` (laranja queimado) | ação/destaque — remete a churrasco | botões primários, item ativo da sidebar, barra de gradiente no topo da sidebar |
| `--color-brand-primary-hover` | `#b33600` | hover do botão primário | — |
| `--color-brand-accent` | `#f2a93b` (dourado/mostarda) | detalhe, label de marca | label "Lanchonete" no topo da sidebar, ranking de pratos (barra secundária) |
| `--color-brand-dark` | `#1a1a1a` | navbar do Caixa/Atendente | herança direta do padrão de navbar escura do vilamill-sistema |
| `--color-bg` | `#f8fafc` | fundo geral claro | corpo da aplicação |
| `--color-sidebar-bg` | `#ffffff` | fundo da sidebar (Admin/Supervisor) | — |
| `--color-sidebar-active-bg` | `#fff1e8` | fundo do item ativo na sidebar | — |
| verde / vermelho / laranja / azul / âmbar / ciano (Tailwind padrão) | — | cards do dashboard financeiro (Receita, CMV, Despesas, Resultado, Mesas Abertas, Receita Líquida) | mesma paleta de cards do vilamill-sistema |
| zinc-950 / zinc-900 / zinc-800 (Tailwind padrão) | — | tema dark exclusivo do KDS | urgência de item pendente sobreposta (borda âmbar/vermelha) |

### Tipografia

| Token | Fonte | Uso |
|---|---|---|
| Geist Sans (via `next/font/google`) | — | fonte única do sistema, aplicada globalmente via CSS var `--font-geist-sans` |

### Espaçamento

Escala padrão do Tailwind (sem tokens customizados de espaçamento) — decisão de simplicidade, diferente do vilamill que definiu uma escala nomeada própria.

---

## 3. Componentes — intenção e limites

| Componente | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| **Sidebar** | Navegação do Admin/Supervisor, agrupada por seção, filtrada por role | Shell fixo à esquerda (desktop) / overlay (mobile) | Mostrar item que o role logado não pode acessar |
| **Navbar** | Navegação do Caixa/Atendente | Barra fixa no topo (dark) + bottom nav mobile | Mostrar link de Estoque para Atendente |
| **MesaCard / grid de mesas** | Comunicar estado da mesa em um olhar | Grade em `/mesas` | Texto longo dentro do card |
| **BalcaoList** | Listar comandas de balcão em aberto | `/balcao` | Misturar com comandas de mesa |
| **ComandaItens** | Tela compartilhada de itens/fechamento entre mesa e balcão | `/comanda/[id]` | Duplicar lógica entre mesa e balcão — é o mesmo componente |
| **PagamentoSplitDialog** | Registrar pagamento simples ou dividido, com bandeira opcional | Modal de fechamento de comanda | Permitir fechar sem a soma bater com o total |
| **CupomImpressao** | Gerar o cupom térmico | Disparado por `window.print()` após fechamento | Aparecer na tela fora do contexto de impressão (fica `hidden`) |
| **KdsBoard** | Fila de preparo da cozinha | `/cozinha`, tema dark full-screen | Misturar com o restante do sistema (não tem shell) |
| **FinanceiroCards** | Cards do dashboard | Início (`/`), exclusivo ADMIN | Aparecer para qualquer outro papel |
| **CardapioCalculoTable** | Tabela de CMV com markup/margem por produto | `/cmv`, exclusivo ADMIN | Confundir com a tabela de Cardápio (CRUD), que é outra tela |
| **FichaTecnicaEditor** | Editar os insumos de um produto | Modal aberto a partir de Cardápio ou CMV | Ficar acessível a papéis operacionais |
| **CalculadoraMetas** | Simula meta de vendas e projeta ganho/lucro por produto | `/inteligencia`, exclusivo ADMIN | Ignorar a taxa do canal de delivery selecionado no cálculo |
| **LogsErroTab** | Lista e detalha erros técnicos registrados pelo sistema | `/configuracoes`, exclusivo da conta `devmaster` | Aparecer para qualquer outro ADMIN — nem o item de menu pode existir para quem não é `devmaster` |

---

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| **Polling silencioso** | Telas operacionais atualizam via SWR sem indicador visível | 3s (mesas/balcão), 2s (KDS), 5s (financeiro) — sem flicker |
| **Shell por papel** | O "entorno" da tela muda conforme o role da sessão | Sidebar (Admin/Supervisor), Navbar (Caixa/Atendente), tela cheia sem shell (Cozinha) |
| **Fechamento em modal** | Pagamento acontece sem sair da tela de itens | `PagamentoSplitDialog` sobre `ComandaItens` |
| **Impressão isolada** | Cupom e DRE escondem todo o resto da página ao imprimir | Cupom via `visibility:hidden` + `position:fixed`; DRE via `print:hidden` nos elementos de navegação |
| **Somente leitura por papel** | Cardápio/Estoque mudam de CRUD completo para visualização pura conforme o papel | Botões de criar/editar/excluir somem inteiramente (não aparecem desabilitados) para CAIXA/ATENDENTE |

---

## 5. Linguagem — voz e tom

**Personalidade:** direta e funcional — herdada do tom do vilamill-sistema, sem humor nem informalidade excessiva.

**Tom em situações normais:**
- "Comanda fechada."
- "Item adicionado."

**Tom em erros:**
- "Valores não conferem. Restante: R$ X,XX"
- "Comanda sem itens"
- "Supervisor só pode criar logins de Caixa, Atendente ou Cozinha"

**Tom em estados vazios:**
- "Nenhuma comanda de balcão aberta"
- "Nenhum pedido pendente 🎉" (única exceção emotiva — usada no KDS quando a fila está zerada, reforço positivo pontual para a cozinha)

**O que evitar:**
- Linguagem técnica visível ao operador (ids, stack trace)
- Confirmação para ações de baixo risco (adicionar item)

**Reforçado em código desde 2026-07-30:** `withErrorHandling`/`handleApiError` (`src/lib/api-error.ts`) garante que nenhuma resposta de erro de API vaze stack técnico ao operador — sempre uma mensagem em português explicando o motivo (ver Módulo 16 dos Requisitos Funcionais). O stack técnico continua existindo, mas só é visível na aba Logs de Erro, exclusiva da conta `devmaster`.

---

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token de cor | willians | willians | entrada no [[registro-de-decisoes-jocley-lanchonete]] |
| Novo papel de acesso (ex.: um 6º role) | willians | willians | registro de decisão — impacto em middleware, sidebar/navbar e schema |
| Novo componente de UI Kit | willians | willians | adicionado ao [[ui-kit-jocley-lanchonete]] |

**Critério para deprecar:** componente substituído por versão mais alinhada ao princípio "papel define o que se vê".
