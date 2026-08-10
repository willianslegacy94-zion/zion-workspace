---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-07-23
owner: willians
---

# Design System — Academia Prof. Sandro

> Referência: [[prd-academiasandro]]

---

## 1. Princípios de design

| Princípio | Significado operacional | Exemplo de aplicação |
|---|---|---|
| **Status por cor, não por texto** | Estado financeiro e de pagamento devem ser reconhecidos pela cor do badge, sem precisar ler o texto todo | Badge verde ("Em dia"), âmbar ("Pendente"), vermelho ("Atrasado") na listagem de alunos |
| **Formulário acima da tabela** | Cadastro é a ação mais frequente — fica sempre visível no topo da página, sem navegação extra | `/alunos` e `/transacoes` têm o formulário de criação antes da listagem, na mesma página |
| **Sem fricção desnecessária** | Sem confirmação para ações não destrutivas; exclusão é direta (sem modal) nesta fase inicial | Botão "Excluir" na linha da tabela remove direto — simplicidade do MVP, revisitar se houver exclusão acidental |

> Com apenas duas telas implementadas, estes princípios ainda não foram testados com uso real — sujeitos a revisão conforme o sistema cresce.

---

## 2. Fundamentos (tokens)

Definidos em `src/app/globals.css`, via `@theme inline` do Tailwind v4 (Tailwind v4 não lê `tailwind.config.ts` por padrão).

### Cores

| Token | Valor | Significado | Quando usar |
|---|---|---|---|
| `--background` (dark, default) | `#0F0E0A` | fundo padrão do sistema | `<body>` — tema escuro é o default |
| `--background` (`.light`) | `#F7F5EF` | fundo em tema claro | quando a classe `.light` está presente no `<html>`/`<body>` |
| `--foreground` (dark, default) | `#F7F5EF` | texto padrão sobre fundo escuro | corpo de texto |
| `--foreground` (`.light`) | `#0F0E0A` | texto padrão sobre fundo claro | corpo de texto no tema claro |
| `color-primary` | `#D4AF37` (dourado) | ação principal, links de destaque | botões de submit, item ativo da navegação |
| `color-secondary` | `#A9791E` (bronze) | hover de ação principal | `hover:bg-secondary` nos botões |
| `color-success` | `#22c55e` | positivo | badge "Em dia", saldo ≥ 0, tipo "Receita" |
| `color-warning` | `#f59e0b` | atenção | badge "Pendente" |
| `color-error` | `#ef4444` | negativo/destrutivo | badge "Atrasado", saldo < 0, tipo "Despesa", botão "Excluir" |
| `color-info` | `#3b82f6` | informativo (reservado — ainda sem uso nas telas atuais) | — |
| `color-surface` | `#161310` (dark) / `#EDEAE0` (light) | fundo de superfícies elevadas (sidebar, cards) | `bg-surface` |
| `color-surface-card` | `#1C1A14` (dark) / `#F2EFE6` (light) | fundo de cards (`card-premium`) | — |
| `color-surface-hover` | `#241F16` (dark) / `#E4E0D2` (light) | hover de itens de navegação, fundo de inputs (`input-dark`) | — |
| `color-surface-border` | `#2E2A1E` (dark) / `#D8D3C0` (light) | bordas de cards/sidebar/tabelas | — |
| `background-image-gold-gradient` | gradiente `secondary → #F5D76E → secondary` | linha decorativa dourada, fundo de `btn-gold` | registrado como variável de tema no namespace `--background-image-*` do Tailwind v4 — **não** é uma classe CSS solta; precisa disso pra `@apply` funcionar |

> Tokens de superfície (`surface*`) e o gradiente dourado foram adicionados em 2026-07-12, adaptando a paleta onix/gold do `sistema-thieco` — por coincidência, o `primary`/`secondary` já existentes aqui já eram quase idênticos ao gold do Thieco.

### Tipografia

| Token | Fonte | Observação |
|---|---|---|
| `--font-sans` | `var(--font-geist-sans)` (Geist, via `next/font/google`) | **Resolvido (2026-07-12):** `body` em `globals.css` agora usa `font-family: var(--font-sans)` — Geist é definitivamente a fonte do sistema. Qualquer "Arial" residual no CSS compilado é só o `@font-face` de fallback métrico que o Next.js gera automaticamente pra Geist (evita layout shift), não afeta a fonte renderizada |
| `--font-mono` | `var(--font-geist-mono)` (Geist Mono) | sem uso identificado nas telas atuais |
| `--font-serif` | `var(--font-playfair)` (Playfair Display, via `next/font/google`) | Adicionado em 2026-07-12 — fonte de destaque pra títulos e nome de marca (`font-serif`), criando contraste tipográfico com o corpo do texto (Geist). Mesma fonte usada pelo `sistema-thieco` pros headings. Aplicada via `PageHeader`, nome da marca na sidebar, e títulos das telas de auth (login, esqueci-senha, resetar-senha, matricule-se) |

### Espaçamento

Sem tokens de espaçamento próprios definidos — telas atuais usam a escala padrão do Tailwind (`gap-4`, `gap-6`, `gap-8`, `px-6`, `py-12` etc.) diretamente nas classes utilitárias, sem abstração adicional.

---

## 3. Componentes — intenção e limites

| Componente (uso atual, sem extração formal) | Intenção | Contexto de uso | O que não fazer |
|---|---|---|---|
| Badge de status | comunicar estado em uma cor | coluna "Pagamento" e "Vencimento" em `/alunos` | usar cor fora da paleta semântica (success/warning/error) |
| Formulário de cadastro | criar registro com o mínimo de campos obrigatórios | topo de `/alunos`, `/transacoes`, `/despesas`, `/matricule-se` | exigir campos que não sejam essenciais ao registro |
| Tabela de listagem | exibir todos os registros com ação de exclusão por linha | corpo de `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros` | mais de ~7 colunas sem quebra responsiva |
| Botão primário (`bg-primary`) | ação de submit do formulário | "Cadastrar aluno", "Registrar transação" | mais de um botão primário visível por formulário |

### Componentes extraídos (adaptados do `sistema-thieco`, 2026-07-12)

| Componente | Arquivo | Intenção |
|---|---|---|
| `AppShell` | `src/components/AppShell.tsx` | Sidebar fixa/colapsável + topbar, único client component do projeto |
| `NotificacaoSino` | `src/components/NotificacaoSino.tsx` | Sino de alertas (vencimentos + pré-cadastros), calculado no servidor e passado como prop |
| `PageHeader` | `src/components/PageHeader.tsx` | Cabeçalho de página (ícone em badge dourado + título `font-serif` + subtítulo + slot de ação opcional) — aplicado em Dashboard, Alunos, Transações, Despesas, Pré-cadastros (2026-07-12) |
| `.card-premium` | `globals.css` | Container elevado com borda e sombra — usado em cards do dashboard, forms de login/despesas |
| `.input-dark` | `globals.css` | Input com fundo `surface-hover` — usado nos forms redesenhados (login, despesas, matricule-se) |
| `.btn-gold` / `.btn-outline-gold` | `globals.css` | Botão de ação primária/secundária com o gradiente dourado |
| `.gold-divider` / `.text-gold-shimmer` | `globals.css` | Divisor ornamental e texto com brilho animado — usados nos títulos das telas de auth |

> `/alunos` e `/transacoes` **não** foram re-estilizadas com essas classes — mantiveram o padrão `border-foreground/10` original, pra não misturar estilos dentro da mesma tela sem necessidade. As classes novas foram usadas só nas telas novas/redesenhadas (login, esqueci-senha, resetar-senha, matricule-se, despesas, dashboard).

### Favicon e ícones temáticos (2026-07-12)

| Elemento | Onde está | Regra de uso |
|---|---|---|
| Favicon (faixa de jiu-jitsu) | `src/app/icon.svg` | Desenho geométrico (nó dourado/bronze + 2 graus brancos), convenção nativa `icon.svg` do Next.js |
| 🥊 (luva de boxe) | Botão "Entrar" do login | Só no login — não usar em outros botões |
| 🥋 (kimono/gi) | Botões "Cadastrar aluno" (`/alunos`) e "Enviar cadastro" (`/matricule-se`) | Reservado pra ações ligadas a aluno/treino |

> **Regra deliberada:** ícones temáticos em emoji só aparecem em telas voltadas a aluno/treino (login, cadastro). Telas financeiras (`/transacoes`, `/despesas`, `/pre-cadastros`) ficam sem emoji, mantendo aparência mais sóbria/profissional — decisão explícita pra não comprometer a percepção de confiabilidade numa tela de números pro cliente.

### Logos das modalidades no login (2026-07-22)

| Elemento | Onde está | Regra de uso |
|---|---|---|
| Logo Sandro Freire Personal | `public/logos/sandro-freire-personal.png` | Centralizado, sozinho, no topo da composição |
| Logos Capoeira Senzala + Matos Fight Team (Muay Thai) | `public/logos/capoeira-senzala.png`, `public/logos/matos-fight-team.png` | Lado a lado, abaixo do logo do Personal — formação triangular |

Os 3 arquivos originais (`academia-sandro/logos/`) eram JPEGs com fundo sólido opaco salvos com extensão `.png` — sem fundo transparente, não "pareciam nativos" do tema escuro. Processados com `sharp` (flood-fill a partir das bordas + recompressão em paleta) pra remover o fundo e reduzir o tamanho do arquivo (~70-78%). **Se novos logos forem adicionados no futuro, preferir already-transparent PNG na origem** — o processamento de remoção de fundo é um workaround, não o fluxo ideal.

---

## 4. Padrões de interação

| Padrão | Descrição | Comportamento esperado |
|---|---|---|
| **Revalidação após mutação** | Toda Server Action chama `revalidatePath()` da rota correspondente | Página re-renderiza com o dado novo sem recarregar manualmente |
| **Exclusão direta** | Botão "Excluir" dispara a Server Action imediatamente, sem modal de confirmação | Risco conhecido de exclusão acidental — aceito nesta fase de MVP |
| **Campo obrigatório nativo** | Validação de campos obrigatórios via atributo HTML `required` | Navegador bloqueia o submit antes de chegar ao servidor; sem mensagens de erro customizadas ainda |

---

## 5. Linguagem — voz e tom

Ainda não há textos de erro, sucesso ou estado vazio customizados além dos estados vazios das tabelas:
- "Nenhum aluno cadastrado ainda."
- "Nenhuma transação registrada ainda."

Toda validação de campo obrigatório usa a mensagem nativa do navegador (não customizada). Mensagens de erro do servidor (ex: `throw new Error(...)` nas Server Actions) ainda não têm tratamento visual — um erro lançado hoje quebra a renderização da página em vez de mostrar uma mensagem amigável.

---

## 6. Governança

| Tipo de mudança | Quem pode propor | Quem aprova | Como é registrada |
|---|---|---|---|
| Novo token de cor | Willians | Willians | entrada no [[registro-de-decisoes-academiasandro]] |
| Extração de componente para `src/components/` | Willians | Willians | atualização do [[ui-kit-academiasandro]] |

Sistema ainda pequeno demais para ter processo formal de deprecação — revisitar quando houver mais de uma tela reutilizando o mesmo componente.
