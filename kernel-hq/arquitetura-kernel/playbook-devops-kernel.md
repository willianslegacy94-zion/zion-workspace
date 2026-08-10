---
status: stable
domain: kernel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Playbook DevOps — Orbita Whitelabel (Kernel)

Extraído do Playbook DevOps geral do kernel-hq em 2026-08-10 (estava genérico demais, difícil de localizar). Contém plano de portabilidade, progresso e comandos específicos do Sistema Orbita Whitelabel — nome comercial **Kernel**, pasta local `kernel/` (renomeada de `sistema-orbita-whitelabel/`). Ver também [[indice-kernel]] e [[Playbook DevOps - Comandos Docker e Bancos]] (comandos gerais + risco do monorepo).

## Sistema Órbita Whitelabel (sistema-orbita-whitelabel) — produto "Kernel"

**Caminho:** `/mnt/c/Users/Willians DataMeet/Desktop/Ops/Kernel Workspace/sistema-orbita-whitelabel` (local; ainda sem deploy em VPS).

**Nome comercial: Kernel** (rebrand em 2026-08-02) — **domínio `kercellwc.online` já registrado, ainda sem VPS/DNS/deploy apontados.** Não confundir com o nome do repositório/pasta, que continua `sistema-orbita-whitelabel`. Ver [[registro-de-decisoes-kernel]] (arquitetura, pasta `arquitetura-kernel`).

O whitelabel é fork do sistema-thieco, mesma stack (Node/Express + React/Vite + Postgres + Docker Compose), mas **já nasceu multi-tenant de verdade** — diferença central que muda todo o plano abaixo:

| | sistema-thieco | whitelabel |
|---|---|---|
| Unidade | `unidade_enum` fixo (`'tambore'`, `'mutinga'`) | tabela `unidades` (linha por unidade, por tenant) |
| Cliente | 1 deploy = 1 cliente (banco, containers, domínio próprios) | 1 deploy = N clientes (`tenants.id`, banco único compartilhado) |
| Branding | hardcoded no código (`Header.jsx`, `Login.jsx`, `index.html`, etc.) | `tenants.branding` (JSONB), resolvido em runtime via `GET /public/tenants/:slug` (`backend/routes/public.js:21`) |
| Feature flags | não existe — tudo sempre ligado | `tenants.features` (JSONB) + `CORE_FEATURES` (`backend/config/features.js:6`) + `featureGate.js` (404 em rota desligada) |
| WhatsApp/IA | Evolution API + Cortex + Quasar, funcionando em produção | **nada implementado** — só uma fila (`notificacoes.canal='whatsapp'`) esperando "um consumidor externo" (comentário cita literalmente Horizon/Cortex/Quasar, `notificacoes.js:17`) |

### Por que isso é mais simples do que parece (a virada de chave)

No thieco, cada cliente novo precisaria de: banco próprio, role `cortex_readonly` própria, instâncias Evolution próprias, container Cortex/Quasar próprios — ou seja, deploy novo = trabalho de infra novo, sempre.

Como o whitelabel já é multi-tenant num banco único, **isso desaparece**: um único Cortex + um único Quasar + uma única Evolution API compartilhados servem **todos os clientes ao mesmo tempo**, cada um isolado só por `tenant_id`/`unidade_id` nos dados — do mesmo jeito que o próprio backend do whitelabel já isola tenant por linha de tabela. Cliente novo deixa de ser "infra nova" e vira **linha nova no banco + QR code novo** — exatamente o que foi pedido.

**A condição pra isso funcionar: nenhum `tenant_id` pode ficar hardcoded em código Python/JS.** No thieco, o Cortex tem isso hardcoded —

```python
TENANTS_ATENDIMENTO_SUPORTADOS = {"sistema_thieco"}
INSTANCIA_ADMIN_POR_TENANT = {"sistema_thieco": "thieco-admin"}
```

— e cada cliente novo exigiria adicionar uma entrada nesse dicionário + rebuild + redeploy do Cortex. Pro whitelabel, isso tem que ser dado, não código: o Cortex/Quasar compartilhados resolvem a config de cada tenant **em tempo de request**, consultando a própria API do whitelabel (`GET /public/tenants/:slug`, ou um endpoint interno equivalente autenticado por `authenticateInternal`) usando o `tenant_id` que veio no payload — nunca uma constante no código-fonte.

### O que falta construir (nada disso existe hoje no whitelabel)

1. **`backend/middleware/auth.js`** — portar `authenticateInternal` do thieco (`sistema-thieco/backend/middleware/auth.js:44-54`), chave compartilhada por header `X-Internal-Key`, pra chamadas serviço-a-serviço do Cortex/Quasar. Genérico, não precisa de tenant-awareness na própria auth (o `tenant_id` viaja no corpo/query de cada request, não na autenticação).

2. **`backend/services/whatsappService.js`** — não existe, precisa ser criado do zero. Diferença-chave vs. thieco: a lista de canais válidos não é mais um array fixo (`CANAIS_VALIDOS = ['mutinga','tambore','admin']`), é a query `SELECT slug FROM unidades WHERE tenant_id = $1` + o pseudo-canal `admin` sempre presente. Nome da instância Evolution também muda: `${tenantSlug}-${unidadeSlug}` (thieco usa só `${EVOLUTION_INSTANCE_NAME}-${canal}`, sem tenant no nome — não serve pra multi-tenant porque duas barbearias diferentes poderiam ter uma unidade chamada "centro").

3. **`backend/routes/whatsapp.js`** — não existe, portar de thieco com o mesmo ajuste de canal→instância tenant-aware acima.

4. **`backend/routes/notificacoes.js`** — já tem os geradores tenant-aware (`gerarNotifFaturamento(tenantId, ...)`, etc. — boa notícia, não precisa reescrever essa parte). Falta portar 3 rotas + 1 função, todas tenant-aware desde o início:
   - `POST /notificacoes/transbordo` (thieco `:961`) — Quasar aciona quando decide passar pra humano.
   - `GET /notificacoes/relatorio-sob-demanda` (thieco `:1019`) — Cortex consulta quando o admin pergunta.
   - `GET /notificacoes/admin-autorizado` (thieco `:1071`) — checagem de telefone ANTES de qualquer resposta (é o fix do loop infinito documentado na sessão de 2026-07-27/28 — não pular essa etapa).
   - `sincronizarAlertas` + `POST /notificacoes/gerar` — estender pra empurrar alerta novo (estoque/meta) pro WhatsApp do admin, não só pro sininho.

5. **`orbita-cortex` e `orbita-quasar`** (as duas microservices Python, hoje 1:1 com o tenant `sistema_thieco`) — remover todo hardcode de tenant:
   - `INSTANCIA_ADMIN_POR_TENANT`, `TENANTS_ATENDIMENTO_SUPORTADOS` (Cortex) e o conector `conectores/thieco.py` (que aponta pra um `THIECO_DATABASE_URL` fixo, um banco por cliente) — trocar pela consulta dinâmica via API do whitelabel, banco único.
   - `UNIDADES_INFO`, `FAQ_THIECO_COMUM/MUTINGA/TAMBORE` (Quasar, `database.py`) — hoje são constantes Python. Precisam virar dado: nova tabela ou coluna JSONB em `unidades` (endereço, horário, Booksy, preços, regras) que o admin do tenant edita pela própria tela de Configurações, sem precisar de mim pra cada cliente.
   - `tenants_config` (SQLite local do Quasar) — troca o `INSERT OR REPLACE` hardcoded por seed dinâmico a partir da API do whitelabel.

6. **`docker-compose.yml`** do whitelabel — adicionar a rede externa `orbita_shared` (mesmo padrão do thieco, `sistema-thieco/docker-compose.yml:186-189`) pra Cortex/Quasar/Evolution alcançarem o backend por nome de container.

7. **Hardening de portas** — achado no levantamento de 2026-07-28: Postgres (`docker-compose.yml:35`) e frontend (`:121`) do whitelabel publicam porta pro host sem travar em `127.0.0.1`, diferente do thieco (`127.0.0.1:5432`, `127.0.0.1:5173`). Corrigir antes de qualquer cliente real em produção.

8. ~~Role de leitura pro Cortex~~ — **superado pelo desenho que emergiu no item 5**: Cortex e Quasar nunca chegaram a precisar de conexão direta com o Postgres do whitelabel. Toda leitura de `clientes`/`usuarios` acontece via API (`GET /internal/cliente-atendimento`, `/internal/admin-autorizado`, etc.), autenticada pela mesma `X-Internal-Key` — o app do whitelabel usa a própria conexão de banco dele, sem role nova nenhuma. Não existe (nem precisa existir) um `WHITELABEL_DATABASE_URL` nas duas microservices, diferente do `THIECO_DATABASE_URL` legado (esse sim usa `cortex_readonly` dedicada, mantido como está — cliente antigo, banco próprio). Item fechado, sem trabalho pendente.

### Progresso (2026-07-28) — itens 1-4, 6-7 feitos e testados localmente

Portado e validado rodando local (`docker compose up -d --build` + `orbita_shared` criada manualmente, sem Cortex/Quasar/Evolution reais — só verificação de que a camada nova não quebra nada e falha de forma limpa sem os agentes no ar):
- `authenticateInternal` (item 1)
- `backend/services/whatsappService.js` + `backend/routes/whatsapp.js` novos, canal resolvido por tenant (item 2-3)
- `backend/routes/internal.js` novo (não `notificacoes.js` — precisa ficar **antes** do `app.use(authenticate)` global do whitelabel, diferente do thieco onde a auth é por rota; achado só na hora de integrar) com `/transbordo`, `/relatorio-sob-demanda`, `/admin-autorizado`, `/tenant-nome` (item 4, rotas)
- `sincronizarAlertas` portado pro `/notificacoes/gerar` (item 4, última linha) — e nessa troca achei e corrigi um bug pré-existente do whitelabel: o `/gerar` antigo apagava e recriava os alertas voláteis a cada chamada, perdendo o estado "lida" toda vez que alguém abria o painel. Confirmado com teste local (marcar como lida → rodar `/gerar` de novo → continua lida).
- Rede `orbita_shared` + hardening de porta no `docker-compose.yml` (itens 6-7)
- **Efeito colateral bom:** generalizei o endpoint `/api/v1/cortex/notificar-admin` do Cortex pra receber o nome da instância direto em vez de um dicionário `tenant_id→instância` — elimina esse hardcode específico também pro sistema-thieco (ajustei o chamador dele pro novo contrato, comportamento idêntico).
- **Item 5 completo** — Cortex: `_resolver_origem_admin` substitui `TENANT_POR_INSTANCIA_ADMIN`/`TENANTS_ATENDIMENTO_SUPORTADOS` fixos — resolve thieco (dicionário legado, preservado) ou whitelabel (`GET /internal/tenant-by-slug`) por instância, sem redeploy por cliente novo. Quasar: `_resolver_origem_cliente` (mesmo padrão) substitui a leitura direta de `UNIDADES_INFO`/FAQ fixos — `buscar_tenant_whitelabel` monta o FAQ em tempo real a partir de `GET /internal/unidade-atendimento` (jornada, equipe, catálogo, regras de atendimento), e o envio de imagem (`_deve_enviar_imagem_whitelabel`) segue a mesma checagem por `link_agendamento` em vez do `booksy_url`/`endereco_match` fixos do thieco. Ambas as microservices decidem thieco vs. whitelabel pelo formato da instância (`instancia.partition("-")` bate num dicionário fixo → thieco; senão, consulta `resolve-instancia`/`tenant-by-slug` → whitelabel), sem nenhum código novo exigido por cliente.
- Item 8 fechado sem trabalho — ver nota acima, superado pelo desenho API-mediado.

**Status da integração WhatsApp/IA:** itens 1-8 completos, testados localmente ponta a ponta (não com credenciais reais de produção — falta cliente com número pareado de verdade). Gap de cadastro de unidade (era task #50) também **fechado** — `routes/unidades.js` + aba "Unidades" em Configurações, desde 2026-07-28.

### Como configurar um cliente novo — Painel Admin (`/admin`), não é mais SQL manual (desde 2026-08-02)

**A seção abaixo (`INSERT` direto nas tabelas) ficou obsoleta — não usar mais.** Onboarding de cliente novo hoje é pela tela, sem SQL:

1. Login em `http://localhost:8082/admin` (local — porta muda por ambiente, ver `APP_PORT` no `.env`) — **desde 2026-08-04, duas contas** em vez de uma só: `ADMIN_ONBOARDING_USER`/`ADMIN_ONBOARDING_PASS` e `ADMIN_DEV_USER`/`ADMIN_DEV_PASS` no `.env` do whitelabel, seedadas em `admin_users` no boot (mesmo acesso completo pras duas, distinção é só de identidade/auditoria — quem lançou o quê). Substitui o antigo par único `ADMIN_PANEL_USERNAME`/`ADMIN_PANEL_PASSWORD` (obsoleto). Não confundir com `ADMIN_USERNAME`/`ADMIN_PASSWORD`, que é o admin do tenant `principal` de bootstrap. Troca de senha própria: `PATCH /admin/me/senha`. **Auth completamente separada** do login de qualquer tenant — token próprio (`role: super_admin`, sem `tenant_id`).
2. "+ Novo Cliente" → preenche nome, slug (gerado automático a partir do nome, editável antes de salvar, **depois vira imutável**), usuário do admin do cliente, plano (Start/Pro/Full ou Avulso), módulos, limite de profissionais, "trabalha com comissão" (sim/não), branding (logo/cores/slogan, tudo opcional, ajustável depois).
3. Salvar → tela seguinte mostra **uma única vez** o link (`/t/<slug>`), usuário e senha temporária gerados — não tem como ver essa senha de novo depois, só redefinir (item 5 abaixo).
4. Cliente já loga em `<dominio>/t/<slug>` com essas credenciais. Ele mesmo cadastra os profissionais/barbeiros (isso continua sendo tela dele, não do painel admin), e pareia o próprio WhatsApp por Configurações (mesmo fluxo de sempre, `POST /whatsapp/<unidade>/conectar`).
5. **Esqueceu a senha do admin do cliente?** Abre o cliente pra editar no painel (`/admin`) → seção "Usuários" no fim da tela → "Gerar nova senha" → mesma tela de credencial-única-vez do passo 3. Não existe (nem existirá por padrão) fluxo de "esqueci minha senha" self-service pra essa conta — ela não tem e-mail de profissional vinculado pra receber o link.

**Detalhe que já causou confusão uma vez:** editar plano/módulos de um cliente já ativo tem efeito **imediato** em quem já está logado — não precisa avisar o cliente pra deslogar/logar de novo (`GET /auth/me` recalcula a cada 60s no frontend, desde 2026-08-03).

**Incidente de migration (2026-08-03), pra não repetir:** uma versão anterior do rename `tenants.nivel → tenants.plano` tinha duas etapas (`ADD COLUMN nivel` + `RENAME nivel TO plano`) — em todo restart do backend, a primeira recriava `nivel` (idempotente por engano) e a segunda batia de frente com `plano` já existente, **derrubando o container num crash loop** (`column "plano" of relation "tenants" already exists`, visível em `docker logs orbita-test_api`). Se algo parecido aparecer de novo (uma `ALTER`/`RENAME` que só falha no *segundo* restart, nunca no primeiro), o padrão de correção é o mesmo: simplificar pra uma única operação idempotente, nunca duas etapas que dependem da ordem de execução relativa uma à outra.

### [2026-08-04] Bug de ordenação de migration + script de demo reutilizável

**Bug real, achado testando deploy num banco vazio pela primeira vez:** `BACKFILL_TIPO_ITEM_PRODUTO` (faz `JOIN` em `catalogo`) rodava em `runMigrations()` **antes** de `CREATE_CATALOGO` — nunca dava erro em nenhum ambiente já existente (todos já tinham a tabela `catalogo` de um boot anterior), só quebrava a primeira migration de um banco 100% vazio. É exatamente o cenário de qualquer deploy novo — teria travado o boot do backend em produção. Reproduzido de propósito (`CREATE DATABASE seedtest` + `runMigrations()` isolado apontando pra ele), corrigido adiantando a chamada de `CREATE_CATALOGO` pra antes do backfill (ela não depende de nenhuma tabela anterior, seguro adiantar — `IF NOT EXISTS` torna a segunda chamada, mais abaixo, um no-op), reconfirmado limpo depois no mesmo banco vazio.

**Novo: `database/seed_demo_apresentacao.sql` (+ atalho `make seed-demo`)** — popula o tenant `principal` (bootstrap, `TENANT_PADRAO` no `.env`) com uma demo comercial completa, pronta pra apresentar a cliente novo: 3 barbeiros com login próprio (`rafaelmendes`/`Rafael@2026`, `lucasferreira`/`Lucas@2026`, `diegosantos`/`Diego@2026`), 10 clientes (5 sem combo, 5 com combo — 2 vencidos por prazo, 2 vencidos por utilização, 1 válido), ~90 dias de vendas históricas geradas, despesas, planos de ação (PDCA), metas, estoque (um produto de propósito abaixo do mínimo, pra mostrar o alerta) e agenda com horários livres reais. Também liga o módulo de autoagendamento público (`autoatendimentoPublico`) nesse tenant.

Portátil de verdade — testado rodando contra um banco 100% vazio (não só reaproveitando dado de um ambiente antigo): resolve o tenant por **slug** (`principal`), nunca por ID fixo, e cria catálogo/barbeiros do zero (não depende de nenhum dado pré-existente de nenhum ambiente específico). Idempotente por checagem (`\if` do psql), não por `ON CONFLICT`: se já existir um profissional "Rafael Mendes" pro tenant, o script detecta e não faz nada — seguro rodar de novo sem querer.

**Onde rodar:** na raiz do projeto (`sistema-orbita-whitelabel/`), com os containers já no ar (`docker compose up -d`) — funciona tanto local quanto no servidor de produção, o que importa é estar no `docker compose` do ambiente que você quer popular:

```bash
make seed-demo
# ou, sem make instalado:
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f - < database/seed_demo_apresentacao.sql
```

Senha dos barbeiros gerada via `pgcrypto` (`crypt(senha, gen_salt('bf', 12))`) direto em SQL — confirmado compatível com o `bcryptjs` que o backend usa pra validar login (hash `$2a$`/`$2b$` são intercambiáveis pro bcrypt, testado `bcrypt.compare` de verdade no container do backend antes de confiar nisso).

**Regra que essa descoberta reforça:** nunca presumir que a ordem de `runMigrations()` está correta só porque funciona nos ambientes que já existem — eles carregam estado de boots anteriores que mascara bug de ordenação. Testar contra banco vazio de verdade antes de qualquer deploy novo (`CREATE DATABASE <nome_temporario>` no mesmo Postgres já resolve, sem precisar de infra nova).

**Domínio:** não precisa domínio novo por cliente — a URL `/t/<slug>` num domínio compartilhado já resolve o branding (mesmo princípio de antes, ver seção obsoleta abaixo). Domínio próprio (tipo `barbeariatl.online` do thieco) continua sendo só opção premium.

### [OBSOLETO — mantido só como histórico] Onboarding via SQL manual, pré-Painel Admin

Como funcionava antes de existir o Painel Admin (2026-07-28 até 2026-08-02) — **não usar mais**, ver seção acima:

```sql
-- 1. Tenant novo (nome + branding + flags — tudo desligado por padrão, liga só o combinado)
INSERT INTO tenants (slug, nome, ativo, features, branding)
VALUES (
  'barbearia-exemplo',
  'Barbearia Exemplo',
  true,
  '{"notificacoes": true, "agenda": false, "campanhas": false}'::jsonb,
  '{"logoUrl": "https://.../logo-exemplo.png", "corPrimaria": "#c9a24b"}'::jsonb
);

-- 2. Unidade(s) do cliente
INSERT INTO unidades (tenant_id, slug, nome)
VALUES ((SELECT id FROM tenants WHERE slug = 'barbearia-exemplo'), 'centro', 'Centro');

-- 3. Usuário admin do tenant
INSERT INTO usuarios (tenant_id, username, senha_hash, role, nome, telefone, ativo)
VALUES ((SELECT id FROM tenants WHERE slug = 'barbearia-exemplo'), 'admin', '<hash bcrypt>', 'admin', 'Nome do Dono', '5511999998888', true);
```

**Regra de ouro que continua valendo:** se, pra ligar um cliente novo, for necessário editar um `.py`/`.js` (não usar a tela do Painel Admin), é sinal de que alguma parte ficou hardcoded por engano — parar e generalizar antes de seguir.

