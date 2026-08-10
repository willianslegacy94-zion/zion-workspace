---
status: stable
domain: jocley-lanchonete
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Jocley Grill

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém comandos, deploy e gotchas específicos do Jocley Grill (`lanchonete-sistema`). Ver também [[indice-jocley-lanchonete]] e [[Playbook DevOps - Comandos Docker e Bancos]] (comandos gerais + risco do monorepo).

## Jocley Grill (lanchonete-sistema) — o que saber pra mexer sem mim

**Mesmo padrão do Villa Mill/Depósito Lobo: repositório Git próprio, nascido em 2026-07-30** — antes disso vivia como pasta solta dentro do `orbita-workspace`, sem versionamento nenhum. Desde 2026-07-30, tem remote próprio: **`https://github.com/willianslegacy94-zion/lanchonete-sistema`** (privado — decisão do `@devops` dado que o `docker-compose.yml` tem credenciais default de dev; `gh repo edit --visibility public` reverte se quiser paridade com os irmãos públicos). **Desde 2026-08-03, em produção na VPS compartilhada** (`2.24.93.178`, mesma dos outros sistemas abaixo) — domínio `jocleygrill.online`. Ver "Deploy na VPS (produção)" mais abaixo.

### Deploy — push, historicamente feito pelo `@devops` (Gage); em sessões sem framework AIOX ativo, feito direto com confirmação do usuário

```
Fluxo original (com AIOX): git add/commit locais → invocar @devops → ele confirma
se já existe repo no GitHub (gh repo view), cria se não existir (gh repo create),
roda quality gate (tsc + lint + build + scan de segredos) e só então git push -u origin main.
```
Esse projeto específico (`lanchonete-sistema`) não tem `.aiox-core/` — não roda dentro do framework AIOX, então não existe agente `@devops` de fato disponível nas sessões sobre ele. **Na prática (confirmado em 2026-08-04, sessão das 10 melhorias operacionais):** push feito direto pelo Claude Code puro, perguntando confirmação explícita ao usuário antes de cada `git push origin main` — sem quality gate automatizado formal, mas com `tsc --noEmit` + `npm run lint` rodados manualmente antes de cada commit. Em outros projetos do workspace que rodam dentro do AIOX de verdade, a regra de `@devops` exclusivo continua valendo.

**Reconfirmado em 2026-08-07 (sessão de entrada rápida de estoque + ficha técnica de espetos):** a tentativa de invocar o subagente `aiox-devops` via Agent tool falhou (`Agent type 'aiox-devops' not found`) — o `.claude/agents/aiox-devops.md` existe no `orbita-workspace` (nível pai), mas não é descoberto quando a sessão roda com cwd dentro de `lanchonete-sistema` (subpasta). Solução usada: spawnar um agente `general-purpose` com instrução explícita para ler `.claude/commands/AIOX/agents/devops.md` (persona Gage) + a task de pre-push quality gate, e então rodar `tsc`/`lint` + `git push origin main` (nunca `-f`) — funcionou nas duas vezes (commits `7abd46c` e `1b56d7f`), sempre só depois de confirmação explícita do usuário ("sim") pra cada push. Padrão reaproveitável pra qualquer projeto do workspace sem `.aiox-core/` que precise do fluxo de push com quality gate mesmo sem o subagente nativo disponível.

| | Detalhe |
|---|---|
| Caminho | `/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema` |
| Nome de exibição | "Jocley Grill" (renomeado de "Jocley Lanchonete" em 2026-07-30 — constante `NOME_LANCHONETE`, `src/lib/constants.ts`, usada em toda a UI) |
| Stack | Next.js 15 + Prisma 6 + PostgreSQL (Docker local) + NextAuth v5 (credentials, campos `usuario`/`senha`, não `username`/`password`) |
| Containers | `jocley-lanchonete-db` (Postgres — porta do host configurável via `POSTGRES_HOST_PORT`, default **5434** local, **5435** na VPS), `jocley-lanchonete-app` (`3001:3000`, só usado se subir via `docker compose up` completo — dev local normal roda o Next fora do container, ver abaixo) |
| Banco | `jocley_lanchonete`, local via `docker-compose.yml` na raiz do projeto |
| VPS (produção) | `/opt/lanchonete-sistema` (SSH, IP `2.24.93.178`) — **atenção:** os outros sistemas dessa VPS (Villa Mill, Sistema Thieco) vivem em `/var/www/...`, a lanchonete foi implantada em `/opt/...`; não é o mesmo padrão de caminho, confira sempre com `pwd` antes de rodar comando às cegas achando que está no padrão dos outros |

### Rodar local

```bash
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema"
npm run dev   # scripts/dev.js: sobe o Postgres via Docker (se não estiver rodando), roda `prisma migrate deploy` + `prisma generate`, depois `next dev`
```

Login de teste (`prisma/seed.ts`): `admin`/`admin123` (ADMIN), `supervisor`/`supervisor123` (SUPERVISOR), `caixa`/`caixa123` (CAIXA), `atendente`/`atendente123` (ATENDENTE), `cozinha`/`cozinha123` (COZINHA), **`devmaster`/`dev2026`** (ADMIN, conta oculta — não aparece em `/usuarios` nem em `GET /api/users`; único login que enxerga Configurações → Logs de Erro).

### Deploy na VPS (produção, desde 2026-08-03)

```bash
ssh root@2.24.93.178
cd /opt/lanchonete-sistema
git pull origin main
docker compose build app                        # reconstrói a imagem com o código novo
docker compose up -d --force-recreate app        # recria o container — Dockerfile já roda `prisma migrate deploy` sozinho no startup
docker compose ps                                # confirma jocley-lanchonete-app e jocley-lanchonete-db "Up"
docker compose logs -f app                       # confirma que subiu sem erro (Ctrl+C sai sem derrubar)
```
Mesmo princípio já registrado pro Villa Mill/Sistema Thieco: um `git push` daqui **não** chega na VPS sozinho, alguém precisa entrar e rodar o pull/rebuild acima.

**Variante (2026-08-07): `scp` de um arquivo único em vez de `git pull` completo, pra um fix pequeno e pontual.** Diferente do Cortex/Quasar (que não têm `.git` na VPS e por isso *dependem* de `scp`), a lanchonete tem git funcionando normal — `scp` aqui é só um atalho opcional pra não esperar confirmar o estado do repo remoto antes de um ajuste de uma linha. Rodar do terminal LOCAL (o caminho local não existe na VPS):
```bash
scp "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema/CAMINHO/DO/ARQUIVO.tsx" \
  root@2.24.93.178:/opt/lanchonete-sistema/CAMINHO/DO/ARQUIVO.tsx
# depois, sempre precisa do rebuild pra valer (o Next standalone já está compilado, copiar o .tsx sozinho não muda o app rodando):
ssh root@2.24.93.178 "cd /opt/lanchonete-sistema && docker compose up -d --build"
```
**Risco desse atalho, pra ter em mente:** ele sobrescreve o arquivo na working tree do repo clonado na VPS sem passar por `git pull` — se o próximo `git pull` de rotina rodar sem `git add`/commit desse arquivo primeiro, o `pull` pode reportar conflito (arquivo modificado localmente na VPS diverge do que o `git pull` traria) ou, pior, ser sobrescrito de volta silenciosamente dependendo do que já estava commitado. Preferir sempre `git pull` completo quando não for uma emergência de um único arquivo — esse `scp` pontual é exceção, não deploy padrão pra este projeto (que tem git funcionando, ao contrário do Cortex/Quasar).

**Gotcha confirmado em 2026-08-04: `docker compose up -d --build` sozinho não é suficiente quando só o `docker-compose.yml` mudou (ex.: rede Docker nova, `extra_hosts`).** Presenciado ao vivo: mudança de `networks:` no compose não se refletiu no container até rodar explicitamente `docker compose build app` (mesmo sem mudança nenhuma no código/Dockerfile) **seguido** de `docker compose up -d --force-recreate app` — um `--force-recreate` sem `build` antes também não bastou (reaproveitou a imagem antiga). Sempre que mexer só no `docker-compose.yml` (sem tocar em código), rodar os dois comandos separados acima, nessa ordem, em vez de confiar que `up -d --build` sozinho detecta e aplica a mudança de rede/config.

**Acesso da VPS ao GitHub é por SSH deploy key, não HTTPS+senha** — GitHub não aceita mais usuário/senha em operações git por HTTPS. Setup (uma vez só, já feito):
```bash
ssh-keygen -t ed25519 -C "vps-jocleygrill" -f ~/.ssh/deploy_jocleygrill -N ""
cat ~/.ssh/deploy_jocleygrill.pub   # colar em github.com/.../lanchonete-sistema/settings/keys, "Add deploy key", SEM "Allow write access"
```
```
# ~/.ssh/config na VPS
Host github-jocleygrill
  HostName github.com
  User git
  IdentityFile ~/.ssh/deploy_jocleygrill
  IdentitiesOnly yes
```
Clone/pull usam `github-jocleygrill:willianslegacy94-zion/lanchonete-sistema.git`, não a URL `https://github.com/...`.

**A imagem final de produção (`runner`, no `Dockerfile`) não tem `tsx` nem devDependencies** — só o necessário pra rodar `server.js` (Next standalone) + Prisma Client. Rodar o seed ou qualquer script TypeScript pontual direto nela falha (`tsx: not found`). Solução: buildar a etapa intermediária (`builder`, que tem tudo) como imagem separada e rodar nela, na mesma rede Docker do projeto:
```bash
docker network ls | grep lanchonete                              # confirma o nome, ex: lanchonete-sistema_default
docker build --target builder -t jocley-seed-tmp .
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"')  # ver gotcha de aspas abaixo
docker run --rm --network lanchonete-sistema_default -e DATABASE_URL="$DB_URL" -e DIRECT_URL="$DB_URL" jocley-seed-tmp npx tsx prisma/seed.ts
docker rmi jocley-seed-tmp   # limpa depois de usar
```

**Gotcha de aspas: `docker run --env-file` não remove aspas do valor, diferente de `docker compose`.** Se o `.env` tem `DATABASE_URL="postgresql://..."` (com aspas, formato padrão do projeto), `docker run --rm --env-file .env ...` passa a aspa literal pro Prisma, que erra `the URL must start with the protocol postgresql://` (a aspa vira parte da string). `docker compose` (usado no `docker compose up -d --build` normal) não tem esse problema, só o `docker run` avulso. Correção: extrair o valor sem aspas na própria sessão do shell antes de passar via `-e` (comando acima, `tr -d '"'`), nunca usar `--env-file .env` num `docker run` solto pra esse projeto.

**Gotcha de porta: essa VPS tem vários projetos Docker disputando as mesmas portas de Postgres.** Antes de subir qualquer container novo com porta fixa, conferir o que já está ocupado:
```bash
docker ps -a                        # todos os containers, mesmo parados — mostra as portas publicadas
ss -ltnp | grep <porta>             # confirma quem seguraria a porta antes mesmo de tentar subir
```
No caso da lanchonete, `5434` já estava ocupada pelo `lane-confeitaria-db` — resolvido tornando a porta do host configurável (`POSTGRES_HOST_PORT`, ver tabela acima) em vez de fixa no `docker-compose.yml`, com a VPS definindo `POSTGRES_HOST_PORT=5435` só no próprio `.env`. **Nunca fixar porta de host direto num `docker-compose.yml` que é compartilhado entre dev local e VPS** — o que "não colide" hoje pode colidir amanhã quando outro projeto entrar na mesma VPS.

**Gotcha do terminal: heredoc multi-linha colado na sessão SSH pode corromper o terminador.** Colar um bloco `comando <<'EOF' ... EOF` de uma vez (via paste do terminal) fez o `EOF` de fechamento vir com lixo grudado (`EOF~`), o heredoc não fechou onde devia, e os comandos seguintes viraram *conteúdo do arquivo* em vez de serem executados — nada do que devia rodar, rodou, silenciosamente. Não deu erro óbvio, só descobri comparando o resultado esperado com o real (`ls /opt` não mostrando a pasta clonada). **Preferir sempre comandos de uma linha só nessa VPS** (`echo "linha" >> arquivo`, um por vez) ou, pra conteúdo maior (ex.: um script), gerar localmente e transmitir como `base64 -d` de uma string única — nunca heredoc multi-linha colado interativamente.

### Gotcha: disputa de porta com outros projetos locais do workspace (`academia-sandro`, `lane-confeitaria`) — e por que **não** fixar a porta

Vários projetos do `orbita-workspace` sobem `next dev` sem porta fixa, todos preferindo `3000` por padrão. Quem sobe primeiro pega `3000`; os outros caem em cascata pra `3001`, `3002`... **A porta que a lanchonete acaba usando muda dependendo da ordem em que os projetos foram iniciados** — não é fixo em `3001` como o `.env` (`NEXTAUTH_URL`/`AUTH_URL`) sugere. Confirme sempre com `ss -tlnp | grep -E ':(3000|3001|3002)'` + `readlink /proc/<pid>/cwd` antes de assumir a porta.

**Já tentei "corrigir" isso fixando a porta com `next dev -p 3001` no `scripts/dev.js` — piorou.** Sem `-p`, o Next cai graciosamente pra próxima porta livre se a preferida estiver ocupada; **com** `-p` explícito, ele **falha** (`EADDRINUSE`) em vez de cair pra outra porta, porque o fallback automático só existe no modo "porta preferida, sem exigência". Revertido — `scripts/dev.js` está de volta sem `-p`, deliberadamente.

Se o login redirecionar pra porta errada (cai em outro sistema, ou dá erro de sessão), o problema é esse — descobrir a porta real e acessar direto nela, ou matar o processo do outro projeto que "roubou" a `3000`/`3001` primeiro (nunca o `academia-sandro`/`lane-confeitaria` sem confirmar com o dono antes, só os processos da própria lanchonete).

### Gotcha: Docker Desktop não está sempre aberto neste WSL

Igual ao registrado acima pro Sistema Thieco — esse ambiente não tem `docker` direto no WSL, só `docker.exe` (Docker Desktop do Windows). Se nem `docker.exe` responder, abrir o app:
```bash
powershell.exe -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"
# esperar uns 30-60s o daemon subir antes de rodar `docker compose up`
```

### Gotcha: watcher do Next não pega **arquivo novo** criado em `/mnt/c` com o `next dev` já rodando

Diferente de editar um arquivo existente (isso o watcher pega normal), **criar uma rota nova** (ex: `src/app/api/algo/route.ts`) enquanto o `next dev` já está de pé some com 404 até reiniciar — o evento de criação de arquivo não chega no watcher do Turbopack de forma confiável vindo do `/mnt/c`. Sintoma idêntico ao já documentado na seção do `academia-sandro` pra mudança de `matcher`/`proxy.ts`, mas aqui acontece pra **qualquer arquivo novo**, não só config de rota.

```bash
pkill -f "next dev"; pkill -f "scripts/dev.js"   # mata só os processos deste projeto, confirme com `ps aux | grep next` antes se tiver outro Next local rodando (ex: academia-sandro)
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema" && npm run dev
```
Se depois do restart ainda vier conteúdo antigo (ex: mudou uma constante e o valor velho continua aparecendo), o cache do Turbopack ficou preso — `rm -rf .next/cache` antes de subir de novo resolve.

**Rodando em background numa sessão de agente (Claude Code):** não usar a opção nativa de rodar em background com timeout curto pra isso — um `next dev` é processo de vida longa e é derrubado quando o timeout expira (aconteceu, o servidor caiu sozinho no meio de teste). Usar `nohup npm run dev > arquivo.log 2>&1 < /dev/null & disown` a partir do shell, redirecionando a saída pra um log, e consultar o log depois — assim o processo sobrevive independente do tool que o lançou.

### Gotcha: build do `.next` corrompido — layout inteiro some, vira HTML puro sem estilo

Sintoma: página carrega, mas sem CSS nenhum (parece HTML cru), e o log do servidor mostra `Error: Cannot find module './XXXX.js'` referenciando `.next/server/webpack-runtime.js` ou `pages/_document.js` (mesmo o projeto sendo 100% App Router, sem Pages Router). Causa: `.next` ficou com build parcial/inconsistente — geralmente depois de uma limpeza de cache (`rm -rf .next/cache`) que não terminou, ou dois processos gravando na mesma pasta `.next` ao mesmo tempo.

**Correção — sempre limpeza completa, nunca só `.next/cache`:**
```bash
pkill -f "next dev"; pkill -f "scripts/dev.js"   # só os processos da lanchonete
rm -rf .next                                      # pasta inteira, não só .next/cache
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema" && npm run dev
```
Confirmar que resolveu: `curl -s <url>/login | grep -o 'layout.css[^"]*'` deve devolver um link de CSS, e baixar esse link deve devolver alguns KB de conteúdo real (não vazio).

### Gotcha: "Hydration failed" que aparece e some ao atualizar a página

Sintoma clássico: tela pisca um erro de hidratação do React e se auto-recupera (o React descarta a árvore do servidor e refaz no cliente) — não trava, mas indica bug real. Causa raiz encontrada nesta sessão: um valor formatado em moeda (`toLocaleString`/`Intl.NumberFormat`) sendo renderizado **antes** dos dados terminarem de carregar (`isLoading` ainda `true` durante o SSR) — o `Intl`/ICU do Node do servidor pode produzir uma string sutilmente diferente da que o navegador produziria na re-hidratação (ex.: espaço normal vs. non-breaking space entre "R$" e o valor).

**Regra a seguir em qualquer card/valor calculado que apareça antes do carregamento terminar:** nunca chamar `formatCurrency`/`toLocaleString` incondicionalmente — sempre gatear atrás de `isLoading` (placeholder tipo `"—"` ou `"Carregando..."` enquanto os dados não chegaram, só formata depois). Ver `estoque-table.tsx` (card de valor total) como referência do padrão corrigido.

### Sistema de tratamento e registro de erros (desde 2026-07-30) — pode servir de referência pra outros sistemas

Nenhuma rota de API tinha tratamento de exceção até esta sessão. Padrão implementado, reutilizável em qualquer projeto Next.js App Router do workspace:

- `src/lib/api-error.ts` — `AppError` (erro de negócio com mensagem amigável customizada), `handleApiError` (mapeia erros conhecidos do Prisma pra mensagem específica, loga console + `ErrorLog`, responde `{error: mensagem}` amigável), `withErrorHandling(rota, handler)` (higher-order function que envolve qualquer handler de rota em try/catch)
- Aplicado nas 38 rotas de API (todas exceto `/api/auth/[...nextauth]`, que tem gestão de erro própria do NextAuth)
- `error.tsx`/`global-error.tsx` — equivalente pra falha de renderização React (página quebrada mostra mensagem amigável + botão "Tentar novamente", em vez da tela de erro crua do Next)
- Ver os erros registrados: login com **`devmaster`/`dev2026`** → Configurações → aba "Logs de Erro" (invisível pra qualquer outro usuário, inclusive ADMIN comum)

```bash
# ver os últimos erros direto no banco, sem passar pela UI
docker exec jocley-lanchonete-db psql -U postgres -d jocley_lanchonete -c \
  "SELECT rota, status, mensagem, \"createdAt\" FROM \"ErrorLog\" ORDER BY \"createdAt\" DESC LIMIT 20;"
```
**Atenção ao usuário do Postgres — `postgres` só funciona local.** O `.env` de produção (VPS) define `POSTGRES_USER=jocley_prod`, não o default `postgres` do `docker-compose.yml` — rodar o comando acima na VPS sem trocar o `-U` dá `FATAL: role "postgres" does not exist`. Confirme sempre antes: `grep POSTGRES_USER /opt/lanchonete-sistema/.env`.

### Configurações → Taxas (dois grupos, desde 2026-07-30)

1. **Taxas de Pagamento** (`TaxaPagamento`) — por forma de pagamento (`DINHEIRO`/`CREDITO`/`DEBITO`/`PIX`/`VOUCHER`/`NOTA`), opcionalmente por bandeira de cartão.
2. **Taxas de Delivery** (`TaxaDelivery`, nova) — por canal (`IFOOD`/`NOVENTA_E_NOVE`/`MOTOBOY`/`OUTROS_DELIVERY`), alimenta a Calculadora de Metas (próximo item).

### Inteligência Financeira → aba "Calculadora de Metas" (nova, 2026-07-30)

Usuário informa uma quantidade de vendas desejada + canal (presencial ou um dos deliveries acima); o sistema projeta receita bruta, desconta a taxa do canal, desconta CMV e mostra o lucro bruto — e, na mesma tela, quanto vender de **cada produto ativo** pra bater essa meta, distribuindo a quantidade proporcionalmente ao mix histórico de vendas do período selecionado (`ranking-pratos`). Sem histórico no período, cai pra distribuição igualitária entre os produtos ativos (com aviso na tela).

### Nginx + SSL (setup inicial, já feito em 2026-08-03 — só pra referência se precisar refazer)

```bash
apt install -y nginx certbot python3-certbot-nginx
cp deploy/nginx/jocleygrill.online.conf /etc/nginx/sites-available/jocleygrill.online   # arquivo já vem pronto no repo
ln -s /etc/nginx/sites-available/jocleygrill.online /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d jocleygrill.online -d www.jocleygrill.online   # exige DNS já propagado (dig jocleygrill.online +short → 2.24.93.178), senão a validação falha
```
Renovação é automática (`systemctl status certbot.timer`), certificado válido até `2026-11-01` — se passar dessa data sem renovar sozinho, `certbot renew --dry-run` pra diagnosticar antes de renovar de verdade.

### Cardápio real (56 produtos, dois cardápios) — como foi cadastrado

`prisma/seed.ts` tem os 56 produtos reais (cardápio principal + espetinhos crus, ver Registro de Decisões 2026-08-03 no Obsidian pra lista completa e as duas ambiguidades resolvidas por julgamento próprio). Se precisar re-seedar do zero (ex.: banco novo, ambiente de teste), mesmo padrão do seed de usuários — roda direto:
```bash
docker run --rm --network lanchonete-sistema_default -e DATABASE_URL="$DB_URL" -e DIRECT_URL="$DB_URL" jocley-seed-tmp npx tsx prisma/seed.ts
```
(precisa da imagem `jocley-seed-tmp` buildada primeiro, ver "Deploy na VPS" acima — o seed é idempotente, `findFirst` por nome antes de criar, então rodar de novo num banco que já tem os produtos não duplica nada.)

**Preço de bebidas ainda zerado** (Coca-Cola, Coca Zero, Guaraná, Guaraná Zero, Fanta Laranja, Água) — cardápio original não trazia valor pra essas, cliente ajusta pela tela de Produtos. Se reaparecer um produto com `preco: 0` inesperado depois de um re-seed, é isso, não é bug.

### Notificações WhatsApp via Evolution API (desde 2026-08-04) — pode servir de referência pra outros sistemas dessa VPS

Faturamento, produtos mais vendidos, estoque baixo e estoque parado (`ConfiguracaoNotificacao`) disparam automaticamente via WhatsApp, usando a **mesma Evolution API self-hosted já compartilhada entre os outros sistemas da VPS** (container `evolution_api`, também usado por thieco/academia-sandro/lane-confeitaria). A lanchonete tem sua **própria instância dedicada** (`jocley-grill`) — nunca reaproveitar instância de outro cliente.

**Gotcha de rede que mais custou tempo pra resolver: porta publicada em `127.0.0.1` do host não é alcançável de outro container, nem com `host.docker.internal`.**
- `evolution_api` publica a porta só em `127.0.0.1:8081->8080` (loopback do host, por segurança) — Docker aceita conexão nessa regra **só vinda do próprio host**, nunca de outro container, nem passando por `host.docker.internal` (que resolve pro IP do bridge gateway, não pro loopback — tentado primeiro, não funcionou, `getaddrinfo ENOTFOUND` ou `ECONNREFUSED` dependendo da tentativa).
- **Solução correta:** `evolution_api` já está numa rede Docker externa chamada **`orbita_shared`** (compartilhada entre os sistemas dessa VPS, incluindo os agentes Cortex/Quasar). Conectar o container do app nessa rede e falar pelo **nome do container + porta interna**, não a publicada:
  ```yaml
  # docker-compose.yml do app
  services:
    app:
      networks:
        - default        # mantém acesso ao serviço "db"
        - orbita_shared   # alcança evolution_api pelo nome
  networks:
    orbita_shared:
      external: true
  ```
  ```bash
  # .env
  EVOLUTION_API_URL="http://evolution_api:8080"   # nome do container + porta INTERNA (8080), nunca a publicada (8081)
  ```
- Testar conectividade sem depender da UI: `docker exec jocley-lanchonete-app wget -qO- http://evolution_api:8080` deve devolver o JSON de welcome da Evolution API.
- Achar a rede certa de qualquer container que já funcione: `docker inspect evolution_api --format '{{json .NetworkSettings.Networks}}'`.

**Diagnóstico de erro de fetch sem precisar redeployar nada** — rodar um teste direto no Node do container, usando as env vars já carregadas:
```bash
docker exec jocley-lanchonete-app node -e "
const url = process.env.EVOLUTION_API_URL + '/message/sendText/' + process.env.EVOLUTION_INSTANCE;
fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY },
  body: JSON.stringify({ number: '5511999999999', text: 'teste' }) })
  .then(async r => { console.log('STATUS', r.status); console.log(await r.text()); })
  .catch(e => { console.log('FETCH ERROR:', e.message); console.log('CAUSE:', e.cause); });
"
```
`e.cause` mostra o motivo real (`ENOTFOUND`, `ECONNREFUSED` etc.) — o log padrão da aplicação (`[API ERROR] ... fetch failed`) não expõe isso, só a mensagem genérica do `fetch`.

**Telefone sem DDI 55 é rejeitado pela Evolution API** com `400 {"response":{"message":[{"exists":false}]}}` — parece erro de conexão, mas é validação de número (`11948455946` sem o `55` na frente não é reconhecido). O código (`src/lib/evolution-api.ts`) já completa o DDI automaticamente pra números de 10/11 dígitos, mas se aparecer esse erro específico em outro contexto, é isso.

**Forçar um disparo agendado agora, sem esperar o horário real bater** (útil pra confirmar que o agendador (`src/instrumentation.ts`, tick de 60s) está rodando de verdade):
```bash
# muda o horário pra "agora" (só a hora importa, minutos são ignorados na comparação)
docker exec jocley-lanchonete-db psql -U jocley_prod -d jocley_lanchonete -c \
  "UPDATE \"ConfiguracaoNotificacao\" SET \"horaDisparo\" = '03:00' WHERE tipo = 'FATURAMENTO';"
sleep 90   # espera o próximo tick
docker exec jocley-lanchonete-db psql -U jocley_prod -d jocley_lanchonete -c \
  "SELECT tipo, \"ultimoDisparoEm\" FROM \"ConfiguracaoNotificacao\" WHERE tipo = 'FATURAMENTO';"
# devolve pro horário real depois, e zera ultimoDisparoEm pra não pensar que já disparou "hoje" por causa do teste:
docker exec jocley-lanchonete-db psql -U jocley_prod -d jocley_lanchonete -c \
  "UPDATE \"ConfiguracaoNotificacao\" SET \"horaDisparo\" = '08:00', \"ultimoDisparoEm\" = NULL WHERE tipo = 'FATURAMENTO';"
```

**Env vars necessárias no `.env`:** `EVOLUTION_API_URL` (`http://evolution_api:8080` na VPS, ver acima), `EVOLUTION_API_KEY` (mesma API key global da Evolution API — pegar com `docker exec evolution_api env | grep -i AUTHENTICATION_API_KEY`), `EVOLUTION_INSTANCE` (`jocley-grill`). Telefone que recebe as notificações fica em `ConfiguracaoGeral` (chave `whatsapp_telefone_notificacao`), configurável pela própria tela (Configurações → Notificações → campo + botão "Salvar telefone"/"Desconectar"), não no `.env`.

### Atualização (2026-08-10) — erro "sendMessage" da Evolution (sessão quebrada mesmo com status `open`) + reset de instância é sempre isolado por nome

Cliente reportou `AppError` repetido no "Enviar teste", com o corpo cru da Evolution: `{"status":400,...,"response":{"message":["TypeError: Cannot read properties of undefined (reading 'sendMessage')"]}}`. Erro **interno do Baileys/Evolution** quando o socket da sessão está `undefined`, não um bug deste app — a instância acha que está conectada (`connectionStatus: "open"`), mas o objeto de sessão real por trás não existe mais. **Lição central: status `open` reportado pela instância não é garantia de sessão viva** — sempre validar com uma chamada real antes de confiar só no status.

**Correção de código (não commitada até o fim desta sessão):**
- `testar/route.ts` passou a chamar `statusInstanciaWhatsApp()` antes de enviar — se `estado !== "open"`, nem tenta chamar a Evolution.
- `mensagemAmigavelEvolution()` (`src/lib/evolution-api.ts`) reconhece o padrão `sendMessage` na resposta da Evolution e devolve mensagem amigável ("sessão caiu, desconecte e escaneie o QR de novo") em vez do JSON cru — cobre o caso em que o status ainda diz `open`.

**Reset de instância é sempre isolado por nome:** `DELETE /instance/logout/{instance}` (já usado pelo botão "Desconectar sessão atual" da tela) atua só sobre `EVOLUTION_INSTANCE=jocley-grill` — instâncias da mesma Evolution API compartilhada são independentes entre si; resetar uma nunca derruba as outras que rodam no mesmo container. Se precisar resetar na unha, sem passar pela UI:
```bash
EVO_KEY=$(docker exec jocley-lanchonete-app env | grep '^EVOLUTION_API_KEY=' | cut -d= -f2-)
curl -s -X DELETE "http://127.0.0.1:8081/instance/logout/jocley-grill" -H "apikey: $EVO_KEY"
curl -s -X PUT "http://127.0.0.1:8081/instance/restart/jocley-grill" -H "apikey: $EVO_KEY"
# se ficar preso em "connecting" e não evoluir sozinho, é a mesma camada 4 do incidente Thieco 2026-08-05
# (DELETE FROM "Session" no Postgres da própria Evolution, container evolution_postgres) — ver aquela seção antes de tentar
```

**Deploy desta correção — variante `scp` de 3 arquivos (comandos fornecidos ao cliente, execução não confirmada nesta sessão):**
```bash
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/lanchonete-sistema"
scp src/app/api/configuracoes/whatsapp/testar/route.ts root@2.24.93.178:/opt/lanchonete-sistema/src/app/api/configuracoes/whatsapp/testar/route.ts
scp src/lib/evolution-api.ts root@2.24.93.178:/opt/lanchonete-sistema/src/lib/evolution-api.ts
scp src/components/configuracoes/notificacoes-tab.tsx root@2.24.93.178:/opt/lanchonete-sistema/src/components/configuracoes/notificacoes-tab.tsx
ssh root@2.24.93.178 "cd /opt/lanchonete-sistema && docker compose build app && docker compose up -d app"
```
**Atenção — mudanças não commitadas no git local até o fim desta sessão:** mesmo risco já registrado acima ("Variante `scp` de um arquivo único") — a working tree da VPS diverge do histórico git até alguém commitar/enviar essas 3 mudanças localmente. Não rodar `git pull` de rotina na VPS antes de resolver isso, ou o pull pode reportar conflito ou sobrescrever o que foi copiado por `scp`.

### Se o sistema realmente travar em produção e eu não estiver disponível

1. SSH na VPS → `cd /opt/lanchonete-sistema && docker compose ps` — `jocley-lanchonete-app` e `jocley-lanchonete-db` estão "Up"? Se não, `docker compose up -d`.
2. `docker compose logs --tail 100 app` — erro geralmente nas últimas linhas.
3. Erro de banco (`P1001`, "Can't reach database server at db:5432") logo depois de subir → o app tentou conectar antes do Postgres estar pronto; `docker compose restart app` costuma resolver (o `migrate deploy` automático do Dockerfile roda de novo no restart).
4. Confirmar de fora que voltou: `curl -I https://jocleygrill.online` (não a porta direto — `3001`/`5435` estão fechados pro público, só `127.0.0.1`, mesmo padrão do Villa Mill).
5. **Nunca rodar `docker compose down -v`** — apaga o volume nomeado do Postgres com os dados reais de vendas/cardápio. `docker compose down` (sem `-v`) + `up -d` é seguro, recria containers preservando o volume.
6. Se for erro de porta do Postgres não subir (`port is already allocated`), conferir se não é de novo o `lane-confeitaria` disputando — `docker ps -a` mostra quem está com qual porta (ver gotcha de porta acima); não é pra acontecer de novo já que a porta é configurável via `.env`, mas se alguém commitar `docker-compose.yml` com porta fixa de novo (regressão), é o mesmo sintoma.

