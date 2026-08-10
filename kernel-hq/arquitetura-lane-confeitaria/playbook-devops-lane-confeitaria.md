---
status: stable
domain: lane-confeitaria
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Lane Confeitaria

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém comandos, deploy, incidentes e gotchas específicos do Lane Confeitaria (`lane-confeitaria`). Ver também [[indice-lane-confeitaria]] e [[Playbook DevOps - Comandos Docker e Bancos]] (comandos gerais + risco do monorepo).

## Lane Confeitaria (lane-confeitaria) — o que saber pra mexer sem mim

**Mesmo padrão do Villa Mill/Depósito Lobo/Jocley Grill: repositório Git próprio, nascido em 2026-07-31** — antes disso vivia como pasta solta dentro do `Kernel Workspace`, sem versionamento nenhum. Desde 2026-07-31, tem remote próprio: **`https://github.com/willianslegacy94-zion/lane-confeitaria`** (privado — regras de negócio reais de uma cliente).

**Desde 2026-08-03/04, em produção real na VPS da Holding** (`https://conflane.online`, mesma VPS de vilamill/thieco/academia-sandro/agentes de IA) — deixou de ser "só ambiente local". Ver `docs/architecture/deploy-playbook.md` (dentro do próprio repo) pro runbook operacional completo; aqui vai só o resumo + gotchas descobertos no dia do primeiro deploy real.

| | Local (dev) | Produção (VPS) |
|---|---|---|
| Caminho | `/mnt/c/Users/Willians DataMeet/Desktop/Ops/lane-confeitaria` | `~/lane-confeitaria` (root da VPS) |
| Containers | `lane-confeitaria-db` (Postgres 16, `docker run` avulso, `5437:5432`) | `docker-compose.yml` no repo: `app` (`127.0.0.1:3020`) + `db` (`127.0.0.1:5434`) + `migrate` (one-off) — todos containerizados agora |
| Domínio | `localhost:PORTA` (Next escolhe porta livre) | `conflane.online`/`www.conflane.online`, nginx do host + certbot |
| Stack | Next.js 16 (App Router, Turbopack) + Prisma 7 + PostgreSQL + NextAuth v5 (credentials, campo `email`) + Tailwind v4 + Recharts + SWR | mesma stack, buildada via `Dockerfile` multi-stage |

### Push — sem bloqueio de agente ativo

Não existe (mais?) hook de `PreToolUse` bloqueando `git push` por agente — `.claude/hooks/` está vazio neste repo e `.git/hooks/` só tem os samples padrão do Git. `git push origin main` direto funciona normal. Se um dia essa proteção reaparecer, checar `.claude/hooks/` antes de assumir que o comando simples ainda funciona.

### Rodar local

```bash
# 1. Banco (só precisa rodar uma vez — se o container já existir, só `docker start lane-confeitaria-db`)
docker run -d --name lane-confeitaria-db \
  -e POSTGRES_USER=lane -e POSTGRES_PASSWORD=<SENHA_DB_LOCAL> -e POSTGRES_DB=lane_confeitaria \
  -p 5437:5432 postgres:16

# 2. Schema + seed (primeira vez ou depois de mudar prisma/schema.prisma)
cd "/mnt/c/Users/Willians DataMeet/Desktop/Ops/lane-confeitaria"
npx prisma migrate dev --name init   # ou um nome descritivo da mudança
npm run db:seed                      # popula 44 sabores de bolo + 12 docinhos + usuário inicial + config padrão

# 3. App
npm run dev
```

Login de teste (`prisma/seed.ts`, senha padrão na constante `SENHA_PADRAO` fixa no código — ver o valor no repo privado `lane-confeitaria`, não replicar aqui: este repo é **público**; `<SENHA_DB_LOCAL>` acima é a mesma ideia, está no `.env` local — o e-mail vem de `ADMIN_EMAIL` do `.env`, então **muda por ambiente**, não decore um valor fixo): local usa o placeholder do `.env.example` (`lane@confeitaria.local`), produção usa `lane@conflane.online` (`.env` real da VPS). Confundir os dois dá `CredentialsSignin` (usuário não existe) — já aconteceu, custou um ciclo de debug inteiro achando que era bug de auth quando era só e-mail errado.

**Porta 3000 quase sempre está ocupada** neste workspace (Villa Mill, academia-sandro, etc. disputam ela) — o Next sobe sozinho na próxima porta livre (`3001`, `3002`...). **Isso quebra o login se `NEXTAUTH_URL` no `.env` não bater com a porta real** — sintoma é `POST /api/auth/callback/credentials` voltando `302` pra `/login?error=MissingCSRF` mesmo com usuário/senha certos. Corrigir `NEXTAUTH_URL` pra porta que o terminal mostrou ao subir (`⚠ Port 3000 is in use... using available port XXXX instead`) e reiniciar o `next dev` (variável de ambiente não é pega a quente). Classe de bug recorrente neste workspace — vários projetos competem pela porta 3000 ao mesmo tempo, e qualquer app que resolva a URL de callback a partir de uma variável de ambiente fixa (não da porta real) cai nesse mesmo sintoma.

### Gotchas deste projeto especificamente

- **Next.js 16 renomeou "Middleware" pra "Proxy"** — o arquivo que protege rotas autenticadas é `src/proxy.ts` (export nomeado `proxy`), não `middleware.ts`/`default`. Breaking change da versão, não bug deste projeto — confirmar em `node_modules/next/dist/docs/` antes de assumir bug depois de update do Next.
- **Prisma 7 não aceita mais `url` dentro do bloco `datasource` do `schema.prisma`** — a connection string vem de `prisma.config.ts` (`defineConfig({ datasource: { url: process.env.DATABASE_URL } })`) na raiz do projeto. Sem esse arquivo, `prisma generate`/`migrate` falha com `P1012` (`the datasource property 'url' is no longer supported in schema files`).
- **Bug de segurança encontrado e corrigido no dia da criação:** a primeira versão de `src/auth.ts` não tinha o callback `authorized`. Sem ele, `src/proxy.ts` anexa a sessão ao request mas **não bloqueia** rota sem login — confirmado testando `/dashboard` sem cookie de sessão e recebendo `200` em vez de redirect. Corrigido adicionando `callbacks.authorized` (redireciona pra `/login?callbackUrl=...` quando `auth.user` é nulo). **Sempre testar rota nova com `curl` sem cookie depois de mexer em auth/proxy** — é a única forma confiável de confirmar que o bloqueio está mesmo ativo, em vez de assumir pelo comportamento do browser (que pode estar reaproveitando sessão antiga em cache).
- **Limite de filas do CRM (kanban) e limite diário de bolos na Agenda são propositalmente diferentes na UI:** o limite de filas (padrão 7) nunca aparece como mensagem de erro — o botão "+ nova fila" só some quando atingido, sem avisar que existe um limite (`ConfiguracaoSistema.limiteFilas`). Já o limite diário de bolos (padrão 5) é mostrado abertamente no calendário da Agenda (`N/limite`, dia "cheio" destacado). Se um teste ou suporte futuro achar que "a 8ª fila devia dar erro visível", isso não é bug — é decisão de produto documentada em `kernel-hq/arquitetura-lane-confeitaria/requisitos-funcionais-lane-confeitaria.md`.
- **Um pedido só vira agendamento na Agenda ou conta pra receita/CMV se a fila em que ele está tiver o flag certo marcado** — `Fila.disparaAgendamento` (gera `Agendamento` ao entrar na fila) e `Fila.contaComoConcluido` (conta como venda concluída pro financeiro/CMV/ranking/clientes recorrentes). Como as filas do kanban têm nome livre (a usuária escolhe), não existe convenção automática de qual fila é "produção confirmada" ou "concluído" — os dois checkboxes ficam em Configurações → Filas, ao lado de cada fila. Dashboard financeiro zerado com pedidos reais cadastrados quase sempre é isso: nenhuma fila marcada como `contaComoConcluido` ainda.
- **`faixaDePeso` (ranking do dashboard) tem limite inferior de 2.5kg por faixa** — corrigido depois que um teste unitário achou um bolo de 1kg sendo classificado como "5kg" (a versão original só tinha limite superior). Faixas reais: 5kg = 2.5–7.5kg, 10kg = 7.5–12.5kg, 15kg = 12.5–17.5kg, fora disso cai em "outros".
- **CMV mostra "custo não calculado", nunca `R$ 0,00`, quando um sabor não tem insumo associado em Financeiro → Insumos** — proposital, pra não sugerir que um sabor sem custo cadastrado é 100% lucro. Se um sabor sempre aparece com badge de "custo não calculado" mesmo depois de cadastrar insumo, checar se a associação foi salva em `ReceitaInsumo` (tela Financeiro → Insumos → selecionar sabor → associar).

### Ainda não existe (pra não perder tempo procurando)

- Seletor de período no dashboard financeiro (fixo no mês atual)

**[2026-08-04] Superado:** botão de marcar sinal/saldo como "pago" — existe desde 2026-08-02 (`PedidoDetalheModal`, abre ao clicar em qualquer card de pedido).

**[2026-08-04] Superado:** `docker-compose.yml` do projeto e deploy em VPS — ambos existem e estão em produção desde 2026-08-03/04 (ver tabela Local/Produção no topo desta seção). A decisão final de plataforma foi VPS+Docker, não Vercel+Neon como o `arquitetura-lane-confeitaria.md` original recomendava — ver `docs/architecture/architecture.md` (no repo) seção "Platform and Infrastructure Choice" pro registro completo da mudança de decisão.

### API interna pro Órbita Quasar (`/api/internal/*`, desde 2026-07-30)

Rotas separadas do login da Lane, pro Quasar consultar/agir no sistema durante uma conversa de WhatsApp (filas, agenda, catálogo, cliente, criar/mover pedido) — protegidas por header `X-Internal-Key` comparado contra `INTERNAL_API_KEY` do `.env`, não por sessão NextAuth. Sem essa variável, todas retornam `503` por padrão.

```bash
# testar rápido se a integração está viva (troca a chave pela do .env real)
curl -H "x-internal-key: $INTERNAL_API_KEY" http://localhost:3002/api/internal/filas
```

**Pré-requisito corrigido nesta mesma sessão, importante se investigar "cliente recorrente não aparece":** `pedidoService.criarPedido` criava um `Cliente` novo em todo pedido — a mesma pessoa comprando 3 vezes virava 3 `Cliente`s, e a contagem de recorrência nunca batia. Corrigido com `clienteService.buscarOuCriarCliente`, que reaproveita o `Cliente` pelo `contato` (telefone) antes de criar um novo. Se um dia essa lógica sumir ou for reescrita sem essa busca, o sintoma volta.

**Mudança em rota interna não aparecendo na resposta:** se você editar um `route.ts` de `/api/internal/*` (ou qualquer rota) e o `curl` continuar devolvendo o formato antigo, é cache do Turbopack, não erro no código — `pkill` o processo do `next dev`, `rm -rf .next/cache`, sobe de novo. Aconteceu de verdade ao adicionar `valorFinal`/`valorSinal` na resposta de `POST /internal/pedidos`.

### Quasar (container local) não alcança este sistema via `host.docker.internal` (WSL2 + Docker Desktop)

Achado integrando o Quasar (`quasar/`) com este sistema: mesmo o Windows enxergando `http://localhost:3002` (confirmado via `Invoke-WebRequest` no PowerShell, `200 OK`), o container do Quasar não alcança esse endereço via `host.docker.internal` — o encaminhamento do WSL2 pro Windows só expõe em `127.0.0.1` do Windows, não nas interfaces que o gateway do Docker Desktop (`192.168.65.254` nesta máquina) realmente enxerga (`connection refused`). A rota IPv6 de `host.docker.internal` dá "network unreachable"; o IP da distro WSL2 direto (`ip addr show eth0`) dá timeout — Docker Desktop isola a rede do container da distro WSL específica.

**Correção (precisa de PowerShell como Administrador no Windows — sessão de IA não tem esse privilégio):**
```powershell
netsh interface portproxy add v4tov4 listenport=3002 listenaddress=0.0.0.0 connectport=3002 connectaddress=<ip-da-distro-wsl2>
# descobrir o <ip-da-distro-wsl2> de dentro do WSL: hostname -I
```
Reversível com `netsh interface portproxy delete v4tov4 listenport=3002 listenaddress=0.0.0.0`.

**Enquanto isso não é feito**, validar as `tools/lane_confeitaria.py` do Quasar rodando Python **fora do container** (no host/WSL, mesma rede do `next dev`) em vez de dentro dele — funciona normalmente, já que o bloqueio é só do container pro host, não do host pra ele mesmo.

### [2026-08-04] Os 3 bugs do primeiro dia real em produção (VPS)

Deploy inicial (2026-08-03) subiu limpo, mas login e integração WhatsApp só funcionaram de fato no dia seguinte, depois de 3 bugs de infra encadeados — nenhum deles aparece em dev local, só atrás do nginx/rede compartilhada da VPS:

1. **Login falhava com `UntrustedHost` (Auth.js)** — rodando atrás de reverse proxy, o Auth.js v5 rejeita o header `Host` por padrão. Fix: `trustHost: true` no `NextAuth({...})` (`src/auth.ts`). Só é seguro porque `NEXTAUTH_URL` já é fixo em produção.
2. **Depois do login funcionar, Server Actions quebravam no browser com "An unexpected response was received from the server"** — o vhost nginx (`/etc/nginx/sites-available/conflane.online`) tinha `proxy_set_header Connection "upgrade";` **hardcoded** (herdado de boilerplate — o app não usa WebSocket nenhum). Isso força `Connection: upgrade` em toda requisição HTTP normal, corrompendo o streaming da resposta de Server Action. Fix: remover as duas linhas (`Upgrade`/`Connection: upgrade`) desse vhost específico, `nginx -t` + `systemctl reload nginx`.
3. **Container `app` respondia via porta publicada do host (127.0.0.1:3020) mas ficava inacessível para outros containers na rede `orbita_shared`** (`connection refused` direto no IP do container) — Docker injeta `HOSTNAME=<container id>` automaticamente em todo container, e o `server.js` standalone do Next.js só cai no fallback `0.0.0.0` quando `HOSTNAME` está ausente (`process.env.HOSTNAME || '0.0.0.0'`, `next/dist/build/utils.js`). Sem isso, o app só escutava no IP resolvido via `/etc/hosts` na rede `default`, nunca na `orbita_shared` — por isso o Quasar não alcançava `/api/internal/*` mesmo com tudo mais certo. Fix: `environment: { HOSTNAME: "0.0.0.0" }` explícito no serviço `app` do `docker-compose.yml`, sobrescrevendo o valor que o Docker injeta.

**Diagnóstico rápido pra bug #3 (reaparecer em outro sistema desta VPS com padrão parecido):**
```bash
docker exec <container-que-deveria-alcancar> python3 -c "
import urllib.request
print(urllib.request.urlopen('http://<nome-do-container-alvo>:<porta>', timeout=5).status)
"
# 'Connection refused' com o nome resolvendo certo (confirmar via
# `docker network inspect <rede> --format '{{range .Containers}}{{.Name}} -> {{.IPv4Address}}{{"\n"}}{{end}}'`)
# é o sintoma — não erro de DNS/rede, é bind incompleto do processo dentro do container alvo.
```

### [2026-08-04] Integração WhatsApp (Mel/Quasar) — configuração ponta a ponta

Arquitetura: `WhatsApp → evolution_api → webhook POST → orbita_quasar → /api/internal/* (lane-confeitaria)`. O Lane Confeitaria nunca recebe webhook diretamente — só expõe API interna que o Quasar consome.

**Registrar o webhook no `evolution_api`** (a doc oficial mostra o body sem wrapper, mas a API real desta instância exige aninhado em `"webhook"` — testado e confirmado):
```bash
curl -X POST "http://127.0.0.1:8081/webhook/set/lane_confeitaria" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"webhook": {"enabled": true, "url": "http://orbita_quasar:5003/webhook/evolution", "events": ["MESSAGES_UPSERT"]}}'

# conferir depois:
curl -s "http://127.0.0.1:8081/webhook/find/lane_confeitaria" -H "apikey: $EVOLUTION_API_KEY"
```

**`orbita_quasar` precisa de duas env vars pra achar o Lane Confeitaria** (`docker-compose.yml` do quasar, serviço `quasar`, bloco `environment`):
```yaml
LANE_CONFEITARIA_API_URL: http://lane-confeitaria-app-1:3000   # nome do container, rede orbita_shared
LANE_CONFEITARIA_INTERNAL_KEY: ${LANE_CONFEITARIA_INTERNAL_KEY} # mesmo valor de INTERNAL_API_KEY do .env do lane-confeitaria
```
Sem elas, `main.py` cai no fallback `http://127.0.0.1:3002` (resquício de quando o Lane Confeitaria rodava fora de container) e a mensagem nunca chega.

**Deploy do `orbita_quasar` na VPS é diferente dos outros sistemas — não é `git pull` direto:** o diretório em produção (`/var/www/orbita-agents/quasar`, confirmar com `docker inspect orbita_quasar --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'`) **não é um repositório git** (`.git` não existe ali) — foi implantado por cópia manual em algum momento. O código-fonte real vive committado no monorepo `zion-workspace` (`quasar/`, mesmo repo do `academia-sandro`), não num repo próprio do quasar. Pra atualizar:
```bash
git clone --depth 1 https://github.com/willianslegacy94-zion/zion-workspace.git /tmp/zion-deploy   # ou 'cd /tmp/zion-deploy && git pull' se já clonado
cp /tmp/zion-deploy/quasar/main.py /var/www/orbita-agents/quasar/main.py    # + outros arquivos que mudaram
cd /var/www/orbita-agents/quasar && docker compose up -d --build
```
`.env` e `docker-compose.yml` locais da VPS não vêm do clone (secrets/config específicos do ambiente) — só código (`main.py`, `database.py`, `tools/*.py`) é copiado por cima.

**Erro `_resolver_origem_cliente` retornando `None` pra `lane_confeitaria` = código do Quasar desatualizado, não bug de rede:** `main.py` tem um atalho pra `instancia == "lane_confeitaria"` que evita a chamada HTTP ao whitelabel. Se os logs mostrarem `falha ao resolver instância 'lane_confeitaria' no whitelabel: ... Connection refused (127.0.0.1:3002)` mesmo com tudo de rede certo, é porque o `main.py` rodando na VPS é uma versão anterior a esse atalho — sintoma de deploy desatualizado (ver acima), não bug novo.

### [2026-08-04] Migration esquecida em produção: `schema.prisma` mudou, migration nunca foi gerada — lição pra qualquer projeto deste workspace

**Sintoma:** `500 Internal Server Error` em `/crm`, depois em `GET /api/dashboard/ranking-peso`, depois criação de pedido "não fazendo nada" — três sintomas aparentemente sem relação, mesma causa raiz. Em produção o Next.js esconde a mensagem real do erro (só mostra um digest), então cada sintoma pareceu um bug novo até investigar o log/schema de verdade.

**Causa:** `Pedido.comprovanteParaValidar`/`resumoComprovante` foram adicionados ao `schema.prisma` numa sessão anterior (2026-08-02, integração de confirmação de pagamento por foto), mas **nenhuma migration foi gerada** pra essas colunas — o ambiente que fez a mudança não tinha acesso a um Postgres real (sandbox sem Docker), então só rodou `prisma generate` (que só lê o `schema.prisma`, nunca toca o banco). O Prisma Client ficou "sabendo" das colunas novas; o banco real (dev e produção) nunca as ganhou. Como nenhuma query nessas rotas usa `select` explícito, qualquer leitura de `pedidos` tentava buscar uma coluna inexistente e quebrava.

**Fix:** migration escrita manualmente (`ALTER TABLE pedidos ADD COLUMN ...`) direto na pasta `prisma/migrations/<timestamp>_<nome>/migration.sql`, sem passar por `prisma migrate dev` (que precisa de banco). Aplicada em produção com:
```bash
cd ~/lane-confeitaria
git pull origin main
docker compose build migrate   # obrigatório — "migrate" tem profiles:["tools"], não é reconstruído por `up --build`
docker compose run --rm migrate
```

**Regra geral pra qualquer sistema deste workspace que usa Prisma (não só Lane Confeitaria):** se você mexer no `schema.prisma` num ambiente sem acesso ao banco real, **escreva a migration SQL manualmente e commite junto** — nunca deixe só `prisma generate` rodar e assuma que "depois alguém gera a migration". `prisma migrate dev` sem banco simplesmente não roda; é fácil esquecer que o passo ficou pendente porque o build/typecheck local passa normalmente (o Client já reflete o schema).

### [2026-08-04] Novidades pós-deploy: funil de filas, despesa recorrente, logout, ícone de app (PWA)

Detalhe completo em `kernel-hq-arquitetura-lane-confeitaria/registro-de-decisoes-lane-confeitaria.md` e `modelo-de-dados-lane-confeitaria.md` — aqui só o que muda operacionalmente:

- **Funil de 5 filas replicado em produção** (Novo Cliente → Em negociação → Atendimento humanizado → Agendado → Pago) via script one-off idempotente: `docker compose run --rm migrate npx tsx scripts/seed-filas-funil.ts` (mesmo padrão de imagem usado pro `db:seed`, roda de novo sem duplicar).
- **`Despesa.recorrente`** — migration `20260804060000_despesa_recorrente`, só marcação visual, sem cron/job associado.
- **Botão de logout** — sem infra nova, só Server Action (`signOut`).
- **Ícone de app/PWA** — `favicon.ico`, `apple-icon.tsx`, `manifest.ts`, rotas `icons/192` e `icons/512`. Sem env var nova, sem migration — só `docker compose up -d --build`.

### [2026-08-05] Nova aba "Projeção de ganho" — precisa de migration, sem gotcha de infra novo

Entidade nova `FormaPagamento` (nome + taxa %) — migration `20260805000000_forma_pagamento`. Deploy padrão, mesmo checklist de sempre que uma mudança de schema entra:
```bash
cd ~/lane-confeitaria
git pull origin main
docker compose up -d --build
docker compose build migrate && docker compose run --rm migrate
```
Sem env var nova, sem mudança de rede/porta. Detalhe do que a tela faz em `kernel-hq-arquitetura-lane-confeitaria/registro-de-decisoes-lane-confeitaria.md` (2026-08-05).

**Bug de saudação (`saudacao_por_horario()`, `main.py`):** madrugada (0h-5h59) contava como "Bom dia" (só checava `hora < 12`) — a Mel dizia "Bom dia!" na apresentação fixa e o próprio modelo, percebendo a hora real, complementava com "Boa noite" por conta própria, duas saudações contraditórias na mesma mensagem. Corrigido tratando 0h-5h59 como "Boa noite" + reforço explícito no prompt pra não adicionar outra saudação. Função é compartilhada com o piloto Thieco — o fix vale pros dois.

### [2026-08-05] Mel mandando mensagem em grupo de WhatsApp sozinha — incidente real em produção

**Sintoma:** logo depois de reconectar o WhatsApp da Lane (novo QR code), a Mel saiu respondendo dentro de grupos de WhatsApp em que o número está, sem ninguém ter chamado — confirmado nos logs do `orbita_quasar` (`QUASAR -> respondeu <id-de-grupo> via lane_confeitaria`, IDs no formato `numero-timestamp` ou puramente numérico longo, assinatura de group JID `@g.us`).

**Causa:** dupla ausência de filtro. (1) A instância `lane_confeitaria` na Evolution API nascia com `groupsIgnore: false` — `/instance/create` (`whatsappService.ts`) não configurava esse campo, então toda mensagem de grupo era repassada pro webhook do Quasar como se fosse conversa 1:1. (2) `webhook_evolution` (`main.py`) nunca checava se `key.remoteJid` terminava em `@g.us` — processava qualquer remetente igual.

**Fix (duas camadas, a config sozinha não é suficiente porque se perde se a instância for recriada):**
1. Config imediata na instância já existente (efeito na hora, sem deploy):
   ```bash
   ssh root@2.24.93.178 '
     KEY=$(grep -m1 "^EVOLUTION_API_KEY=" ~/lane-confeitaria/.env | cut -d= -f2- | tr -d "\"")
     curl -s -X POST http://127.0.0.1:8081/settings/set/lane_confeitaria \
       -H "apikey: $KEY" -H "Content-Type: application/json" \
       -d "{\"rejectCall\":false,\"msgCall\":\"\",\"groupsIgnore\":true,\"alwaysOnline\":false,\"readMessages\":false,\"readStatus\":false,\"syncFullHistory\":false}"
   '
   ```
2. `src/server/services/whatsappService.ts` — `groupsIgnore: true` adicionado ao body de `/instance/create`, pra qualquer instância nova já nascer protegida.
3. `quasar/main.py`, `webhook_evolution` — checagem explícita `remote_jid.endswith("@g.us")` logo após o check de `fromMe`, retorna `{"status": "ignorado", "motivo": "mensagem de grupo"}` sem chamar o modelo. Rede de segurança que não depende da config da Evolution API.

Diagnóstico rápido se acontecer de novo em qualquer instância desta VPS: `curl -s http://127.0.0.1:8081/settings/find/<instancia> -H "apikey: $KEY"` — se `groupsIgnore` não vier `true`, é a causa.

### [2026-08-05] Mel só responde sobre o negócio — ferramenta `silenciar_fora_de_escopo` (Lane Confeitaria)

Pedido da cliente: se a mensagem não tiver nenhuma relação com bolo/confeitaria, a Mel deve ficar muda (não é o mesmo comportamento do transbordo normal, que ainda responde "Vou confirmar com a Lane e já retorno") até a Lane assumir manualmente — mesma infra do `acionar_atendimento_humano` (move o card pra fila marcada `disparaAtendimentoHumano`), só que sem nenhum texto de resposta.

**Implementação (`quasar/main.py`):** nova tool `silenciar_fora_de_escopo` (só disponível quando `produto=="lane"`). No loop de tool-calling, se essa tool for chamada, `lane_tool.acionar_atendimento_humano(...)` é acionado e a função retorna `(None, None)` **sem** mais nenhuma rodada de LLM — nunca gera o texto final. A conversa fica muda pro resto do atendimento porque `cliente_em_atendimento_humano` (já existente) passa a barrar a partir da próxima mensagem, sem estado novo do lado do Quasar. Regra de quando usar cada caso documentada em `FAQ_LANE_CONFEITARIA` (`database.py`), seção "MENSAGEM FORA DE ESCOPO".

### [2026-08-05] Mel lê comprovante em PDF, além de foto

Antes, `webhook_evolution` só extraía `imageMessage` — comprovante de Pix mandado como PDF (comum quando exportado direto do app do banco) chegava sem processamento nenhum. Adicionado `_extrair_documento_mensagem` (mesmo padrão de `_extrair_imagem_mensagem`, via `getBase64FromMediaMessage` da Evolution API), só ativo pra `produto=="lane"`. O PDF vira um content block `{"type": "file", "file": {...}}` na chamada à OpenRouter, com `plugins: [{"id": "file-parser", "pdf": {"engine": "pdf-text"}}]` — engine gratuito, só extrai texto real embutido no PDF (não funciona em PDF que é só imagem/scan colado; nesse caso o prompt instrui a Mel a pedir foto em vez do PDF, não existe fallback pra OCR pago por padrão).

### [2026-08-05] Peso mínimo do bolo era 1,5kg, corrigido pra 1kg

Erro de dado, não de lógica — corrigido em 4 lugares que precisam ficar em sincronia manual (não há uma fonte única cadastrável pra isso ainda): `FAQ_LANE_CONFEITARIA`/descrição da tool `registrar_pedido` (`quasar`), `docs/brand/brand-context.md` e o `placeholder` do campo peso em `PedidoForm.tsx` (`lane-confeitaria`). Se o valor mudar de novo, checar os 4.

### [2026-08-05] Modal de detalhes na Agenda + tema do bolo visível no Kanban

- **Agenda (`CalendarioAgenda.tsx`):** clicar numa data abre modal (`DiaAgendaModal.tsx`) com todos os pedidos do dia — cliente, contato, sabores, massa, peso, tema (`modeloReferencia`) e valores. Substituiu o painel inline que só mostrava cliente+sabor+peso. `/api/agenda` (admin) estendido pra devolver esses campos extras (a query Prisma já trazia o `Pedido` completo via `include`, só não estava selecionando os campos no `.map()`).
- **Card do Kanban (`PedidoCard.tsx`):** mostra `modeloReferencia` (🎨) quando preenchido — campo já existia desde a Story 2.3, só nunca tinha sido exposto na leitura.

### [2026-08-05] Etiqueta de atendimento humanizado no card — `motivoAtendimentoHumano`

Pedido: quando a Mel aciona atendimento humano, o card precisa deixar visível **por que** — link de pagamento no cartão (ela não gera esse link) vs caso genérico — sem a Lane precisar abrir a conversa pra descobrir.

**Modelagem:** enum `MotivoAtendimentoHumano { PAGAMENTO_CARTAO GERAL }`, campo `motivoAtendimentoHumano` nullable em `Pedido` **e** `Atendimento` (migration `20260805210553_motivo_atendimento_humano`). Regra importante: `moverPedidoDeFila`/`moverAtendimentoDeFila` **sempre sobrescrevem** esse campo (inclusive pra `null` quando não informado) — assim qualquer movimentação manual do card pela Lane (drag-and-drop, que não passa esse parâmetro) já limpa a etiqueta sozinha, sem precisar de lógica extra de "expiração". `/api/internal/cartoes/[tipo]/[id]/mover` aceita `motivoAtendimentoHumano` no body; o Quasar (`TOOL_TRANSBORDO`, parâmetro opcional `categoria`) só preenche isso quando o próprio negócio (Lane) tem regra clara de quando usar cada valor — documentado em `FAQ_LANE_CONFEITARIA`.

### [2026-08-06] Topo simples vs Topo 3D — preço variável, Mel nunca fecha o 3D sozinha

Regra de negócio real (conversa da Lane com um cliente, print de referência): "topo simples" (preço fixo, ela fecha sozinha) vs "topo 3D" (personalizado, preço "a partir de", varia por design — a Mel só informa o valor de partida e aciona a Lane pra fechar o valor exato).

- **Novo campo cadastrável** `ConfiguracaoSistema.valorTopo3dAPartirDe` (migration `20260806034810_topo_3d_a_partir_de`), tela Configurações → Acréscimos. **Nasce em R$0,00** — sempre configurar o valor real depois de aplicar essa migration em qualquer ambiente novo, senão a Mel fala "a partir de R$0,00".
- `/api/internal/catalogo` passou a incluir `topo: { simplesPreco, tresDAPartirDe }` — preço nunca hardcoded no prompt (mesmo princípio já usado pra sabor).
- Foto de exemplo de "topo simples" servida como asset estático do próprio app (`public/exemplos/topo-simples.jpg`, `https://conflane.online/exemplos/topo-simples.jpg`) — a Mel manda via nova tool `mostrar_exemplo_topo_simples` (sem argumentos; ao ser chamada, seta uma flag interna que `gerar_resposta_quasar` usa pra decidir o `imagem_url` de saída). Isso mudou a assinatura de retorno de `gerar_resposta_quasar` de `str | None` pra `tuple[str | None, str | None]` (texto, imagem_extra) — os dois call sites (`/api/v1/quasar/chat` e `webhook_evolution`) foram atualizados juntos; qualquer novo call site precisa desempacotar a tupla.
- Pra topo 3D: `registrar_pedido` continua sendo chamado normalmente pro resto do pedido (sabor/peso/data), só que **sem** `acrescimo_topper=true` — o valor do topo 3D fica de fora, pendente com a Lane depois do `acionar_atendimento_humano` (categoria `"geral"`).

### [2026-08-07] Antecedência mínima de 3 dias pra pedido (sem contar domingo)

Regra de negócio: cliente precisa pedir com no mínimo 3 dias de antecedência, mas domingo não conta na contagem (a Lane não produz domingo, mas **entrega** normalmente nesse dia — não confundir as duas coisas, "entrega domingo" ficou explicitamente confirmado, não é regra inventada).

**`agendaService.dataMinimaEntrega(hoje)`** — centraliza a conta (soma dias, pula domingo no incremento do contador) pra `proximasDatasComVaga` (o que a Mel enxerga via `consultar_disponibilidade_agenda`) e `criarPedido` nunca divergirem. Duas camadas: (1) `proximasDatasComVaga` já marca dia dentro da janela mínima como `temVaga: false`, então a Mel nunca oferece; (2) `criarPedido` valida de novo no servidor, **só quando `origem === "automatico"`** (canal do Quasar) — pedido manual da Lane (`PedidoForm`) continua livre, ela pode aceitar rush por conta própria. Sem migration — regra pura em código, não em dado.

### [2026-08-07] Bloqueio manual de dia na Agenda — `DiaBloqueado`

Cobre o caso de pedido fechado fora do sistema (telefone, WhatsApp pessoal da Lane) — sem isso, o sistema não sabe que o dia já está cheio e a Mel continua oferecendo. Novo model `DiaBloqueado` (`data` única + `motivo` opcional, migration `20260807130429_dia_bloqueado`), sem vínculo com `Pedido`. Botão "Bloquear"/"Desbloquear" dentro do `DiaAgendaModal.tsx` (mesmo modal da Agenda). Efeito em cascata: `proximasDatasComVaga` trata dia bloqueado igual dia cheio (`temVaga: false`); `agendarProducao` recusa com `DIA_BLOQUEADO` se alguém tentar forçar reserva mesmo assim (mesmo padrão já existente de `DIA_CHEIO`).

### [2026-08-07] Bloqueio manual de número no WhatsApp — `TELEFONES_BLOQUEADOS` (Quasar)

Pedido pontual da Lane: um número específico (`11932791014`) nunca mais deve receber resposta da Mel, seja qual for a mensagem. Implementado direto no `quasar/main.py`, `webhook_evolution` — constante `TELEFONES_BLOQUEADOS` (tupla de sufixos) checada logo depois do check de grupo/`fromMe`, comparando `telefone.endswith(...)` (não depende do prefixo `55` vir ou não no `remoteJid`). Retorna `{"status": "ignorado", "motivo": "número bloqueado manualmente"}` sem chamar o modelo — mesmo padrão do filtro de grupo já documentado acima.

**Descoberta relevante durante esse trabalho, vale registrar aqui porque afeta qualquer sessão futura mexendo em `quasar`:** o `main.py`/`database.py` locais tinham uma quantidade grande de trabalho **pendente de commit havia dias** — categoria de transbordo (pagamento no cartão), topo simples/3D (essa parte já tinha ido pro ar via `scp` antes de virar commit — ver seção de topo 3D acima), alerta no Telegram, ferramenta `silenciar_fora_de_escopo`, telemetria de custo real, e leitura de PDF de comprovante ainda incompleta. Tudo foi commitado (`f7ca3bf`) **exceto** a leitura de PDF (a pedido explícito do usuário, por ainda estar em andamento) — reconstruída manualmente hunk-a-hunk numa cópia à parte pra não misturar os dois. **Confirmado também nessa sessão:** o deploy do `orbita_quasar` em produção não usa git — é sempre `scp` manual do arquivo certo pro caminho `/var/www/orbita-agents/quasar/` + `docker compose up -d --build` (já documentado na seção "Deploy do `orbita_quasar` na VPS é diferente dos outros sistemas" mais abaixo, mas vale reforçar: **nunca dar `scp` direto da working tree sem antes checar `git status`/`git diff`** — pode levar código solto/incompleto pro ar sem querer).

### [2026-08-07/08] Card "Desistência" (Lane Confeitaria) — motivo classificado pela Mel, retenção de 30 dias, e dois incidentes de deploy

Pedido da Lane: um botão no card do Kanban (Pedido **e** Atendimento) pra marcar que o cliente desistiu — mas o motivo (preço/prazo/indisponibilidade) precisa ser **classificado pela própria Mel**, olhando a conversa real, nunca escolhido manualmente pela Lane numa lista. O card some do painel na hora, mas fica visível na aba Clientes por 30 dias antes de sumir de vez.

**Modelagem (`lane-confeitaria`):** enum `MotivoDesistencia { PRECO PRAZO INDISPONIBILIDADE INDEFINIDO }` + campos `desistencia`/`desistenciaMotivo`/`desistenciaEm` em `Pedido` **e** `Atendimento` (migration `20260808000024_desistencia`). `desistencia=true` é **permanente** (tira o card do Kanban pra sempre, `listarPedidosPorFila`/`listarAtendimentosPorFila` filtram por ele) — diferente de `desistenciaMotivo`/`desistenciaEm`, que uma limpeza diária zera depois de 30 dias **sem nunca apagar o Pedido/Atendimento em si** (preserva sabor/valor/histórico financeiro pra sempre). Ver detalhe completo em `modelo-de-dados-lane-confeitaria.md`.

**Integração nova, direção invertida da usual:** até aqui, era sempre o Quasar chamando `/api/internal/*` do Lane Confeitaria. Essa feature inverte — o Lane Confeitaria chama um endpoint novo do Quasar (`POST /api/v1/quasar/classificar-desistencia`, protegido pela mesma `LANE_CONFEITARIA_INTERNAL_KEY` já usada na direção contrária), que busca as últimas mensagens reais da conversa (`gerenciar_memoria`) e pede pro modelo classificar o motivo. Falha de rede/timeout nunca trava a Lane — cai em `INDEFINIDO`.

**Sem Vercel Cron nesse deploy (self-hosted em Docker/VPS)** — a limpeza dos 30 dias é `POST /api/internal/desistencias/limpar`, disparado por um `crontab` comum na VPS (não um serviço do compose). Comando de setup documentado em `docs/architecture/deploy-playbook.md` (dentro do repo `lane-confeitaria`).

**Incidente 1 — sessão concorrente sobrescreveu `main.py`/`database.py` do Quasar:** no meio desse trabalho, uma sessão diferente (mexendo no Theo/`sistema-thieco`, mesmo checkout compartilhado do monorepo `zion-workspace`) usou `Write` pra reescrever esses dois arquivos a partir de uma cópia desatualizada em contexto próprio — apagou, no disco (não no git, que ficou intacto), tudo que tinha sido commitado horas antes (bloqueio de número, topo simples/3D, categoria, Telegram). Detectado comparando `wc -l`/`git diff` do arquivo em disco contra `HEAD` antes de continuar editando; corrigido com `git checkout -- quasar/main.py quasar/database.py`. **Lição pra qualquer sessão de IA span mexendo nesse monorepo compartilhado:** antes de editar `main.py`/`database.py` do Quasar, sempre `git status`/`git diff` primeiro — não confiar que o conteúdo em contexto da própria sessão ainda bate com o disco, principalmente se outra sessão estiver ativa em paralelo.

**Incidente 2 — `docker compose run --rm migrate` reaproveitou imagem em cache, migration não aplicada em produção:** repetição exata da causa-raiz já documentada em `registro-de-decisoes-lane-confeitaria.md` (2026-08-04) — o serviço `migrate` (`profiles: ["tools"]`) **não** é reconstruído automaticamente por `docker compose up -d --build`. O redeploy rodou `git pull && docker compose run --rm migrate && docker compose up -d --build` (migrate **antes** do build) — como não havia build explícito do `migrate` nesse meio, ele reusou a imagem antiga, relatou "9 migrations found... No pending migrations to apply" (a 10ª, `desistencia`, nem existia nessa imagem) e a coluna nova ficou faltando. `/crm` em produção deu `PrismaClientKnownRequestError: column pedidos.desistencia does not exist` por alguns minutos, até o log ser conferido e corrigido com `docker compose build migrate && docker compose run --rm migrate`. **`docs/architecture/deploy-playbook.md` corrigido** pra sempre explicitar `docker compose build migrate` antes do `run`, não deixar implícito — a documentação de 2026-08-04 já sabia disso, só não estava nos comandos copiáveis do playbook do próprio repo, e o erro se repetiu por isso.

**Gotcha de deploy que se repetiu nesta sessão (já documentado acima em 2026-08-04, mas vale reforçar):** rodar `docker compose run --rm migrate` sem `docker compose build migrate` antes reaproveita a imagem `migrate` cacheada de um deploy anterior — Prisma roda contra código desatualizado e reporta `No pending migrations to apply` mesmo com uma migration nova no repo, deixando a tabela `_prisma_migrations` e as colunas reais do banco dessincronizadas (sintoma: `PrismaClientKnownRequestError` / `ColumnNotFound` na tela que usa o campo novo). Sempre `docker compose build migrate && docker compose run --rm migrate`, nessa ordem, nunca só o segundo comando.