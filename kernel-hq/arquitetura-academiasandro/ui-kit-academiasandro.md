---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-07-23
owner: willians
---

# UI Kit — Academia Prof. Sandro

> Referência: [[design-system-academiasandro]]
> Implementação: Next.js 16 + Tailwind CSS v4 (`src/app/` + `src/components/`)

---

## Inventário de componentes

Desde 2026-07-12, `src/components/` existe com três componentes extraídos: `AppShell.tsx` (sidebar + topbar, client component), `NotificacaoSino.tsx` (sino de alertas) e `PageHeader.tsx` (cabeçalho de página com ícone + título serifado + subtítulo). Desde 2026-07-23, mais dois: `AlunoShell.tsx` (sidebar da Área do Aluno, client component) e `AgendaGrid.tsx` (grade de horários, server-compatible, reaproveitada no admin e no aluno). Fora esses cinco, o restante do HTML/Tailwind ainda vive inline dentro de cada `page.tsx`. O inventário abaixo documenta os padrões visuais repetidos, como referência para futuras extrações.

### Padrões inline repetidos

| Padrão | Onde aparece | Status | Onde está |
|---|---|---|---|
| Badge de status de pagamento | coluna "Pagamento" da tabela de alunos | draft (inline, não componentizado) | `src/app/alunos/page.tsx` — função `statusBadgeClass()` |
| Linha de tabela com ação "Excluir" | tabelas de `/alunos` e `/transacoes` | draft (inline, duplicado entre as duas telas) | `src/app/alunos/page.tsx`, `src/app/transacoes/page.tsx` |
| Formulário de cadastro (label + input/select + botão) | topo de `/alunos` e `/transacoes` | draft (inline, duplicado) | idem |
| Card de saldo (valor + cor condicional) | topo de `/transacoes` | draft (inline) | `src/app/transacoes/page.tsx` |

### Layouts (patterns)

| Layout | Uso | Status |
|---|---|---|
| `AppShell` (sidebar + topbar) | sidebar fixa/colapsável com navegação agrupada + sino de notificação sempre visível | aprovado — `src/components/AppShell.tsx`, aplicado via `src/app/(app)/layout.tsx` |
| `AlunoShell` (sidebar da Área do Aluno) | sidebar mais enxuta (2 itens: Agenda, Financeiro), avatar com inicial do nome, sem sino de notificação | aprovado — `src/components/AlunoShell.tsx` (2026-07-23), aplicado via `src/app/aluno/layout.tsx` |
| `PageHeader` (cabeçalho de página) | ícone em badge dourado + título `font-serif` + subtítulo + slot de ação opcional (ex: saldo) | aprovado — `src/components/PageHeader.tsx`, aplicado em Dashboard/Alunos/Transações/Despesas/Pré-cadastros/Agenda/Aluno |
| Tela de auth centralizada (`card-premium`) | card centralizado, sem sidebar, com tag/ícone no topo | aprovado — `/login`, `/esqueci-senha`, `/resetar-senha`, `/matricule-se` |
| Página de formulário + tabela | formulário de criação no topo, tabela de listagem abaixo | aprovado — padrão repetido em `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros` |
| Grade semanal (`AgendaGrid`) | tabela modalidade × dia da semana, célula com horários coloridos por disponibilidade de vaga, `overflow-x-auto` com `min-w-0` no container pai (mobile) | aprovado — `src/components/AgendaGrid.tsx` (2026-07-23), aplicado em `/agenda` (admin) e `/aluno` (aluno) |

### Templates de tela

| Template | Uso | Status |
|---|---|---|
| Dashboard (Home) | cards de total de alunos/saldo/vencendo em 3 dias + ranking de modalidades + faixa etária | aprovado — `src/app/(app)/page.tsx` |
| Alunos | formulário de cadastro (nome, modalidade, faixa, status, telefone, e-mail, data de nascimento, cidade, lesões, apto exame) + tabela com badge de status/vencimento + WhatsApp + exclusão | aprovado — `src/app/(app)/alunos/page.tsx` |
| Transações | formulário de cadastro (tipo, categoria, valor, data, aluno opcional) + card de saldo + tabela + exclusão | aprovado — `src/app/(app)/transacoes/page.tsx` |
| Despesas | formulário (categoria, descrição, valor, data, recorrência) + tabela | aprovado — `src/app/(app)/despesas/page.tsx` |
| Pré-cadastros | tabela com Aprovar/Rejeitar | aprovado — `src/app/(app)/pre-cadastros/page.tsx` |
| Matricule-se | formulário público de auto-cadastro, mesma identidade visual do login | aprovado — `src/app/matricule-se/page.tsx` |
| Login | usuário/senha, sem slogan, título "Centro de Treinamento Sandro Ferreira" (`font-serif`) + 3 logos das modalidades em formação triangular (2026-07-22), link "esqueci minha senha" | aprovado — `src/app/login/page.tsx` |
| Agenda (admin) | `PageHeader` + `AgendaGrid` — grade completa de todas as modalidades | aprovado — `src/app/(app)/agenda/page.tsx` (2026-07-23) |
| Área do Aluno — Agenda (tela inicial) | saudação com nome do aluno + `AgendaGrid` (mesma grade completa do admin, sem filtro ainda) | aprovado — `src/app/aluno/page.tsx` (2026-07-23) |
| Área do Aluno — Financeiro | status de mensalidade, vencimento, chave PIX, formulário de upload de comprovante | aprovado — `src/app/aluno/financeiro/page.tsx` (2026-07-23) |

---

## Assets

| Asset | Tipo | Formato | Onde está |
|---|---|---|---|
| `next.svg`, `vercel.svg` | assets padrão do `create-next-app` | SVG | `public/` — ainda não substituídos por identidade própria da academia |
| Fontes Geist / Geist Mono / Playfair Display | `next/font/google` | variável CSS | `src/app/layout.tsx` |
| Favicon (faixa de jiu-jitsu) | ícone próprio, geométrico | SVG | `src/app/icon.svg` (2026-07-12) — primeiro asset visual próprio da academia |

> Assets de `public/` (logos padrão do Next.js) ainda não substituídos — pendente no [[backlog-tarefas-academiasandro]]. O favicon já é próprio da academia desde 2026-07-12.

---

## Regras de uso

- Badge de status (`statusBadgeClass()`) usa exclusivamente as três cores semânticas definidas no design system — success/warning/error — nunca uma cor fora dessa paleta
- Toda tabela tem estado vazio explícito ("Nenhum X cadastrado/registrado ainda.") — nunca renderizar tabela sem `<tbody>` ou em branco
- Ao extrair um componente repetido (badge, linha de tabela, formulário) para `src/components/`, atualizar este inventário e mover o status de "draft (inline)" para "aprovado"
