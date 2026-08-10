# 12 — Backlog: Painel Administrativo Cortex/Quasar (VPS compartilhada)

> Documento de mapeamento/escopo — **não é plano de implementação**. Objetivo
> é registrar a decisão e o levantamento técnico pra retomar numa sessão
> dedicada, sem perder o contexto discutido em 2026-08-02.

## Contexto

Decisão: subir uma única VPS (Hostinger) hospedando os sistemas de gestão já
construídos, todos atendidos pelos mesmos agentes de IA compartilhados
(Órbita Cortex + Órbita Quasar — ver
[08-modulo-de-inteligencia-artificial-e-agentes.md](./08-modulo-de-inteligencia-artificial-e-agentes.md)
pro papel de cada um e a decisão estratégica de usar Evolution API).

Como criador/desenvolvedor do Quasar e do Cortex, falta uma visão
centralizada — hoje qualquer ajuste (prompt, FAQ, regra de negócio) é feito
editando arquivo Python direto por tenant (`database.py`/`main.py`), sem
tela nenhuma, e não existe NENHUM registro de custo de IA por cliente — todos
os tenants dividem a mesma chave OpenRouter sem rastreio.

**Detalhe técnico completo do estado atual do Quasar** (stack, endpoints,
loop de tool-calling, tenants reais, limitações) foi documentado/atualizado
em 2026-08-02 em `kernel-hq/arquitetura-quasar/` — ver especialmente
[arquitetura-tecnica-quasar.md](../arquitetura-quasar/arquitetura-tecnica-quasar.md)
e [registro-de-decisoes-quasar.md](../arquitetura-quasar/registro-de-decisoes-quasar.md).
Este backlog referencia esses documentos em vez de duplicar o conteúdo.

## Escopo — sistemas que entram

Todos rodam na mesma VPS e usam Cortex/Quasar como cérebro de IA
compartilhado:

- **sistema-thieco** (Barbearia Thieco Leandro) — piloto original do Quasar,
  agendamento conversacional.
- **vilamill-sistema**
- **academia-sandro**
- **lanchonete-sistema**
- **lane-confeitaria** (Confeitaria Artesanal da Lane) — integração mais
  recente e mais completa até agora: Kanban automático (Atendimento → Pedido
  → filas com gatilhos configuráveis), visão computacional (foto de
  bolo/comprovante Pix), WhatsApp real via Evolution API. Ver
  `quasar/tools/lane_confeitaria.py` e o schema de
  `lane-confeitaria/prisma/schema.prisma` como referência de padrão a
  replicar nos demais (nenhum dado de negócio hardcoded do lado do agente,
  tudo consultado via API interna com `X-Internal-Key`).

## Escopo — o que NÃO entra (por enquanto)

- **sistema-orbita-whitelabel**: vai ganhar **admin próprio e um agente de
  IA novo e dedicado**, arquitetura separada — decisão explícita do
  Willians por causa da meta de escalar pra **~500 clientes**. Não faz
  sentido compartilhar o mesmo painel/agente genérico dos sistemas acima
  nessa escala; whitelabel trata-se em sessão própria, focada só nisso.

## Objetivo do painel

1. **Ajustes/correções/adaptações centralizadas** — hoje é edição manual de
   arquivo por tenant; o painel deveria permitir editar FAQ/regras de
   negócio/prompt por tenant sem precisar mexer em código Python e sem
   redeploy.
2. **Visão em tempo real de quem está usando** — quais tenants têm WhatsApp
   conectado (já dá pra consultar via
   `GET /instance/connectionState/{instance}` na Evolution API, ver
   `lane-confeitaria` → Configurações → WhatsApp como referência de UI já
   construída), conversas ativas, última mensagem por cliente.
3. **Visão de custo** — a resposta do OpenRouter já traz `usage.cost` por
   chamada (confirmado em teste real: `"cost":0.0000067` etc.) e isso hoje é
   descartado. Precisa virar um registro persistido (tabela nova, algo tipo
   `uso_ia_log(tenant_id, timestamp, tokens_prompt, tokens_completion, cost,
   modelo)`), gravado a cada chamada dentro do próprio `gerar_resposta_quasar`
   (`main.py`), permitindo consolidar gasto por tenant/dia/mês.

## Achado que reforça o objetivo 1 (ajustes centralizados): bug real ficou invisível por meses

Em 2026-08-02, durante a integração real do lane-confeitaria, foi encontrado um bug sério no
próprio engine do Quasar: a rechamada ao modelo depois de executar uma ferramenta nunca
reenviava a lista de `tools` — o modelo ficava impedido de encadear uma 2ª ferramenta na mesma
mensagem (ex.: checar catálogo+agenda e só depois registrar o pedido). Esse bug existia desde a
criação do engine (junho/2026) e afetava **todos os tenants** (Thieco, whitelabel, Lane), não só
o que estava sendo testado — só não tinha sido percebido porque o domínio original (agendamento
de mentoria) raramente precisa de 2 ferramentas em sequência. Corrigido com um loop de
tool-calling de verdade (até 5 rodadas). Detalhe completo em
`arquitetura-quasar/registro-de-decisoes-quasar.md` e `fluxos-conversacionais-quasar.md`.

**Por que isso importa pro painel:** um bug estrutural como esse só foi descoberto porque um
humano estava acompanhando uma conversa real ao vivo. Sem visão centralizada de conversas/tools
executadas por tenant, esse tipo de falha fica invisível indefinidamente em produção — reforça
o objetivo 1 (não é só "editar prompt sem redeploy", é também "perceber que algo está
sistematicamente quebrado" antes que um cliente real perceba primeiro).

## Levantamento técnico (o que já existe, o que falta)

- Cada tenant já expõe rotas internas padronizadas (`/api/internal/*` +
  header `X-Internal-Key`) que o Quasar consome — mapear, sistema por
  sistema, o que cada um já expõe hoje antes de desenhar o painel (nem todos
  devem estar no mesmo nível de maturidade que o lane-confeitaria).
- `FAQ_*` de cada tenant está **hardcoded como string Python** em
  `database.py` (`FAQ_LANE_CONFEITARIA`, `FAQ_THIECO_*` etc.) — candidato
  natural a virar registro editável em banco via essa tela, em vez de exigir
  editar código + rebuild do container a cada ajuste de tom/regra (foi
  exatamente esse ciclo manual que usamos hoje pro lane-confeitaria).
- Conexão WhatsApp por tenant (Evolution API) — endpoint de status já
  existe e é reutilizável (`/instance/connectionState/{instance}`,
  `/instance/connect/{instance}` pro QR code), só falta agregar isso numa
  tela cross-tenant em vez de uma por sistema.
- Log de tool-calling (`⚙️ TOOL EXECUTION`) hoje só vai pro `stdout` do
  container (`docker logs`) — some no restart. Painel precisaria de
  persistência própria de eventos, não só ler logs efêmeros.

## Processo de subir os agentes (Cortex/Quasar) e os sistemas pra VPS

Hoje tudo roda local: Quasar/Cortex em Docker (WSL, Docker Desktop), cada
sistema (ex.: lane-confeitaria) rodando nativo no host (`npm run dev`) fora
de container. Isso só funciona enquanto a máquina do Willians estiver ligada
— pra virar "sempre no ar" de verdade, precisa migrar pra VPS Hostinger.
Pontos já identificados (confirmados em `quasar/docker-compose.yml`
e na integração real feita com o lane-confeitaria em 2026-08-02):

### 1. `host.docker.internal` não é garantido em Linux puro

Em Docker Desktop (Windows/Mac) funciona por padrão; em Docker Engine puro
(Linux, caso de qualquer VPS) só funciona se o container tiver
`extra_hosts: ["host.docker.internal:host-gateway"]` — **o
`docker-compose.yml` do Quasar já tem isso configurado**, então funciona na
VPS SE o sistema-alvo (ex.: lane-confeitaria) estiver rodando nativo no host
e escutando em `0.0.0.0` (não só `127.0.0.1`/`localhost`). Next.js
(`next start`) já faz isso por padrão — checar se outros sistemas (vilamill,
academia-sandro, lanchonete-sistema) também fazem.

### 2. Melhor caminho: containerizar os sistemas na rede `orbita_shared`

Em vez de depender de host.docker.internal/binding, o padrão mais robusto
(já usado por sistema-thieco e whitelabel) é cada sistema virar container na
mesma rede Docker `orbita_shared` — Quasar então alcança pelo **nome do
container** (ex.: `http://lane_confeitaria_app:3010`), sem ambiguidade de
rede. Envolve dar um `Dockerfile`/`docker-compose.yml` de produção pra cada
sistema que ainda não tem (lane-confeitaria hoje só roda em dev, sem
Dockerfile de produção ainda).

### 2.1. Alternativa considerada: agentes numa VPS separada dos sistemas

Cortex/Quasar não *precisam* estar na mesma VPS dos sistemas — é só
comunicação HTTP entre serviços, dá pra separar. Decisão por ora: **manter
juntos** (thieco, vilamill, academia-sandro, lanchonete-sistema,
lane-confeitaria + Cortex/Quasar todos na mesma VPS), pelos motivos abaixo.

- **A favor de manter junto (opção atual):** tudo fica na rede Docker
  interna, sem precisar expor a API interna (`X-Internal-Key`) na internet
  pública; mais simples; uma VPS só, mais barato.
- **Trade-off:** se algum sistema tiver problema de recurso (CPU/memória) ou
  cair, isso pode afetar os agentes de todo mundo junto — acoplamento entre
  a infraestrutura de IA (compartilhada) e a infraestrutura de cada negócio
  individual.
- **Quando reconsiderar:** se algum tenant crescer muito e virar gargalo de
  recurso pros outros, ou se precisar de mais isolamento/resiliência entre
  os agentes e os sistemas. Nesse caso, separar os agentes numa VPS própria
  exige rede privada entre as VPS (VPN/Wireguard) ou expor a API interna com
  HTTPS + autenticação reforçada — mais infraestrutura pra manter, mas
  desacopla o ciclo de vida dos agentes do ciclo de vida de cada sistema.

### 3. SQLite do Quasar não é persistido — PRECISA resolver antes do deploy

Descoberto durante o teste real: `orbita_quasar.db` está no `.dockerignore`
e não tem volume montado no `docker-compose.yml` — toda vez que o container
é recriado (`docker compose up -d --build`), o histórico de conversa de
**todos os tenants** é apagado (os pedidos/atendimentos de verdade, que
ficam no Postgres de cada sistema, não são afetados — só a memória de
conversa do Quasar). Em produção, qualquer deploy/restart apagaria contexto
de conversas em andamento de todo mundo. Precisa de um volume Docker
nomeado (`volumes: - quasar_data:/app`) antes de ir pra VPS. Mesmo gap
documentado em `arquitetura-quasar/base-de-conhecimento-quasar.md` (ciclo
de vida dos dados) e `arquitetura-tecnica-quasar.md` (limitações atuais).

### 4. Variáveis de ambiente por serviço

Cada sistema aponta pro Quasar/Evolution API via env vars específicas
(`LANE_CONFEITARIA_API_URL`, `LANE_CONFEITARIA_INTERNAL_KEY`,
`EVOLUTION_API_URL` etc.) — todas precisam ser reapontadas pros endereços
reais da VPS (nomes de container, não mais `host.docker.internal` nem
`localhost`). `OPENROUTER_API_KEY` e outras chaves do `.env` raiz do
workspace também precisam existir na VPS (nunca commitadas no git — copiar
com cuidado, fora do controle de versão).

### 5. Domínio + HTTPS

Cada sistema com domínio próprio (ex.: o da Lane) precisa de reverse proxy
(nginx ou Caddy) + certificado (Let's Encrypt) na frente. O webhook da
Evolution API → Quasar é tráfego **interno** (mesma rede Docker da VPS),
não precisa de domínio público nem HTTPS — só os apps voltados pro
cliente final (frontend de cada sistema) precisam de domínio/SSL.

### 6. Checklist de migração (resumo, sem ordem de execução definida ainda)

- [ ] Dockerfile de produção pra lane-confeitaria (e demais sistemas que
      ainda não têm)
- [ ] Volume nomeado pro `orbita_quasar.db` (resolver perda de memória)
- [ ] Reapontar todas as env vars inter-serviço pros nomes de container na VPS
- [ ] Copiar `.env` da Holding (OpenRouter, Evolution API key etc.) pra VPS
      com segurança (fora do git)
- [ ] Reverse proxy + SSL por sistema com domínio público
- [ ] Reconfigurar webhook de cada instância Evolution API pro endereço do
      Quasar dentro da rede da VPS
- [ ] Validar, sistema por sistema, o mesmo fluxo ponta a ponta testado
      localmente pro lane-confeitaria (card automático, visão, WhatsApp real)

## Onde deve morar

Dentro do Quasar/Cortex (não em nenhum dos sistemas individuais) — é o único
lugar com visão natural de todos os tenants ao mesmo tempo. Autenticação
restrita ao Willians (não é tela de cliente final).

## Próximos passos (retomar em sessão dedicada)

1. Desenhar schema do log de uso/custo (tabela + onde persistir — Postgres
   já usado por vários tenants, ou SQLite do próprio Quasar como hoje).
2. Desenhar autenticação do painel (separada do login de cada tenant).
3. Decidir se roda no mesmo processo do Quasar/Cortex ou como serviço
   separado.
4. Prototipar primeiro a tela de status + custo (maior valor, menor
   esforço) antes da edição de FAQ/prompt (maior esforço, mexe em como o
   agente carrega config hoje).
