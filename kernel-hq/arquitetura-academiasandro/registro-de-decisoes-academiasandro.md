---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-03
owner: willians
---

# Registro de Decisões — Academia Prof. Sandro

> Referência: [[prd-academiasandro]] | [[requisitos-funcionais-academiasandro]] | [[arquitetura-academiasandro]]

Memória viva do sistema. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-07-10 — Criação do schema inicial (Aluno + TransacaoFinanceira)

**Motivo:** MVP de gestão de academia precisa de duas entidades centrais: aluno matriculado (com modalidade e graduação) e transação financeira (receita/despesa).
**Impacto:** `prisma/schema.prisma` com os models `Aluno` e `TransacaoFinanceira`, relação 1:N opcional (`alunoId` nullable). Campo `valor` definido como `Decimal(10,2)` desde o início — nunca `Float` — para evitar erro de arredondamento com dinheiro.
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-academiasandro

---

## 2026-07-10 — Correção do `.env` (senha exposta em texto puro)

**Motivo:** `DATABASE_URL` e `DIRECT_URL` estavam concatenadas em uma única linha no `.env` original, o que expôs a senha real do Postgres em texto puro durante a depuração.
**Impacto:** Variáveis separadas em linhas próprias, senha percent-encoded (continha `#`, `[`, `]`, que quebram parsing de URL).
**Status:** aplicado — **rotação da senha no painel da Supabase ainda pendente** (a senha apareceu em texto puro na conversa e deveria ser trocada por segurança)
**Artefatos atualizados:** arquitetura-academiasandro (seção 5 — Fronteiras de segurança)

---

## 2026-07-10 — `sslmode=no-verify` para contornar validação de certificado do Prisma 7

**Motivo:** `npx prisma migrate dev` falhava com `P1001: Can't reach database server`. Investigação eliminou rede/porta bloqueada, proxy corporativo, antivírus/firewall de terceiros e IPv6. Causa raiz: Prisma 7 passou a validar a cadeia de certificado TLS por completo com `sslmode=require` (antes só criptografava, sem validar). A cadeia do pooler Supavisor da Supabase não bate com a lista de CAs confiável default do Prisma 7, gerando `self-signed certificate in certificate chain`.
**Impacto:** `sslmode=no-verify` nas duas URLs do `.env` — mantém TLS, não valida a cadeia. Aceitável para dev local.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-academiasandro (seção 1 e 5)
**Observação:** revisitar para `sslmode=verify-full` com a CA correta do pooler antes de produção. Fontes: prisma/prisma#29060, prisma/prisma#28803.

---

## 2026-07-11 — Migração `init_aluno_transacao` aplicada + limpeza de scripts de diagnóstico

**Motivo:** Após corrigir `sslmode`, a migração pôde ser aplicada de fato no Supabase.
**Impacto:** `npx prisma migrate dev --name init-aluno-transacao` criou e aplicou a migração. Os 3 scripts de diagnóstico de conexão TLS (`test-pg.js`, `test-pg-tls.js`, `test-pg-cert.js`) deixados na raiz do projeto durante a investigação foram removidos — não fazem parte do app.
**Status:** aplicado
**Artefatos atualizados:** —

---

## 2026-07-11 — Segundo bug de conexão: senha incluía colchetes do placeholder da Supabase

**Motivo:** Mesmo com `sslmode=no-verify`, a migração seguia falhando — `P1001` no Windows, `P1000` (autenticação) via WSL. Investigação (testando a conexão diretamente via WSL) revelou que a senha salva no `.env` incluía os colchetes `[` `]` como se fossem parte da senha. Esses colchetes são o placeholder que a Supabase exibe na tela de connection string (`postgres.[ref]:[YOUR-PASSWORD]@...`) — a senha real não os inclui.
**Impacto:** Colchetes removidos de `DATABASE_URL` e `DIRECT_URL` no `.env` (mantido `%23` para o `#` real da senha). Autenticação passou a funcionar — confirmado via `npx prisma migrate status` e, em seguida, via `npx prisma migrate dev` no Windows.
**Status:** aplicado
**Artefatos atualizados:** arquitetura-academiasandro (seção 5)
**Observação:** o `P1001` no Windows era um sintoma indireto — o retry/timeout do driver mascarava o erro real de autenticação (`P1000`), que só ficou visível testando via WSL com `sslmode=no-verify` já aplicado.

---

## 2026-07-11 — Prisma 7 (gerador `prisma-client`) exige driver adapter explícito

**Motivo:** Ao tentar instanciar `new PrismaClient()` em `src/lib/prisma.ts`, o TypeScript acusou `Expected 1 arguments, but got 0`. O gerador `prisma-client` (novo, diferente do tradicional `prisma-client-js`) não lê mais `DATABASE_URL` implicitamente — exige um driver adapter explícito no construtor.
**Impacto:** Instalados `@prisma/client@7.8.0`, `@prisma/adapter-pg@7.8.0` e `pg`. `src/lib/prisma.ts` passou a instanciar `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`. Confirmado que `pg-connection-string` (dependência do `pg`) já trata `sslmode=no-verify` corretamente, sem necessidade de flag adicional (`uselibpqcompat`).
**Status:** aplicado
**Artefatos atualizados:** arquitetura-academiasandro (seção 1), modelo-de-dados-academiasandro (seção "Notas de geração do client")

---

## 2026-07-11 — Implementação das telas `/alunos` e `/transacoes`

**Motivo:** Primeira entrega funcional do MVP — cadastro e listagem de alunos, e cadastro/listagem de transações financeiras com saldo.
**Impacto:** `src/lib/prisma.ts` (client singleton), `src/app/alunos/{page.tsx,actions.ts}`, `src/app/transacoes/{page.tsx,actions.ts}`, navbar simples em `src/app/layout.tsx`. Sem autenticação, sem edição (só criação, listagem e exclusão). `tsc --noEmit` e `npm run lint` limpos; leitura verificada via `curl` contra o dev server (Prisma consultando o Supabase com sucesso). Escrita via Server Actions **não foi testada em navegador real** nesta sessão — sem ferramenta de browser disponível.
**Status:** aplicado (parcial — leitura verificada, escrita não verificada em UI real)
**Artefatos atualizados:** requisitos-funcionais-academiasandro, ui-kit-academiasandro

---

## 2026-07-11 — Edição de Aluno e Transação Financeira (item 2 do backlog)

**Motivo:** MVP só tinha criação/listagem/exclusão — não havia como corrigir um cadastro sem excluir e recriar.
**Impacto:** `updateAluno`/`updateTransacao` em `actions.ts`, páginas dedicadas `/alunos/[id]/editar` e `/transacoes/[id]/editar` (decisão de UI: página separada, não modal — `ui-kit-academiasandro` ainda não tinha padrão de modal). Testado ponta a ponta via HTTP (curl simulando os Server Actions com progressive enhancement — `$ACTION_ID` + multipart/form-data).
**Status:** aplicado
**Artefatos atualizados:** backlog-tarefas-academiasandro

---

## 2026-07-12 — Autenticação: NextAuth v5 + login por username + recuperação de senha via token

**Motivo:** Sistema não tinha nenhuma barreira de acesso — bloqueante antes de qualquer deploy público. Decisão inicial (NextAuth v5, usuário único) foi revisada no meio da implementação: o usuário pediu explicitamente login por **username** (não e-mail) + senha padrão temporária + fluxo de recuperação por token, replicando o padrão usado em outro sistema do mesmo operador, mas adaptado ao stack Next.js/Prisma daqui (lá é Express + React SPA com rotas `backend/routes/auth.js`).
**Impacto:**
- Model `Usuario` com `username` (login) + `email` (só recuperação) + `senhaTemporaria`/`tokenRecuperacao`/`tokenExpiracao`
- `src/auth.ts` — Credentials provider, sessão JWT, mitigação de timing attack (`bcrypt.compare` contra hash dummy quando usuário não existe)
- **Breaking change do Next 16 aproveitado corretamente:** middleware foi renomeado pra "Proxy" — arquivo é `src/proxy.ts` (`export const proxy`), não `middleware.ts`. Confirmado na doc local (`node_modules/next/dist/docs/`) antes de implementar, por causa do aviso do `AGENTS.md` do projeto sobre breaking changes desta versão
- `POST /api/auth/esqueci-senha` e `POST /api/auth/resetar-senha` (Route Handlers) — token opaco (`crypto.randomBytes(32).toString('hex')`), expira em 1h, single-use. Sem SMTP configurado: o link de reset é retornado na resposta pro admin repassar manualmente (WhatsApp) — não tenta enviar e-mail
- `npm run db:seed` cria o usuário com senha padrão fixa (`academia2026`) + `senhaTemporaria=true`
**Status:** aplicado — testado ponta a ponta via HTTP (login errado/certo, timing comparável entre username existente/inexistente, esqueci-senha 404 vs sucesso, resetar-senha com token válido/inválido/expirado/reusado)
**Artefatos atualizados:** modelo-de-dados-academiasandro, backlog-tarefas-academiasandro
**Observação:** decisão original do backlog (autenticação por e-mail) foi substituída no meio da sessão a pedido do usuário — não ficou registrada como decisão intermediária, só a versão final acima.

---

## 2026-07-12 — Fix da inconsistência de fonte (Geist vs Arial)

**Motivo:** `body` em `globals.css` fixava `font-family: Arial, Helvetica, sans-serif`, sobrescrevendo a fonte Geist já configurada em `--font-sans`.
**Impacto:** `font-family: var(--font-sans)` no lugar do valor hardcoded. Confirmado no CSS compilado que o `Arial` restante é só o `@font-face` de fallback métrico que o Next.js gera automaticamente pra Geist (evita layout shift) — não afeta a fonte renderizada.
**Status:** aplicado
**Artefatos atualizados:** design-system-academiasandro, backlog-tarefas-academiasandro

---

## 2026-07-12 — Layout com sidebar + tela de login, adaptado do sistema-thieco

**Motivo:** Usuário pediu explicitamente para copiar a estrutura visual do `sistema-thieco` (`Sidebar.jsx`, `Header.jsx`, `Login.jsx`) — só layout e segmentação de navegação, não lógica de negócio.
**Impacto:**
- `src/components/AppShell.tsx` (primeiro client component do projeto) — sidebar fixa/colapsável, navegação agrupada, item ativo destacado por rota
- Route group `src/app/(app)/` criado para aplicar o shell só nas rotas autenticadas (`/alunos`, `/transacoes`), mantendo `/`, `/login`, `/esqueci-senha`, `/resetar-senha` fora
- `/login` redesenhado com a paleta dourado/bronze já existente (card, ícone, tag "Sistema de Gestão") — **sem slogan** (decisão do usuário: só nome + selo, sem frase de efeito como o "Autoestima Muda Destinos..." do Thieco)
- `globals.css` ganhou classes reutilizáveis adaptadas do Thieco: `card-premium`, `input-dark`, `btn-gold`, `btn-outline-gold`, `gold-divider`, `text-gold-shimmer`
- Bug pego durante o teste: `bg-gold-gradient` quebrava o build porque foi declarada como classe CSS solta — Tailwind v4 não aceita `@apply` nela. Corrigido registrando como variável de tema no namespace `--background-image-*` (convenção CSS-first do Tailwind v4)
**Status:** aplicado — testado via HTTP (login, sidebar com item ativo certo por rota, logout, `/esqueci-senha`/`/resetar-senha` com o novo visual)
**Artefatos atualizados:** design-system-academiasandro, ui-kit-academiasandro, backlog-tarefas-academiasandro

---

## 2026-07-12 — Módulo financeiro completo + controle de vencimento + cadastro público (grande expansão de escopo)

**Motivo:** Usuário pediu para trazer do `sistema-thieco` os módulos de despesas, faturamento e cadastro de alunos, somados a três funcionalidades novas: controle de vencimento de matrícula com cobrança via WhatsApp, sino de notificação (matrículas vencendo em 3 dias) e link público de auto-cadastro. Pesquisa no `sistema-thieco` mostrou que lá o WhatsApp é sempre um link `wa.me` simples (nunca API paga) e a "validade" só existe hoje pra combos (ciclo fixo de 30 dias) — não existe cobrança automatizada real em lugar nenhum daquele sistema.
**Decisões de negócio confirmadas com o usuário antes de implementar:**
1. Vencimento de matrícula = ciclo fixo de 30 dias a partir da matrícula (ou do último pagamento), recalculado a cada pagamento — não é uma data editada manualmente
2. Cadastro público cai numa fila de pré-cadastros pendentes — só vira `Aluno` depois que o Sandro aprova, nunca direto
3. Despesas ganharam tela própria (não reaproveitou `TransacaoFinanceira`), com categorias e recorrência (gera as próximas 11 ocorrências automaticamente, igual ao `RegistroGasto.jsx` do Thieco)

**Simplificações deliberadas (adaptação, não cópia 1:1 do Thieco):**
- Sino de notificação **sem** tabela de notificações persistente/lida-não-lida (isso existe no Thieco pra múltiplos usuários/unidades — overkill pra um admin só aqui). Calcula a lista ao vivo a cada carregamento de página autenticada (vencimentos + pré-cadastros pendentes), sem polling nem estado de leitura
- "Faturamento" não virou uma página de DRE separada (como o `IntelFinanceira.jsx` do Thieco) — os indicadores (saldo, ranking de modalidades, faixa etária) entraram na **home** (`/`), que era só o template do `create-next-app` até então — resolveu o item 5 do backlog de quebra

**Impacto:**
- Schema: `Aluno` ganhou `telefone`, `email`, `dataNascimento`, `cidade`, `lesoes`, `dataVencimento`; novos models `Despesa` e `PreCadastro` (ver [[modelo-de-dados-academiasandro]])
- `src/lib/vencimento.ts` (`calcularVencimento`, `diasParaVencer`) e `src/lib/whatsapp.ts` (`montarLinkWhatsapp`, `mensagemCobranca`) — link `wa.me` puro, sem API paga, igual ao padrão do Thieco
- `createTransacao` agora recalcula `Aluno.dataVencimento` quando registra uma Receita vinculada a um aluno
- `/despesas` (+ `[id]/editar`) — nova tela, recorrência gera 12 ocorrências (atual + 11)
- `/matricule-se` — página pública (fora do grupo `(app)`, sem proteção), cria `PreCadastro`
- `/pre-cadastros` — revisão (Aprovar linka pra `/alunos?preCadastroId=...` que pré-preenche o form existente; Rejeitar só muda o `status`)
- `/` (dashboard) — movida pra dentro do grupo `(app)` (agora exige login), com cards de saldo/total de alunos/vencendo em 3 dias, ranking de modalidades e faixa etária
- `src/components/NotificacaoSino.tsx` — sino no topbar (agora sempre visível, não só mobile), duas seções: vencimentos e pré-cadastros pendentes, com botão WhatsApp direto por aluno
- `src/auth.ts`/`src/proxy.ts` — `/despesas`, `/pre-cadastros` e `/` (match exato, não prefixo) entraram na lista de rotas protegidas
**Status:** aplicado — `tsc`/`eslint` limpos; verificação funcional completa ainda não fechada nesta sessão (usuário pediu pra testar manualmente e não prosseguir com os testes automatizados que estavam em andamento)
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, backlog-tarefas-academiasandro, arquitetura-academiasandro
**Observação:** campo `idade` no `PreCadastro` é redundante com `dataNascimento` (dá pra calcular um a partir do outro) — mantido porque o usuário pediu os dois campos explicitamente no formulário público.

---

## 2026-07-12 — Dados fictícios de demonstração + bug real no cálculo de saldo

**Motivo:** Usuário pediu alunos fictícios pra apresentar o sistema a um cliente (visualizar números na tela, entender a dinâmica e os insights). Depois pediu transações e despesas fictícias também.
**Impacto:**
- `prisma/seed-demo.ts` (`npm run db:seed-demo`) — 18 alunos fictícios, variados em modalidade, faixa etária (10 a 55 anos, cobrindo as 6 faixas do dashboard), status de pagamento e vencimento de matrícula (4 já vencidos, 3 vencendo em até 3 dias — pra popular o sino de notificação de verdade). Idempotente (pula por nome se já existir)
- `prisma/seed-demo-financeiro.ts` (`npm run db:seed-demo-financeiro`) — 50 transações (mensalidades + exames) e 15 despesas (2 recorrentes + 7 avulsas), rodando em cima dos alunos já criados. Guarda de segurança: não roda se já existir qualquer transação/despesa na base
- **Bug real encontrado e corrigido:** o cálculo de saldo do dashboard (`src/app/(app)/page.tsx`) somava *todas* as despesas cadastradas, inclusive parcelas futuras geradas por uma despesa recorrente — ou seja, marcar algo como recorrente derrubava o saldo na hora, mesmo pros meses que ainda não chegaram. Corrigido filtrando receitas/despesas por `data <= hoje`. Não é um ajuste só pro dado fictício — vale pra qualquer despesa recorrente real cadastrada dali pra frente
**Status:** aplicado — confirmado via HTTP que saldo, "vencendo em 3 dias", ranking de modalidades e faixa etária batem exatamente com os números esperados
**Artefatos atualizados:** requisitos-funcionais-academiasandro (RF-029 ajustado implicitamente pelo fix), backlog-tarefas-academiasandro
**Observação:** esses 18 alunos + transações + despesas são fictícios, persistidos de verdade no Supabase (não é dado local/efêmero) — **precisam ser apagados antes de qualquer uso real com alunos de verdade**. O usuário confirmou que vai apagar antes de subir pra produção.

---

## 2026-07-12 — Polimento visual: fonte serifada, cabeçalhos de página, favicon e ícones temáticos

**Motivo:** Usuário achou os títulos internos (ex: "Dashboard") "sem graça" e pediu mais "cara de sistema", além de um favicon com desenho de faixa de jiu-jitsu e um botão de login com luva de boxe.
**Impacto:**
- **Fonte:** `Playfair Display` (mesma serifada do `sistema-thieco`) adicionada via `next/font/google`, exposta como token `--font-serif` em `globals.css` — usada só em títulos/nomes de marca (Geist continua sendo a fonte de corpo)
- `src/components/PageHeader.tsx` (novo) — cabeçalho reutilizável (ícone + título serifado + subtítulo + slot de ação opcional), aplicado em Dashboard, Alunos, Transações, Despesas e Pré-cadastros
- Cards de estatística do Dashboard ganharam ícones combinando com o significado (pessoas, carteira, alerta)
- **Favicon:** `src/app/icon.svg` — desenho geométrico de faixa (nó dourado/bronze + 2 graus brancos), usando a convenção nativa `icon.svg` do Next.js (substitui o favicon padrão automaticamente). Testado em 16px/32px pra garantir legibilidade
- **Ícones temáticos em botões:** 🥊 (luva de boxe) no botão de login, 🥋 (kimono/gi) nos botões de cadastro de aluno (`/alunos` e `/matricule-se`). Decisão deliberada: **não** aplicado nas telas financeiras (Transações, Despesas) — mantidas mais sóbrias, por serem telas de "back office" que precisam parecer confiáveis pro cliente
**Status:** aplicado — testado via HTTP (`.font-serif` no CSS compilado aponta pra Playfair Display; `/icon.svg` responde 200 e aparece no `<head>`; emojis confirmados nos 3 botões)
**Artefatos atualizados:** design-system-academiasandro, ui-kit-academiasandro

---

## 2026-07-12 — Primeiro commit + push para o GitHub (repositório público `zion-workspace`)

**Motivo:** Usuário pediu commit e push das mudanças da sessão pra `main`, antes de reiniciar o ambiente.
**Descoberta importante:** o projeto nunca tinha sido commitado — `academia-sandro/` vivia inteiramente como pasta não rastreada dentro do repositório do `Kernel Workspace` (um monorepo compartilhado por vários projetos do usuário). O repositório remoto (`github.com/willianslegacy94-zion/zion-workspace`) é **público**, confirmado via `gh repo view` — usuário autorizou explicitamente publicar mesmo assim.
**Impacto:**
- Antes do commit, uma varredura de segurança encontrou a senha real do Postgres em texto puro no `academia-sandro/PROGRESS.md` (reincidência do problema já registrado em 2026-07-10/11) — redigida antes de commitar
- Commit `5e1361b` criado com pathspec limitado a `academia-sandro/`, sem tocar em mudanças já staged de outro projeto (`orbita-lobo/`) que estavam soltas no mesmo working directory
- **Incidente durante o push:** `git push` foi rejeitado (remoto tinha 2 commits novos, só de `sistema-thieco/`). Ao tentar `git merge origin/main` na pasta principal do `Kernel Workspace`, descobriu-se que `orbita-lobo/` é na verdade **um repositório git próprio** (remoto separado: `github.com/willianslegacy94-zion/orbita-lobo`), vivendo como subpasta sem isolamento adequado (sem gitlink/submodule, sem exclusão no `.gitignore` do monorepo). O merge, ao reconciliar a árvore de arquivos, **apagou 31 arquivos do disco** dentro de `orbita-lobo/` (confirmados como só deleções, sem edição em progresso perdida — recuperáveis via `git restore .` dentro daquele repo). O usuário optou por restaurar por conta própria
- **Solução aplicada:** criado um **worktree isolado** (`git worktree add`) com uma branch temporária a partir do commit local, totalmente separado da pasta principal (sem os arquivos soltos do `orbita-lobo`). Merge com `origin/main` feito ali dentro (limpo, sem conflito — mudanças remotas só tocavam `sistema-thieco/`), depois `git push origin temp-branch:main`. Branch e worktree temporários removidos depois
**Status:** aplicado — `academia-sandro` publicado em `origin/main` (commit `1f43c2c`, mesclado com o histórico do `sistema-thieco`). `orbita-lobo` restaurável, mas ainda não restaurado (usuário vai fazer)
**Artefatos atualizados:** backlog-tarefas-academiasandro, arquitetura-academiasandro
**Observação/risco operacional:** `Kernel Workspace` é um monorepo que hospeda vários projetos independentes, alguns com `.git` próprio aninhado sem isolamento (`orbita-lobo` confirmado; podem existir outros). **Qualquer operação de merge/checkout na raiz do `Kernel Workspace` é arriscada** — pode apagar arquivos de projetos vizinhos. Recomendação pro futuro: sempre usar `git worktree` isolado (ou operar só com `git commit -- <pathspec>` limitado) ao invés de mexer na pasta principal; nunca rodar `git merge`/`git pull` na raiz sem antes verificar se há subpastas com `.git` próprio não declaradas como submodule.

---

## 2026-07-22 — Redesign da tela de login (logos das 3 modalidades + título serifado)

**Motivo:** Usuário pediu pra remover o slogan antigo e adicionar o nome completo "Centro de Treinamento Sandro Ferreira" em destaque (`font-serif`), com os 3 logos das modalidades (Sandro Freire Personal, Capoeira Senzala, Matos Fight Team/Muay Thai) acima do título.
**Impacto:**
- Logos originais (`academia-sandro/logos/`) eram na verdade JPEGs com fundo sólido opaco salvos com extensão `.png` — sem ferramenta de edição de imagem disponível no ambiente (sem ImageMagick/PIL), removido o fundo via script próprio (`sharp`, flood-fill BFS a partir das bordas + recompressão em paleta PNG, ~70-78% de redução de tamanho)
- Layout final: logo do Personal centralizado no topo, Capoeira + Matos Fight Team lado a lado abaixo (formação triangular), tamanhos aumentados em relação à primeira versão a pedido do usuário pra ficar legível no celular
- `preload` no lugar de `priority` no `next/image` — breaking change confirmado do Next.js 16 (`priority` foi depreciado)
**Status:** aplicado — verificado via Playwright headless (Chromium baixado manualmente + libs do sistema extraídas via `apt-get download`/`dpkg-deb`, já que o ambiente não tinha as dependências compartilhadas do Chromium) em viewport mobile (390px) e desktop (1280px), sem erros de console
**Artefatos atualizados:** design-system-academiasandro, ui-kit-academiasandro
**Observação:** commit `cc6771c`, publicado via `@devops` depois de um rebase seguro (branch local estava 3 commits atrás do remoto, só de `sistema-thieco`) — sem force-push, histórico do `sistema-thieco` preservado.

---

## 2026-07-22 — Expansão do schema: `Role`, `AgendaAula`, `PresencaDiaria`, campos de comprovante em `TransacaoFinanceira`

**Motivo:** Usuário pediu 4 estruturas novas de uma vez, com vista à Área do Aluno e à Agenda: controle de acesso por papel (`Role`: ADMIN/ALUNO em `Usuario`), agenda de aulas com capacidade máxima (default 10), presença diária de aluno numa aula, e campos pra comprovante de pagamento manual/gateway futuro.
**Impacto:**
- `enum Role { ADMIN, ALUNO }` em `Usuario` (default `ALUNO`)
- `model AgendaAula`: `diaSemana` (enum `DiaSemana`), `horarioInicio`/`horarioFim` (`@db.Time`), `modalidade`, `capacidadeMax` (default 10)
- `model PresencaDiaria`: relaciona `Aluno` + `AgendaAula`, `status` (enum `StatusPresenca`: AGENDADO/CONFIRMADO/CANCELADO/FALTA_SEM_AVISO), `@@unique([alunoId, agendaAulaId, data])`
- `TransacaoFinanceira` ganhou `comprovanteUrl` e `gatewayPagamentoId` (ambos opcionais)
- **Confirmado nesta sessão:** o fluxo de migração manual (`migrate diff --script` → criar pasta `<timestamp>_<nome>/migration.sql` manualmente → `migrate deploy`) continua sendo o único caminho viável — `migrate dev` trava no Supabase mesmo com `--create-only`, reconfirmado
**Status:** aplicado — migração `20260722012129_expansao_agenda_role` criada e implantada via `migrate deploy`, `npx prisma generate` rodado em seguida
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro
**Observação:** um erro de rede transitório (`P1001: Can't reach database server`) apareceu na primeira tentativa de `migrate deploy` — não era configuração errada, era instabilidade momentânea da conexão TCP até o pooler da Supabase; confirmado testando `/dev/tcp` direto antes de tentar de novo, que funcionou de primeira.

---

## 2026-07-23 — Vínculo `Usuario.alunoId` (Usuario ↔ Aluno)

**Motivo:** Ao construir a Área do Aluno, ficou claro que não existia nenhuma forma de saber qual `Aluno` corresponde a um `Usuario` logado — nem FK, nem convenção de e-mail confiável. Pergunta feita ao usuário: casar por e-mail (sem migração, mas frágil) ou criar uma FK explícita (mais correto, mais uma migração)? **Escolhido: FK explícita.**
**Impacto:** `Usuario.alunoId` (`String? @unique`) → `Aluno.id`, relação 1:1 opcional. Migração gerada e aplicada (`20260723002845_usuario_aluno_link`) com o mesmo fluxo manual (`migrate diff --script` + `migrate deploy`).
**Status:** aplicado
**Artefatos atualizados:** modelo-de-dados-academiasandro

---

## 2026-07-23 — Área do Aluno construída (sidebar, Agenda, Financeiro, upload de comprovante)

**Motivo:** Pedido explícito do usuário: tela principal da Área do Aluno (`src/app/aluno/`) com cabeçalho (nome/modalidade/graduação), card financeiro (status, vencimento, chave PIX, botão de anexar comprovante) e card de upsell de outras modalidades.
**Decisões tomadas via pergunta ao usuário (não inventadas):**
1. Vínculo Usuario↔Aluno — ver decisão acima (FK explícita, não e-mail)
2. Chave PIX do CT não existia em nenhum lugar do projeto — usuário optou por criar `PIX_KEY_CT` vazia no `.env` (preenche depois) em vez de me passar o valor real na conversa
**Impacto:**
- `session.user.role`/`session.user.alunoId` expostos via callbacks do NextAuth (`src/auth.ts` + `src/next-auth.d.ts`)
- `/aluno` adicionada à lista de rotas protegidas (`PROTECTED_PATHS` em `auth.ts` + matcher em `src/proxy.ts`)
- Upload de comprovante (`src/app/aluno/actions.ts` → `anexarComprovante`): salva o arquivo em `public/comprovantes/` (filesystem local — **não sobrevive a deploy serverless/efêmero**, revisitar antes de produção) e atualiza `comprovanteUrl` na `TransacaoFinanceira` mais recente do aluno
- Testado ponta a ponta via Playwright headless: redirect de não-autenticado pra `/login`, upload real de arquivo gravando no disco e no banco
**Status:** aplicado (reestruturado no mesmo dia — ver decisão seguinte)
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, ui-kit-academiasandro

---

## 2026-07-23 — Agenda compartilhada (`AgendaGrid`) + grade real de horários seedada + reestruturação da Área do Aluno em sidebar

**Motivo:** Usuário pediu pra reestruturar a Área do Aluno com menu lateral (Agenda / Financeiro, tela inicial = Agenda) e usar o mesmo modelo de grade tanto na tela do Sandro quanto na do aluno, com a grade real de horários da academia.
**Impacto:**
- `src/lib/agenda.ts` (`getAgendaGrade`) + `src/components/AgendaGrid.tsx` — componente único reaproveitado em `/agenda` (admin, dentro do route group `(app)`) e em `/aluno` (tela inicial)
- `src/components/AlunoShell.tsx` — sidebar própria da Área do Aluno (Agenda / Financeiro), mesmo padrão visual do `AppShell` mas mais enxuto (2 itens, sem sino de notificação)
- `/aluno/layout.tsx` (novo) busca sessão+aluno uma vez só; `/aluno/page.tsx` virou a tela de Agenda; `/aluno/financeiro/page.tsx` (novo) recebeu o card financeiro que antes vivia em `page.tsx`
- Item "Agenda" do menu admin (`AppShell.tsx`) — estava marcado `disabled: true` ("Em breve"), habilitado
- **63 `AgendaAula` inseridas no Supabase**, a partir da grade que o usuário ditou por mensagem: Musculação/Personal (07h-18h Seg/Qua/Sex + 21h só Seg/Qua), Capoeira (19h/20h Terça/Quinta), Muay Thai (08h-21h) + duas sub-turmas modeladas como linhas próprias da grade (`"Muay Thai - Idosos"` 09h, `"Muay Thai - Kids"` 19h) — sem campo novo no schema pra isso, só encodado no nome da modalidade
- **Suposição assumida (não confirmada com o usuário):** dias do Muay Thai não foram explicitados na mensagem — assumi a mesma base geral do texto ("Segunda, quarta e sexta"). Se estiver errado, precisa correção manual dos horários já seedados
- Pausa de almoço (12h/13h) tratada como legenda textual no rodapé da grade, não como linhas de `AgendaAula` (não é uma aula de verdade)
- **Bug de responsividade encontrado e corrigido:** no mobile, a tabela de agenda esticava a página inteira em vez de rolar só ela mesma — clássico problema de flexbox sem `min-width: 0`. Corrigido em `AlunoShell.tsx` e `AppShell.tsx` (`min-w-0` nos containers flex)
**Status:** aplicado — testado via Playwright headless (admin `/agenda` e aluno `/aluno`+`/aluno/financeiro`, mobile 390px e desktop 1280px, sem erros de console)
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, ui-kit-academiasandro, design-system-academiasandro, ux-flows-academiasandro

---

## 2026-07-23 — Planejamento da próxima etapa (ainda NÃO implementado): calendário do Sandro com confirmação de presença + agenda pessoal do aluno + aba de Matrícula

**Motivo:** Usuário definiu o próximo passo, a ser feito numa sessão futura — registrado aqui só como plano, não como decisão de implementação.
**O que foi pedido:**
1. **Calendário do Sandro:** ajustar a tela `/agenda` (admin) pra mostrar, por dia e horário, quantos alunos estão naquele slot e quem são (hoje a grade só mostra vagas disponíveis, não a lista de alunos) — com botão pra enviar mensagem de confirmação de presença (provavelmente via WhatsApp, seguindo o padrão `wa.me` já usado em `src/lib/whatsapp.ts` pra cobrança, mas isso ainda não foi confirmado com o usuário)
2. **Agenda pessoal do aluno:** a tela `/aluno` hoje mostra a grade completa de todas as modalidades — o pedido é filtrar/destacar só os dias e horários em que aquele aluno específico está matriculado
3. **Nova aba "Matrícula":** tela nova na Área do Aluno onde o aluno se matricula numa modalidade diferente da atual — mostraria a agenda do Sandro filtrada pelos horários disponíveis (vagas) da modalidade desejada
**Pendências antes de implementar (a decidir com o usuário quando essa etapa começar):**
- Não existe hoje nenhuma tabela de "matrícula fixa por horário" — `PresencaDiaria` é por data específica, não por vínculo recorrente aluno↔horário. Precisa decidir: aluno tem horário fixo (nova tabela de matrícula) ou o "meus dias de aula" é inferido do histórico de `PresencaDiaria`?
- Mensagem de confirmação de presença — canal (WhatsApp `wa.me` vs. outro) e se precisa de registro de "confirmado" em algum campo (`StatusPresenca` já tem `CONFIRMADO`, mas nada dispara essa transição hoje)
- Fluxo de auto-matrícula do aluno numa nova modalidade — precisa de aprovação do Sandro (como o `PreCadastro`) ou é direto?
**Status:** planejado, não implementado
**Artefatos a atualizar quando implementado:** modelo-de-dados-academiasandro (nova tabela de matrícula fixa, se decidido), requisitos-funcionais-academiasandro, ui-kit-academiasandro, backlog-tarefas-academiasandro (mover de "pendente" pra "concluído")

---

## 2026-07-28 — Rotação da senha do banco (Supabase)

**Motivo:** Pendência de segurança registrada desde 2026-07-10 (senha exposta em texto puro múltiplas vezes durante depuração). Usuário confirmou disposição a rotacionar.
**Impacto:** Nova senha gerada no painel da Supabase (Settings → Database → Reset Database Password) e atualizada em `DATABASE_URL`/`DIRECT_URL` no `.env`, mantendo o formato já validado (percent-encoding, sem colchetes de placeholder, `sslmode=no-verify`). **Cuidado deliberado nesta rotação:** para não reincidir no mesmo erro (senha em texto puro na conversa), a troca foi guiada sem que o Claude exibisse a senha antiga de volta — o usuário colou a senha nova diretamente, e a validação (`npx prisma migrate status`) rodou sem nunca ecoar o valor em texto puro na resposta.
**Status:** aplicado — conexão confirmada funcionando com a senha nova
**Artefatos atualizados:** arquitetura-academiasandro (seção 5), backlog-tarefas-academiasandro (item 1 concluído)

---

## 2026-07-28 — Correção do gap de autorização por `role` (pendência de segurança desde 2026-07-23)

**Motivo:** Validação da tela `/aluno` encontrou o problema já registrado em 2026-07-23: `session.user.role` existia no schema mas o callback `authorized` de `src/auth.ts` só checava "existe sessão?", nunca "essa `role` pode acessar essa rota?". Confirmado na prática: uma conta ADMIN acessava `/aluno` normalmente (a tela carregou os dados de uma aluna vinculada por engano a essa conta no banco de testes).
**Impacto:**
- `src/auth.ts` — `authorized` passou a diferenciar `ADMIN_PATHS` (`/alunos`, `/transacoes`, `/agenda`, `/despesas`, `/pre-cadastros`, depois `/matriculas`) de `ALUNO_PATHS` (`/aluno`), redirecionando pra `/aluno` ou `/` conforme a `role` não bater com o grupo de rota
- **Bug introduzido e corrigido na mesma sessão:** a primeira versão comparava prefixo puro (`pathname.startsWith(path)`), o que fazia `/alunos` (gestão) colidir com `/aluno` (portal) — `"/alunos".startsWith("/aluno")` é `true`. Corrigido com `pathEmGrupo` (match por segmento exato: `pathname === prefixo || pathname.startsWith(prefixo + "/")`)
- **Causa raiz do bug de dados encontrado:** a única conta (`sandro`) tinha sido criada pela migração de expansão do schema (2026-07-22) com `role` no valor default do Prisma (`ALUNO`), nunca setado pra `ADMIN` explicitamente no seed — e estava com `alunoId` vinculado a uma aluna de teste (Juliana). `prisma/seed.ts` corrigido para setar `role: "ADMIN"` explicitamente no upsert; vínculo `alunoId` indevido removido do registro existente
**Status:** aplicado — testado com sessão ADMIN real e uma conta ALUNO temporária (criada e removida depois), confirmando bloqueio nos dois sentidos
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro (seção 5), requisitos-funcionais-academiasandro (RNF-003)

---

## 2026-07-29 — Grade real seedada a partir do quadro físico + modalidades unificadas + horário de referência no cadastro

**Motivo:** Usuário enviou foto do quadro físico afixado na academia com a grade real de horários — diferente da grade que já estava seedada (2026-07-23, ditada por mensagem, com suposições não confirmadas sobre os dias do Muay Thai). Também revelou que as modalidades usadas no cadastro de aluno (`Jiu-Jitsu`, `Muay Thai`, `Judô`, `Boxe`, `Outra`) eram um placeholder genérico do scaffold inicial, sem relação com o que a academia realmente ensina.
**Decisão confirmada com o usuário antes de implementar:** unificar as modalidades do cadastro de aluno com as categorias do quadro físico (opção recomendada, entre 3 alternativas apresentadas) — não manter listas separadas.
**Impacto:**
- Modalidades unificadas: `Musculação/Personal`, `Capoeira`, `Boxe/Muay Thai`, `Kids`, `Aula para Idosos` (`src/lib/modalidades.ts`, fonte única) — os 18 alunos fictícios remapeados por idade (crianças → Kids, 50+ → Aula para Idosos, resto distribuído)
- **63 `AgendaAula` antigas removidas** (nomenclatura errada, dias assumidos incorretamente) e **80 novas inseridas** batendo exatamente com o quadro físico (`prisma/seed-agenda.ts`, `npm run db:seed-agenda`)
- `Aluno.agendaAulaReferenciaId` (FK opcional → `AgendaAula`) — horário de referência informado no cadastro, **só exibição/organização, não restringe acesso** (decisão confirmada com o usuário: a modalidade já dá acesso a todos os horários dela)
- Seletor cascata (`SeletorModalidadeHorario.tsx`, client component) — modalidade primeiro, horário filtrado depois
- `PreCadastro.modalidadeInteresse` — cadastro público agora pergunta a modalidade de interesse, e ela pré-preenche o formulário de novo aluno na aprovação
**Status:** aplicado — testado via HTTP (cadastro completo, prefill do pré-cadastro, roster batendo com a agenda)
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, ui-kit-academiasandro

---

## 2026-07-29 — Matrícula em modalidade extra: modelo `Matricula`, preço configurável, modal de pagamento

**Motivo:** Item 15 do backlog ("aba de Matrícula") finalmente implementado, com um refinamento pedido pelo usuário no meio do trabalho: ao clicar "Matricular-se" numa modalidade extra, deve abrir um modal tipo PDV pro aluno "pagar" aquela aula — pessoa que ainda não é aluna continua indo pra fila de pré-cadastro normalmente (fluxo não mudou).
**Decisões confirmadas com o usuário:**
1. Pagamento manual (sem gateway real) — modal mostra o valor, aluno confirma e escolhe forma de pagamento (PIX/Dinheiro/Cartão), sistema gera uma cobrança pendente; aluno sobe o comprovante depois, mesmo fluxo já usado pra mensalidade
2. Preço fixo por modalidade, configurável pelo admin (aceito começar em R$0 e ser preenchido depois)
**Impacto:**
- `model Matricula` (novo) — aluno × `AgendaAula`, `@@unique([alunoId, agendaAulaId])`. Representa só modalidades **extras**: a modalidade principal (`Aluno.modalidade`) já dá acesso implícito a todos os horários dela, sem precisar de registro de matrícula
- `model ModalidadePreco` (novo) — `modalidade` como chave, `valor` default 0. Editável num card no topo de `/agenda` (admin)
- `getAgendaGrade()` reescrito: `vagas` deixou de contar `PresencaDiaria` (métrica que só crescia, nunca reflete capacidade real) e passou a contar roster real (alunos da modalidade principal + `Matricula`); cada célula da grade carrega a lista de nomes (roster), exibida via `<details>` expansível na visão do admin
- `MatricularAcaoCelula.tsx` (client component) — modal com resumo (modalidade/horário/valor), seletor de forma de pagamento, chama a Server Action direto via `startTransition` (não é `<form>` — é uma chamada de função, mais controle sobre fechar o modal e mostrar erro)
- `matricularEmAula` (Server Action) — valida capacidade, cria `Matricula` + `TransacaoFinanceira` (categoria `"Matrícula extra — {modalidade}"`) numa transação atômica do Prisma
- **Regra confirmada depois, ao testar:** modalidade extra só aparece na agenda pessoal do aluno (`/aluno`) depois que o pagamento for **confirmado** pelo admin — antes disso, o aluno já pode ver/cancelar a matrícula na aba "Matrícula", mas ela não aparece como "meu horário" ainda (evita o aluno achar que já pode ir pra aula antes de pagar)
**Status:** aplicado — testado ponta a ponta (matricular, confirmar, cancelar), incluindo teste do estado "pendente" propositalmente deixado ativo a pedido do usuário
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, ui-kit-academiasandro
**Observação:** um bug real foi encontrado e corrigido no meio do processo — a primeira versão do filtro de célula (`ALUNO_PATHS`/agenda) tinha a mesma colisão de prefixo `/aluno` vs. `/alunos` já registrada na decisão de role acima, desta vez na lógica de "quais células pertencem à modalidade extra do aluno".

---

## 2026-07-29 — Fluxo financeiro: confirmação manual de pagamento, parcelas de 12 meses, expiração de comprovante

**Motivo:** Ao testar a matrícula extra, usuário percebeu que a cobrança gerada não aparecia em lugar nenhum acionável — bug real: `/aluno/financeiro` só mostrava um resumo genérico de mensalidade (status + vencimento), nunca listava as transações de fato. A partir daí, três pedidos em sequência: (1) o sistema deve **alertar** quando um comprovante é inserido, e só o Sandro validar/dar o "ok" muda o status; (2) o aluno deve ver um limite dos próximos 12 meses de parcela a partir da matrícula; (3) comprovante deve expirar e ser apagado do disco 10 dias após o envio, pra não ocupar espaço.
**Impacto:**
- `TransacaoFinanceira` ganhou `dataVencimento`, `formaPagamento`, `confirmadoEm`, `comprovanteEnviadoEm`, `matriculaId` (FK `@unique` → `Matricula`, liga a cobrança ao horário/modalidade)
- **`/aluno/financeiro` reescrita:** lista todas as cobranças de fato (antes só mostrava a mais recente/resumo), com upload de comprovante por transação específica (`anexarComprovante` passou a receber `transacaoId`, não mais "achar a mais recente" — bug real, quebraria com múltiplas cobranças pendentes ao mesmo tempo)
- **Confirmação manual:** `confirmarPagamento` (Server Action, `src/app/(app)/transacoes/actions.ts`) — seta `confirmadoEm`, e se a transação é Receita vinculada a aluno, atualiza `Aluno.statusPagamento` pra "Em dia". Botão "Confirmar pagamento" em `/matriculas` e em `/transacoes`. Só aparece o comprovante existindo e ainda não confirmado — depois de confirmado, o registro some da tela `/matriculas` (mesmo padrão do `/pre-cadastros`, que só lista `status="Pendente"`)
- **Parcelas de 12 meses** (`src/lib/parcelas.ts`, `getParcelas`) — janela **fixa** de 12 meses a partir do mês da matrícula (não é "próximos 12 meses a partir de hoje"), cruzando cada mês com uma `TransacaoFinanceira` tipo Receita não vinculada a matrícula extra (`matriculaId: null`) daquele mês. Status por parcela: Paga / Aguardando confirmação / Pendente / A vencer / Não paga. Cobranças de modalidade extra ficam numa seção separada ("Outras cobranças"), fora dessa janela
- **Expiração de comprovante (10 dias):** `limparComprovantesExpirados()` (`src/lib/comprovantes.ts`) apaga o arquivo do disco e limpa `comprovanteUrl`/`comprovanteEnviadoEm` (mantém `confirmadoEm` intacto se já confirmado). Sem cron configurado no ambiente — chamada de forma **preguiçosa** (roda quando `/matriculas` ou `/transacoes` são abertas). Rota `/api/cron/limpar-comprovantes` deixada pronta pra quem quiser agendar de verdade (Vercel Cron, cron de sistema)
- **Correção de bug relacionado, mesma sessão:** `Aluno.statusPagamento` é um campo manual que nunca se atualiza sozinho — usuário encontrou um aluno com vencimento já no passado mostrando "Em dia". Criado `statusPagamentoEfetivo()` (`src/lib/vencimento.ts`): se `dataVencimento` já passou, o status exibido é sempre "Atrasado" na hora, independente do que está gravado — aplicado em `/alunos` e em `/aluno/financeiro`. Confirmado no banco: **9 dos 12 alunos vencidos** estavam com o status errado gravado
**Status:** aplicado — testado ponta a ponta (upload, confirmação, expiração forçada com timestamp de 11 dias atrás confirmando remoção real do arquivo, parcelas geradas corretas pro Pedro)
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro

---

## 2026-07-29 — Novas Matrículas (tela admin), filtros em Alunos, e cadastro de aluno com acesso automático

**Motivo:** Três pedidos complementares: (1) tela dedicada pro Sandro ver nome do aluno, comprovante, horário e forma de pagamento de cada matrícula extra; (2) filtros na lista de Alunos pra achar rápido quem está vencido ou aguardando confirmação; (3) ao cadastrar aluno já com e-mail, o sistema deve criar o acesso ao portal automaticamente (sem passo manual extra na tela de edição).
**Impacto:**
- `/matriculas` ("Novas Matrículas") — nova rota admin, lista `Matricula` com aluno, horário, forma de pagamento, valor e status do comprovante; botão de confirmar pagamento inline
- `/alunos` — abas de filtro (`Todos` / `Pagamento vencido` / `Aguardando confirmação`), cada uma com contador; lista de aluno **separada** do formulário de cadastro (ver decisão de layout abaixo)
- `createAluno`: se o formulário tem e-mail preenchido, cria a conta de acesso (`Usuario`, `role=ALUNO`) automaticamente e já redireciona pra tela de edição mostrando o link de definição de senha — sem precisar do passo manual "Criar acesso" que já existia
- **Reorganização de layout (pedido à parte):** formulário de "Novo Aluno" saiu de dentro de `/alunos` e virou rota própria (`/alunos/novo`) — `/alunos` ficou só a lista + botão "Novo Aluno"
**Status:** aplicado — testado via HTTP (filtros retornando contagens corretas, criação de aluno gerando acesso automático, `/matriculas` refletindo confirmação em tempo real)
**Artefatos atualizados:** requisitos-funcionais-academiasandro, ui-kit-academiasandro, backlog-tarefas-academiasandro

---

## 2026-07-29 — Sino de notificações: marcar como lido + 4 categorias de alerta

**Motivo:** Sino de notificação (criado em 2026-07-12) foi desenhado deliberadamente **sem** estado de lida/não lida (simplificação aceita na época, "overkill pra um admin só"). Usuário pediu essa capacidade de volta: poder abrir e marcar como lido, com o número só voltando a aparecer quando surge alerta **novo** — e formalizou as 4 categorias que devem compor o sino: pré-cadastro, alunos inadimplentes, vencimento até D+3, novas matrículas.
**Impacto:**
- `Usuario.alertasLidosEm` (novo campo) — timestamp da última vez que aquele admin marcou como lido
- `session.user.id` exposto (não existia antes — precisava pra saber qual `Usuario` atualizar)
- `src/lib/alertas.ts` (`getAlertas`) — cada categoria tem seu próprio "instante de gatilho": pré-cadastro/matrícula = quando foram criados; vencimento D+3 = quando a data cruzou o limiar (`dataVencimento - 3 dias`); inadimplência = o próprio `dataVencimento`. Um item é "novo" se seu gatilho é posterior a `alertasLidosEm` — os itens **continuam visíveis** na lista depois de marcados como lidos, só o contador (badge) zera até aparecer algo genuinely novo
- **Bug de precisão encontrado e corrigido:** a comparação inicial usava o timestamp exato de `dataVencimento` (que podia ter hora do dia diferente de meia-noite, herdada de quando o dado foi seedado), enquanto o cálculo de "quantos dias faltam" (`diasParaVencer`) já zera a hora — um item ficava preso como "novo" por causa dessa inconsistência de precisão. Corrigido zerando a hora em ambos os lados da comparação
- `NotificacaoSino.tsx` reescrito: botão "Marcar como lida" (chama `marcarAlertasComoLidos` via `startTransition`), 4 seções (Inadimplentes, Vencendo em até 3 dias, Pré-cadastros, Novas matrículas), ponto indicador de "novo" por item
- Contadores de badge na sidebar (nav "Novas Matrículas", "Pré-cadastros") continuam sendo contagem total absoluta — só o sino usa o conceito de lido/não-lido
- Dashboard (`/`) ganhou dois cards clicáveis: "Novas matrículas" e "Pré-cadastros", com o número pendente de cada
**Status:** aplicado — validado a lógica de leitura direto (15 alertas → marca como lido → 0 não-lidos, itens continuam na lista); deixado propositalmente com alertas não-lidos ativos pro usuário ver o comportamento ao vivo na primeira abertura
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, arquitetura-academiasandro, ui-kit-academiasandro

---

## 2026-07-29 — Rebrand: "Academia" → "Centro de Treinamento" em toda a UI

**Motivo:** Usuário notou o termo "Academia" ainda aparecendo em alguns lugares (sidebar do admin) depois do redesign do login (2026-07-22, que já usava "Centro de Treinamento Sandro Ferreira") — pediu que "Academia" nunca mais apareça, em lugar nenhum da interface.
**Impacto:** Varredura completa do código-fonte por "Academia" — 7 ocorrências trocadas: título da aba do navegador (`<title>`), sidebar do admin (desktop e mobile), mensagens de WhatsApp (cobrança e link de acesso ao portal), assunto do e-mail de acesso. Tela `/matricule-se` também alinhada ao mesmo padrão visual do `/login` (logos + título "Centro de Treinamento Sandro Ferreira", que antes só existia na tela de login).
**Status:** aplicado — busca confirmando zero ocorrências restantes de "Academia" isolado no código-fonte
**Artefatos atualizados:** design-system-academiasandro

---

## 2026-07-29 — Botão de pré-cadastro fixo no canto superior direito + domínio de produção registrado

**Motivo:** Usuário pediu que o botão "Ainda não é aluno? Cadastre-se" (até então um link discreto abaixo do card de login) ficasse bem visível no canto superior direito da tela, pra quem acessa o sistema pela primeira vez. Também informou o domínio que o sistema vai usar em produção.
**Impacto:** Botão reposicionado como elemento fixo (`position: fixed`) no canto superior direito do `/login`, com texto encurtado em telas pequenas ("Cadastre-se" no mobile, texto completo a partir de `sm:`). Domínio `sandrofreiresf.online` registrado em `PROGRESS.md` (nota de projeto, sem configuração de deploy ainda associada a ele).
**Status:** aplicado
**Artefatos atualizados:** —

---

## 2026-07-30 — Contas fixas de suporte (`devaluno`/`devmaster`), tela de Configurações do admin, e correção de gap de autorização em `/configuracoes`

**Motivo:** Três pedidos encadeados: (1) transformar o usuário de teste existente (`pedro.lima`) numa conta **fixa** — `devaluno`, senha sempre igual — pra logar como aluno em qualquer ambiente (inclusive produção futura) sem depender de senha alterada por terceiros; (2) criar uma segunda conta fixa `devmaster` (mesma senha, `role=ADMIN`) pro mesmo propósito do lado admin; (3) tela de Configurações pro Sandro cadastrar/editar nome, e-mail e telefone dele mesmo, já que hoje esses dados só existiam via seed (`.env`) ou nunca existiam (telefone). O fluxo de "esqueci minha senha" (aluno cadastra e-mail → clica esqueci senha → define a senha que quiser) já existia desde 2026-07-12 e foi só **confirmado**, não alterado.
**Impacto:**
- `Usuario.telefone` (novo campo, `String?`) — migração `20260730143418_usuario_telefone`
- `pedro.lima` → renomeado pra `devaluno` (username/e-mail/senha), `Aluno` vinculado renomeado pra "Aluno Teste (Dev)" (decisão do usuário, pra não ser confundido com aluno real em relatórios/telas)
- `devmaster` (novo `Usuario`, `role=ADMIN`, sem `alunoId`) — senha igual à do `devaluno` (`dev1807194`)
- `src/lib/contas-fixas.ts` (novo) — `ehContaFixa(username)`; usado em `deleteAluno` e `revogarAcessoAluno` (`src/app/(app)/alunos/actions.ts`) pra bloquear exclusão/revogação dessas duas contas pela UI
- `prisma/seed.ts` ganhou `garantirContasFixas()` — roda depois do upsert do `sandro`; garante `devaluno`/`devmaster` (senha fixa `dev1807194`) mesmo num banco recriado do zero, criando o `Aluno`+`Usuario` do `devaluno` junto se ainda não existir
- `/configuracoes` (nova rota, `src/app/(app)/configuracoes/`) — form pro admin editar `nome`/`email`/`telefone`, mesmo padrão visual das telas públicas (`card-premium`/`input-dark`)
- `src/components/AppShell.tsx` — novo grupo de menu "Conta" com o item "Configurações"
**Status:** aplicado — testado ponta a ponta (hash de senha conferido via `bcrypt.compare` pras 3 contas, `/configuracoes` redirecionando 307 sem sessão depois do fix, `npx tsc --noEmit` e `npm run lint` limpos)
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro, requisitos-funcionais-academiasandro
**Observação — bug real encontrado e corrigido no meio do processo:** ao criar `/configuracoes`, só o `ADMIN_PATHS` (`src/auth.ts`) foi atualizado pra incluir a rota nova — ela ficou **acessível sem login nenhum** por uma rodada de teste, porque a proteção de rota nesta versão do Next.js (16) não vem de um único `middleware.ts` clássico: `src/proxy.ts` (renomeado de "Middleware" pra "Proxy" nesta versão) tem seu próprio array `matcher`, independente do `ADMIN_PATHS`, e só roda o `authorized()` do `auth.ts` pras rotas listadas nele. Faltando `/configuracoes` no `matcher`, o proxy nunca era acionado pra aquele caminho. Corrigido adicionando `/configuracoes/:path*` no `matcher`. **Lição registrada no Playbook DevOps:** toda rota admin nova precisa ser adicionada nos dois lugares, e testada com `curl` sem cookie (esperando `307`, nunca `200`) antes de considerar pronta.

---

## 2026-07-30 — Gestão de horários/aulas, horário de almoço e bloqueios pontuais na Agenda

**Motivo:** `/agenda` só mostrava a grade (visualização) e um form de preços — criar/editar/excluir um `AgendaAula` só era possível via script (`prisma/seed-agenda.ts`), copiando o quadro físico. Usuário pediu: (1) UI pra gerenciar horários/aulas de verdade; (2) travar um horário de almoço configurável, que hoje era só um texto fixo no rodapé da grade sem regra nenhuma por trás; (3) um jeito de "travar a agenda" quando ele tem um compromisso pessoal num dia específico. Antes de implementar, perguntei e o usuário confirmou duas decisões de escopo: o bloqueio é **pontual por data específica** (não recorrente por dia da semana), e o almoço é **único e fixo pra toda a academia** (não varia por modalidade/dia).
**Impacto:**
- `ConfiguracaoAgenda` (novo model, linha singleton `id="singleton"`) — `almocoInicio`/`almocoFim`; `criarAula` rejeita horário novo dentro do intervalo
- `BloqueioAgenda` (novo model) — `data` + `horaInicio`/`horaFim` + `motivo` opcional, bloqueio pontual por data de calendário
- `src/lib/configuracao-agenda.ts` (`getConfiguracaoAgenda`, `salvarAlmoco`, `caiNoAlmoco`) e `src/lib/bloqueios-agenda.ts` (`getBloqueiosFuturos`, `getBloqueiosProximos`) — novos
- `/agenda` ganhou 3 seções novas: gerenciar horários (criar/editar capacidade/excluir `AgendaAula`), horário de almoço, bloqueios pontuais (form + lista com exclusão)
- Banner de aviso em `/aluno` (`getBloqueiosProximos(14)`) — avisa o aluno se houver bloqueio nos próximos 14 dias
- **Limitação estrutural comunicada ao usuário, não escondida:** o sistema não tem conceito de "aula do dia X" (só grade semanal recorrente) — um `BloqueioAgenda` avisa mas não cancela `Matricula`/`PresencaDiaria` automaticamente, porque isso não existe pra nenhuma aula hoje, bloqueada ou não
**Status:** aplicado — testado ponta a ponta via script (`caiNoAlmoco` rejeitando/aceitando corretamente, exclusão de horário com matrícula bloqueada com `P2003`, exclusão sem matrícula funcionando, bloqueio aparecendo em `getBloqueiosFuturos`/`getBloqueiosProximos`), `tsc`/`lint` limpos
**Artefatos atualizados:** modelo-de-dados-academiasandro, requisitos-funcionais-academiasandro, arquitetura-academiasandro

---

## 2026-07-30 — Gestão de agenda migrada pra Configurações (aba própria) + campo PIX no perfil

**Motivo:** Usuário gostou da estrutura de gestão de agenda recém-criada e pediu pra ela deixar de morar em `/agenda` e passar a viver dentro de `/configuracoes`, como uma aba "Agenda" ao lado da aba de perfil (nome/e-mail/telefone) — `/agenda` fica só com a grade. Pediu também um campo **PIX** no mesmo form de perfil, pro Sandro cadastrar a própria chave — a chave mostrada pro aluno em `/aluno/financeiro` vinha de uma env var (`PIX_KEY_CT`, sempre vazia, exigindo mexer no `.env`/redeploy pra mudar). Requisito explícito: qualquer edição em Configurações (agenda ou PIX) tem que refletir pro aluno **automaticamente**, sem passo manual.
**Impacto:**
- `Usuario.pix` (novo campo, `String?`) — migração `20260730191937_usuario_pix`
- `/configuracoes` virou página com abas (`?aba=perfil|agenda`, mesmo padrão de `Link`+`searchParams` já usado nos filtros de `/alunos`, sem client component) — aba Perfil ganhou o campo PIX, aba Agenda recebeu as 4 seções que saíam de `/agenda` (preços, almoço, bloqueios, gerenciar horários)
- Todas as Server Actions de agenda migraram de `src/app/(app)/agenda/actions.ts` (apagado) pra `src/app/(app)/configuracoes/actions.ts`, e passaram a revalidar `/aluno` e `/aluno/matricula` além de `/agenda`/`/configuracoes` — é isso que garante o reflexo automático pro aluno (as telas dele já são Server Components sem cache client-side, então bastava garantir a invalidação certa)
- `/agenda` virou só `AgendaGrid` (com a legenda de almoço real) + link pra Configurações → Agenda
- `/aluno/financeiro`: `process.env.PIX_KEY_CT` trocado por `prisma.usuario.findUnique({ where: { username: process.env.ADMIN_USERNAME } })` — busca deliberadamente pelo username fixo do admin principal, não "qualquer `role=ADMIN`", pra não pegar o PIX de `devmaster` por engano agora que existem duas contas admin
**Status:** aplicado — testado via script (PIX do `sandro` aparece corretamente pro aluno mesmo com `devmaster` tendo um PIX diferente cadastrado; criação/remoção de horário funcionando pelo novo caminho), servidor reiniciado do zero (matando o processo antigo por PID exato — `pkill -f` silenciosamente não achou o processo dessa vez), `tsc`/`lint` limpos
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro

---

## 2026-07-31 — Correção de marca ("Sandro Freire"), Gestão de Preços (Pacotes família/combo), vencimento editável, confirmação de pagamento visível ao aluno, e autocadastro de aluno ativo

**Motivo:** Sessão nova, cinco pedidos encadeados do usuário: (1) o nome da academia estava errado em várias telas ("Sandro Ferreira" — o correto, confirmado pelos logos em `public/logos/sandro-freire-personal.png` e pelo domínio `sandrofreiresf.online` já registrados, é "Sandro Freire"); (2) gestão de preços mais sofisticada — preço por modalidade (já existia), override de mensalidade por aluno individual (2 alunos da mesma modalidade podendo pagar valores diferentes) e "pacotes" com desconto, tanto pra família (vários alunos) quanto pra um único aluno praticando 2+ modalidades; (3) vencimento da mensalidade editável direto pelo admin (antes só recalculado automaticamente); (4) confirmação de pagamento visível pro aluno na aba Financeiro dele (cobranças extras só mostravam "comprovante enviado", nunca "confirmado"); (5) um link público de autocadastro pra aluno que já treina mas ainda não está no sistema — diferente do `/matricule-se` existente (que é fila de aprovação pra quem ainda não é aluno). Refinamento de escopo do pedido (2), feito via pergunta ao usuário antes de implementar: pacote é um conceito genérico com dois tipos (`FAMILIA` e `COMBO_MODALIDADES`), não fixo em "família"; e em pacote família, só o titular tem login no portal — a mensalidade de todos os integrantes aparece consolidada no financeiro dele.
**Impacto:**
- `Aluno.mensalidadeValor` (`Decimal?`, novo) — override do preço padrão da modalidade; `null` = usa `ModalidadePreco`
- `Pacote` (novo model) + `PacoteMembro` (novo model, `alunoId` `@unique` — um aluno só pertence a 1 pacote) + enum `TipoPacote` (`FAMILIA` | `COMBO_MODALIDADES`) — migração `20260731011546_pacotes_preco_individual`, aplicada direto via `npx prisma migrate dev` sem precisar do workaround manual (coluna nova nullable + 2 tabelas novas, sem constraint complexa — mesmo padrão observado em migrações "simples" anteriores)
- `src/lib/precos.ts` ganhou `valorEfetivoAluno` (calcula o valor com desconto — pra `FAMILIA` desconta só a mensalidade, pra `COMBO_MODALIDADES` desconta mensalidade + soma das modalidades extras matriculadas), `somaExtrasAluno`, `getAlunosComPrecos` (tabela da aba Preços) e `getPacotes`
- `src/lib/acesso-portal.ts` (novo) — `gerarUsernameUnico`/`criarUsuarioAluno` extraídos de `alunos/actions.ts` (eram privados lá) pra reaproveitar no novo fluxo de autocadastro
- Nova aba "Preços" em `/configuracoes` (`?aba=precos`, terceira aba ao lado de Perfil/Agenda) — preço por modalidade (bloco movido de dentro da aba Agenda), gestão de pacotes (criar/editar desconto por integrante/trocar titular/excluir, via `src/app/(app)/configuracoes/precos-actions.ts` e `src/components/CriarPacoteForm.tsx`), e tabela de override individual por aluno
- Cadastro/edição de aluno (`/alunos/novo`, `/alunos/[id]/editar`) ganharam campo de vencimento editável (`dataVencimento`, antes só calculado) e seletor de pacote (`pacoteId`/`descontoPercentual`) — vincular pelo formulário do aluno, não só pela aba Preços
- `/alunos/[id]/editar` mostra aviso (não bloqueia) quando o aluno é integrante não-titular de um pacote família, apontando quem é o titular do login
- `/aluno/financeiro` reescrita pra suportar múltiplos perfis: se o aluno logado é titular de um pacote família, a página lista a mensalidade (com valor já calculado/descontado) e as ações de comprovante de **todos** os integrantes, não só a dele — como os dependentes não têm login próprio, é assim que eles conseguem anexar comprovante (via `anexarComprovante` em `src/app/aluno/actions.ts`, que passou a aceitar `alunoId` de qualquer integrante acessível pela sessão, não só o `alunoId` da própria sessão)
- Bloco "Outras cobranças" de `/aluno/financeiro` ganhou um terceiro estado visual — "Pagamento confirmado" (badge de sucesso) além de "sem comprovante" e "aguardando confirmação", espelhando o badge que já existia só pro admin em `/transacoes`
- `/cadastro-aluno` (nova rota pública, fora dos route groups — mesmo padrão de `/matricule-se`) — aluno ativo se cadastra e vira `Aluno` de verdade na hora (`statusPagamento="Pendente"`), com acesso ao portal já criado no mesmo fluxo (reaproveita `criarUsuarioAluno`) — tela de sucesso mostra o link de definir senha direto, sem precisar do admin repassar depois
- `src/components/CopiarLink.tsx` (novo, client component) — botão de copiar o link de `/cadastro-aluno`, exibido no topo de `/alunos` pro admin divulgar
**Status:** aplicado — testado ponta a ponta via HTTP real (login por credentials via `curl` com `devmaster`/`devaluno`, autocadastro completo incluindo definição de senha e login subsequente, `/aluno/financeiro` conferido com um pacote família de teste — 2 alunos, descontos de 10%/20%, valores batendo exatamente com o cálculo esperado: R$40→R$36 e R$50→R$40 — dados de teste removidos do banco depois), `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro, requisitos-funcionais-academiasandro, backlog-tarefas-academiasandro
**Observação — porta 3000 ocupada por processo antigo:** ao testar via `npm run dev`, a porta 3000 estava ocupada por um `next-server` de sessão anterior (rodando há várias horas, código desatualizado — sem o rename "Sandro Freire", sem `/cadastro-aluno`). `pkill`/reinício simples não bastou até matar o PID exato encontrado via `ps`; mesma classe de armadilha já registrada no Playbook DevOps (seção deste projeto) — vale conferir `ps`/`ss -tlnp` antes de assumir que uma porta ocupada é sempre "outro projeto do workspace".

---

## 2026-08-03 — Deploy em produção (VPS Hostinger compartilhada) + descoberta de infra + remoção do `orbita-lobo`

**Motivo:** Domínio (`sandrofreiresf.online`) já registrado desde 2026-07-29 e usuário confirmou ter contratado VPS Hostinger com Docker — pediu pra colocar o sistema no ar. Plano inicial (Dockerfile + `docker-compose.yml` com serviço `caddy` próprio, bind direto nas portas 80/443) foi montado e testado localmente **antes** de se saber que essa VPS já hospeda outros dois sistemas em produção (VillaMill, Sistema Thieco) atrás de um **nginx no host** (não containerizado) que já ocupa as portas 80/443 — descoberto só quando o usuário mencionou os outros sistemas, a tempo de não executar o `docker compose up` do Caddy (nenhum outro site chegou a cair).
**Impacto:**
- `next.config.ts`: `output: "standalone"` — build enxuto pro Docker
- `Dockerfile` (novo, multi-stage deps→builder→runner, Node 22 Alpine) — como o projeto usa `@prisma/adapter-pg` (driver adapter), não precisa da engine nativa do Prisma no runtime, só o driver `pg`
- `docker-compose.yml` (novo) — serviço `app` publicado só em `127.0.0.1:3010` (porta escolhida por ser a primeira livre entre as já usadas pelos outros sistemas: 3000, 5000, 5003, 5173, 5432, 5433, 5436, 8081) + `migrate`/`seed` (one-off, rodam no stage `builder`, que tem o Prisma CLI/tsx completos que o `runner` não carrega)
- **Sem Caddy/reverse-proxy próprio** — quem expõe pra internet é o nginx do host (`/etc/nginx/sites-available/academia-sandro`), mesmo padrão do VillaMill/Thieco; certificado via `certbot --nginx -d sandrofreiresf.online -d www.sandrofreiresf.online` (Let's Encrypt, renovação automática, válido até 2026-11-01)
- Volume Docker nomeado `comprovantes` (`/app/public/comprovantes`) — sem isso, uploads de aluno seriam perdidos a cada rebuild da imagem standalone
- `orbita-lobo` (domínio `depositolobo.online`, containers `orbita-lobo-web/api/proxy`, pasta `/root/orbita-lobo`) **removido por completo da VPS** — decisão do usuário, sistema não usado mais. Containers, network Docker, imagens, site do nginx e certificado Certbot apagados; pasta do projeto apagada
**Status:** aplicado — `https://sandrofreiresf.online` e `https://www.sandrofreiresf.online` respondendo 200, redirect HTTP→HTTPS confirmado (301), certificado validado via `curl -v` (subject correto, expiração 2026-11-01)
**Artefatos atualizados:** arquitetura-academiasandro (seção 6 e nova seção de infraestrutura), Playbook DevOps (seção Academia Prof. Sandro), backlog-tarefas-academiasandro (item 6 fechado)
**Observação — correção de um registro anterior deste documento:** este arquivo (entrada de 2026-07-10) e o `backlog-tarefas-academiasandro.md` (linha de resumo + item concluído) afirmavam que a senha do Postgres do Supabase **tinha sido rotacionada em 2026-07-28**. Evidência coletada nesta sessão contradiz isso: o `.env` de desenvolvimento, lido diretamente nesta sessão pra montar o `.env.production` do VPS, contém a **mesma senha** já descrita como exposta em texto puro desde 2026-07-10 (mesmo valor, char a char). Ou a rotação de 2026-07-28 nunca foi de fato aplicada no painel do Supabase, ou foi revertida em algum momento não documentado — não dá pra confirmar qual das duas à distância. A senha voltou a ser exposta em texto puro nesta mesma sessão (necessário pra montar o `.env.production` do VPS) e, perguntado explicitamente se queria rotacionar agora, o usuário **optou por manter a senha atual por ora**. Tratar a entrada de 2026-07-28 como não confiável até confirmação manual no painel do Supabase (Settings → Database → verificar data do último reset de senha).

---

## 2026-08-03 — Limpeza de dados de teste/demonstração em produção

**Motivo:** Sistema acabou de ir ao ar (deploy acima) usando o **mesmo banco Supabase do ambiente de desenvolvimento** — ou seja, todo o dado fictício acumulado durante meses de dev (alunos de demonstração, transações, despesas) estava visível na produção real. Usuário pediu a limpeza; item já era backlog conhecido (item 12), mas agora executado.
**Impacto:**
- Apagados: 55 `TransacaoFinanceira`, 15 `Despesa`, 1 `Matricula` extra, 19 `Aluno` (18 fictícios do `seed-demo.ts`, com e-mail `@exemplo.com`, mais 2 cadastros reais de teste do próprio usuário e da esposa dele — "Willians de Oliveira Santana" e "Livia Dias", ambos de 2026-08-02, criados testando o fluxo de `/cadastro-aluno` durante o deploy) e os `Usuario` (`willians.santana`, `livia.dias`) vinculados a esses 2
- Também apagado, a pedido explícito do usuário numa segunda rodada: o `Aluno` fixo "Aluno Teste (Dev)" (vinculado ao login de suporte `devaluno`) — **mantido o login `devaluno` em si**, agora sem `alunoId` (decisão explícita: manter o login de suporte, aceitar que ele fique sem aluno vinculado até um novo `npm run db:seed`/`docker compose run --rm seed` recriar o par, já que `garantirContasFixas()` em `prisma/seed.ts` faz isso automaticamente)
- **Preservado, propositalmente:** os 81 registros de `AgendaAula` (grade real de horários da academia, não é dado de teste) e os `Usuario` `sandro`/`devmaster`
**Status:** aplicado — verificado por query direta no banco antes e depois de cada exclusão (contagem de `Aluno`/`TransacaoFinanceira`/`Despesa` zerada, exceto o combo `devaluno` sem `alunoId`); scripts de limpeza (`prisma/_tmp-*.ts`) eram descartáveis, apagados depois de rodar — não fazem parte do app
**Artefatos atualizados:** backlog-tarefas-academiasandro (item 12 fechado)

---

## 2026-08-03 — Cadastro multi-modalidade + faixa por modalidade em `/cadastro-aluno`

**Motivo:** Usuário pediu que quem recebe o link de autocadastro (`/cadastro-aluno` — aluno já ativo migrando pro sistema, não prospecção) consiga, no mesmo cadastro, adicionar mais de uma modalidade, mais de um horário, e uma faixa/graduação **por modalidade** (ex: Faixa Azul em Jiu-Jitsu, Corda Amarela em Capoeira — hoje só existia um `graduacaoFaixa` único pro aluno inteiro). Escopo fechado com o usuário: só o `/cadastro-aluno` (não as telas de admin nem o autoatendimento `/aluno/matricula`, que já permite adicionar modalidade extra depois de logado, mas sem capturar faixa).
**Impacto:**
- `AlunoFaixaModalidade` (novo model) — `alunoId` + `modalidade` + `graduacaoFaixa`, `@@unique([alunoId, modalidade])`; uma linha por modalidade **extra** praticada (a principal continua em `Aluno.modalidade`/`Aluno.graduacaoFaixa`, sem migração de schema aí) — migração `20260803053420_aluno_faixa_modalidade_extra`
- `src/lib/matricula.ts` (novo) — `matricularAlunoEmAula` extraído de `matricularEmAula` (`src/app/aluno/actions.ts`), recebendo opcionalmente o client de uma transação em andamento (`tx`), pra poder ser reaproveitado tanto pelo autoatendimento (sessão logada) quanto pelo autocadastro público (aluno recém-criado, sem sessão, dentro da mesma transação que cria o `Aluno`)
- `src/components/SeletorModalidadesMultiplas.tsx` (novo client component, substitui `SeletorModalidadeHorario` em `/cadastro-aluno`) — grupos repetíveis de modalidade+horário+faixa, primeiro grupo é a principal (horário opcional, só referência, como já era), grupos seguintes são extras (horário obrigatório — vira `Matricula` real, com cobrança) e cada modalidade só pode ser escolhida uma vez (select desabilita as já usadas nos outros grupos)
- `src/app/cadastro-aluno/actions.ts` reescrita — lê os 3 campos como arrays (`formData.getAll`), cria o `Aluno` (grupo principal) + `Matricula`/`TransacaoFinanceira`/`AlunoFaixaModalidade` de cada grupo extra dentro de um único `prisma.$transaction` (falha em qualquer grupo — ex: horário lotado — desfaz o cadastro inteiro, em vez de deixar aluno pela metade)
**Status:** aplicado — `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos; testado ponta a ponta com script descartável reproduzindo a mesma lógica da action (aluno com modalidade principal + 1 extra, faixa de cada uma, cobrança da extra gerada com o preço certo da modalidade) — dado de teste apagado depois. Sincronizado e rebuildado no VPS (`docker compose build app && docker compose run --rm migrate && docker compose up -d app`), confirmado no ar pelo usuário.

---

## 2026-08-03 — 12 melhorias encadeadas: WhatsApp real via Evolution API, financeiro por modalidade, pacotes-catálogo, LGPD, horário obrigatório

**Motivo:** Lista de 12 pedidos soltos numa mensagem só, cobrindo praticamente todo módulo do sistema. Antes de implementar, mapeei o código atual e descobri um fato que mudou o desenho de 3 dos 12 itens: a VPS compartilhada já roda um gateway real de WhatsApp (**Evolution API**, container `evolution_api`), usado por `orbita-cortex` e `lane-confeitaria` — os pedidos de "avisar por WhatsApp" deixaram de ser link `wa.me` manual e passaram a ser envio automático de verdade. Usuário confirmou 3 pontos antes de começar: (1) termo LGPD com texto padrão genérico, não jurídico; (2) modalidades extras passam a ter ciclo de 12 parcelas próprio (igual a mensalidade principal), não só 1 cobrança única; (3) pacotes Combo viram catálogo autosserviço, Família continua só-admin.
**Impacto (schema, uma migration só — `20260803191927_melhorias_agosto`):**
- `Matricula.dataVencimentoBase` (`DateTime @default(now())`) — âncora do ciclo de 12 parcelas de cada modalidade extra, editável pelo admin por matrícula
- `TransacaoFinanceira.matriculaId` perdeu o `@unique` — uma matrícula extra agora pode ter várias transações ao longo dos meses (1 por mês), igual já funcionava pra mensalidade principal via `alunoId`. Toda leitura que assumia "a transação da matrícula" (singular) foi migrada pra "a mais antiga/a que interessa" (`src/lib/agenda.ts`, `src/lib/alertas.ts`, `/matriculas`, `/` dashboard, `layout.tsx`) — `matricula.transacao` virou `matricula.transacoes[]`
- `Pacote.descontoPadrao` (`Decimal?`) — só usado por `COMBO_MODALIDADES` criado como catálogo (sem `PacoteMembro` ainda), vira o desconto aplicado quando o aluno escolhe o pacote sozinho
- `PreCadastro.dataAulaExperimental` (`DateTime? @db.Date`), `termosAceitos` (`Boolean`), `termosAceitosEm` (`DateTime?`)
**Impacto (WhatsApp real — `src/lib/whatsapp-gateway.ts`, novo):** conexão direta com a Evolution API (não passa pelo Cortex — a instância própria do academia-sandro precisa de `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` de qualquer forma pra gerenciar QR/status/desconectar, então falar com `/message/sendText` direto é o caminho mais simples, sem hop extra). Nova aba "WhatsApp" em `/configuracoes` (`WhatsappConexao.tsx`, cópia fiel do padrão já usado em `lane-confeitaria`) — QR code, status, desconectar. Bloqueio de agenda (`criarBloqueio`) resolve os alunos afetados (principal da modalidade + matriculados no horário específico) e envia aviso automático; pré-cadastro com `dataAulaExperimental` preenchida avisa o admin (telefone de `Usuario` com `username=ADMIN_USERNAME`) automaticamente. Falha de envio nunca lança — só loga, nunca derruba a action de negócio.
**Impacto (features, resumo — 12 itens, ver [[modelo-de-dados-academiasandro]] e [[arquitetura-academiasandro]] pros detalhes técnicos completos):**
1. Ficha completa do pré-cadastro — `/pre-cadastros/[id]` (nova rota)
2. Username incluso na mensagem de acesso ao portal (`mensagemAcessoPortal` ganhou parâmetro)
3. Horário sempre obrigatório — removida a opção "Sem horário definido"/"(opcional)" de `SeletorModalidadeHorario`/`SeletorModalidadesMultiplas`; validado também nas 3 Server Actions de criação de aluno
4. Financeiro por modalidade — `getParcelas` generalizada pra `getParcelasCiclo({alunoId, matriculaId, dataBase})`, reaproveitada pra mensalidade principal e cada modalidade extra; `/aluno/financeiro` reescrita com card + tabela de 12 parcelas por modalidade; nova seção "Modalidades matriculadas" em `/alunos/[id]/editar` com vencimento editável por matrícula (`atualizarVencimentoMatricula`, nova action)
5. Badges de modalidades extras na listagem `/alunos` (dedupe por nome de modalidade, não por matrícula)
6. Pacotes Combo em catálogo (`alunoId` opcional em `criarPacote`, nova action `atribuirAlunoPacote`) + Pacote Família isolado num bloco visual separado, nunca oferecido ao aluno; `/cadastro-aluno` oferece os combos-catálogo disponíveis quando o aluno escolhe 2+ modalidades
7. Bloqueio de agenda avisa o aluno (ver WhatsApp acima)
8. Pré-cadastro com data de aula experimental avisa o admin (ver WhatsApp acima) — campo novo em `/matricule-se`
9. Horário de almoço nunca fica "sem configurar" — `getConfiguracaoAgenda` cai num default seguro (12:00–13:00) em vez de `null`/`null` antes do admin configurar pela 1ª vez
10. Aba WhatsApp em Configurações (ver acima)
11. Termo de aceite LGPD no pré-cadastro — `TermosAceite.tsx` (novo componente), checkbox obrigatório, texto padrão genérico sinalizado como tal (não é texto jurídico revisado)
12. Despesas recorrentes — **já estava implementado**, confirmado sem necessidade de mudança
**Status:** aplicado — migration rodada contra o banco real (mesmo Supabase de dev/produção), `npx tsc --noEmit`/`npm run lint`/`npm run build` limpos em cada bloco. Testado ao vivo com `npm run dev` + sessão real autenticada (`devmaster`): todas as páginas novas/alteradas responderam 200 com dado real. Achados e corrigidos durante o teste ao vivo (não no plano original):
- Bug de timezone: `dataNascimento`/`dataAulaExperimental`/`dataVencimentoBase` formatadas sem `timeZone: "UTC"` apareciam **um dia a menos** em qualquer render de data-only — corrigido nos 3 pontos novos que exibiam esses campos
- Bug em `valorEfetivoAluno` (`src/lib/precos.ts`, função pré-existente, não criada nesta sessão): só somava modalidades extras no total quando o aluno tinha pacote `COMBO_MODALIDADES` — pra aluno sem pacote nenhum, o "valor total" do financeiro sempre foi só a mensalidade base, ignorando extras. Corrigido pra sempre computar `extras` via `somaExtrasAluno` e somar ao total nos 3 ramos (sem pacote, `FAMILIA`, `COMBO_MODALIDADES`) — efeito colateral positivo: a tabela "Preço individual dos alunos" em Configurações → Preços também passou a refletir o valor real (extras inclusos)
- Bug de renderização em `bullets()`/`numbered()` do gerador do manual em PDF (ver entrada seguinte) — não é bug do sistema, é do script descartável de geração do PDF
**Artefatos atualizados:** modelo-de-dados-academiasandro, arquitetura-academiasandro, backlog-tarefas-academiasandro, folder-purpose (registro da pasta faltando), Playbook DevOps (seção Academia Prof. Sandro)

---

## 2026-08-03 — Commit fechando lacuna de histórico + push pro GitHub + achado de segurança (senha real em `.claude/settings.local.json`)

**Motivo:** Usuário pediu commit + push depois da sessão de 12 melhorias acima. `git status` revelou que o working tree tinha muito mais coisa "untracked" do que só o trabalho do dia — features inteiras de sessões anteriores nunca tinham sido commitadas (`/cadastro-aluno` completo, `src/lib/matricula.ts`, `src/lib/acesso-portal.ts`, `Dockerfile`, `docker-compose.yml`, `DEPLOY.md`, migrations antigas, logos), já em produção mas fora do git. Usuário confirmou: commitar tudo (fechar a lacuna), exceto 4 imagens `WhatsApp Image *.jpeg` soltas na raiz (screenshots sem relação com o app).
**Impacto:**
- Antes de comitar `.claude/` (que o usuário não pediu explicitamente pra excluir), inspecionei o conteúdo — `academia-sandro/.claude/settings.local.json` continha a **senha real do Postgres do Supabase em texto puro**, dentro de um padrão de permissão salvo de uma sessão antiga (comando `DATABASE_URL='postgresql://...%23<SENHA-REDIGIDA>@...'` autorizado — valor real removido deste documento em 2026-08-10 ao versionar `orbita-black`/`kernel-hq` pela primeira vez, precisamente pra evitar repetir a exposição que esta entrada descreve). Excluído do commit por conta própria, mesmo sem pedido explícito — regra de segurança do sistema (nunca commitar segredo) prevalece sobre a resposta literal do usuário à pergunta sobre `.claude/`. Reforça a pendência de rotação de senha já registrada (2026-07-28/2026-08-03 acima) — a senha real segue exposta em pelo menos 2 lugares fora do git agora (o `.env` local, esse `settings.local.json`).
- Também descoberto: `academia-sandro/.claude/agent-memory/aiox-devops/project-zion-workspace-monorepo.md` — memória própria de uma sessão AIOX anterior, documentando a técnica de "plumbing-rebase" pra empurrar só arquivos de um projeto num monorepo compartilhado com árvore cronicamente suja (`zion-workspace`, remote `github.com/willianslegacy94-zion/zion-workspace`), sem tocar em outros projetos (`sistema-thieco`, `node_modules` commitado, etc) nem no repo aninhado `orbita-lobo/` — mesmo risco já registrado na seção "Risco do monorepo" do Playbook DevOps, agora com o procedimento de mitigação documentado também do lado do academia-sandro
- Commit `74e7f11` — 50 arquivos, +3261/-437 linhas, escopado só a `academia-sandro/` (`git add academia-sandro -- ':!academia-sandro/.claude' ':!academia-sandro/*.jpeg'`)
- Push delegado ao agente `aiox-devops` (não feito diretamente) — regra de governança do workspace reserva `git push` a esse agente; o agente confirmou `origin/main` sem divergência (`0 behind / 1 ahead`), fast-forward puro sem precisar da técnica de plumbing-rebase, validou escopo do commit (`git diff-tree`, zero arquivo fora de `academia-sandro/`, zero segredo/marcador de conflito nas linhas adicionadas) antes de publicar
**Status:** aplicado — `74e7f11` publicado em `origin/main`, verificado `git log --oneline origin/main..HEAD` vazio pós-push
**Artefatos atualizados:** registro-de-decisoes-academiasandro (esta entrada)
**Observação — dívida de documentação/governança pré-existente, não desta sessão:** este projeto tinha meses de trabalho implementado e funcionando em produção sem nunca ter sido commitado — um risco real (nenhum backup de código fora do próprio disco até agora) que só foi descoberto ao tentar cumprir o pedido de commit. Não há como saber se isso se repete em outros projetos do mesmo operador sem checar `git status` de cada um.

---

## 2026-08-03 — Deploy manual guiado (achado: bug de cache do Turbopack + erro de terminal no rsync) + manual do usuário em PDF

**Motivo:** Depois do push, usuário pediu ajuda pra subir as mudanças de hoje na VPS de produção, e depois um manual de usuário em PDF pra entregar ao Sandro.
**Impacto (deploy):**
- Confirmado meta-fato importante: este projeto **não** usa `git pull` na VPS — o deploy é via `rsync` direto do computador local pro `/opt/academia-sandro`, sem clone git no servidor (ver Playbook DevOps). O push pro GitHub é só backup/histórico, não alimenta o deploy sozinho.
- Usuário cometeu o mesmo erro duas vezes: rodou o comando `rsync` de **dentro da sessão SSH já aberta na VPS**, em vez de um terminal local — o comando tentou copiar `/opt/academia-sandro/academia-sandro` (caminho relativo resolvido contra o cwd da VPS) pra ela mesma via rede, e falhou (`No such file or directory`). Também rodou `docker compose build/migrate/up` **antes** do rsync bem-sucedido, reconstruindo o container com código antigo (`migrate` reportou "no pending" só porque o banco — compartilhado dev/prod — já tinha as migrations aplicadas desde a sessão de desenvolvimento, não porque o código estava em dia)
- Corrigido guiando passo a passo com comandos explícitos de verificação (`hostname` pra confirmar que saiu da VPS) antes do rsync certo — funcionou na segunda tentativa
- Confirmado ao vivo, de fora, que o deploy pegou o código novo: `curl` em `https://sandrofreiresf.online/matricule-se` já retornava os campos novos (data de aula experimental, texto de termos de uso)
**Impacto (manual em PDF):**
- Ambiente sandbox não tem bibliotecas de sistema pra Chromium headless (`libnspr4.so` e afins faltando, sem `sudo` pra instalar) — Playwright/Puppeteer (padrão já usado no workspace, ver `Proposta_Generica/gerar-pdf.js`) não funciona aqui. Gerado via **pdfkit** (biblioteca Node pura, sem dependência de navegador) — script descartável, não faz parte do projeto
- `academia-sandro/Manual-do-Usuario-Sandro.pdf` (16 páginas) — capa com identidade visual do CT, sumário com números de página reais, 14 seções cobrindo o sistema como está hoje (inclusive as 12 melhorias desta sessão), caixas de "Dica"/"Atenção"
- 2 bugs de renderização achados e corrigidos durante a verificação (extração de texto do PDF gerado, comparado contra o conteúdo esperado): (1) o caractere seta `→` não existe na fonte padrão Helvetica do PDF (WinAnsiEncoding) e virava caractere quebrado — trocado por `>` em todo o texto; (2) itens numerados/com marcador que quebravam em 2+ linhas perdiam um trecho do meio do texto — causa era um cálculo manual de posição Y (`doc.y - 12.4`) assumindo altura fixa de 1 linha; corrigido trocando pro encadeamento nativo do pdfkit (`continued: true`), que deixa a própria biblioteca calcular o wrap
**Status:** aplicado — produção confirmada com o código de hoje via `curl` externo; PDF verificado via extração de texto completa (`pdf-parse`), sem trecho cortado/colado, acentuação intacta
**Artefatos atualizados:** Playbook DevOps (seção Academia Prof. Sandro — deploy e novos gotchas)

---

## 2026-08-03 — WhatsApp pareado e testado ao vivo em produção + achado de bug real (telefone do admin vazio) + melhorias de UX

**Motivo:** Depois do deploy, usuário parou pra ativar o WhatsApp de verdade: criou a rede `orbita_shared` na VPS, preencheu `EVOLUTION_API_KEY`, recriou o container e escaneou o QR code em Configurações → WhatsApp — conectou de primeira. Pediu então pra testar os dois avisos automáticos (itens 7 e 8) com mensagem chegando de verdade no celular.
**Impacto (teste ao vivo, via `curl` direto em `https://sandrofreiresf.online`):**
- **Item 8 (aula experimental avisa o admin) falhou na primeira tentativa** — pré-cadastro de teste criado com sucesso, mas nenhuma mensagem chegou. **Item 7 (bloqueio de agenda avisa o aluno) funcionou de primeira** — usuário criou um bloqueio de teste e a mensagem chegou no WhatsApp.
- Como os dois usam o mesmo `enviarWhatsapp`/mesma conexão, o item 7 funcionando isolou o problema: não era a conexão com a Evolution API, era específico do item 8. **Causa raiz confirmada:** o código busca `Usuario.telefone` do admin (`username = ADMIN_USERNAME`) e, se esse campo estiver vazio, **pula o envio em silêncio** (`if (admin?.telefone) { ... }`) — sem lançar erro, sem logar nada. O campo Telefone da conta `sandro` estava vazio (nunca preenchido desde que o campo existe, 2026-07-30). Usuário preencheu em Configurações → Perfil com o mesmo número pareado no WhatsApp — reteste confirmou mensagem chegando.
- **Gap identificado, não corrigido nesta sessão:** diferente do item 7 (`criarBloqueio` loga `console.error` quando `enviarWhatsapp` retorna `enviado: false`), o item 8 (`criarPreCadastro`) não checa nem loga o resultado do envio — por isso o primeiro teste falhou sem deixar rastro nenhum nos logs da VPS. Fica registrado como inconsistência conhecida, não urgente (o sintoma agora é conhecido e documentado no manual do usuário).
**Impacto (2 melhorias de UX, a pedido do usuário depois do teste — "por que tem que conectar em 2 abas diferentes"):**
- Texto explicativo adicionado em Configurações → Perfil (campo Telefone) e Configurações → WhatsApp, deixando explícita a diferença entre os dois campos: um é **pra onde chegam** os avisos administrativos (`Usuario.telefone`, Perfil), o outro é **quem envia** as mensagens (número pareado na Evolution API, aba WhatsApp) — coincidem na prática, mas são conceitos diferentes no sistema (o segundo nem é um campo do banco, é estado da instância Evolution)
- `whatsapp-gateway.ts` ganhou `buscarNumeroConectado()` — consulta `GET /instance/fetchInstances` na Evolution API e tenta extrair o número pareado (`ownerJid`/`owner`/`instance.owner`, formato varia por versão da API, falha em silêncio retornando `null` se não achar nenhum desses campos — não é crítico, é só atalho de conveniência)
- Nova action `sincronizarTelefonePerfilAction` (`whatsapp-actions.ts`) — copia o número pareado pro `Usuario.telefone` da sessão logada, com 1 clique
- `WhatsappConexao.tsx`: quando conectado, busca o número pareado e mostra o botão "Usar esse número também como Telefone do Perfil" (só aparece se `buscarNumeroConectado` conseguir extrair um número)
**Impacto (limpeza de dados de teste):**
- Apagados: 2 `PreCadastro` de teste ("TESTE WhatsApp (apagar)", "TESTE WhatsApp 2 (apagar)"), 1 `BloqueioAgenda` de teste (criado nesta sessão, sem `motivo`, 04/08 07:15–18:15) — **preservado** um `BloqueioAgenda` real pré-existente ("Consulta medica", 02/08), identificado por ter `motivo` preenchido e `createdAt` de antes desta sessão
- Também apagado (a pedido explícito): `Aluno` "Aluno Teste Badges" + `Usuario` `aluno.badges` + as 2 `Matricula` + as 2 `AlunoFaixaModalidade` vinculadas — era o aluno de teste multi-modalidade criado numa sessão anterior do mesmo dia (ver entrada "12 melhorias..." acima) pra validar as badges de modalidade extra em `/alunos`
**Impacto (commit/push #2 + manual atualizado):**
- Commit `2b3be3a` — só os 4 arquivos das melhorias de UX (`configuracoes/page.tsx`, `whatsapp-actions.ts`, `WhatsappConexao.tsx`, `whatsapp-gateway.ts`), push via `aiox-devops` de novo — fast-forward puro, sem divergência (`origin/main` estava exatamente em `74e7f11`, parent direto)
- `Manual-do-Usuario-Sandro.pdf` atualizado (16→17 páginas): nova dica na seção Perfil, texto revisado na seção WhatsApp, e a pergunta frequente "avisos não chegando" ganhou o diagnóstico real (campo Telefone vazio = envio pulado em silêncio) — verificado de novo via extração de texto completa, sem corrupção
**Status:** aplicado e **validado ao vivo em produção** — os dois avisos automáticos (bloqueio → aluno, aula experimental → admin) confirmados chegando de verdade no WhatsApp real do CT, não só testado via HTTP/banco. Primeira vez neste projeto que uma feature de WhatsApp é confirmada ponta a ponta com mensagem realmente recebida (todas as anteriores foram só `enviado: true`/HTTP 200, sem confirmação humana do outro lado)
**Artefatos atualizados:** registro-de-decisoes-academiasandro (esta entrada), backlog-tarefas-academiasandro, arquitetura-academiasandro, Playbook DevOps

---

## 2026-08-03 — Cron real de expiração de comprovante + total do financeiro soma extras por matrícula

**Motivo:** Dois itens que já estavam no backlog como decisão pendente: (1) configurar de verdade o cron da rota `/api/cron/limpar-comprovantes` (existia desde 2026-07-29, mas só rodava "preguiçoso" quando alguém abria `/matriculas`/`/transacoes`); (2) decidir se o "Valor total" do financeiro (Seção 7 do manual, `valorEfetivoAluno`) deveria somar por matrícula extra ou por nome de modalidade distinto — usuário escolheu por matrícula.
**Impacto (cron):**
- Nenhuma mudança de código — a rota já existia e já era idempotente/pública (`GET /api/cron/limpar-comprovantes`, sem auth, chama `limparComprovantesExpirados`). Só faltava o agendamento em si, que é infraestrutura da VPS (`crontab`), não código do projeto
- Passo a passo passado ao usuário pra rodar via SSH: `crontab -e` → `0 3 * * * curl -s https://sandrofreiresf.online/api/cron/limpar-comprovantes > /dev/null` (exatamente o que já estava documentado em `DEPLOY.md` desde o deploy inicial, só nunca tinha sido de fato configurado)
**Impacto (total por matrícula):**
- `somaExtrasAluno` (`src/lib/precos.ts`) deduplicava por nome de modalidade (`new Set(...)`) antes de somar — um aluno com 2 `Matricula` na mesma modalidade extra (2 horários diferentes) só contava o preço **uma vez** no total, mesmo cada matrícula gerando sua própria cobrança/ciclo de parcelas separado (`getParcelasCiclo`, ver entrada "12 melhorias..." acima). Trocado pra somar por matrícula (`reduce` direto sobre a lista, sem `Set`) — agora o "Valor total" bate com a soma real do que é cobrado
- Os cards de parcelas por modalidade em `/aluno/financeiro` **não mudaram** — já eram por matrícula desde a implementação original; só o número do topo estava inconsistente com eles
- Efeito colateral (esperado, mesmo padrão da correção de `valorEfetivoAluno` registrada na entrada "12 melhorias..."): a tabela "Preço individual dos alunos" em Configurações → Preços também reflete o novo total, já que usa a mesma função
**Status:** aplicado — commit `71835cf` (só `src/lib/precos.ts`), push via `aiox-devops` (3º push da sessão, fast-forward puro de novo, `origin/main` sem divergência nas 3 vezes). `npx tsc --noEmit` limpo, verificado pelo próprio `aiox-devops` antes de publicar
**Artefatos atualizados:** registro-de-decisoes-academiasandro (esta entrada), backlog-tarefas-academiasandro, Playbook DevOps
