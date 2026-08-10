---
status: stable
domain: thieco
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Sistema Thieco

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém comandos, deploy, incidentes e gotchas específicos do Sistema Thieco (`sistema-thieco`). Ver também [[indice-thieco]] e [[Playbook DevOps - Comandos Docker e Bancos]] (comandos gerais + risco do monorepo).

## Sistema Thieco (sistema-thieco) — o que saber pra mexer sem mim

**Mesmo padrão do Villa Mill: duas cópias, mesmos nomes de container.**

| | Local (seu Windows/WSL) | Produção (VPS) |
|---|---|---|
| Caminho | `/mnt/c/Users/Willians DataMeet/Desktop/Ops/orbita-workspace/sistema-thieco` | `/var/www/sistema-thieco` (SSH na VPS, IP `2.24.93.178`) |
| Containers | `thieco_api` (backend, sem porta pro host — só rede interna do Docker), `thieco_web` (frontend, `127.0.0.1:5173`), `thieco_db` (Postgres, `127.0.0.1:5432`) | mesmos nomes, mesma VPS do Villa Mill e do Depósito Lobo — todos isolados entre si, sem rede/volume compartilhado |
| Domínio público | — | `barbeariatl.online` (Nginx do host, fora de container) |
| Repositório | `github.com/willianslegacy94-zion/sistema-thieco` | mesmo — `git push` daqui não chega na VPS sozinho, alguém precisa entrar e fazer o pull/rebuild |

### Deploy na VPS (produção)

Backend e frontend são containers separados — normalmente só um dos dois muda por vez, não precisa rebuildar os dois sempre:
```bash
ssh <usuario>@2.24.93.178
cd /var/www/sistema-thieco
git pull origin main
docker compose build backend && docker compose up -d backend    # só backend mudou
docker compose build frontend && docker compose up -d frontend  # só frontend mudou
docker compose ps                                                # confirma thieco_api, thieco_web, thieco_db "Up (healthy)"
docker compose logs backend --tail=30                             # confirma que migrations rodaram sem erro
```

**As migrations do banco rodam sozinhas todo boot do backend** (`runMigrations()`, chamado em `server.js` antes de `app.listen`) — não existe comando separado de "rodar migration", é automático sempre que o container `thieco_api` sobe. Se aparecer `Erro ao executar migrations` no log, o container entra em loop de restart — ver logs pra achar a query que falhou.

### Rodar uma query ou importar um `.sql` pontual

```bash
docker exec -i thieco_db psql -U postgres -d sistema_thieco < arquivo.sql
docker exec -T thieco_db psql -U postgres -d sistema_thieco -c "SELECT COUNT(*) FROM vendas;"
```
(mesmo princípio já registrado no topo deste documento — `docker exec -i` pra redirecionar arquivo, sem `-i` pra rodar comando único com `-c`)

### Se você estiver no WSL e o comando `docker` não existir

Esse ambiente específico (WSL sem integração Docker Desktop ativa) não tem o binário `docker` direto — só `docker.exe` (o Docker Desktop do Windows, acessível de dentro do WSL). Troque `docker` por `docker.exe` em todos os comandos acima quando isso acontecer. Se nem `docker.exe` responder (erro de pipe/conexão), o Docker Desktop provavelmente não está aberto — abra o app no Windows (ou, via WSL, confira se o processo já está de pé com `tasklist.exe | grep -i "Docker Desktop"` antes de esperar o engine subir, o que leva uns 30-60s depois do processo aparecer).

### Gotcha: symlink local quebrando o build do backend

`backend/data/db` é um symlink pra fora do projeto (`~/.thieco-dev/pgdata`, usado só no modo de desenvolvimento nativo sem Docker — ver `startEmbeddedPostgres()` em `server.js`, só roda quando `NODE_ENV !== 'production'`). Esse symlink quebra o `docker build` no Docker Desktop do Windows com erro `invalid file request data/db`. Já corrigido — `backend/.dockerignore` exclui a pasta `data` do contexto de build — mas se um dia voltar a acontecer (ex.: alguém recriar o symlink), a correção é essa: garantir `data` no `.dockerignore`, não apagar o symlink em si (pode ser dado de dev de outra pessoa).

### Se o sistema realmente travar em produção e eu não estiver disponível

1. SSH na VPS → `docker compose ps` — `thieco_api`, `thieco_web`, `thieco_db` estão "Up (healthy)"? Se não, `docker compose up -d`.
2. `docker compose logs --tail 100 backend` — se for erro de migration, geralmente aparece logo depois de "Executando migrations...".
3. Container do Postgres (`thieco_db`) só parou (não corrompeu) → `docker compose start postgres` resolve na maioria das vezes; os logs mostram "database system was not properly shut down... automatic recovery in progress" seguido de "ready to accept connections" — isso é normal, não é corrupção.
4. Depois de subir o Postgres, o backend pode ter entrado em loop de restart tentando conectar antes do banco estar pronto — `docker compose restart backend` resolve.
5. **Nunca rodar `docker compose down -v` nem excluir o volume do Postgres** — apaga os dados de vendas/gastos históricos (milhares de registros reais, 2024 em diante). `docker compose down` (sem `-v`) e `docker compose up -d` recriam os containers preservando o volume nomeado.
6. Confirmar de fora que voltou: abrir `barbeariatl.online` no navegador.

### O que aprender/consultar por conta própria, sem depender de IA

- **SQL básico de leitura** (`SELECT ... WHERE ... AND/OR`, `JOIN`, `GROUP BY`) — dá pra investigar praticamente qualquer dúvida de dado (faturamento errado, venda sumida, comissão estranha) direto no `psql` sem precisar de ninguém, usando os comandos de conexão acima.
- **Diferença entre `docker compose build` (recompila a imagem a partir do código) e `docker compose up -d` (só sobe o que já está construído)** — rodar só o segundo depois de mudar código não aplica a mudança; é preciso os dois, nessa ordem, sempre que o backend ou frontend mudar.
- **Onde ficam as regras de negócio** — praticamente toda regra de comissão, taxa e cálculo financeiro mora em `backend/routes/` e `backend/services/financeiro.js`, nunca no frontend. Se um número parecer errado, o lugar certo pra olhar primeiro é a rota correspondente, não a tela.
- **Nunca rodar comando destrutivo (`DROP`, `DELETE` sem `WHERE`, `docker volume rm`) sem confirmar duas vezes o que vai ser afetado** — o banco de produção tem histórico real de vendas desde 2024, sem backup automático fora do volume Docker.

### Gatilhos, notificações e campanhas — como testar/depurar sem mim (desde 2026-07-12)

O sistema tem hoje 6 mecanismos que **só enfileiram** mensagem numa tabela (`notificacoes`) — nenhum envia WhatsApp/e-mail de verdade ainda (falta a integração externa, ver `orbita-horizon`/`orbita-cortex`). Se um cliente "não recebeu a mensagem", o primeiro passo é sempre confirmar se ela pelo menos **foi gerada** — 90% das vezes o problema é um dos itens abaixo, não um bug.

**Configuração que precisa estar preenchida, senão o gatilho fica mudo mesmo ativado:**
- Configurações → cadastro do administrador: telefone/e-mail preenchidos e o canal correspondente ligado (senão nenhuma notificação administrativa sai, mesmo configurada).
- Configurações → remetente WhatsApp por unidade: opcional, só afeta qual número aparece como remetente na mensagem — não bloqueia o disparo se ficar vazio.
- Configurações → link de avaliação (Google Meu Negócio) por unidade: **obrigatório** pro gatilho "Pedido de avaliação" — sem link preenchido, a unidade simplesmente não dispara nada (silencioso, por design, não é erro).

**Ver o que está na fila de disparo, sem esperar o timer:**

> `<SENHA_ADMIN>` nos comandos abaixo é a senha do usuário `thieco` — está nos seeds em `backend/models.js` (repo privado `sistema-thieco`). Nunca colar o valor real aqui: este repo é **público**.

```bash
# pega um token de admin (login normal) e chama o endpoint autenticado
docker.exe compose exec backend node -e "
fetch('http://localhost:3001/auth/login', {method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({username:'thieco', senha:'<SENHA_ADMIN>'})})
  .then(r=>r.json()).then(({token}) =>
    fetch('http://localhost:3001/notificacoes/whatsapp/pendentes', {headers:{Authorization:'Bearer '+token}})
      .then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2))));
"
```
Ou direto no banco (mais rápido pra só olhar):
```bash
docker exec -T thieco_db psql -U postgres -d sistema_thieco -c \
  "SELECT id, tipo, titulo, canal, created_at FROM notificacoes WHERE canal IN ('whatsapp','email') ORDER BY created_at DESC LIMIT 20;"
```

**Forçar um gatilho a rodar agora, sem esperar o timer** (útil pra confirmar que uma configuração nova está funcionando):
```bash
docker.exe compose exec backend node -e "
require('./routes/notificacoes').gerarGatilhoAniversariante().then(n => console.log('criados:', n));
"
# troca o nome da função: gerarGatilhoClienteSumido, gerarGatilhoAvaliacaoPosVenda,
# verificarNotificacoesConfiguradas — todas em backend/routes/notificacoes.js
```

**Por que uma mensagem esperada não apareceu:**
- **Cooldown de 14 dias:** nenhum cliente recebe mais de uma mensagem de marketing (aniversariante/cliente sumido/promoção/avaliação) nesse intervalo, mesmo se ele bater em mais de um gatilho. Checar: `SELECT * FROM notificacoes WHERE tipo IN ('aniversariante_cliente','cliente_sumido','promocao','avaliacao_pos_venda') AND (meta->>'cliente_id')::int = <id> ORDER BY created_at DESC;` — se tiver algo nos últimos 14 dias, é isso.
- **Pedido de avaliação:** só dispara 5 minutos depois da última linha da venda daquele atendimento (evita mandar no meio de uma comanda ainda sendo montada) — se testou e rodou na hora, é esperado não aparecer ainda.
- **Cliente sem telefone cadastrado:** todos os gatilhos pulam silenciosamente cliente sem `contato` preenchido.
- **Horário de disparo:** aniversariante/cliente sumido/notificações admin só avaliam a condição depois do horário configurado (não é "assim que a condição bate", é "na próxima checagem depois do horário").

**Timers ativos** (`backend/server.js`): a cada 5min roda lembrete de agendamento + pedido de avaliação pós-venda; a cada 15min roda notificações administrativas + aniversariante + cliente sumido. Promoções (aba Promoções) é sempre manual, sem timer.

### Atualização (2026-07-28) — WhatsApp já dispara de verdade pro admin, e desconectar não precisa mais do modal

Desde 12/07 os 6 gatilhos já enfileiravam; a partir daqui, dois deles passaram a **efetivamente sair no WhatsApp**, não só ficar na fila:

- **Relatório periódico/sob demanda do admin** — já saía via Cortex.
- **Alertas do sistema (estoque baixo/zerado, meta em risco)** — novo (`d33cff7`). Antes só apareciam no sininho (🔔) do painel; agora, todo `POST /notificacoes/gerar` que encontrar alerta **genuinamente novo** (condição que não existia na chamada anterior — reabastecer estoque ou sair do risco de meta "reseta" isso) manda **uma única mensagem consolidada** pro WhatsApp do admin, com todos os alertas novos daquela chamada juntos (não um disparo por alerta). Ranking semanal fica de fora de propósito — é FYI periódico, não alerta urgente.
  - Se um alerta esperado não chegou no WhatsApp (mas apareceu no sininho): confirmar que o admin tem `notif_canal_whatsapp = true` **e** `telefone` preenchido em Configurações → cadastro do administrador — sem os dois, a função nem tenta notificar (`backend/routes/notificacoes.js:846`).
  - Testar sem esperar a condição real acontecer: zerar manualmente o estoque de um item de teste, ou rodar o gatilho de alertas na mão:
    ```bash
    docker.exe compose exec backend node -e "
    fetch('http://localhost:3001/auth/login', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:'thieco', senha:'<SENHA_ADMIN>'})})
      .then(r=>r.json()).then(({token}) =>
        fetch('http://localhost:3001/notificacoes/gerar', {method:'POST', headers:{Authorization:'Bearer '+token}})
          .then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2))));
    "
    # resposta { geradas: N, notificado_admin: true/false } — false quer dizer
    # que não tinha alerta NOVO nessa chamada (não é erro) ou que faltou
    # telefone/canal habilitado no cadastro do admin
    ```

- **Contrato do Cortex mudou** (`7c80eff`, efeito colateral de o Cortex ter passado a atender também o produto Kernel — o mesmo container agora serve os dois sistemas, então uma mudança de contrato num afeta o outro): `notificarAdminViaCortex` (`backend/routes/notificacoes.js:46`) agora manda `instancia: 'thieco-admin'` direto no payload pro endpoint `POST {CORTEX_URL}/api/v1/cortex/notificar-admin`, em vez do `tenant_id` resolvido contra um dicionário fixo dentro do Cortex. Mesmo destino real, comportamento idêntico pro thieco — só muda se algum dia o Cortex mudar de novo o contrato desse endpoint (aí é aqui que se ajusta, não em nenhum outro lugar).
  - Diagnosticar falha de envio sem entrar no código: `notificado_admin: false` na resposta de `/notificacoes/gerar` com admin corretamente cadastrado normalmente é o **Cortex fora do ar** ou `CORTEX_URL` errado (`.env`, default `http://localhost:5000`) — checar `docker compose logs backend --tail=30 | grep Cortex` (a função nunca lança, só loga e segue).

**Desconectar WhatsApp não precisa mais abrir o modal do QR Code** (`74b0d21`). Na tela Configurações, o card de remetente WhatsApp agora busca o status de cada canal (`GET /whatsapp/:canal/status`, tambore/mutinga/admin) assim que a tela carrega e troca o botão sozinho:
- Canal **conectado** → botão vermelho "Desconectar" aparece direto no card (sem abrir nada) → `POST /whatsapp/:canal/desconectar` encerra a sessão na Evolution API e libera o canal pra parear outro número.
- Canal **sem número pareado** → botão "QR Code" (comportamento de sempre, abre o modal).

Pra fazer isso manualmente sem abrir a tela (ex: automação, ou UI fora do ar):
```bash
# ver status de um canal (tambore | mutinga | admin)
docker exec -T thieco_db psql -U postgres -d sistema_thieco -c \
  "SELECT chave, valor FROM configuracoes WHERE chave LIKE 'whatsapp_remetente_%';"
# ou via API (precisa token de admin, mesmo padrão de login usado acima):
#   GET /whatsapp/<canal>/status  → { conectado, conectando, numero }
#   POST /whatsapp/<canal>/desconectar
```
Desconectar **não apaga histórico de conversa nem configuração de remetente** — só derruba a sessão pareada na Evolution; atendimento automático daquele canal para até alguém escanear um QR Code novo.

### Atualização (2026-08-04) — o "contrato idêntico" do Cortex (item acima) estava errado na prática + os 3 canais WhatsApp ficaram desconectados 1 semana

A entrada de 2026-07-28 acima disse que a mudança de contrato do Cortex (`instancia` em vez de `tenant_id`) tinha "comportamento idêntico pro thieco". Isso valia pro **código**, mas o deploy do lado do Cortex nunca aconteceu de verdade — o container na VPS continuou rodando a versão antiga (`PayloadNotificarAdmin` ainda exigindo `tenant_id`), então toda chamada de `notificar-admin` vinda do thieco (que já mandava `instancia`) falhava com **HTTP 422** desde 28/07 — quase uma semana de notificação administrativa (faturamento/ranking/estoque, alertas de sistema) silenciosamente não entregue. `notificado_admin: false` nunca foi investigado a fundo até um relato do Willians em 04/08.

**Causa raiz real, em camadas (achadas em ordem, cada uma escondendo a próxima):**
1. Contrato desalinhado (acima) → corrigido, commit `34abea5` no `orbita-workspace` (`orbita-cortex/main.py`).
2. Depois de corrigir o 422, a Evolution API passou a devolver **HTTP 400** (`Cannot read properties of undefined (reading 'id')`, erro típico de sessão Baileys quebrada).
3. Investigando o 400: **os 3 canais Evolution API (`thieco-admin`, `thieco-mutinga`, `thieco-tambore`) estavam com `connectionStatus: "connecting"` desde 28/07/2026** — Willians tinha usado o botão "Desconectar" (item acima, `74b0d21`) nos 3 canais pra testar com o número pessoal dele, e nenhum reconectou depois. `thieco-tambore` nunca teve `ownerJid` — nunca chegou a ser pareado de verdade. **Impacto real: o atendimento automático do Theo (Quasar) pode ter ficado fora do ar pra cliente de Mutinga e Tamboré a semana inteira**, não só a notificação do admin.

**Descoberta importante sobre o deploy do Cortex/Quasar na VPS — não usa git:**
```
/var/www/orbita-agents/cortex   (container orbita_cortex)
/var/www/orbita-agents/quasar   (container orbita_quasar)
/var/www/orbita-agents/.env     (compartilhado pelos dois)
```
Diferente do sistema-thieco/vilamill (que são `git clone` de verdade), essas duas pastas **não têm `.git`** — foram deployadas por cópia manual de arquivo em algum momento. `git pull` falha com `fatal: not a git repository`. Até isso ser convertido pra um clone de verdade (pendência em aberto, não fazer sozinho sem combinar com o Willians — mexe em como o deploy funciona), atualizar código lá é: editar o arquivo direto na VPS (por exemplo com um patch Python de substituição exata, mais seguro que `sed` pra trecho multi-linha) e rodar `docker compose up -d --build <serviço>`.

**Achar o diretório certo de um agente, sem adivinhar:**
```bash
docker inspect orbita_cortex --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
docker inspect orbita_quasar --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

**Checar status de conexão de um canal Evolution API direto pela API** (mais confiável que confiar só no botão da tela, que pode estar com cache):
```bash
EVO_KEY=$(docker exec thieco_api sh -c 'echo $EVOLUTION_API_KEY')
for canal in thieco-admin thieco-mutinga thieco-tambore; do
  echo "== $canal =="
  curl -s "http://127.0.0.1:8081/instance/fetchInstances?instanceName=$canal" \
    -H "apikey: $EVO_KEY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d[0].get('connectionStatus') if d else 'nao encontrada', '| owner:', d[0].get('ownerJid') if d else None)
"
done
```
Todos devem mostrar `open` quando pareados de verdade — `connecting` parado (não evolui pra `open` nem `close`) é sessão quebrada, precisa desconectar de novo (força limpar) e reconectar com QR novo.

**Reenviar manualmente uma notificação que ficou marcada `enviado_whatsapp=false`** (só depois de confirmar que o canal admin está `open` — senão vai falhar de novo):
```bash
docker exec thieco_db psql -U postgres -d sistema_thieco -t -A -c "
  SELECT row_to_json(t) FROM (
    SELECT id, tipo, titulo, mensagem, meta->>'telefone_destino' AS telefone
    FROM notificacoes WHERE canal='whatsapp' AND enviado_whatsapp=false
    ORDER BY id DESC LIMIT 5
  ) t;
"
# pra cada linha, POST manual:
curl -s -X POST http://127.0.0.1:5000/api/v1/cortex/notificar-admin \
  -H "Content-Type: application/json" \
  -d '{"instancia":"thieco-admin","telefone":"<telefone>","mensagem":"<mensagem>"}'
# se vier {"status":"ok"}, marca como enviado:
docker exec thieco_db psql -U postgres -d sistema_thieco -c \
  "UPDATE notificacoes SET enviado_whatsapp=true WHERE id=<id>;"
```
Cuidado com notificação **antiga** (relatório de dias atrás, alerta de transbordo de uma semana atrás) — reenviar dado desatualizado é pior que não reenviar; só vale a pena reenviar o registro mais recente de cada `tipo`, e nem sempre vale reenviar mesmo esse (avaliar caso a caso).

**Colar comando multi-linha com acento/travessão neste terminal da VPS corrompe às vezes** (perde trecho no meio, mistura linhas) — se acontecer, criar o script num `cat > arquivo <<'EOF' ... EOF` primeiro, conferir com `wc -l arquivo` (comparar contra o número de linhas esperado) **antes** de executar, só depois rodar o arquivo separado. Colar tudo de uma vez (criação + execução no mesmo bloco) piora o risco.

**Base de conhecimento do Theo (Quasar) — onde fica e como editar:** `orbita-quasar/database.py`, constantes `FAQ_THIECO_COMUM` (regras comuns às duas unidades) / `FAQ_THIECO_MUTINGA` / `FAQ_THIECO_TAMBORE` (dados por unidade — endereço, equipe, tabela de preços). É texto fixo em Python, sincronizado pro SQLite (`tenants_config`) toda vez que o container sobe (`init_quasar_db()`, chamado em `main.py` na importação do módulo) — editar o `.py` e reconstruir o container já basta, não precisa mexer no banco à parte. Preços conferidos contra o catálogo real de produção em 2026-08-04 batiam 100% (não é isso que causa informação errada, se o Theo errar de novo, investigar outra parte do FAQ). Regra nova adicionada nesta data: **nunca arredondar preço** (vários combos têm centavos quebrados — R$ 69,13, R$ 88,88, R$ 138,25 — e o modelo tende a arredondar numa resposta falada).

### Atualização (2026-08-05) — mesmo incidente de novo, em escala maior: causa raiz real era compartilhamento de número entre instâncias + a instância travada tem uma camada mais funda do que "reconectar com QR novo" + alerta Telegram implementado

A entrada de 2026-08-04 acima já tinha achado 3 canais travados (`thieco-admin`, `thieco-mutinga`, `thieco-tambore`) e atribuído a "Willians desconectou pra testar com número pessoal". No dia seguinte o mesmo padrão apareceu em escala maior: **5 das 6 instâncias da VPS** (`thieco-admin`, `academia-sandro-admin`, `jocley-grill`, `lane_confeitaria`, `thieco-mutinga`) com `connectionStatus: "connecting"` + `disconnectionReasonCode: 401`.

**Causa raiz real (não tinha sido nomeada explicitamente antes):** dois números pessoais/teste de Willians estavam vinculados a múltiplas instâncias simultaneamente —
```
5511954079335 → thieco-admin, academia-sandro-admin
5511948455946 → jocley-grill, lane_confeitaria, thieco-mutinga
```
WhatsApp/Baileys não permite o mesmo número ser sessão primária de duas instâncias Evolution ao mesmo tempo — escanear um número já vinculado em outra instância derruba (401) a sessão anterior, e o efeito cascateia por todas as instâncias que compartilham aquele número. **Regra daqui pra frente: 1 número dedicado real por instância, sempre — nunca escanear número pessoal/teste numa instância de cliente em produção**, nem "só rapidinho". Antes de gerar QR em qualquer instância, checar `fetchInstances` e confirmar que o número não é `ownerJid` de nenhuma outra.

**A instância travada tem 4 camadas possíveis — cada uma resolve só uma parte dos casos, testar em ordem:**

1. `DELETE /instance/logout/{instance}` + `PUT /instance/restart/{instance}` via API — resolve os casos simples.
   ```bash
   curl -s -X DELETE "http://127.0.0.1:8081/instance/logout/$inst" -H "apikey: $EVOLUTION_API_KEY"
   curl -s -X PUT "http://127.0.0.1:8081/instance/restart/$inst" -H "apikey: $EVOLUTION_API_KEY"
   ```
2. `docker restart evolution_api` — resolve loop de reconexão preso em memória, não toca no Postgres.
3. Cache no Redis — na prática **sempre vazio** nesse setup (`docker exec evolution_redis redis-cli KEYS '*{instance}*'`), não é aqui que o Evolution guarda a sessão travada.
4. **A causa raiz de verdade, achada nesta sessão:** a tabela `Session` do Postgres da própria Evolution (não do `sistema_thieco`) — `sessionId` é FK pra `Instance.id`, coluna `creds` guarda a credencial Baileys. O Evolution reautentica sozinho no boot usando essa credencial morta, o que **sobrescreve qualquer `UPDATE` manual em `Instance.connectionStatus`** feito antes do restart. 3 das 5 instâncias deste incidente só resolveram nesta camada:
   ```bash
   # usuário/banco reais (não é "postgres"/"evolution" por padrão — confirmar sempre):
   docker exec evolution_postgres env | grep POSTGRES   # -> POSTGRES_USER=evolution, POSTGRES_DB=evolution

   docker exec -it evolution_postgres psql -U evolution -d evolution -c \
     "DELETE FROM \"Session\" WHERE \"sessionId\" IN (SELECT id FROM \"Instance\" WHERE name IN ('thieco-admin','academia-sandro-admin','thieco-mutinga'));"

   docker exec -it evolution_postgres psql -U evolution -d evolution -c \
     "UPDATE \"Instance\" SET \"connectionStatus\" = 'close' WHERE name IN ('thieco-admin','academia-sandro-admin','thieco-mutinga');"

   docker restart evolution_api
   ```
   Não toca em `Message`/`Contact`/`Chat` — histórico de conversa preservado. Sem credencial na `Session`, o Evolution não tem mais o que tentar reconectar sozinho no boot; assenta em `close` e fica lá até `/instance/connect` ser chamado de propósito.

**Confirmação de que o deploy do Cortex/Quasar continua sem git** (mesma pendência da entrada 2026-08-04, ainda não resolvida): atualizar código lá é `scp` manual a partir do repo local, rodado do terminal LOCAL (não da sessão SSH da VPS — o caminho local não existe lá):
```bash
scp "orbita-workspace/orbita-cortex/main.py" root@2.24.93.178:/var/www/orbita-agents/cortex/main.py
scp "orbita-workspace/orbita-quasar/main.py" root@2.24.93.178:/var/www/orbita-agents/quasar/main.py
# depois, na sessão SSH da VPS:
cd /var/www/orbita-agents/cortex && docker compose up -d --build
cd /var/www/orbita-agents/quasar && docker compose up -d --build
```
`.env` compartilhado (`/var/www/orbita-agents/.env`) tem `OPENROUTER_API_KEY`/`EVOLUTION_API_KEY` **próprios da VPS**, diferentes dos usados em dev local — conferir antes de sobrescrever (`cat` primeiro, nunca `>` direto).

**Gap descoberto durante o diagnóstico, agora corrigido — Cortex e Quasar eram "nunca lança" em falha de envio Evolution, sem alertar ninguém:** `_enviar_resposta_whatsapp` (Quasar) e `notificar_admin`/`webhook_evolution_admin` (Cortex) sempre trataram `resp.ok == False` como só um `print()` no log do container — nenhum retry, nenhum fallback, nenhum alerta. Foi exatamente esse gap que deixou o `thieco-mutinga` uma semana fora do ar (entrada 2026-08-04) sem ninguém perceber. Corrigido: `_alertar_telegram()` adicionado nos dois `main.py`, notifica o bot `@orbita_alertas_bot` no Telegram sempre que um envio falha.

```bash
# variáveis no .env compartilhado (local e VPS):
TELEGRAM_BOT_TOKEN=<token do @BotFather>
TELEGRAM_CHAT_ID=<chat_id de Willians>

# pegar o chat_id (depois de mandar 1 mensagem qualquer pro bot):
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[-1].message.chat.id'

# testar sem esperar incidente real (dispara contra qualquer instância fechada):
curl -s -X POST http://127.0.0.1:5000/api/v1/cortex/notificar-admin \
  -H "Content-Type: application/json" \
  -d '{"instancia":"thieco-admin","telefone":"5511954079335","mensagem":"teste de alerta"}'
```
Cooldown de 15min por `instancia` (dict em memória) — sem isso, uma instância fora do ar por horas gera um alerta por mensagem/tentativa. **Ainda não existe retry nem checagem prévia de `connectionStatus` antes de gerar a resposta da IA** — o alerta só avisa Willians pra agir manualmente; o custo de IA de uma tentativa fadada a falhar continua sendo pago até a instância ser reconectada. Detalhe completo em `registro-de-decisoes-cortex.md` (RD-008) e `registro-de-decisoes-quasar.md` (2026-08-05).

### Atualização (2026-08-06/07) — causa raiz real do "Theo não responde": banco parado + colisão de DNS na rede compartilhada (não a sessão WhatsApp) + 4 melhorias no Theo + confirmação de que a VPS `2.24.93.178` é a produção real

**Contexto:** sessão começou com "cadê o Theo, não me respondeu" e terminou revelando um problema de infra mais grave que a sessão WhatsApp, além de corrigir uma suposição errada sobre onde a produção roda de verdade.

**Causa raiz #1 — `thieco_db` parado + `DB_HOST` ambíguo entre projetos:**
`thieco_db` levou um `docker stop` (ou similar) em ~2026-08-05 11:19 e nunca voltou sozinho (fora do padrão `restart: unless-stopped` porque foi parado manualmente). Ao tentar religar, `thieco_api` entrou em crash-loop de ~30h com `password authentication failed for user "postgres"` — **mas a senha estava certa**: o `docker-compose.yml` usava `DB_HOST: postgres` (nome do *service*), e a rede compartilhada `orbita_shared` tem **outro projeto (`kernel`) com um service também chamado `postgres`** — com o container attachado nas duas redes, o DNS resolvia `postgres` pro banco errado (do kernel), daí a "senha errada" (era senha certa, banco errado). Sintoma só aparece quando testado com o container attachado nas DUAS redes ao mesmo tempo — testar isolado numa rede só (`docker run --network thieco_network`) mascarava o bug.

**Correção:** trocar `DB_HOST: postgres` → `DB_HOST: thieco_db` no `docker-compose.yml` (nome do *container*, único no host, nunca ambíguo). Commit `7ed95ef`. **Regra geral pra qualquer produto nessa VPS/rede `orbita_shared`:** sempre usar nome de container pra apontar serviço de outro projeto docker-compose, nunca nome de service — já era assim pro Evolution API/Cortex/Quasar no thieco (comentário no próprio `docker-compose.yml` já avisava disso), só o `DB_HOST` tinha ficado de fora dessa convenção.

**Diagnóstico que expôs o bug (útil de reaproveitar se aparecer de novo em outro projeto):**
```bash
# resolve "postgres" com o container attachado só numa rede (pode mascarar o bug)
docker run --rm --network thieco_network postgres:16-alpine getent hosts postgres

# resolve com as DUAS redes attachadas, igual o container real — reproduz de verdade
docker run -d --rm --name dns_probe --network thieco_network postgres:16-alpine sleep 60
docker network connect orbita_shared dns_probe
docker exec dns_probe getent hosts postgres   # se devolver IP de OUTRO projeto, é isso
docker rm -f dns_probe
```

**Causa raiz #2 — descoberta ao mexer em SEO, revelou que "desktop é produção" estava errado:** um pedido separado (corrigir a meta description da página de login, que o Google estava indexando com o texto cru do formulário) levou à leitura deste próprio Playbook — e ele documenta que a produção real do sistema-thieco é a **VPS `2.24.93.178`** (`ssh root@2.24.93.178`, `/var/www/sistema-thieco`, `barbeariatl.online`), não o desktop local. Toda a investigação/fix do banco acima tinha sido feita e testada só no desktop — precisou ser replicada manualmente na VPS depois (git pull + rebuild) pra valer pra clientes de verdade. Ver [[topologia-producao-real-vps]] (memória do Claude) pro mapa completo de qual produto usa git/scp/rsync na VPS — vale a pena promover esse mapa pra dentro deste Playbook também, ainda não foi feito.

**Autenticação do `git pull` na VPS também precisou de ajuste:** GitHub não aceita mais senha por HTTPS pra operações git — a VPS estava tentando `git pull` com usuário/senha e recebendo "Password authentication is not supported". Resolvido com **Deploy Key SSH** (read-only, específica por repo, mais segura que Personal Access Token pra um servidor que só faz `pull`):
```bash
# na VPS, dentro do repo
ssh-keygen -t ed25519 -C "sistema-thieco-deploy" -f ~/.ssh/id_ed25519_thieco -N ""
cat ~/.ssh/id_ed25519_thieco.pub   # copiar a saída

# cadastrar no GitHub (via gh CLI, do desktop — mais rápido que a UI web):
gh repo deploy-key add <arquivo.pub> --title "systems-server" --repo willianslegacy94-zion/sistema-thieco
gh repo deploy-key list --repo willianslegacy94-zion/sistema-thieco   # confirma

# na VPS, ~/.ssh/config
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_thieco
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

cd /var/www/sistema-thieco
git remote set-url origin git@github.com:willianslegacy94-zion/sistema-thieco.git
ssh -T git@github.com   # deve responder "Hi .../sistema-thieco! You've successfully authenticated..."
git pull origin main
```
**Pegadinha real dessa sessão:** rodar `ssh-keygen` sem confirmar depois se o arquivo foi criado no caminho certo — a primeira tentativa "sumiu" (comando não persistiu o arquivo em `/root/.ssh/`, por motivo não identificado), só descobrimos com `ls -la ~/.ssh/` mostrando que o arquivo não existia. **Sempre conferir com `ls -la ~/.ssh/` depois do `ssh-keygen`, antes de cadastrar a chave pública em qualquer lugar** — cadastrar uma chave que não bate com nenhum arquivo real trava tudo silenciosamente (erro só aparece depois, no `ssh -T`, como "no such identity").

**Deploy de código na VPS sem acesso SSH direto da ferramenta de IA:** nem toda sessão/ferramenta tem a credencial SSH da VPS (senha ou chave autorizada) — quando for esse o caso, o padrão que funcionou foi: preparar os arquivos já corrigidos num caminho local acessível (`/mnt/c/...`), e o Willians roda `scp`/`ssh root@2.24.93.178 "comando"` ele mesmo, do terminal dele. Comando remoto de uma linha (sem precisar abrir sessão interativa separada):
```bash
scp "/mnt/c/.../arquivo.py" root@2.24.93.178:/caminho/no/servidor/arquivo.py
ssh root@2.24.93.178 "cd /caminho && docker compose up -d --build"
```

**4 melhorias no Theo (Quasar) nesta sessão, já commitadas (`orbita-workspace`, `main.py`/`database.py`) e replicadas na VPS (`scp` pro caminho sem git, ver seção Cortex/Quasar acima) — confirmadas ao vivo em produção depois do deploy:**
1. Saudação sem "digital", e agora **com o nome do cliente** antes do "!" (`"Boa tarde Aline! Aqui é o Theo..."`) — só quando o WhatsApp manda um `pushName` real, senão cai na saudação genérica.
2. Horário de funcionamento passou a ser **específico por unidade** (Mutinga: Seg-Sex 9h-20h, Sáb 9h-19h · Tamboré: Seg-Sex 9h-19h, Sáb 9h-17h) — antes as duas compartilhavam o mesmo bloco (com o horário certo só pra Mutinga).
3. **Preço de serviço/combo passou a ser consultado em tempo real** (`calcular_total_servicos`, chama `GET /agendamentos/servicos` do sistema-thieco de verdade) em vez da tabela estática do FAQ, que já estava desatualizada (ex.: Combo Corte+Barba real é R$80,00, tabela dizia R$79,00) — tabela virou só fallback pra quando a API estiver fora do ar. Soma de múltiplos serviços também é calculada por código (match de substring contra o catálogo real), não pelo modelo de cabeça.
4. Nova ferramenta `manter_silencio_mesmo_assunto` — depois de escalar um assunto pro humano (`acionar_atendimento_humano`), o Theo não insiste no MESMO assunto se o cliente mandar outra mensagem sobre ele, mas continua respondendo normalmente se for assunto diferente (diferente do silêncio de conversa inteira que a Lane já tinha). Mensagem de transbordo também mudou pra não citar "Thieco"/"gerente" nominalmente, só "o responsável". E regra nova de concordância verbal (erro real observado: "Avalia corte" → "Quer avaliar corte").

**Trabalho da Lane Confeitaria (topo simples/3D, leitura de PDF, alerta Telegram, telemetria de custo) estava pendente sem commit no mesmo `main.py`/`database.py` desde 2026-08-04 — não foi tocado nesta sessão**, ficou isolado dos commits do Theo por pedido explícito do Willians (técnica: reconstruir a versão limpa a partir do último commit + reaplicar só os hunks do produto certo, ver detalhe na memória do Claude se precisar repetir).

**Meta description da página de login corrigida** (`frontend/index.html`) — o Google estava gerando o snippet de busca a partir do texto visível do formulário de login (frase de efeito + labels Usuário/Senha), porque não existia `<meta name="description">`. Adicionada uma descrição profissional. Reindexação pelo Google não é instantânea (dias a semanas) — Search Console permite forçar, se precisar.

### Atualização (2026-08-07, mesma sessão) — 2 correções de tom no Theo (nome completo + repetição), e um gotcha de git: outra sessão comitou/empurrou por baixo

**2 bugs reais achados num print de conversa real (cliente "Thiago Ermão", pushName do WhatsApp "Thiago Leandro"):**
1. **Nome completo em vez de primeiro nome** — o `pushName` do WhatsApp às vezes vem com nome completo; o Theo usava inteiro ("Thiago Leandro"). Corrigido **em código**, não só no prompt — `nome_cliente.split()[0]` logo na entrada de `gerar_resposta_quasar` (produto thieco), antes de o nome ser usado em qualquer lugar. Mais confiável que só pedir pro modelo lembrar disso em toda mensagem da conversa (ele não lembrava).
2. **Repetição de "Nome, tudo bem?" em quase toda resposta** — a regra de tom adicionada na sessão anterior ("cheque com tudo bem? sempre que voltar a falar") foi mal calibrada e o modelo aplicava em TODA mensagem, não só na retomada da conversa. Reescrita pra deixar explícito: nome/saudação aparecem **uma vez só**, no começo; da segunda mensagem em diante vai direto ao assunto.

Commit `7800154` (`orbita-workspace`), replicado na VPS via `scp` (mesmo padrão de sempre, ver seção acima) — confirmado ao vivo reproduzindo a conversa exata do print.

**Gotcha de colaboração via git, útil se acontecer de novo:** entre um commit e outro desta mesma sessão, **outra sessão/processo comitou e deu push** direto no `main` do `orbita-workspace` (`f7ca3bf`, trabalho da Lane Confeitaria que estava pendente desde 04/08) — sem coordenação com esta sessão. O efeito prático: a técnica de "reconstruir a versão limpa a partir do HEAD" (ver entrada anterior) usa um HEAD guardado em cache (scratchpad) que **ficou desatualizado** assim que isso aconteceu — o próximo diff isolado saiu gigante e cheio de conteúdo da Lane que não deveria estar lá, porque a base de comparação (HEAD antigo) já não era mais o HEAD real. **Sinal de alerta:** um diff isolado que deveria ser pequeno (uma ou duas linhas de mudança) aparecendo com centenas de linhas — antes de desconfiar da própria lógica de isolamento, rodar `git log --oneline -5` e comparar com o que se esperava ser o HEAD; se mudou, refazer a base (`git show HEAD:arquivo` de novo) antes de continuar.

