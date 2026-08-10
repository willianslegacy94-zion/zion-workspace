---
status: stable
domain: academiasandro
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Academia Prof. Sandro

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém comandos, deploy e gotchas específicos do Academia Prof. Sandro (`academia-sandro`).

## Academia Prof. Sandro (academia-sandro) — o que saber pra mexer sem mim

**Desde 2026-08-03, sistema em produção** — `https://sandrofreiresf.online`, VPS Hostinger **compartilhada com VillaMill e Sistema Thieco** (mesmo IP `2.24.93.178` dos dois). Ainda **não tem repositório próprio no GitHub** — continua sendo uma subpasta dentro do repo compartilhado `orbita-workspace` (`github.com/willianslegacy94-zion/zion-workspace`, **público**). Banco é Supabase (nuvem), **mesmo banco em dev e produção** — não existe separação, cuidado ao rodar script/seed local, ele mexe no banco real.

| | Detalhe |
|---|---|
| Caminho (local) | `/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/academia-sandro` |
| Caminho (VPS) | `/opt/academia-sandro` (SSH `root@2.24.93.178`) |
| Stack | Next.js 16 (App Router) + Prisma 7 (`@prisma/adapter-pg`, sem engine nativa) + PostgreSQL (Supabase) |
| Banco | Supabase (pooler Supavisor) — mesmo banco em dev e produção (não existe separação hoje) |
| Repositório | Não tem repo próprio — vive dentro do `zion-workspace` (ver [[Playbook DevOps - Comandos Docker e Bancos]], seção Risco do monorepo) |
| Domínio público | `sandrofreiresf.online` — nginx do **host** (não container) faz o proxy + TLS, igual VillaMill/Thieco |
| Porta interna (VPS) | `127.0.0.1:3010` — container `academia-sandro-app-1`, nunca exposto direto pra internet |

### Deploy na VPS (produção)

**Diferente de VillaMill/Thieco: não existe reverse-proxy próprio (Caddy/Traefik) rodando em container** — a VPS já tem um nginx instalado direto no host, compartilhado entre os 3 sistemas, cada um com seu `server{}` block em `/etc/nginx/sites-available/`. Um plano inicial com Caddy container foi descartado a tempo (ver [[registro-de-decisoes-academiasandro]], 2026-08-03) justamente por isso — **nunca** subir um proxy próprio bindando 80/443 nessa VPS.

```bash
# do computador local (WSL, não PowerShell — rsync não existe no Windows nativo)
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/academia-sandro/" \
  root@2.24.93.178:/opt/academia-sandro/

# no VPS
ssh root@2.24.93.178
cd /opt/academia-sandro
docker compose build app
docker compose run --rm migrate   # só se prisma/schema.prisma mudou
docker compose up -d app
curl -I http://127.0.0.1:3010     # confirma que subiu antes de checar de fora
```

**⚠️ Armadilha real, cometida em 2026-08-03: rodar o `rsync` de dentro da sessão SSH da VPS, não do terminal local.** Se o prompt já mostra `root@<host-da-vps>:/opt/academia-sandro#`, o comando acima **não funciona** — o caminho de origem (`"academia-sandro/"`, relativo) é resolvido contra o cwd da própria VPS, e o destino (`root@2.24.93.178:...`) tenta uma conexão SSH da VPS pra ela mesma. Sintoma: `rsync: [sender] change_dir "/opt/academia-sandro/academia-sandro" failed: No such file or directory`. **Sempre confirmar com `hostname` antes de rodar o rsync** — se aparecer o nome da VPS, dar `exit` primeiro pra voltar pro terminal local.

**Não existe `git pull` neste projeto — nem clone git na VPS.** `/opt/academia-sandro` é só uma cópia de arquivos sincronizada via `rsync`, sem `.git` próprio. O `git push` pro GitHub (ver [[Playbook DevOps - Comandos Docker e Bancos]], seção Risco do monorepo) é só backup/histórico do código — não alimenta o deploy sozinho, precisa sempre do `rsync` acima.

**`docker-compose.yml` tem 3 serviços:** `app` (roda sempre, publicado só em `127.0.0.1:3010`), `migrate` e `seed` (one-off, não sobem com `docker compose up` — só rodam via `docker compose run --rm <nome>`, usam o stage `builder` da imagem porque o `runner` não carrega o Prisma CLI nem o `tsx`).

**Primeiro deploy (só uma vez, já feito em 2026-08-03) precisou também configurar o nginx do host:**
```bash
# /etc/nginx/sites-available/academia-sandro
server {
    server_name sandrofreiresf.online www.sandrofreiresf.online;
    client_max_body_size 20m;   # comprovante enviado por foto de celular passa fácil de 1MB (default do nginx)
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    listen 80;
    listen [::]:80;
}
```
```bash
ln -s /etc/nginx/sites-available/academia-sandro /etc/nginx/sites-enabled/academia-sandro
nginx -t && systemctl reload nginx
certbot --nginx -d sandrofreiresf.online -d www.sandrofreiresf.online   # emite o certificado e já reescreve o arquivo com o bloco HTTPS + redirect
```
Só precisa repetir isso se o site do nginx for perdido/recriado do zero — deploys normais de código são só o bloco `rsync` + `docker compose` acima.

**Migrations rodando local batem direto no banco de produção** (mesmo Supabase) — não precisa reaplicar migration na VPS depois de rodar `npx prisma migrate dev` localmente, ela já está no banco assim que roda local. O `docker compose run --rm migrate` na VPS normalmente só confirma "No pending migrations to apply" — o passo que realmente importa depois de mudar o schema é regenerar a imagem (`docker compose build app`) pra ela carregar o Prisma Client novo, não a migration em si.

**Se o sistema travar em produção:**
1. SSH na VPS → `docker compose ps` — `academia-sandro-app-1` está "Up"? Se não, `docker compose up -d app`.
2. `docker compose logs --tail 100 app` — erro geralmente nas últimas linhas.
3. Confirmar de fora: `https://sandrofreiresf.online/login` (não `2.24.93.178:3010` direto — porta fechada pro público, só o nginx do host fala com o container).
4. Erro 502 do nginx com container "Up" normalmente é o nginx apontando pra porta errada ou container não escutando ainda — `curl -I http://127.0.0.1:3010` direto no VPS isola se o problema é o container ou o nginx.

### Rodar local

```bash
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/academia-sandro"
npm run dev              # sobe em localhost:3000
```

Login: usuário `sandro` (senha é a que foi definida por último via `/resetar-senha` — não tem valor fixo documentável aqui, ela é trocada pelo próprio usuário do sistema). Se esquecer, gerar link de reset direto por API (não precisa abrir a tela):
```bash
curl -X POST http://localhost:3000/api/auth/esqueci-senha \
  -H "Content-Type: application/json" \
  -d '{"email":"sandro@academiaprofsandro.com.br"}'
# retorna { "link": "http://localhost:3000/resetar-senha?token=..." } — abre esse link no navegador e define a senha nova
```

Recriar o usuário do zero (perdeu acesso e não tem e-mail configurado, ou é um ambiente novo):
```bash
npm run db:seed          # cria/atualiza o usuário sandro (username/e-mail do .env, senha padrão fixa "academia2026") + garante as contas fixas abaixo
```

### Contas fixas de suporte — `devaluno` / `devmaster` (2026-07-30)

Pra testar ou dar suporte **sem depender da senha pessoal do Sandro** (inclusive em produção, quando existir deploy): duas contas fixas, com senha sempre igual, que sobrevivem a qualquer `npm run db:seed` (mesmo banco recriado do zero):

| Usuário | Senha | Role | Pra que serve |
|---|---|---|---|
| `devaluno` | `dev1807194` | ALUNO | logar como aluno (portal `/aluno`) — vinculado ao cadastro "Aluno Teste (Dev)" |
| `devmaster` | `dev1807194` | ADMIN | logar como admin, acesso total (`/alunos`, `/transacoes`, etc.) |

Protegidas contra exclusão acidental pela UI — `deleteAluno`/`revogarAcessoAluno` (`src/app/(app)/alunos/actions.ts`) bloqueiam com erro se o alvo for uma dessas contas (checagem em `src/lib/contas-fixas.ts`). Se algum dia precisar trocar a senha fixa, é só mudar a constante `SENHA_DEV` em `prisma/seed.ts` (função `garantirContasFixas`) e rodar `npm run db:seed` de novo — atualiza o hash sem duplicar a conta.

### Editar perfil do admin (nome/e-mail/telefone/PIX)

Desde 2026-07-30, não precisa mais mexer no banco pra isso — tela própria em `/configuracoes?aba=perfil` (menu lateral, "Configurações", aba "Perfil" — default), acessível logado como `sandro` ou `devmaster`. Salva em `Usuario.nome`/`email`/`telefone`/`pix`.

A chave PIX cadastrada ali é a que aparece pro aluno em `/aluno/financeiro` (substituiu a antiga env var `PIX_KEY_CT`, que morreu — não precisa mais mexer no `.env` nem redeployar pra trocar o PIX). **Atenção:** o aluno sempre vê o PIX da conta com `username` igual ao `ADMIN_USERNAME` do `.env` (ou seja, `sandro`) — se cadastrar um PIX na conta `devmaster`, ele não aparece pro aluno, é só pra teste isolado.

### Gerenciar horários/aulas, horário de almoço e bloqueios pontuais (2026-07-30)

Tudo isso mudou de lugar na mesma sessão em que foi criado — vive em `/configuracoes?aba=agenda` (aba "Agenda"), não mais em `/agenda` (que virou só a grade de visualização, com um link pra Configurações → Agenda no topo):

- **Horários/aulas:** form pra criar `AgendaAula` (modalidade/dia/hora/capacidade) + tabela com capacidade editável e exclusão por linha. Criar rejeita horário dentro do almoço configurado; excluir é bloqueado se o horário tiver matrícula/presença vinculada (erro amigável, não estoura genérico).
- **Horário de almoço:** único pra toda a academia (não por modalidade/dia) — dois campos de hora, salva em `ConfiguracaoAgenda` (linha singleton).
- **Bloqueios pontuais:** avisa o aluno que não vai ter aula num dia específico (data + período + motivo opcional) — **não cancela matrícula automaticamente**, o sistema não tem conceito de "aula do dia X" (só grade semanal recorrente), então isso não existe pra nenhuma aula. Aparece como banner em `/aluno` pros próximos 14 dias.

Todas essas ações revalidam `/aluno` e `/aluno/matricula` além de `/agenda`/`/configuracoes` — qualquer mudança aparece pro aluno na próxima vez que ele abrir a tela, sem precisar reiniciar nada.

### Gestão de Preços e Pacotes (2026-07-31)

Terceira aba de `/configuracoes` (`?aba=precos`, ao lado de Perfil/Agenda), acessível logado como `sandro` ou `devmaster`:

- **Preço por modalidade:** mesmo bloco que já existia (movido da aba Agenda pra cá).
- **Override individual de mensalidade:** tabela com todos os alunos, campo de valor por linha — serve pra caso de 2 alunos da mesma modalidade pagando valores diferentes (ex: por frequência semanal). Campo vazio volta a usar o preço da modalidade.
- **Pacotes:** admin cria um `Pacote` de tipo `FAMILIA` (vários alunos, cada um com seu % de desconto) ou `COMBO_MODALIDADES` (1 aluno só, praticando 2+ modalidades, desconto sobre o valor total combinado). Editar desconto, trocar titular (só relevante em `FAMILIA`) e excluir, tudo na mesma aba. Também dá pra vincular um aluno a um pacote existente direto no formulário de cadastro/edição dele (`/alunos/novo`, `/alunos/[id]/editar`), sem precisar passar pela aba Preços.

**"1 login por família":** em pacote `FAMILIA`, só o titular deveria ter conta no portal — os demais integrantes não precisam de `Usuario` próprio, porque o financeiro deles já aparece automaticamente no login do titular (`/aluno/financeiro` lista todo mundo do pacote, com upload de comprovante em nome de cada um). Isso é uma **convenção reforçada na UI** (aviso em `/alunos/[id]/editar` quando o aluno é integrante não-titular), não um bloqueio técnico — nada impede criar acesso pra um dependente também, se algum dia fizer sentido.

Se precisar conferir se o cálculo de desconto está batendo, a fórmula fica em `src/lib/precos.ts` (`valorEfetivoAluno`): base = `Aluno.mensalidadeValor` (se preenchido) senão o preço da modalidade; pra `FAMILIA` o desconto incide só na base, pra `COMBO_MODALIDADES` incide em (base + soma das modalidades extras matriculadas).

**`somaExtrasAluno` soma por matrícula, não por modalidade distinta (2026-08-03, decisão do usuário):** um aluno com 2 `Matricula` na mesma modalidade extra (2 horários diferentes) conta o preço **2x** no total — cada matrícula gera sua própria cobrança/ciclo de 12 parcelas separado (`Matricula.dataVencimentoBase`), então o total precisa refletir isso. Antes dessa correção, a função deduplicava por nome de modalidade (`new Set`) e só contava uma vez, mesmo com 2 cobranças reais acontecendo — inconsistência achada ao testar o WhatsApp ao vivo com um aluno de teste que tinha 2 horários na mesma modalidade extra.

### Link de autocadastro pra aluno ativo (2026-07-31)

`/cadastro-aluno` — **diferente** de `/matricule-se` (que é fila de pré-cadastro pra quem ainda não é aluno, exige aprovação manual). Esse é pra quem já treina mas ainda não está no sistema: preenche o formulário, vira `Aluno` de verdade na hora (`statusPagamento="Pendente"`) e já sai da tela com o link de definir senha do portal, sem o admin precisar gerar acesso depois.

O link completo (com o domínio certo) aparece num card copiável no topo de `/alunos`, logado como admin — é assim que o Sandro pega o link pra mandar pros alunos, não tem divulgação automática em nenhum lugar público.

**Desde 2026-08-03, aceita múltiplas modalidades num só cadastro** — botão "+ Adicionar outra modalidade" (`SeletorModalidadesMultiplas.tsx`). A primeira é sempre a principal (horário só de referência, sem cobrança extra); a partir da segunda, o horário é obrigatório e vira `Matricula` real (com cobrança, mesma regra de capacidade/preço do autoatendimento `/aluno/matricula`) — e cada modalidade tem sua própria faixa/graduação (`AlunoFaixaModalidade`, novo model; a faixa da principal continua em `Aluno.graduacaoFaixa`, sem mudança aí). Tudo roda dentro de uma única transação — se uma modalidade extra falhar (ex: horário lotado), o cadastro inteiro é desfeito, não fica `Aluno` pela metade. Lógica de matrícula extraída pra `src/lib/matricula.ts` (`matricularAlunoEmAula`), reaproveitada tanto aqui quanto no `/aluno/matricula` original. Escopo combinado com o usuário: só esse formulário — as telas de admin (`/alunos/novo`, `/alunos/[id]/editar`) e o próprio `/aluno/matricula` continuam sem capturar faixa ao adicionar modalidade extra.

### WhatsApp real via Evolution API (2026-08-03)

Diferente do resto do sistema (cobrança e mensagem de acesso continuam sendo link `wa.me` manual, `src/lib/whatsapp.ts`), dois avisos são automáticos de verdade, sem clique humano, via `src/lib/whatsapp-gateway.ts`:
- **Bloqueio de agenda avisa o aluno** — `criarBloqueio` (Configurações → Agenda) resolve quem tem acesso a algum horário dentro da janela bloqueada e manda mensagem pra cada um
- **Aula experimental agendada avisa o admin** — `criarPreCadastro` (`/matricule-se`), se a pessoa marcou uma data, avisa o telefone do `Usuario` com `username = ADMIN_USERNAME`

**Pareado e validado ao vivo em produção (2026-08-03)** — os dois avisos (bloqueio de agenda → aluno, aula experimental → admin) confirmados chegando de verdade no WhatsApp real do CT, não só `enviado: true`/HTTP 200. Passo a passo que foi seguido (útil se precisar reparear depois de trocar de número):
```bash
# na VPS, se a rede ainda não existir (idempotente — outros produtos da Holding já podem tê-la criado)
docker network create orbita_shared

# pega a API key real direto do container em execução, evita digitar errado
docker exec evolution_api env | grep AUTHENTICATION_API_KEY

# em /opt/academia-sandro/.env.production
EVOLUTION_API_URL="http://evolution_api:8080"   # nome do container na rede orbita_shared, não localhost
EVOLUTION_API_KEY="<valor do comando acima>"
EVOLUTION_INSTANCE_NAME="academia-sandro-admin"

docker compose up -d --force-recreate app   # aplica o .env novo + a rede
docker exec academia-sandro-app-1 printenv | grep EVOLUTION   # confirma as 3 variáveis carregadas antes de ir pro QR
```
Depois disso, logar como admin em `/configuracoes?aba=whatsapp` e escanear o QR code com o número do CT. Sem isso, os dois avisos automáticos simplesmente não são enviados (`enviado: false` no gateway) — mas **atenção**, ver gotcha abaixo, nem todo call site loga essa falha.

**⚠️ Achado no teste ao vivo (2026-08-03): campo Telefone do Perfil vazio faz o aviso de aula experimental falhar em silêncio, sem log nenhum.** O código busca `Usuario.telefone` da conta `sandro` (Configurações → Perfil) pra saber pra quem mandar o aviso — se esse campo estiver vazio, `criarPreCadastro` (`src/app/matricule-se/actions.ts`) simplesmente **pula o envio**, sem chamar `enviarWhatsapp` nem logar nada. Diferente do aviso de bloqueio de agenda (`criarBloqueio`), que já loga `console.error` quando o envio falha. **Diagnóstico:** se um aviso de bloqueio chega mas o de aula experimental não, o primeiro lugar pra checar é Configurações → Perfil → campo Telefone (tem que estar preenchido, com o mesmo número pareado no WhatsApp — são dois campos/conceitos diferentes, ver próximo parágrafo). Pendente corrigir a inconsistência de log (ver backlog).

**Dois campos diferentes que parecem a mesma coisa:** Configurações → Perfil → Telefone (`Usuario.telefone`, um campo de texto no banco) é **pra onde chegam** os avisos administrativos. Configurações → WhatsApp (QR code, estado da instância na Evolution API) é **quem envia** todas as mensagens automáticas. Coincidem na prática (mesmo celular do CT), mas são coisas tecnicamente independentes — dá pra ter um WhatsApp que envia tudo enquanto os avisos administrativos chegam num número pessoal diferente. Desde 2026-08-03, a tela de WhatsApp (quando conectada) tenta buscar o número pareado (`GET /instance/fetchInstances` na Evolution API) e oferece um botão "Usar esse número também como Telefone do Perfil" — 1 clique em vez de digitar de novo. Esse botão só aparece se a Evolution devolver o campo esperado (`ownerJid`/`owner`/`instance.owner`, formato varia por versão) — se não aparecer, é só preencher o Telefone manualmente mesmo, não é bug bloqueante.

**Padrão de integração, diferente do sistema-thieco/whitelabel:** o academia-sandro fala **direto** com a Evolution API, não via `POST {CORTEX_URL}/api/v1/cortex/notificar-admin` (o relay que thieco/whitelabel usam). Motivo: a gestão de QR/status/desconectar (`buscarQrCode`, `buscarStatusConexao`, `desconectarWhatsapp`) não é exposta pelo Cortex, só o envio de texto — como o projeto precisa falar direto com a Evolution de qualquer jeito pra isso, evitar o hop extra pro envio também é mais simples. Se um dia esse sistema ganhar um agente de atendimento tipo Quasar, vale reavaliar centralizar via Cortex, mesmo padrão dos outros produtos da Holding.

### Cron real de expiração de comprovante (2026-08-03)

A rota `/api/cron/limpar-comprovantes` existe desde 2026-07-29 (chama `limparComprovantesExpirados`, apaga comprovante com mais de 10 dias) mas só rodava "preguiçosa" — quando alguém abria `/matriculas` ou `/transacoes`. Agendamento real configurado direto no `crontab` da VPS (não é código do projeto, é infra):

```bash
ssh root@2.24.93.178
crontab -e
```
Adicionar:
```
0 3 * * * curl -s https://sandrofreiresf.online/api/cron/limpar-comprovantes > /dev/null
```
Confirmar: `crontab -l`. A rota é pública (sem auth) e idempotente — chamar de novo antes da próxima janela não causa problema, só não acha nada pra apagar.

### Popular com dados fictícios (demonstração)

```bash
npm run db:seed-demo               # 18 alunos fictícios variados
npm run db:seed-demo-financeiro    # transações e despesas em cima dos alunos acima (só roda se o banco de transações/despesas estiver vazio)
```
Esses dados ficam gravados **de verdade no Supabase** (não é algo que reseta ao reiniciar) — apagar via Prisma Studio (`npx prisma studio`) ou `DELETE FROM alunos; DELETE FROM transacoes_financeiras; DELETE FROM despesas;` antes de usar com alunos reais.

**Já foi apagado uma vez, em produção (2026-08-03)** — os 18 alunos fictícios + transações + despesas geradas por esses dois comandos (mais 2 cadastros de teste do próprio usuário/esposa) foram removidos do Supabase no dia do deploy, já que era o mesmo banco. Hoje o banco de alunos está zerado (só o login `devaluno` sobrevive, sem `Aluno` vinculado). **Não rodar `db:seed-demo`/`db:seed-demo-financeiro` de novo sem lembrar que vai direto pro banco de produção** — se precisar de dado fictício pra testar algo, apagar de novo depois (ver script padrão: apagar `TransacaoFinanceira`/`Despesa`/`Matricula` antes de apagar `Aluno`, senão a foreign key de `matriculas_alunoId_fkey` barra o delete).

### Migração de schema — `prisma migrate dev` trava neste ambiente

**Sintoma:** `npx prisma migrate dev --name algo` fica parado e depois falha com `Prisma Migrate has detected that the environment is non-interactive` — acontece até com `--create-only`. É esse terminal/ambiente que não é interativo o suficiente pro Prisma, não é erro de configuração do projeto.

**Correção (sempre que mudar `prisma/schema.prisma`):**
```bash
# 1. gera o SQL da diferença entre o banco atual e o schema novo
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

# 2. cria a pasta de migração manualmente com esse SQL
mkdir -p "prisma/migrations/$(date +%Y%m%d%H%M%S)_nome_da_mudanca"
# cola o SQL gerado no passo 1 em prisma/migrations/<pasta_criada>/migration.sql

# 3. aplica e registra no banco (não-interativo, sempre funciona)
npx prisma migrate deploy

# 4. regenera o client TypeScript com os campos novos
npx prisma generate
```
Sem o passo 4, o TypeScript acusa erro dizendo que o campo/model novo "não existe" no `PrismaClient`, mesmo a coluna já estando no banco — o client é gerado a partir do schema, não lido em tempo real.

**Atualização 2026-07-31 — nem sempre trava mesmo:** `npx prisma migrate dev --name pacotes_preco_individual` (2 tabelas novas + 1 coluna nova nullable, sem constraint que exija confirmação) rodou direto, sem cair no erro "non-interactive" — mesmo padrão já observado em migrações "simples" anteriores. O passo 4 (`npx prisma generate`) continua obrigatório mesmo quando `migrate dev` funciona direto — ele aplica a migração no banco mas não regenera o client de forma confiável neste ambiente, então sempre rodar `npx prisma generate` na sequência antes de usar o campo/model novo no código, mesmo que `migrate dev` não tenha travado.

**Atualização 2026-08-03 — confirma o padrão:** `npx prisma migrate dev --name aluno_faixa_modalidade_extra` (1 tabela nova, FK simples com `onDelete: Cascade`) rodou direto de novo, sem travar. Parece que só migrações mais complexas (constraint exigindo confirmação de perda de dado, por exemplo) é que caem no erro "non-interactive" — o workaround de 4 passos acima segue valendo como plano B, mas vale sempre tentar `migrate dev` direto primeiro.

### Gotchas deste projeto especificamente

- **Next.js 16 renomeou "Middleware" pra "Proxy"** — o arquivo que protege rotas autenticadas é `src/proxy.ts` (função `proxy`), não `middleware.ts`. Se algo desse tipo parecer não funcionar depois de uma atualização do Next, checar `node_modules/next/dist/docs/` antes de assumir que é bug — essa versão tem várias mudanças assim vs. o Next.js "clássico".
- **Toda rota nova protegida precisa ser adicionada em DOIS lugares, não um só** — `ADMIN_PATHS`/`ALUNO_PATHS` (`src/auth.ts`, decide qual `role` pode acessar) **e** o array `matcher` (`src/proxy.ts`, decide se o proxy roda pra aquela rota). Bug real cometido em 2026-07-30 ao criar `/configuracoes`: só o `ADMIN_PATHS` foi atualizado — a rota ficou **acessível sem login nenhum** até o `matcher` ser corrigido também, porque sem entrar no `matcher` o `proxy.ts` nunca roda pra aquele caminho (o `authorized()` do `auth.ts` nem chega a ser chamado). Sempre testar com `curl` sem cookie de sessão depois de adicionar rota admin nova — deve devolver `307` pro `/login`, nunca `200`.
- **Alterar `matcher`/`proxy.ts` exige reiniciar o `next dev`** — diferente de página/Server Action nova, mudança no `config.matcher` não é sempre pega a quente pelo watcher (principalmente rodando de `/mnt/c` no WSL2, onde eventos de arquivo do Windows nem sempre chegam ao inotify do Linux). Se uma rota nova continuar dando 404 ou continuar sem redirecionar mesmo depois do arquivo salvo, matar o processo e subir de novo antes de desconfiar de outra coisa.
- **`pkill -f "next dev"` / `pkill -f "next-server"` pode falhar silenciosamente neste ambiente** (2026-07-30, aconteceu mais de uma vez) — o comando roda, não dá erro, mas o processo continua vivo e servindo na porta 3000 com código/Prisma Client **desatualizados**. Sintoma: depois de mudar o schema e rodar `npx prisma generate`, uma tela quebra com `Unknown field` mesmo a coluna já existindo no banco — é o servidor velho ainda de pé, não a migration. **Forma confiável de reiniciar:** achar o PID de verdade com `ss -tlnp | grep 3000` (não confiar no `pkill`), matar com `kill -9 <pid>` **por esse PID exato**, confirmar porta livre (`ss -tlnp | grep 3000` de novo, sem saída), só então subir `npm run dev` de novo.
- **Prisma 7 (gerador `prisma-client`) exige driver adapter explícito** — `new PrismaClient()` sozinho não compila. O padrão já está em `src/lib/prisma.ts` (`new PrismaClient({ adapter: new PrismaPg(...) })`); só relevante se algum dia recriar esse arquivo do zero.
- **Tailwind v4: `@apply` não funciona em classe CSS solta** — uma classe utilitária customizada (ex: `bg-gold-gradient`) só pode ser usada dentro de `@apply` se for registrada como variável de tema dentro de `@theme inline` (namespace `--background-image-*` pra gradientes, `--color-*` pra cores, etc.) em `globals.css`. Declarar a classe direto com `background: linear-gradient(...)` fora do `@theme` quebra o build na hora que outra classe tentar dar `@apply` nela.
- **Senha do Postgres já vazou em texto puro mais de uma vez** (no `.env` durante debug, no `PROGRESS.md`, e de novo em 2026-08-03 ao montar o `.env.production` do VPS) — rotacionar no painel do Supabase antes de qualquer uso real segue como recomendação. Um registro anterior (`registro-de-decisoes-academiasandro.md`, 2026-07-28) afirma que já foi rotacionada, mas evidência de 2026-08-03 contradiz isso (mesma senha, char a char) — tratar como **não confiável** até confirmar manualmente no painel (Settings → Database → data do último reset). Perguntado explicitamente em 2026-08-03, o usuário optou por manter a senha atual por ora — decisão registrada, não esquecimento.
- **VPS de produção (desde 2026-08-03) é compartilhada com VillaMill e Sistema Thieco** (mesmo IP `2.24.93.178`) — um nginx no host, não um proxy em container, faz o roteamento por domínio pra todos os 3. Ver seção "Deploy na VPS (produção)" acima antes de mexer em portas/proxy nesse sistema — nunca assumir que é uma VPS dedicada.
- **Nome oficial é "Sandro Freire", não "Sandro Ferreira"** (corrigido em 2026-07-31 em toda a UI) — os logos (`public/logos/sandro-freire-personal.png`) e o domínio de produção (`sandrofreiresf.online`) já usavam o nome certo desde antes; só o texto espalhado pela UI (título, sidebar, login, mensagens de WhatsApp) estava errado desde o redesign do login em 2026-07-22. Se aparecer "Ferreira" em algum lugar novo, é regressão, não é o nome certo.
- **Servidor antigo pode ficar de pé por horas segurando a porta 3000** (2026-07-31, aconteceu de novo) — `npm run dev &` detecta "Port 3000 is in use by an unknown process" e sobe sozinho na próxima porta livre (3001...), mas isso mascara o problema: se o processo antigo é de uma sessão anterior (código desatualizado), testar contra a porta nova (3001) funciona só por coincidência dele estar rodando código velho igual. Antes de testar algo que depende do código mais recente, confirmar com `ps -p <pid> -o lstart,cmd` (achando o PID via `ss -tlnp | grep 3000` ou similar) se o processo que já está na 3000 é realmente antigo, e matar (`kill <pid>`, ou `kill -9` se não sair) antes de subir de novo — não assumir que "porta ocupada" é sempre outro projeto do workspace disputando a 3000 (ver [[Playbook DevOps - Comandos Docker e Bancos]], seção Risco do monorepo), às vezes é o próprio `academia-sandro` de uma sessão anterior que não foi encerrada.
- **Cache persistente do Turbopack pode corromper e servir código desatualizado sem erro visível (2026-08-03)** — matar processos `next dev`/`next-server` (mesmo com `kill -9`) enquanto o Turbopack está no meio de escrever seu cache em disco (`.next/dev/cache/turbopack/`) deixa esse cache num estado inconsistente. Sintoma traiçoeiro: o servidor continua respondendo `200` normalmente, mas serve HTML **antigo** mesmo depois de editar o arquivo fonte e o log mostrar "recompilado" — só quebra visivelmente mais tarde, com `TurbopackInternalError: Failed to restore task data (corrupted database or bug)` apontando pra um `.sst` que não existe. Causa raiz provável: múltiplos processos `next dev` de tentativas de reinício anteriores (ver gotcha da porta 3000 acima) escrevendo no mesmo diretório de cache ao mesmo tempo. **Correção:** achar e matar **todos** os processos `next`/`next-server` por PID exato (`ps aux | grep next`, não confiar em `pkill`), confirmar porta livre (`ss -ltnp | grep 3000`), só então `rm -rf .next` e subir um único `npm run dev` novo. Rodar com `npx next dev --webpack` evita essa classe de bug inteiramente (sem cache persistente do Turbopack) — considerar fixar isso no `package.json` se o bug se repetir.
- **`git push` neste workspace é reservado ao agente `aiox-devops`** — nenhuma outra sessão/agente publica direto no `origin/main` do monorepo `zion-workspace`. O `aiox-devops` valida escopo do commit (`git diff-tree`, garantindo que nenhum arquivo de outro projeto foi arrastado) e sabe lidar com a árvore cronicamente suja e o risco de divergência (ver [[Playbook DevOps - Comandos Docker e Bancos]], seção Risco do monorepo) — inclusive a técnica de "plumbing-rebase" quando `origin/main` estiver à frente do `main` local sem dar pra fazer `git pull`/`git merge` limpo. `git add`/`git commit` locais continuam podendo ser feitos por qualquer sessão, só o `push` final é exclusivo.
- **Segredo real pode acabar salvo em `.claude/settings.local.json` sem querer (2026-08-03)** — esse arquivo guarda o histórico de permissões de comandos Bash autorizados numa sessão; se um comando de debug incluiu a `DATABASE_URL` completa inline (ex: testando conexão manualmente), a senha real do Postgres fica salva em texto puro nesse arquivo, mesmo sem nunca ter sido colada de propósito em lugar nenhum. Achado ao preparar um commit que ia incluir `.claude/` inteira — **sempre inspecionar o conteúdo de `settings.local.json` antes de commitar essa pasta**, não assumir que é só configuração inofensiva de UI.

