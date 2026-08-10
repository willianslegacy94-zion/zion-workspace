---
status: draft
domain: academiasandro
source: claude
created: 2026-07-11
updated: 2026-08-03
owner: willians
---

# Arquitetura Técnica — Academia Prof. Sandro

> Referência: [[prd-academiasandro]] | [[requisitos-funcionais-academiasandro]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Full-stack em uma única codebase; Server Actions eliminam necessidade de API REST separada para CRUD simples | Versão recente com breaking changes vs. Next.js anterior — `AGENTS.md` do projeto exige checar `node_modules/next/dist/docs/` antes de assumir comportamento de versões antigas |
| UI | React 19 + TypeScript 5 | Tipagem estática, Server Components por padrão | — |
| Estilo | Tailwind CSS v4 | Utility-first; tokens de marca (dourado/bronze) direto em `@theme inline` | Tailwind v4 **não lê `tailwind.config.ts`** por padrão — todo o tema vive em `globals.css` |
| ORM | Prisma 7.8 (gerador `prisma-client`) | Schema declarativo, migrations versionadas, type safety | Gerador novo (`prisma-client`, não `prisma-client-js`) **exige driver adapter explícito** — `new PrismaClient()` sem adapter não compila mais |
| Driver de banco | `@prisma/adapter-pg` + `pg` | Adapter oficial para PostgreSQL exigido pelo novo gerador do Prisma 7 | Precisa estar instalado manualmente — não vem como dependência transitiva do pacote `prisma` |
| Banco de dados | PostgreSQL (Supabase, pooler Supavisor) | Gratuito para começar, gerenciado, com pooler de conexões | Prisma 7 mudou o comportamento de `sslmode=require` (validação completa da cadeia de certificado) — pooler da Supabase exige `sslmode=no-verify` para conectar (ver seção 5) |

---

## 2. Camadas do sistema

```
[Browser]
     ↓  ↑  (Server Actions via <form action={...}>)
[Next.js 16 App Router]
   ├── [Server Components — src/app/*/page.tsx]   ← leitura direta via Prisma
   └── [Server Actions — src/app/*/actions.ts]     ← mutações ("use server")
     ↓  ↑  (PrismaPg adapter, pool "pg")
[PostgreSQL — Supabase (Supavisor pooler)]
```

**Browser:** apenas HTML renderizado no servidor + formulários nativos. Nenhum estado de cliente ou fetch manual — toda a interatividade é via `<form action={serverAction}>`.

**Server Components (`page.tsx`):** consultam o Prisma diretamente durante o render (`prisma.aluno.findMany()`), sem passar por uma API HTTP intermediária.

**Server Actions (`actions.ts`):** funções `"use server"` que recebem `FormData`, validam campos obrigatórios, persistem via Prisma e chamam `revalidatePath()` para atualizar a listagem.

**Prisma Client + PostgreSQL:** client singleton em `src/lib/prisma.ts`, instanciado com `PrismaPg` (driver adapter) apontando para `DATABASE_URL`.

---

## 3. Fluxo de dados

**Listagem de alunos (leitura):**
```
[GET /alunos]
→ [Server Component: prisma.aluno.findMany({ orderBy: { dataMatricula: "desc" } })]
→ [HTML renderizado no servidor com a tabela já populada]
```

**Cadastro de aluno (escrita):**
```
[Submit do <form action={createAluno}>]
→ [Server Action recebe FormData]
→ [Valida campos obrigatórios — lança erro se algum estiver vazio]
→ [prisma.aluno.create({ data: {...} })]
→ [revalidatePath("/alunos") → página re-renderiza com o novo registro]
```

**Cadastro de transação com vínculo opcional:**
```
[Submit do <form action={createTransacao}>]
→ [Server Action recebe FormData, incluindo alunoId opcional]
→ [prisma.transacaoFinanceira.create({ data: { ..., alunoId: alunoId || null } })]
→ [revalidatePath("/transacoes")]
```

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Notas |
|---|---|---|---|---|
| Next.js ↔ PostgreSQL | consumo interno | Prisma Client (via `@prisma/adapter-pg`, TCP) | usuário/senha na `DATABASE_URL` | Conexão via pooler Supavisor da Supabase (`aws-1-us-east-2.pooler.supabase.com:5432`), não conexão direta ao Postgres |
| Browser ↔ Server Actions | consumo interno | protocolo interno do Next.js (RSC) | nenhuma (sem autenticação implementada) | Não é uma API REST tradicional — não pode ser chamada via `curl` sem replicar o protocolo do Next |
| Next.js ↔ Evolution API (2026-08-03) | saída (envio de WhatsApp) + gestão de instância (QR/status/desconectar/número pareado) | HTTP REST (`POST /message/sendText/{instance}`, `GET /instance/connectionState/{instance}`, `POST /instance/connect/{instance}`, `POST /instance/create`, `DELETE /instance/logout/{instance}`, `GET /instance/fetchInstances`) | header `apikey` (`EVOLUTION_API_KEY`) | `src/lib/whatsapp-gateway.ts`, novo — conexão direta (não via Cortex, diferente do padrão usado por `sistema-thieco`/`sistema-orbita-whitelabel`), porque a gestão de QR/status/desconectar não é exposta pelo Cortex, só o relay de envio (`/api/v1/cortex/notificar-admin`) — já que precisa falar direto com a Evolution de qualquer forma, falar direto pro envio também evita um hop extra. Só alcançável em produção (rede Docker `orbita_shared`); em dev local a conexão falha graciosamente (`enviado: false`, nunca lança). **Pareado e validado ao vivo em 2026-08-03.** |

> **Gap conhecido, não corrigido (2026-08-03):** o aviso de aula experimental (`criarPreCadastro`, `src/app/matricule-se/actions.ts`) não checa nem loga o retorno de `enviarWhatsapp` — se `Usuario.telefone` do admin estiver vazio, o envio é pulado **em silêncio**, sem erro visível em lugar nenhum. Foi exatamente a causa do primeiro teste ao vivo falhar sem deixar rastro. O aviso de bloqueio de agenda (`criarBloqueio`, `src/app/(app)/configuracoes/actions.ts`) já loga falha (`console.error`) — inconsistência entre os dois call sites, registrada aqui pra não ser redescoberta do zero numa sessão futura.

---

## 5. Fronteiras de segurança

- **Autenticação:** implementada (2026-07-12) via **NextAuth v5** (Credentials provider), sessão JWT, login por `username` (não e-mail). `src/proxy.ts` protege `/`, `/alunos`, `/transacoes`, `/despesas`, `/pre-cadastros`, `/agenda`, `/matriculas`, `/configuracoes` (2026-07-30) e, desde 2026-07-23, `/aluno` — redireciona pra `/login` se não houver sessão. `/matricule-se`, `/login`, `/esqueci-senha` e `/resetar-senha` são públicas por design.
  - **Proteção de rota exige dois lugares sincronizados (armadilha real, 2026-07-30):** `ADMIN_PATHS`/`ALUNO_PATHS` em `src/auth.ts` decidem qual `role` acessa qual rota, mas só entram em jogo se a rota também estiver no array `matcher` de `src/proxy.ts` — sem isso, o proxy nunca roda pra aquele caminho e a rota fica **pública por omissão**. Ao criar `/configuracoes`, só o `ADMIN_PATHS` foi atualizado inicialmente; a rota ficou acessível sem sessão até o `matcher` ser corrigido também. Checklist pra toda rota admin nova: adicionar em `ADMIN_PATHS` **e** em `matcher`, depois confirmar com `curl` sem cookie (esperar `307` pro `/login`, nunca `200`).
  - **Contas fixas de suporte (2026-07-30):** `devaluno` (ALUNO) e `devmaster` (ADMIN), senha sempre `dev1807194`, criadas pra permitir teste/suporte sem depender da senha pessoal do Sandro — inclusive em produção futura. Protegidas contra exclusão pela UI (`src/lib/contas-fixas.ts`, checado em `deleteAluno`/`revogarAcessoAluno`) e recriadas/reforçadas a cada `npm run db:seed` (`garantirContasFixas` em `prisma/seed.ts`), mesmo num banco zerado.
  - Mitigação de timing attack no login: `bcrypt.compare` roda contra um hash dummy mesmo quando o username não existe, pra não vazar por tempo de resposta se a conta existe
  - Recuperação de senha: token opaco (`crypto.randomBytes(32)`), expira em 1h, single-use, sem SMTP — o link é retornado na resposta pra repasse manual (WhatsApp)
  - **Controle por `role` implementado (2026-07-28)**, fechando a pendência registrada em 2026-07-23: `authorized` (em `src/auth.ts`) diferencia `ADMIN_PATHS` de `ALUNO_PATHS` e redireciona (não bloqueia com erro) quando a `role` da sessão não bate com o grupo de rota — ADMIN tentando `/aluno` vai pra `/`; ALUNO tentando `/alunos` vai pra `/aluno`. Match de rota é por **segmento exato** (`pathname === prefixo || pathname.startsWith(prefixo + "/")`), não prefixo puro — uma primeira versão colidia `/alunos` (gestão) com `/aluno` (portal), corrigida na mesma sessão. **Causa raiz do gap:** a única conta existente (`sandro`) tinha sido criada com a `role` default do Prisma (`ALUNO`), nunca setada pra `ADMIN` explicitamente — `prisma/seed.ts` corrigido para setar `role: "ADMIN"` no upsert
- **Segredos:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` apenas em `.env` (fora do controle de versão via `.gitignore`)
- **TLS com o banco:** `sslmode=no-verify` na connection string — criptografa a conexão mas não valida a cadeia de certificado do pooler da Supabase. Aceitável para desenvolvimento local; **revisitar para `verify-full` antes de produção** (ver decisão no [[registro-de-decisoes-academiasandro]])
- **Incidente de senha exposta (2026-07-10, reincidente em 2026-07-12, 2026-08-03 e de novo em 2026-08-03):** a `DATABASE_URL`/`DIRECT_URL` originais vieram concatenadas em uma única linha no `.env`, expondo a senha real do Postgres em texto puro durante a depuração — voltou a aparecer em texto puro numa sessão posterior (2026-07-12, ao reabrir o `.env` pra adicionar variáveis de auth) e de novo em 2026-08-03 (necessário ecoar a connection string pra montar o `.env.production` do VPS durante o deploy). Uma entrada anterior deste registro/arquitetura afirmava **"senha rotacionada em 2026-07-28"** — evidência coletada em 2026-08-03 contradiz isso: o `.env` de dev tinha, char a char, a mesma senha descrita como exposta desde 2026-07-10. Ou a rotação de 2026-07-28 nunca foi aplicada de fato no painel, ou foi revertida sem registro. **Tratar essa entrada de 2026-07-28 como não confiável** até confirmação manual em Supabase → Settings → Database (data do último reset de senha). Perguntado explicitamente em 2026-08-03 se queria rotacionar antes de ir ao ar, o usuário optou por **manter a senha atual por ora** — decisão registrada, não pendência esquecida. **Nova reincidência (2026-08-03, sessão de commit/push):** a mesma senha real apareceu também em texto puro dentro de `academia-sandro/.claude/settings.local.json` — não no `.env`, mas num padrão de permissão salvo (comando Bash autorizado contendo a `DATABASE_URL` completa) de uma sessão de debug anterior. Excluída do commit `74e7f11` por conta própria (regra de "nunca commitar segredo" prevalece sobre resposta literal a uma pergunta genérica sobre o que incluir). **Reforça, não substitui, a recomendação de rotação** — a senha real continua viva em pelo menos 2 arquivos locais fora do git.
- **Bug de senha com colchetes (2026-07-11):** a senha salva no `.env` incluía os colchetes `[` `]` do placeholder que a Supabase exibe na tela de connection string (`postgres.[ref]:[YOUR-PASSWORD]@...`) como se fossem parte da senha real. Isso causava falha de autenticação (`P1000` via WSL) e, no Windows, um erro de conexão genérico (`P1001`) — o retry/timeout mascarava o erro real de autenticação. Corrigido removendo os colchetes.
- **Cadastro público (`/matricule-se`):** sem autenticação por design — qualquer pessoa pode enviar um `PreCadastro`. Mitigação de spam/abuso: nenhuma (sem rate limit, sem captcha) — aceitável no MVP porque nada vira `Aluno` de verdade sem aprovação manual do Sandro.
- **Autocadastro de aluno ativo (`/cadastro-aluno`, 2026-07-31; multi-modalidade 2026-08-03):** também sem autenticação por design, mesmo padrão de `/matricule-se`, mas **cria `Aluno` de verdade direto** (sem fila de aprovação) e já gera `Usuario`/acesso ao portal no mesmo fluxo — decisão validada com o usuário (link é pra quem já treina, não pra prospecção). Mesma ausência de rate limit/captcha do `/matricule-se`; risco maior porque cria registro real, não só um `PreCadastro` — mitigado só pelo fato do link não ser divulgado publicamente (fica visível pro admin em `/alunos`, pra ele compartilhar manualmente com os alunos certos). Desde 2026-08-03, o formulário aceita múltiplas modalidades (a primeira vira `Aluno.modalidade`/`graduacaoFaixa`, as seguintes viram `Matricula` real + cobrança + `AlunoFaixaModalidade`), tudo dentro de um único `prisma.$transaction` — falha em qualquer modalidade extra (ex: horário lotado) desfaz o cadastro inteiro, não deixa `Aluno` órfão pela metade.
- **"1 login por família" (2026-07-31) não é uma mudança no modelo de autenticação:** continua sendo 1:1 entre `Usuario` e `Aluno` (`Usuario.alunoId` `@unique`, sem alteração de schema nessa relação). O que muda é só que, quando o aluno logado é titular de um `PacoteMembro` do tipo `FAMILIA`, a página `/aluno/financeiro` consulta e exibe os dados de **outros** `Aluno` (os demais integrantes do mesmo `Pacote`) além do próprio — e `anexarComprovante` (`src/app/aluno/actions.ts`) autoriza a ação também pra `TransacaoFinanceira` desses outros alunos, não só pra `alunoId` da sessão. Nenhum dependente ganha `Usuario` próprio automaticamente — é uma convenção reforçada na UI (aviso em `/alunos/[id]/editar`), não uma restrição de banco.
- **Comprovantes de pagamento:** não há validação de autenticidade (é uma imagem/PDF enviado pelo aluno, confirmado manualmente pelo Sandro) — decisão deliberada de não construir verificação automática, já que isso exigiria um gateway de pagamento real (fora de escopo). Arquivos expiram e são apagados do disco 10 dias após o envio (2026-07-29, `limparComprovantesExpirados`), reduzindo a superfície de dados sensíveis retidos, mas sem cron real configurado — a limpeza só roda quando `/matriculas` ou `/transacoes` são abertas.

---

## 6. Estratégia de escala

**Estado atual (2026-08-03): sistema em produção.** `https://sandrofreiresf.online` no ar desde hoje, num VPS Hostinger **compartilhado** com outros dois sistemas do usuário (VillaMill, Sistema Thieco) — ver seção 9 para a arquitetura de infra completa. Tráfego real ainda não começou (link de autocadastro só foi compartilhado internamente até aqui), mas o sistema já está publicamente acessível.

**O que ainda exige atenção:**
- Revisão de `sslmode=no-verify` → `verify-full` com CA correta do pooler (conexão app↔Supabase — não confundir com o TLS browser↔app, que já é via Let's Encrypt/Certbot desde o deploy)
- Rate limit/captcha em `/matricule-se` se o link público começar a receber tráfego real (hoje sem proteção contra spam)
- Armazenamento de comprovantes (`public/comprovantes/`) — resolvido para o deploy atual via volume Docker nomeado (sobrevive a rebuild/redeploy do container), mas ainda é filesystem local de um único VPS, não um object storage; revisitar (S3, Supabase Storage) se algum dia precisar de múltiplas réplicas/instâncias
- Configurar cron real pra `/api/cron/limpar-comprovantes` (hoje só roda de forma reativa, quando `/matriculas`/`/transacoes` são abertas)
- **Rotação da senha do Supabase** — ver nota na seção 5; estado real é incerto/pendente apesar de um registro anterior (2026-07-28) afirmar o contrário

**Concluído desde a última revisão:**
- ~~Checagem de `role` em rotas~~ — implementada em 2026-07-28
- ~~Decisão de hospedagem~~ — VPS Hostinger + Docker + nginx compartilhado (2026-08-03, ver seção 9)
- ~~Deploy em produção~~ — feito em 2026-08-03, domínio + HTTPS via Certbot
- ~~Apagar alunos/transações/despesas fictícios de demonstração~~ — feito em 2026-08-03 (backlog item 12)

---

## 9. Infraestrutura de produção (2026-08-03)

```
[Internet]
     ↓ HTTPS (Let's Encrypt via Certbot)
[nginx — no HOST do VPS, não containerizado]  ← compartilhado com VillaMill e Sistema Thieco
     ↓ proxy_pass http://127.0.0.1:3010
[Container Docker "academia-sandro-app-1"]  ← só escuta em 127.0.0.1, nunca exposto direto
     ↓ PrismaPg adapter
[PostgreSQL — Supabase]  ← mesmo banco usado em desenvolvimento
```

**VPS Hostinger (IP `2.24.93.178`) é compartilhada com outros sistemas do usuário** — não é dedicada ao academia-sandro. Isso é a decisão de infraestrutura mais importante desta seção, porque muda a forma de deploy: **não existe reverse-proxy próprio** (nada de Caddy/Traefik em container bindando 80/443) — um nginx já instalado direto no host faz esse papel pra todos os sistemas, cada um recebendo um `server{}` block próprio em `/etc/nginx/sites-available/`. Um plano inicial de deploy com Caddy container foi montado e testado localmente antes dessa informação aparecer; descartado a tempo (nenhum outro site chegou a cair) — ver [[registro-de-decisoes-academiasandro]] (2026-08-03).

**Portas já em uso nessa VPS** (checar antes de publicar um serviço novo, `docker ps --format 'table {{.Names}}\t{{.Ports}}'`): `3000` (VillaMill), `3010` (academia-sandro), `5000`/`5003` (Cortex/Quasar), `5173` (Thieco frontend), `5432`/`5433`/`5436` (Postgres de cada sistema), `8081` (Evolution API).

**Docker Compose deste projeto** (`academia-sandro/docker-compose.yml`):
- `app` — imagem `runner` (multi-stage, Next.js `output: standalone`), publicada só em `127.0.0.1:3010`, volume nomeado `comprovantes` (`/app/public/comprovantes`, sobrevive a rebuild)
- `migrate` / `seed` — serviços one-off (não sobem com `docker compose up`), usam o stage `builder` (tem o Prisma CLI e o `tsx` completos, que o `runner` não carrega) — rodam com `docker compose run --rm migrate`/`seed`
- **`orbita_shared` (2026-08-03)** — `app` ganhou essa rede Docker externa (além da `default`), pra alcançar o container `evolution_api` (WhatsApp real, ver seção 4) pelo nome — mesmo padrão já usado por `orbita-cortex`/`lane-confeitaria`/`sistema-thieco` nessa mesma VPS. **Pareado e validado ao vivo em 2026-08-03** (mesmo dia) — rede criada, `EVOLUTION_API_KEY` preenchida, QR code escaneado, os dois avisos automáticos confirmados chegando de verdade no WhatsApp real do CT (não só HTTP 200/`enviado: true`)

**Deploy (rotina, quando o código muda):**
```bash
# do computador local, sincroniza o código (exclui node_modules/.next/.git)
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  "academia-sandro/" root@2.24.93.178:/opt/academia-sandro/

# no VPS
cd /opt/academia-sandro
docker compose build app
docker compose run --rm migrate   # só se prisma/schema.prisma mudou
docker compose up -d app
```
Ver Playbook DevOps (seção "Academia Prof. Sandro") pro passo a passo completo, incluindo configuração inicial do nginx/Certbot.

**Removido desta VPS durante o mesmo deploy:** o sistema `orbita-lobo` (domínio `depositolobo.online`) — não usado mais, containers/network/imagens/site-nginx/certificado apagados a pedido do usuário. Detalhes em [[registro-de-decisoes-academiasandro]].

---

## 8. Controle de versão

**Repositório:** `academia-sandro/` vive como subpasta dentro do monorepo `Kernel Workspace`, versionado no GitHub em `github.com/willianslegacy94-zion/zion-workspace` — **repositório público**, confirmado via `gh repo view`. Primeiro commit (`5e1361b`) feito em 2026-07-12; nenhum commit anterior existia (o projeto inteiro tinha vivido só como pasta não rastreada até então).

**Lacuna descoberta em 2026-08-03:** meses de trabalho entre 2026-07-12 e a sessão de hoje **nunca foram commitados** — `/cadastro-aluno` inteiro, `src/lib/matricula.ts`, `src/lib/acesso-portal.ts`, `Dockerfile`, `docker-compose.yml`, `DEPLOY.md`, 3 migrations, os logos — tudo já rodando em produção, mas ausente do histórico git (`git status` mostrava dezenas de arquivos `??`). Fechado no commit `74e7f11` (escopado só a `academia-sandro/`, excluindo 4 imagens soltas na raiz sem relação com o app). **Regra de governança confirmada nesta sessão:** `git push` neste workspace é reservado ao agente `aiox-devops` (não feito diretamente por outro agente/sessão) — o agente valida escopo do commit (`git diff-tree`, nenhum arquivo fora do projeto, nenhum segredo nas linhas adicionadas) antes de publicar, e sabe lidar com a árvore cronicamente suja do monorepo (worktree isolado ou "plumbing-rebase" quando `origin/main` diverge — ver Playbook DevOps, seção do monorepo, e a memória própria do agente em `.claude/agent-memory/aiox-devops/` dentro deste projeto, não commitada de propósito).

**⚠️ Risco operacional do monorepo:** `Kernel Workspace` hospeda vários projetos independentes do usuário (academia-sandro, sistema-thieco, orbita-lobo, etc.). Pelo menos um deles (`orbita-lobo`) é na verdade **um repositório git próprio aninhado** (com remoto separado no GitHub), vivendo como subpasta sem isolamento (sem gitlink/submodule, sem exclusão no `.gitignore` do monorepo). Uma tentativa de `git merge`/`git pull` direto na raiz do `Kernel Workspace` **apagou 31 arquivos do disco** dentro de `orbita-lobo/` (recuperados via `git restore` no repo interno — sem perda real, mas o risco é real). **Regra a seguir a partir de agora:** qualquer operação de merge/checkout na raiz do `Kernel Workspace` deve ser feita num `git worktree` isolado (não na pasta principal), ou limitada por pathspec (`git commit -- academia-sandro/`), nunca com `git merge`/`git pull` direto na raiz sem antes checar se há subpastas com `.git` próprio. Detalhes completos em [[registro-de-decisoes-academiasandro]].

---

## 7. Camadas do sistema (atualização pós-autenticação e sidebar)

```
[Browser]
     ↓  ↑  (Server Actions via <form action={...}> ou chamada direta em client component)
[src/proxy.ts]  ← protege "/", /alunos, /transacoes, /despesas, /pre-cadastros, /agenda, /matriculas, /configuracoes, /aluno
     ↓
[src/auth.ts — authorized()]  ← 2026-07-28: checa role (ADMIN_PATHS vs. ALUNO_PATHS), não só "existe sessão?"
     ↓
[Next.js 16 App Router]
   ├── route group (app)/         ← rotas ADMIN, shell com sidebar (AppShell.tsx, client component)
   │     ├── page.tsx (dashboard)  ← + cards "Novas matrículas"/"Pré-cadastros" (2026-07-29)
   │     ├── alunos/               ← só listagem + abas de filtro (2026-07-29); alunos/novo/ = formulário de cadastro (rota própria)
   │     ├── transacoes/, despesas/, pre-cadastros/
   │     ├── agenda/               ← (2026-07-30: virou só visualização) grade semanal (AgendaGrid) + roster por horário + link pra gestão em Configurações → Agenda
   │     ├── matriculas/           ← "Novas Matrículas" (2026-07-29): fila de confirmação de pagamento
   │     ├── configuracoes/        ← perfil do admin (nome/e-mail/telefone/**pix**) + aba "Agenda" (2026-07-30: preços, almoço, bloqueios, gerenciar horários — migrado de `/agenda`) + aba "Preços" (2026-07-31: preço por modalidade, pacotes, override individual — `precos-actions.ts` separado de `actions.ts`), via `?aba=perfil|agenda|precos`
   │     ├── actions.ts            ← marcarAlertasComoLidos (2026-07-29)
   │     └── layout.tsx            ← calcula alertas (src/lib/alertas.ts) e passa pro AppShell
   ├── aluno/                     ← Área do Aluno (self-service), shell próprio (AlunoShell.tsx)
   │     ├── layout.tsx           ← busca sessão + Aluno vinculado (session.user.alunoId), redireciona se ausente
   │     ├── page.tsx             ← Agenda pessoal (getMeusHorarios — só horários confirmados, 2026-07-29)
   │     ├── matricula/page.tsx   ← (2026-07-29) matrícula em modalidade extra, modal de pagamento
   │     ├── financeiro/page.tsx  ← (reescrita 2026-07-29; 2026-07-31: multi-perfil) parcelas de 12 meses + outras cobranças (com badge "Pagamento confirmado") + valor de mensalidade calculado (`valorEfetivoAluno`) — titular de pacote família vê a lista de todos os integrantes, não só a própria
   │     └── actions.ts           ← anexarComprovante (por transação, 2026-07-29; 2026-07-31: aceita `alunoId` de qualquer integrante acessível pela sessão, não só o próprio), matricularEmAula, cancelarMatricula
   ├── cadastro-aluno/             ← (2026-07-31) pública, fora dos route groups — autocadastro de aluno **ativo** (cria `Aluno` direto + acesso ao portal no mesmo fluxo), distinta de `matricule-se/` (fila de pré-cadastro pra quem ainda não é aluno)
   ├── login/, esqueci-senha/, resetar-senha/, matricule-se/   ← públicas, fora dos route groups (matricule-se com escolha de modalidade desde 2026-07-29)
   ├── api/auth/[...nextauth]/    ← NextAuth (login/logout)
   ├── api/auth/{esqueci-senha,resetar-senha}/  ← Route Handlers custom
   └── api/cron/limpar-comprovantes/  ← (2026-07-29) rota pronta pra cron externo, chama a mesma limpeza reativa
     ↓  ↑  (PrismaPg adapter, pool "pg")
[PostgreSQL — Supabase (Supavisor pooler)]
```

`AppShell.tsx`, `AlunoShell.tsx`, `NotificacaoSino.tsx`, `MatricularAcaoCelula.tsx` (2026-07-29), `CriarPacoteForm.tsx` e `CopiarLink.tsx` (2026-07-31) são os client components do projeto — os dois primeiros por `usePathname`/`useState` de drawer, os do meio por `useState`/`useTransition` (modal/formulário dinâmico + chamada direta de Server Action sem `<form>` tradicional), o último por `navigator.clipboard`. Todo o resto continua Server Components + Server Actions.

**`src/lib/acesso-portal.ts` (2026-07-31):** `gerarUsernameUnico`/`criarUsuarioAluno` — extraídos de `src/app/(app)/alunos/actions.ts` (onde eram funções privadas) pra um módulo compartilhado sem `"use server"`, já que passaram a ser usados por dois fluxos diferentes: o cadastro manual pelo admin (`criarAcessoAluno`/`createAluno`) e o autocadastro público (`cadastro-aluno/actions.ts`). `criarUsuarioAluno` passou a receber `origin` como parâmetro explícito em vez de calcular via `headers()` internamente, pra funcionar igual nos dois call sites.

**Camada de dados compartilhada (2026-07-23, reescrita 2026-07-29):** `src/lib/agenda.ts` (`getAgendaGrade`) consulta `AgendaAula` + roster real (alunos da modalidade principal via `Aluno.modalidade` + `Matricula` extra) e devolve uma estrutura já agrupada por modalidade/dia, com `vagas` calculado sobre esse roster (não mais sobre `PresencaDiaria`, que só crescia e nunca refletia capacidade real). `getMeusHorarios(alunoId)` filtra em cima disso pra Área do Aluno: linha inteira da modalidade principal + só as células de modalidades extras já confirmadas. `getAgendaParaMatricula(alunoId)` gera a visão inversa (outras modalidades, pra `/aluno/matricula`). `src/lib/alertas.ts` (`getAlertas`) e `src/lib/parcelas.ts` (`getParcelas`) seguem o mesmo padrão de módulo de leitura consolidada, sem camada de API intermediária.

**Gestão de agenda (2026-07-30):** `src/lib/configuracao-agenda.ts` (`getConfiguracaoAgenda`, `salvarAlmoco`, `caiNoAlmoco`) — linha singleton (`ConfiguracaoAgenda`, `id` fixo `"singleton"`) com o horário de almoço único pra toda a academia, valida contra criação de `AgendaAula` dentro dele. `src/lib/bloqueios-agenda.ts` (`getBloqueiosFuturos`, `getBloqueiosProximos`) — bloqueios pontuais por data específica (`BloqueioAgenda`), sem recorrência semanal; `getBloqueiosProximos(14)` alimenta o banner de aviso em `/aluno`. Todas as Server Actions de gestão de agenda (`criarAula`, `atualizarCapacidadeAula`, `excluirAula`, `salvarConfiguracaoAgenda`, `criarBloqueio`, `excluirBloqueio`) vivem em `src/app/(app)/configuracoes/actions.ts` (migradas de `agenda/actions.ts`, que foi apagado) e revalidam `/configuracoes`, `/agenda`, `/aluno` e `/aluno/matricula` juntos — mudança feita pelo admin aparece pro aluno na hora, sem cache client-side envolvido (Server Components buscam direto do Prisma a cada request).

**Gestão de preços e pacotes (2026-07-31):** `salvarPrecosModalidade` migrou de `configuracoes/actions.ts` pra um arquivo próprio, `src/app/(app)/configuracoes/precos-actions.ts`, junto com as Server Actions novas (`atualizarMensalidadeAluno`, `criarPacote`, `atualizarDescontoMembro`, `definirTitular`, `removerMembroPacote`, `excluirPacote`) — separação por responsabilidade dentro da mesma rota (`/configuracoes`), já que o arquivo original já estava grande. `src/lib/precos.ts` concentra a regra de cálculo (`valorEfetivoAluno`, `somaExtrasAluno`) e as consultas de leitura consolidada (`getAlunosComPrecos`, `getPacotes`), mesmo padrão de "módulo de leitura sem camada de API" já usado por `agenda.ts`/`alertas.ts`/`parcelas.ts`. **Vínculo aluno↔pacote é bidirecional na UI:** dá pra gerenciar pela aba Preços (visão de todos os pacotes) ou direto no formulário de cadastro/edição do aluno (`pacoteId`/`descontoPercentual`) — ambos os caminhos convergem pro mesmo `PacoteMembro.upsert` (`sincronizarPacoteAluno`, em `alunos/actions.ts`).

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-07-10 | Schema inicial — `Aluno` e `TransacaoFinanceira`, tema visual em `globals.css`, `.env` corrigido (senha exposta em texto puro) |
| v0.2 | 2026-07-10/11 | Troubleshooting de conexão `P1001` — causa raiz: Prisma 7 valida cadeia de certificado TLS por completo com `sslmode=require`; fix aplicado com `sslmode=no-verify` |
| v0.3 | 2026-07-11 | Migração `init_aluno_transacao` aplicada no Supabase; scripts de diagnóstico (`test-pg*.js`) removidos |
| v0.4 | 2026-07-11 | Segundo bug de conexão resolvido — senha com colchetes do placeholder da Supabase incluída por engano no `.env` |
| v0.5 | 2026-07-11 | Telas `/alunos` e `/transacoes` implementadas (Server Components + Server Actions); `@prisma/client` + `@prisma/adapter-pg` + `pg` instalados — Prisma 7 (gerador `prisma-client`) exige driver adapter explícito, não lê `DATABASE_URL` sozinho como versões anteriores |
| v0.6 | 2026-07-11 | Edição de Aluno/Transação implementada (páginas dedicadas, não modal) |
| v0.7 | 2026-07-12 | Autenticação completa (NextAuth v5, login por username, recuperação por token) + fix de fonte (Geist) + layout com sidebar (`AppShell.tsx`, route group `(app)`) + tela de login, adaptados do `sistema-thieco` |
| v0.8 | 2026-07-12 | Módulo financeiro completo: `Despesa` e `PreCadastro` (novos models), `Aluno.dataVencimento` com ciclo de 30 dias, cobrança via WhatsApp (`wa.me`), sino de notificação, dashboard (`/`) com saldo/ranking/faixa etária, cadastro público `/matricule-se` |
| v0.9 | 2026-07-12 | Dados fictícios de demonstração (18 alunos + 50 transações + 15 despesas); bug de saldo corrigido (despesas futuras de recorrência não contam mais no saldo de hoje) |
| v1.0 | 2026-07-12 | Polimento visual (Playfair Display, `PageHeader`, favicon de faixa, ícones temáticos); primeiro commit + push pro GitHub (`zion-workspace`, público) — incidente com `orbita-lobo` (repo aninhado) durante o merge, contido via worktree isolado |
| v1.1 | 2026-07-22 | Redesign da tela de login (logos das 3 modalidades em formação triangular, remoção de fundo via script próprio, título "Centro de Treinamento Sandro Ferreira" em `font-serif`) |
| v1.2 | 2026-07-22 | Schema expandido: `Role` (ADMIN/ALUNO) em `Usuario`, `AgendaAula`, `PresencaDiaria`, campos de comprovante em `TransacaoFinanceira` — migração `20260722012129_expansao_agenda_role` |
| v1.3 | 2026-07-23 | `Usuario.alunoId` (FK 1:1 opcional pra `Aluno`) — migração `20260723002845_usuario_aluno_link`; decisão tomada via pergunta ao usuário (FK explícita em vez de casar por e-mail) |
| v1.4 | 2026-07-23 | Área do Aluno construída (`/aluno`): sidebar própria (`AlunoShell.tsx`), tela de Agenda + Financeiro (upload de comprovante), `PIX_KEY_CT` (env var vazia, aguardando valor real) |
| v1.5 | 2026-07-23 | Agenda compartilhada (`src/lib/agenda.ts` + `AgendaGrid.tsx`) reaproveitada no admin (`/agenda`, habilitado) e no aluno; 63 `AgendaAula` reais seedadas no Supabase a partir da grade ditada pelo usuário; bug de responsividade mobile corrigido (`min-w-0` em flex containers) |
| v1.6 | 2026-07-28 | Senha do Supabase rotacionada; gap de autorização por `role` corrigido (`authorized` em `src/auth.ts` passou a checar ADMIN_PATHS vs. ALUNO_PATHS, com match por segmento exato) |
| v1.7 | 2026-07-29 | Grade real reseedada a partir do quadro físico da academia (63 `AgendaAula` antigas removidas, 80 novas); modalidades unificadas (`Musculação/Personal`, `Capoeira`, `Boxe/Muay Thai`, `Kids`, `Aula para Idosos`); `Aluno.agendaAulaReferenciaId` (só exibição); `PreCadastro.modalidadeInteresse` |
| v1.8 | 2026-07-29 | Matrícula em modalidade extra: `model Matricula`, `model ModalidadePreco`, modal de pagamento (`MatricularAcaoCelula.tsx`), roster real substituindo contagem por `PresencaDiaria` em `getAgendaGrade` |
| v1.9 | 2026-07-29 | Fluxo financeiro: `/aluno/financeiro` reescrita (lista de cobranças reais, upload por transação), confirmação manual de pagamento (`confirmadoEm`, `Aluno.statusPagamento` atualizado), parcelas de 12 meses (`getParcelas`), expiração de comprovante em 10 dias (`limparComprovantesExpirados`, rota `/api/cron`), `statusPagamentoEfetivo` (status derivado da data, não mais o campo manual isolado) |
| v2.0 | 2026-07-29 | `/matriculas` (Novas Matrículas, admin), filtros em `/alunos` (vencido/aguardando confirmação), `/alunos/novo` (formulário separado da listagem), criação automática de acesso do aluno no cadastro (`createAluno` com e-mail) |
| v2.1 | 2026-07-29 | Sino de notificações reescrito: `Usuario.alertasLidosEm`, `session.user.id` exposto, `src/lib/alertas.ts` (4 categorias com gatilho próprio por categoria), botão "Marcar como lida", cards de contagem no dashboard |
| v2.2 | 2026-07-29 | Rebrand "Academia" → "Centro de Treinamento" em toda a UI restante (título da aba, sidebar, mensagens de WhatsApp, e-mail); `/matricule-se` alinhada ao mesmo padrão visual do `/login`; botão de pré-cadastro fixo no canto superior direito; domínio de produção registrado (`sandrofreiresf.online`) |
| v2.3 | 2026-07-30 | Contas fixas de suporte `devaluno`/`devmaster` (senha `dev1807194`, protegidas contra exclusão, garantidas pelo seed); `Usuario.telefone` (novo campo); tela `/configuracoes` (admin edita nome/e-mail/telefone); bug corrigido — `/configuracoes` ficou acessível sem login até o `matcher` de `src/proxy.ts` ser sincronizado com `ADMIN_PATHS` de `src/auth.ts` |
| v2.4 | 2026-07-30 | Gestão de horários/aulas em `/agenda` (CRUD de `AgendaAula`, antes só via script de seed); `ConfiguracaoAgenda` (singleton, horário de almoço único pra toda a academia, bloqueia criação de horário dentro dele); `BloqueioAgenda` (bloqueio pontual por data específica, com motivo — banner de aviso em `/aluno` pros próximos 14 dias) |
| v2.5 | 2026-07-30 | Gestão de agenda migrada de `/agenda` pra `/configuracoes` (aba "Agenda", `?aba=perfil\|agenda`) — `/agenda` vira só visualização; `Usuario.pix` (novo campo, editável na aba Perfil) substitui a env var `PIX_KEY_CT` na chave PIX mostrada em `/aluno/financeiro`, buscada pelo `username` de `ADMIN_USERNAME` (evita pegar o PIX de `devmaster` por engano, já que agora existem duas contas `ADMIN`) |
| v2.6 | 2026-07-31 | Correção de marca "Sandro Ferreira" → "Sandro Freire" em toda a UI; `Aluno.mensalidadeValor` (override individual de mensalidade); `Pacote`/`PacoteMembro` (`FAMILIA`/`COMBO_MODALIDADES`, desconto por integrante, "1 login por família"); aba "Preços" em `/configuracoes`; vencimento (`dataVencimento`) editável direto no formulário do aluno; badge "Pagamento confirmado" em `/aluno/financeiro`; `/cadastro-aluno` (autocadastro público de aluno ativo, com acesso ao portal liberado no mesmo fluxo) |
| v2.7 | 2026-08-03 | **Deploy em produção** — VPS Hostinger (Docker) + nginx do host (compartilhado com VillaMill/Thieco) + Certbot, `https://sandrofreiresf.online` no ar; `next.config.ts` (`output: standalone`), `Dockerfile`, `docker-compose.yml` (`app`/`migrate`/`seed`); removido do plano inicial um Caddy container próprio, ao se descobrir que a VPS é compartilhada; `orbita-lobo` removido da mesma VPS (não usado mais) |
| v2.8 | 2026-08-03 | Limpeza de dados de teste/demonstração direto na produção (mesmo banco do dev): 19 `Aluno` fictícios/teste + 55 `TransacaoFinanceira` + 15 `Despesa` + 1 `Matricula` apagados; `Aluno` fixo "Aluno Teste (Dev)" também removido a pedido (login `devaluno` mantido, sem `alunoId`) |
| v2.9 | 2026-08-03 | `AlunoFaixaModalidade` (novo model) — faixa/graduação por modalidade extra; `/cadastro-aluno` aceita múltiplas modalidades+horário+faixa num só cadastro (`SeletorModalidadesMultiplas.tsx`, novo); `src/lib/matricula.ts` extraído (lógica de matrícula reaproveitável dentro de transação) |
| v3.0 | 2026-08-03 | 12 melhorias encadeadas: WhatsApp real via Evolution API (`src/lib/whatsapp-gateway.ts`, aba Configurações → WhatsApp, bloqueio de agenda avisa aluno, aula experimental avisa admin); financeiro por modalidade (`getParcelasCiclo`, ciclo de 12 parcelas por modalidade extra, `Matricula.dataVencimentoBase`); pacotes Combo em catálogo (`Pacote.descontoPadrao`, sem `PacoteMembro` até ser escolhido) + Família isolado; ficha completa do pré-cadastro (`/pre-cadastros/[id]`); horário sempre obrigatório; badges de modalidade extra em `/alunos`; termo LGPD (`PreCadastro.termosAceitos`); horário de almoço com default seguro; `TransacaoFinanceira.matriculaId` deixou de ser `@unique`. Corrigidos no mesmo ciclo: bug de timezone em datas-only exibidas sem `timeZone: "UTC"`, e bug pré-existente em `valorEfetivoAluno` que não somava extras no total pra aluno sem pacote |
| v3.1 | 2026-08-03 | Commit `74e7f11` fecha lacuna de meses de trabalho nunca commitado (`/cadastro-aluno`, `Dockerfile`, `docker-compose.yml`, `DEPLOY.md`, migrations antigas — tudo já em produção, fora do git). Achado durante o processo: senha real do Postgres exposta em texto puro em `.claude/settings.local.json` (excluída do commit). Push feito via agente `aiox-devops` (governança do workspace reserva `git push` a esse agente), fast-forward puro sem divergência |
| v3.2 | 2026-08-03 | WhatsApp pareado na VPS (rede `orbita_shared` + `EVOLUTION_API_KEY` + QR code) e **validado ao vivo** — primeira feature de WhatsApp deste projeto confirmada com mensagem realmente recebida, não só HTTP 200. Bug real achado: aviso de aula experimental falhava em silêncio com `Usuario.telefone` do admin vazio (sem log, diferente do aviso de bloqueio, que já loga falha). `whatsapp-gateway.ts` ganhou `buscarNumeroConectado()`; nova action `sincronizarTelefonePerfilAction`; `WhatsappConexao.tsx` oferece botão de 1 clique pra copiar o número pareado pro campo Telefone do Perfil — textos explicativos adicionados nas duas telas esclarecendo que são conceitos diferentes (quem envia vs. pra onde chega). Commit `2b3be3a`, push via `aiox-devops` |
