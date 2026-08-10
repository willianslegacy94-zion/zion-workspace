---
status: stable
domain: thieco
source: claude
created: 2026-05-24
updated: 2026-08-07
owner: willians
---

# Configurações de Infraestrutura da VPS

> Referência: [[arquitetura-thieco]] | [[registro-de-decisoes-thieco]]

## Estado atual (desde 2026-07-05)

O sistema-thieco roda na **mesma VPS que hospeda o vilamill-sistema** — consolidação de infraestrutura para reduzir custo, já que os dois sistemas rodam em stacks Docker totalmente isoladas (rede, volume e portas próprias, sem nada compartilhado além do Nginx do host).

- **Provedor:** Hostinger VPS
- **Sistema Operacional:** Ubuntu 24.04 LTS
- **IP:** `2.24.93.178`
- **Diretório do projeto:** `/var/www/sistema-thieco`
- **Domínio:** `barbeariatl.online` (SSL via Let's Encrypt/certbot)
- **Acesso root:** `ssh root@2.24.93.178`

### Isolamento entre sistema-thieco e vilamill-sistema (mesma VPS)

| | sistema-thieco | vilamill-sistema |
|---|---|---|
| Diretório | `/var/www/sistema-thieco` | `/var/www/vilamill-sistema` |
| Container do banco | `thieco_db` | `villamill-db` |
| Volume do banco | `thieco_postgres_data` | `villamill_pgdata` |
| Rede Docker | `thieco_network` | padrão do compose |
| Porta DB no host | `127.0.0.1:5432` | `127.0.0.1:5433` |
| Porta app no host | `127.0.0.1:5173` (frontend) | `127.0.0.1:3000` |
| Domínio | `barbeariatl.online` | `villamill.online` |

Nenhum volume, rede ou container é compartilhado — os bancos nunca se tocam. O único elemento compartilhado é o **Nginx do host** (fora do Docker), que roteia por `server_name` para a porta local correta de cada sistema, e o **Certbot**, que gerencia certificados independentes por domínio.

**Todas as portas (banco e frontend, dos dois sistemas) estão vinculadas a `127.0.0.1`** — nunca expostas diretamente na internet. Só o Nginx do host (que roda fora de container, direto na VPS) fala com eles. Isso inclui uma correção aplicada em 2026-07-05 no próprio `vilamill-sistema`, que antes tinha `villamill-app` (3000) e `villamill-db` (5433) expostos em `0.0.0.0` — corrigido sem perda de dado (backup `pg_dump` tirado antes, container recriado reaproveitando o mesmo volume).

### VPS antiga (descomissionada)

O sistema-thieco rodou de 2026-05 até 2026-07-05 numa VPS Hostinger dedicada (IP `72.60.113.214`, hostname `sistema-thieco`). Migrado para a VPS do villamill por decisão de consolidação de custo. Containers da VPS antiga estão **parados** (`docker compose stop`, dado preservado no volume) — cancelamento da assinatura Hostinger é pendência do usuário, fora do escopo técnico. Ver [[registro-de-decisoes-thieco]] (entrada 2026-07-05) para o histórico completo da migração, incluindo a reconciliação de dados que foi necessária.

---

## Acesso ao banco de dados

```bash
cd /var/www/sistema-thieco

# Sessão interativa psql
docker compose exec postgres psql -U postgres -d sistema_thieco

# Query direta (sem TTY)
docker compose exec postgres psql -U postgres -d sistema_thieco -c "SELECT COUNT(*) FROM vendas;"

# Encerrar sessão interativa
\q
```

> Os nomes dos serviços no `docker-compose.yml` são `postgres`/`backend`/`frontend` (usar com `docker compose exec <serviço>`); os `container_name` são `thieco_db`/`thieco_api`/`thieco_web` (usar com `docker exec <nome>`). Ambos funcionam, mas `docker compose exec` respeita o diretório do projeto automaticamente.

---

## Deploy e atualização de código

```bash
cd /var/www/sistema-thieco
git pull origin main
docker compose up -d --build
docker compose ps   # confirma thieco_db, thieco_api, thieco_web healthy
```

Push para o GitHub é exclusivo do agente `@devops` (ver `.claude/rules/agent-authority.md` no repositório principal) — nunca feito diretamente pelos demais agentes.

**Autenticação do `git pull` na VPS — GitHub não aceita mais senha por HTTPS (2026-08-07):** o remote precisa ser SSH, com uma Deploy Key dedicada (read-only, específica deste repo):
```bash
# na VPS, uma vez só
ssh-keygen -t ed25519 -C "sistema-thieco-deploy" -f ~/.ssh/id_ed25519_thieco -N ""
ls -la ~/.ssh/   # SEMPRE confirmar que o arquivo foi criado antes de seguir — já aconteceu de "sumir"
cat ~/.ssh/id_ed25519_thieco.pub

# cadastrar como Deploy Key no GitHub (via gh CLI, do desktop)
gh repo deploy-key add <arquivo.pub> --title "systems-server" --repo willianslegacy94-zion/sistema-thieco

cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_thieco
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

git remote set-url origin git@github.com:willianslegacy94-zion/sistema-thieco.git
ssh -T git@github.com   # confirma antes do pull
```

### Incidente 2026-08-05/07 — `thieco_db` parado + `DB_HOST` colidindo com outro projeto na rede compartilhada

`thieco_db` parou (~2026-08-05 11:19, shutdown limpo — provável `docker stop` manual) e não voltou sozinho. Na tentativa de religar, `thieco_api` entrou em crash-loop de ~30h com `password authentication failed for user "postgres"` — senha certa, **banco errado**: `docker-compose.yml` usava `DB_HOST: postgres` (nome do *service*), e a rede compartilhada `orbita_shared` tem outro projeto (`kernel`) com um service **também** chamado `postgres`. Com o container attachado nas duas redes, o DNS resolvia `postgres` pro Postgres do kernel, não pro `thieco_db`.

**Corrigido:** `DB_HOST: thieco_db` (nome do *container*, único no host, nunca ambíguo) — commit `7ed95ef`. Mesma convenção que Evolution API/Cortex/Quasar já seguiam (nome de container, não de service) — só o `DB_HOST` tinha ficado de fora.

**Diagnóstico que reproduz o bug** (testar numa rede só mascara — precisa attachar nas duas, igual o container real):
```bash
docker run -d --rm --name dns_probe --network thieco_network postgres:16-alpine sleep 60
docker network connect orbita_shared dns_probe
docker exec dns_probe getent hosts postgres   # IP de outro projeto = bug confirmado
docker rm -f dns_probe
```

**Lição geral pra qualquer novo serviço adicionado à rede `orbita_shared`:** nunca usar nome de *service* do `docker-compose.yml` pra apontar outro projeto — só nome de *container*, que é garantidamente único no host.

### WhatsApp real + IA conversacional em produção (desde 2026-07-25/28)

A pendência de TASK-30 (variáveis de e-mail/WhatsApp na VPS) foi resolvida — não com Meta Cloud API como se cogitava em 2026-07-21, mas com o pivô pra Evolution API self-hosted (ver [[registro-de-decisoes-thieco]] 2026-07-25). Aplicado e testado com mensagem real na VPS:

```
RESEND_API_KEY
EVOLUTION_API_URL, EVOLUTION_API_KEY
INTERNAL_SERVICE_KEY  # compartilhada com Cortex/Quasar
CORTEX_URL, QUASAR_URL
```

- **Evolution API** roda como stack Docker própria na mesma VPS (`evolution_api`/`evolution_postgres`/`evolution_redis`), rede `orbita_shared` compartilhada com o backend do thieco (e, desde 2026-07-28, também com o sistema-orbita-whitelabel — ver [[arquitetura-kernel]]).
- **Órbita Cortex e Órbita Quasar** (microservices Python, fora deste repositório) também rodam na VPS, conectados via `orbita_shared` — não existe mais sessão Baileys local (`backend/data/whatsapp-auth` não é mais usado).
- 3 instâncias Evolution API pareadas de verdade: Mutinga, Tamboré, admin.

### Deploy do Cortex e Quasar — não usa git (descoberto em 2026-08-04)

Diferente do sistema-thieco (seção "Deploy e atualização de código" acima), os diretórios do Cortex e Quasar na VPS **não são clones git**:

```
/var/www/orbita-agents/cortex   (container orbita_cortex)
/var/www/orbita-agents/quasar   (container orbita_quasar)
/var/www/orbita-agents/.env     (variáveis compartilhadas pelos dois)
```

Foram publicados por cópia manual de arquivo em algum momento anterior — não têm `.git`, `git pull` falha com `fatal: not a git repository`. Isso já causou uma vez um fix commitado no repositório (2026-07-28) nunca chegar de fato à VPS, silenciosamente, por quase uma semana (ver [[registro-de-decisoes-thieco]] 2026-08-04). Até isso virar um clone git de verdade (pendência em aberto), atualizar código lá é: patch direto do arquivo (substituição de texto exata via script Python — mais seguro que editar à mão um arquivo de produção) seguido de `docker compose up -d --build <serviço>`.

Achar o diretório certo de um agente sem adivinhar (útil se a estrutura mudar):
```bash
docker inspect orbita_cortex --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
docker inspect orbita_quasar --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

### Diagnóstico de canal WhatsApp (Evolution API) — checar status real, não confiar só na tela

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
`open` = pareado e funcionando. `connecting` que não evolui pra `open` nem `close` é sessão quebrada (ex.: depois de um logout malsucedido) — precisa desconectar de novo (força limpar) e reconectar com QR novo, não só esperar.

---

## Profissionais cadastrados em produção (IDs reais, atualizados em 2026-07-05)

> IDs confirmados via reconciliação pós-migração (backup Hostinger de 29/06 + banco local). E-mails de Thieco e Kauã dos Santos corrigidos nesta data — antes vinham vazios no dump migrado.

| ID | Nome | Unidade | Comissão | E-mail |
|----|------|---------|----------|--------|
| 1  | Thieco Leandro       | tambore | 0%  | thiecobarber@gmail.com |
| 2  | Igor Hidalgo         | mutinga | 40% | ia.hidalgo@hotmail.com |
| 4  | Marcos Fernandes     | mutinga | 40% | *(sem e-mail cadastrado)* |
| 11 | Kauã dos Santos      | mutinga | 40% | Kaka2soares@gmail.com |

> IDs `120` (Kauã Soares), `133` (Willians Santana) e `158` (Willians Dev Barbeiro), citados em versão anterior deste documento, não existem mais no banco de produção atual (eram de uma ramificação de dados anterior à consolidação — ver registro de decisões). Scripts de importação nunca devem hardcodar IDs — sempre resolver por nome via query ao banco de produção.

---

## Importação em lote de dados históricos

**Processo correto** — executar dentro do container `thieco_api`, ou via script `.sql` idempotente montado localmente:

```bash
# Opção 1: script Node.js dentro do container (usa models.js/db.js reais)
docker cp /tmp/importar-standalone.js thieco_api:/app/importar-standalone.js
docker compose exec backend node importar-standalone.js

# Opção 2: script SQL idempotente via stdin (usado na reconciliação de 2026-07-05)
docker compose exec -T postgres psql -U postgres -d sistema_thieco < importar_junho_novo.sql
```

**Regras obrigatórias para scripts de importação:**
1. Resolver `profissional_id` por nome via query ao banco de produção (nunca hardcode — IDs divergem entre ambientes)
2. `valor` = preço de tabela (bruto, ANTES do desconto) — nunca o valor já líquido (ver RN em modelo-de-dados-thieco, campo Venda.valor)
3. `desconto` = abatimento dado, subtraído de `valor` para chegar no líquido
4. Scripts SQL de reconciliação devem começar com `DELETE` do período/unidade afetado antes do `INSERT` — idempotente, seguro rodar mais de uma vez
5. Popular `venda_origem_id` ao agrupar itens da mesma visita (comanda) — omitir infla a contagem de atendimentos

**Histórico de importações relevantes:**
- Maio/2026 (Mutinga): 438 registros — ver registro de decisões (2026-06-02)
- Junho/2026 (Mutinga): 348 registros — ver registro de decisões (2026-07-01, reconciliado em 2026-07-05)
- Junho/2026 (Tambore): 4 registros (dia 28/06, cliente Christopher Dias Santana) — reconciliado em 2026-07-05
