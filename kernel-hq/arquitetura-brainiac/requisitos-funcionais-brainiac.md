---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Requisitos Funcionais — Kernel Brainiac

Todos os RFs abaixo descrevem comportamento **já implementado** em
`Kernel-brainiac/main.py`, salvo onde marcado explicitamente como backlog. Cada RF cita a
função ou constante de origem.

---

## Módulo 0 — Infraestrutura do serviço

### RF-00 — Healthcheck
- **Rota:** `GET /health` → `{"status": "ok"}`
- Consumido pelo `HEALTHCHECK` do `Dockerfile` (intervalo 30s, timeout 10s, start-period
  15s, 3 retries) via `urllib.request` em `http://localhost:5010/health`.

### RF-00b — Carga de configuração
- `.env` carregado de `Path(__file__).resolve().parent / ".env"` — **local à pasta do
  Brainiac**, nunca o `.env` compartilhado da raiz do workspace.
- Defaults embutidos quando a variável está ausente: `EVOLUTION_API_URL` →
  `http://localhost:8081`; `WHITELABEL_API_URL` → `http://localhost:3002`;
  `OPENROUTER_MODEL` → `openai/gpt-5.6-luna`.
- `INTERNAL_SERVICE_KEY` ausente vira string vazia no header `X-Internal-Key` (o Kernel
  responde 401 — falha explícita, não silenciosa).

---

## Módulo 1 — Contexto de cliente para o Kalel

### RF-01 — Consulta de contexto de atendimento
- **Rota:** `GET /api/v1/brainiac/atendimento`
- **Query params:** `tenant_id` (obrigatório), `contato` (obrigatório), `unidade` (opcional)
- **Comportamento:** repassa para `GET {WHITELABEL_API_URL}/internal/cliente-atendimento`
  com header `X-Internal-Key`, timeout 5s. **Sem nenhuma chamada de IA.**
- **Origem do dado:** o `churn_risk` devolvido é calculado no backend do Kernel por regra
  determinística (cliente sem visita há mais de 45 dias), não pelo Brainiac.

### RF-02 — Contrato de resposta do contexto

| Situação | Resposta |
|---|---|
| Cliente encontrado | `{"status": "ok", "cliente": {...}}` |
| Kernel respondeu `encontrado: false` | `{"status": "nao_encontrado"}` |
| Kernel respondeu HTTP não-2xx | `{"status": "erro", "detalhe": "Kernel respondeu HTTP {code}"}` |
| Exceção (timeout, rede) | `{"status": "erro", "detalhe": "Falha ao consultar a base do tenant."}` |

- Nunca expõe stack trace ao chamador — o `repr` da exceção vai só para o log
  (`print("🧠 BRAINIAC -> ...")`).

---

## Módulo 2 — Notificação do admin (mensageiro)

### RF-03 — Endpoint de notificação
- **Rota:** `POST /api/v1/brainiac/notificar-admin`
- **Payload (Pydantic `PayloadNotificarAdmin`):** `instancia`, `telefone`, `mensagem` —
  todos `str` obrigatórios; ausência gera HTTP 422 automático do FastAPI.
- **Regra estrutural:** o chamador envia o **nome da instância Evolution direto** (ex.
  `barbearia-jp-admin`), não o `tenant_id`. O Brainiac não mantém nenhum dicionário
  tenant→instância — é isso que permite tenant novo funcionar sem alterar o agente.

### RF-04 — Papel de mensageiro, não de decisor
- O conteúdo do relatório (faturamento, ranking, estoque parado) **já vem pronto** do
  chamador. O Brainiac não interpreta, não formata e não decide o que enviar nesta rota.
- **Nenhuma chamada de IA** neste caminho.

### RF-05 — Normalização de DDI
- Extrai apenas dígitos de `telefone`.
- Se o resultado tiver 10 ou 11 dígitos e não começar com `55`, prefixa `55`.
- **Motivo documentado no código:** número cadastrado sem DDI faz a Evolution API recusar o
  envio, reportando o JID como inexistente.

### RF-06 — Envio e tratamento de falha
- `POST {EVOLUTION_API_URL}/message/sendText/{instancia}` com header `apikey`, timeout 10s.
- `EVOLUTION_API_KEY` ausente → retorna erro imediato sem tentar enviar.
- HTTP não-2xx **ou** exceção → log + `_alertar_telegram(..., chave_cooldown=instancia)` +
  resposta `{"status": "erro", ...}`.
- Sucesso → registra o `key.id` da mensagem (RF-11) e retorna `{"status": "ok"}`.
- **Sem retry automático** em nenhum cenário.

---

## Módulo 3 — Relatório sob demanda pelo WhatsApp

### RF-07 — Webhook do canal admin
- **Rota:** `POST /webhook/evolution`
- Ignora (com `{"status": "ignorado", "motivo": ...}`) quando:
  - o corpo não é JSON válido;
  - `event != "messages.upsert"`;
  - a mensagem não tem texto (`conversation` nem `extendedTextMessage.text`) — mídia, etc.;
  - a instância não termina em `-admin` ou não resolve para um tenant;
  - o telefone não está presente.
- **Nunca lança** — a Evolution API só espera um 200 rápido.

### RF-08 — Resolução do tenant pelo nome da instância
- `_resolver_tenant_admin(instancia)`: exige sufixo `-admin`, extrai o slug e consulta
  `GET {WHITELABEL_API_URL}/internal/tenant-by-slug`, timeout 5s.
- Retorna `(tenant_id, nome_tenant)` ou `None`.
- **Zero configuração por cliente** — nenhum mapa hardcoded no agente.

### RF-09 — Autorização fail-closed
- `_telefone_e_admin_autorizado(tenant_id, telefone)` consulta
  `GET /internal/admin-autorizado`, timeout 5s.
- **Falha de rede = nega** (retorna `False`).
- A checagem acontece **antes de qualquer resposta**, inclusive antes da mensagem de "não
  entendi" (RF-12). Motivo registrado no código: evitar o loop infinito Brainiac↔Kalel já
  observado no piloto original, em que uma recusa do agente conversacional virava "não
  entendi" e voltava.
- Reforço em segunda camada: HTTP 403 vindo de `/internal/relatorio-sob-demanda` também
  encerra o fluxo sem responder.

### RF-10 — Classificação do pedido via IA
- `_classificar_pedido_relatorio(texto, tenant_id)`:
  `POST https://openrouter.ai/api/v1/chat/completions`, `temperature: 0.0`,
  `usage: {include: true}`, timeout 15s, modelo `OPENROUTER_MODEL`.
- **Saída esperada:** JSON estrito com `tipo`, `unidade`, `periodo_dias`.
- **Sanitização:** remove cercas markdown (` ```json `, ` ``` `) antes do `json.loads`.
- **Validação pós-modelo:**

| Chave | Regra aplicada no código |
|---|---|
| `tipo` | Precisa estar em `TIPOS_RELATORIO`; qualquer outro valor → `{"tipo": None}` |
| `unidade` | `strip().lower()`; vazio/nulo → `None`. **Não validada contra lista fixa** — unidades são dinâmicas por tenant e o backend ignora slug inexistente, caindo em "todas as unidades" |
| `periodo_dias` | `int(...)`, default `1`; valor não numérico → `1`; piso `max(1, ...)` |

- **Nunca lança:** qualquer exceção vira `{"tipo": None}`, tratado como "não entendi".

**Tipos de relatório suportados** (`TIPOS_RELATORIO`):
`faturamento`, `produtos_mais_vendidos`, `servicos_mais_realizados`, `estoque_parado`.

**Convenção de período instruída no prompt:** "hoje"/não especificado = 1; "essa semana" = 7;
"esse mês" = 30.

**Regra explícita de não-invenção no prompt:** o modelo é instruído a **nunca inferir ou
adivinhar uma unidade que não foi dita explicitamente** — na dúvida, `null`.

### RF-11 — Supressão de eco no self-chat
- `IDS_ENVIADOS_PELO_BRAINIAC: set[str]` guarda o `key.id` de tudo que o Brainiac envia
  (tanto por RF-06 quanto por RF-13).
- No webhook: evento com `fromMe = true` **e** id conhecido → ignorado como eco, e o id é
  descartado do set.
- Evento com `fromMe = true` **sem** id conhecido → tratado como mensagem real (o canal
  admin é pareado no número pessoal do gestor; ele escreve "para si mesmo").
- **Cap:** quando o set passa de 200 entradas, é esvaziado por inteiro
  (`.clear()`) — ver ponto de atenção PA-02.

### RF-12 — Mensagem de ajuda ("não entendi")
- Disparada quando `tipo` é `None`.
- Formato: `🥇 *{nome_tenant}*` + lista de tipos disponíveis (rótulos em
  `LABEL_POR_TIPO_RELATORIO`) + instrução de que dá para pedir por unidade e por período.
- Só é enviada a um telefone **já autorizado** (RF-09).

### RF-13 — Busca e formatação do relatório
- `GET {WHITELABEL_API_URL}/internal/relatorio-sob-demanda` com `tipo`, `periodo_dias`,
  `telefone_solicitante`, `tenant_id` e opcionalmente `unidade`; timeout 10s.
- Reaproveita **as mesmas consultas do relatório periódico** — o Brainiac não acessa o
  Postgres de vendas/catálogo.

| Situação | Resposta ao admin |
|---|---|
| HTTP 403 | Nenhuma — encerra silenciosamente como "solicitante não autorizado" |
| `encontrado: false` | `🥇 *{nome}*\n\nNada a reportar pra esse período/unidade.` |
| Sucesso | `_formatar_resposta_relatorio`: cabeçalho + `_Relatório sob demanda_` + um bloco `*{titulo} — {unidade}*` por resultado |
| Exceção | `🥇 *{nome}*\n\nDeu um erro buscando esse relatório, tenta de novo em instantes.` |

- Envio via Evolution com `linkPreview: false`; sucesso registra o id (RF-11); falha
  dispara alerta Telegram com cooldown por instância.

---

## Módulo 4 — Observabilidade e telemetria

### RF-14 — Alerta de falha no Telegram
- `_alertar_telegram(mensagem, chave_cooldown)` →
  `POST https://api.telegram.org/bot{TOKEN}/sendMessage`, timeout 5s.
- **No-op silencioso** se `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` estiverem ausentes.
- **Cooldown:** `_COOLDOWN_ALERTA_SEGUNDOS = 900` (15 min) por `chave_cooldown`, que hoje é
  sempre o nome da instância. Motivo no código: instância fora do ar por horas geraria um
  alerta por mensagem.
- **Best-effort absoluto:** `except: pass` — nunca derruba o fluxo principal.
- Acionado em 4 pontos: HTTP de erro e exceção no `notificar_admin`; HTTP de erro e exceção
  no envio da resposta do webhook.

### RF-15 — Telemetria de custo de IA
- `_reportar_custo_agente(tenant_id, modelo, origem, usage, unidade)` →
  `POST {WHITELABEL_API_URL}/internal/agente-custo`, timeout 5s.
- **Payload:** `tenant_id` (convertido para `int`), `agente: "brainiac"`, `modelo`,
  `origem`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `custo_usd` (de
  `usage.cost`), `unidade`.
- **Origem usada hoje:** `"brainiac_classificar_relatorio"` — único ponto de IA do serviço.
- **Guarda:** não envia nada se `tenant_id` ou `usage` forem falsy.
- Falha nunca afeta o atendimento do admin (comentário explícito no código).
- Depende de `agente_custos.agente` aceitar `'brainiac'` no `CHECK` — migration já aplicada
  e testada no Kernel (`kernel/BACKLOG.md`, 2026-08-05).

---

## Pontos de atenção observados no código

| ID | Observação | Severidade | Rastreio |
|---|---|---|---|
| PA-01 | Nenhuma rota do Brainiac tem autenticação própria. Quem alcançar a porta 5010 pode disparar WhatsApp arbitrário via `notificar-admin` para qualquer instância. Mitigado hoje só por bind em `127.0.0.1` e rede Docker interna | Alta (se a porta for exposta na VPS) | `main.py` (ausência de dependency de auth), `docker-compose.yml` `ports: 127.0.0.1:5010:5010` |
| PA-02 | `IDS_ENVIADOS_PELO_BRAINIAC.clear()` esvazia **todo** o set ao passar de 200 ids. Em volume alto, ids recentes podem ser descartados e o eco do self-chat voltar a ser tratado como pergunta | Média | `_registrar_envio_proprio` |
| PA-03 | Todo o estado (cooldown de alerta, ids enviados) vive em memória do processo. Restart do container zera ambos — o primeiro alerta pós-restart reaparece imediatamente, e ecos em trânsito deixam de ser suprimidos | Média | `_ULTIMO_ALERTA_TELEGRAM`, `IDS_ENVIADOS_PELO_BRAINIAC` |
| PA-04 | `TIPOS_RELATORIO` é um `set`, e `_mensagem_ajuda_relatorio` itera sobre ele. A ordem dos itens da mensagem de ajuda pode variar entre execuções do processo | Baixa (cosmética) | `TIPOS_RELATORIO`, `_mensagem_ajuda_relatorio` |
| PA-05 | Sem retry automático em nenhum envio: o alerta Telegram avisa, mas a mensagem perdida não é reenviada | Média | RF-06, RF-13; herdado do Cortex (RD-008 de [[registro-de-decisoes-cortex]]) |
| PA-06 | `_reportar_custo_agente` faz `int(tenant_id)` sem guarda — se `tenant_id` vier não numérico, a telemetria falha (capturada, sem impacto no fluxo) | Baixa | `_reportar_custo_agente` |

---

## Backlog (rastreado a `kernel/BACKLOG.md`, não inventado)

| ID | Item | Estado |
|---|---|---|
| B-01 | Gerar chave real de OpenRouter (própria do Brainiac) e chave Evolution dedicada ao Kernel, e colar nos `.env` | Aberto |
| B-02 | Cutover: apontar o backend do Kernel para `POST /api/v1/brainiac/notificar-admin` (hoje `CORTEX_URL` → `/api/v1/cortex/notificar-admin`) | Aberto — ver RD-010 |
| B-03 | Deploy na VPS nova (Kernel + Brainiac + Kalel), domínio `kercellwc.online` | Aberto — infra não decidida |
| B-04 | Decoupling do Cortex original (remover a branch whitelabel) — só depois de Brainiac estável com tráfego real | Aberto, com pré-condição explícita |
| B-05 | Atualizar `WHITELABEL_API_URL` e comentários do `docker-compose.yml` quando o nome do container/rede do Kernel deixar de conter "orbita" | Aberto |

**Não documentado no código — perguntar ao Willians:**
- Se `notificar-admin` deve ganhar autenticação antes do deploy público (PA-01).
- Se o alerta do Telegram deve evoluir para retry automático (PA-05) ou continuar só
  avisando.
- Qual valor real de `OPENROUTER_MODEL` será usado em produção (o default no código é
  `openai/gpt-5.6-luna`, mas o `.env` real não foi lido).

[[indice-brainiac]] · [[prd-brainiac]] · [[arquitetura-brainiac]]
