---
status: experimental
domain: brainiac
source: claude
created: 2026-08-10
updated: 2026-10-14
owner: willians
---

# Integrações — Telovis Brainiac

## Visão Geral

O Brainiac é um serviço de fronteira: praticamente todo o seu comportamento é integração.

```
        ┌──────────┐   GET /atendimento    ┌────────────┐
        │  Kalel   │──────────────────────▶│            │
        └──────────┘                       │            │
                                           │            │   GET/POST /internal/*
   ┌────────────────┐  POST /notificar-    │            │──────────────────────▶ ┌──────────────┐
   │ Telovis Barber backend │  admin  (⚠ cutover   │  BRAINIAC  │                        │ Telovis Barber (API) │
   └────────────────┘  pendente)  ────────▶│   :5010    │◀───────────────────────└──────────────┘
                                           │            │
   ┌────────────────┐  POST /webhook/      │            │   POST /chat/completions
   │ Evolution API  │  evolution   ───────▶│            │──────────────────────▶ ┌──────────────┐
   └────────────────┘                      │            │                        │  OpenRouter  │
            ▲                              │            │                        └──────────────┘
            │  POST /message/sendText      │            │   POST /sendMessage
            └──────────────────────────────│            │──────────────────────▶ ┌──────────────┐
                                           └────────────┘                        │   Telegram   │
                                                                                 └──────────────┘
```

Nenhuma integração usa fila, retry ou circuit breaker. Todas usam `requests` síncrono com
timeout explícito e `try/except` amplo.

---

## ENTRADA 1 — Kalel → contexto de cliente

**Consumidor:** `telovis-kalel/main.py`, função `buscar_contexto_brainiac`
(`BRAINIAC_URL`, default `http://127.0.0.1:5010`).

```
GET {BRAINIAC_URL}/api/v1/brainiac/atendimento
    ?tenant_id={id}&contato={telefone}[&unidade={slug}]
```

### Respostas

```json
{"status": "ok", "cliente": {
  "nome": "Marcos Oliveira", "contato": "5511...", "unidade": "centro",
  "tipo": "...", "primeira_visita": "...", "ultima_visita": "...",
  "total_visitas": 12, "dias_desde_ultima_visita": 51, "churn_risk": 1
}}
```

```json
{"status": "nao_encontrado"}
{"status": "erro", "detalhe": "Telovis Barber respondeu HTTP 401"}
{"status": "erro", "detalhe": "Falha ao consultar a base do tenant."}
```

**Contrato de degradação:** o Kalel trata qualquer falha como `None` e segue a conversa sem
contexto — o atendimento do cliente final **não depende** do Brainiac estar no ar.

**Regra de fronteira registrada no código:** *"O Brainiac nunca fala com o cliente final;
quem consome esta rota é o Kalel."*

---

## ENTRADA 2 — Backend do Telovis Barber → notificação do admin

```
POST {BRAINIAC_URL}/api/v1/brainiac/notificar-admin
Content-Type: application/json

{"instancia": "barbearia-jp-admin", "telefone": "11987654321", "mensagem": "..."}
```

**Respostas:** `{"status": "ok"}` ou
`{"status": "erro", "detalhe": "Evolution API respondeu HTTP 400" | "EVOLUTION_API_KEY não configurada no Brainiac." | "Falha ao notificar o admin via WhatsApp."}`

### ⚠ Cutover pendente — este caller ainda não existe

Hoje o backend do Telovis Barber chama **o Cortex**, não o Brainiac:

- `telovis-barber/backend/routes/notificacoes.js` → `notificarAdminViaCortex()` faz
  `POST ${CORTEX_URL}/api/v1/cortex/notificar-admin`
- `telovis-barber/backend/services/whatsappService.js` → canal `admin` resolve para `CORTEX_URL`
- `telovis-barber/.env` e `telovis-barber/docker-compose.yml` → `CORTEX_URL=http://orbita_cortex:5000`
- **Não existe `BRAINIAC_URL` em nenhum arquivo do backend do Telovis Barber.**

Ou seja: `POST /api/v1/brainiac/notificar-admin` está implementado e testado, mas **sem
nenhum chamador em produção**. Ver [[registro-de-decisoes-brainiac]] RD-010 para o plano de
cutover.

---

## ENTRADA 3 — Evolution API → webhook do canal admin

```
POST {BRAINIAC_URL}/webhook/evolution
```

### Payload consumido (só os campos usados)

| Caminho | Uso |
|---|---|
| `event` | Precisa ser `"messages.upsert"`; qualquer outro → ignorado |
| `instance` | Nome da instância; precisa terminar em `-admin` |
| `data.key.id` | Supressão de eco |
| `data.key.fromMe` | Distinção eco vs. self-chat do gestor |
| `data.key.remoteJid` | Telefone do solicitante (`split("@")[0]`) |
| `data.message.conversation` ou `data.message.extendedTextMessage.text` | Texto da pergunta |

### Respostas (sempre HTTP 200)

| Resposta | Quando |
|---|---|
| `{"status":"ignorado","motivo":"payload inválido"}` | JSON malformado |
| `{"status":"ignorado","motivo":"evento não tratado"}` | `event` diferente |
| `{"status":"ignorado","motivo":"eco da propria resposta do Brainiac"}` | `fromMe` + id conhecido |
| `{"status":"ignorado","motivo":"mensagem sem texto (mídia, etc.)"}` | Sem texto |
| `{"status":"ignorado","motivo":"instância '...' sem tenant admin mapeado"}` | Slug não resolve |
| `{"status":"ignorado","motivo":"solicitante não autorizado"}` | Fail closed |
| `{"status":"ok"}` | Fluxo completo |

**Requisito de configuração na Evolution API:** a instância `${slug}-admin` precisa ter o
webhook `messages.upsert` apontando para o Brainiac. Se apontar para o Cortex (config
atual dos tenants), o Brainiac nunca recebe nada — mesmo cutover da ENTRADA 2.

---

## SAÍDA 1 — Backend do Telovis Barber (`/internal/*`)

Autenticação: header `X-Internal-Key: {INTERNAL_SERVICE_KEY}`, validado por
`authenticateInternal` no Telovis Barber. Base: `WHITELABEL_API_URL`.

| Endpoint | Método | Params | Timeout | Usado em |
|---|---|---|---|---|
| `/internal/cliente-atendimento` | GET | `tenant_id`, `contato`, `unidade?` | 5s | `atendimento_cliente` |
| `/internal/tenant-by-slug` | GET | `slug` | 5s | `_resolver_tenant_admin` |
| `/internal/admin-autorizado` | GET | `tenant_id`, `telefone` | 5s | `_telefone_e_admin_autorizado` |
| `/internal/relatorio-sob-demanda` | GET | `tenant_id`, `tipo`, `periodo_dias`, `telefone_solicitante`, `unidade?` | 10s | `webhook_evolution_admin` |
| `/internal/agente-custo` | POST | corpo JSON de telemetria | 5s | `_reportar_custo_agente` |
| `/internal/brainiac-contexto` | GET | `tenant_id`, `telefone_solicitante` | 20s | `_chat_executivo` (RF-16) |
| `/internal/ai-tokens/debitar` | POST | `tenant_id`, `modelo`, `origem`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `custo_usd` | 5s | `_chat_executivo` — grava custo e debita a carteira juntos |

### Contratos de erro relevantes

| Código | Origem | Tratamento no Brainiac |
|---|---|---|
| 401 | `X-Internal-Key` ausente/errada | Vira erro genérico; **causa provável se `INTERNAL_SERVICE_KEY` não bater com a do backend** |
| 403 | `/relatorio-sob-demanda` — telefone não é o admin | Encerra sem responder |
| 404 | `/brainiac-contexto` — tenant sem carteira de tokens | Cai na mensagem de ajuda |
| 402 | `/brainiac-contexto` — saldo esgotado (`motivo: saldo_esgotado`) ou assinatura vencida | Não chama o LLM |
| 404 | `/tenant-by-slug` — slug não existe ou tenant inativo | Ignora a mensagem |
| 422 | `tipo` fora de `TIPOS_RELATORIO_SOB_DEMANDA` | Não deveria ocorrer: o Brainiac valida antes |

**Acoplamento a vigiar:** `TIPOS_RELATORIO` (Brainiac) precisa continuar sendo subconjunto
de `TIPOS_RELATORIO_SOB_DEMANDA` (`telovis-barber/backend/routes/internal.js`). Divergência entre os
dois vira 422 silencioso para o gestor.

**Duplicidade a vigiar:** a autorização é checada **duas vezes** — em
`/internal/admin-autorizado` (antes de responder qualquer coisa) e novamente dentro de
`/internal/relatorio-sob-demanda`. Redundância deliberada: a primeira protege o caminho do
"não entendi", a segunda protege o backend contra qualquer chamador.

---

## ENTRADA 4 — Backend do Telovis Barber → chat executivo web

```
POST /api/v1/brainiac/chat-web
X-Internal-Key: {INTERNAL_SERVICE_KEY}
```

Chamador: `telovis-barber/backend/routes/brainiac.js` (`POST /brainiac/chat`), timeout 45s, URL em `BRAINIAC_URL` (default `http://telovis_brainiac:5010`). Contrato completo em [[requisitos-funcionais-brainiac]] RF-17.

| Código | Causa | O que o gestor vê |
|---|---|---|
| 200 | Resposta gerada | A resposta, e o saldo atualizado |
| 401 | `X-Internal-Key` diferente entre backend e Brainiac | "não conseguiu responder" |
| 422 | Última mensagem não é do gestor | "não conseguiu responder" |
| 502 | OpenRouter falhou (chave inválida, sem crédito, modelo indisponível) | "não conseguiu responder" |
| sem resposta | Container parado ou fora da rede `orbita_shared` | "está fora do ar" |

---

## SAÍDA 2 — OpenRouter (dois usos de IA)

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer {OPENROUTER_API_KEY}
```

```json
{
  "model": "{OPENROUTER_MODEL}",
  "messages": [
    {"role": "system", "content": "<regras de classificação de pedido de relatório>"},
    {"role": "user", "content": "<mensagem literal do gestor>"}
  ],
  "temperature": 0.0,
  "usage": {"include": true}
}
```

**Resposta esperada:** JSON estrito `{"tipo": ..., "unidade": ..., "periodo_dias": ...}`,
sem markdown e sem explicação (instrução explícita no system prompt).

**Contratos de erro:**
- Timeout (> 15s), 401, JSON inválido, `tipo` fora do domínio → todos convergem para
  `{"tipo": None}` → mensagem de ajuda ao gestor. Nunca derruba o webhook.
- Cercas markdown na resposta são removidas antes do `json.loads`.

**Chave:** própria do Brainiac, independente da do Kalel e de qualquer outro agente
(decisão explícita — [[registro-de-decisoes-brainiac]] RD-004). Estado atual: chave real
no `.env` local e da VPS desde 2026-10-14 ([[registro-de-decisoes-brainiac]] RD-017).

**Telemetria acoplada:** `usage.include = true` é o que alimenta
`POST /internal/agente-custo`. Remover esse flag zera a atribuição de custo por tenant.

**Segundo uso — chat executivo (RF-18):** mesmo endpoint e mesma chave, com `model` =
`BRAINIAC_CHAT_MODEL` (default `openai/gpt-4o-mini`), `temperature 0.3`, `max_tokens` 800 e
timeout 30s. A resposta é texto livre. O `usage` aqui é o que sai da carteira do tenant, então
remover `usage.include` também quebraria a cobrança.

**Diagnóstico de chave:** `401 {'message': 'User not found.'}` = chave apagada, revogada ou de
conta inexistente (caso de 2026-10-14, RD-017). Falta de crédito vem como 402.

---

## SAÍDA 3 — Evolution API (WhatsApp)

```
POST {EVOLUTION_API_URL}/message/sendText/{instancia}
apikey: {EVOLUTION_API_KEY}
Content-Type: application/json

{"number": "5511987654321", "text": "...", "linkPreview": false}
```

- `linkPreview: false` presente apenas no envio da resposta do webhook; ausente em
  `notificar_admin`.
- Normalização de DDI aplicada apenas em `notificar_admin`; no webhook o telefone vem do
  `remoteJid`, já com DDI.
- Resposta usada: `key.id`, gravado em `IDS_ENVIADOS_PELO_BRAINIAC`.
- Falha (HTTP não-2xx ou exceção) → log + alerta Telegram com cooldown por instância.
  **Sem retry.**

**Chave compartilhada com o Kalel:** uma única instância Evolution dedicada ao Telovis Barber,
usada pelos dois agentes, distinta da usada por thieco/lane (comentário do `.env`).

**Convenção de nomes de instância (contrato implícito com o Telovis Barber):**
- Canal admin: `${tenantSlug}-admin` — sufixo fixo, seguro de stripar (usado pelo Brainiac)
- Canal cliente: `${tenantSlug}-${unidadeSlug}` — ambíguo por hífen, resolvido por
  `GET /internal/resolve-instancia` (usado pelo Kalel, **não** pelo Brainiac)

---

## SAÍDA 4 — Telegram (alerta operacional)

```
POST https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage
{"chat_id": "{TELEGRAM_CHAT_ID}", "text": "⚠️ Brainiac: falha ao notificar admin via '...' (HTTP 400)..."}
```

| Aspecto | Valor |
|---|---|
| Destinatário | Willians (operador) |
| Gatilhos | 4 pontos: HTTP de erro e exceção em `notificar_admin`; HTTP de erro e exceção no envio do webhook |
| Cooldown | 15 min por instância |
| Sem token/chat_id | No-op silencioso |
| Falha ao alertar | `except: pass` — nunca propaga |
| Timeout | 5s |

Mesmo padrão herdado do Cortex — ver [[registro-de-decisoes-cortex]] RD-008 e o incidente
que o originou (`thieco-mutinga`, instância desconectada por mais de uma semana sem
ninguém perceber).

---

## Rede e endereçamento

| Variável | Default no código | Observação |
|---|---|---|
| `WHITELABEL_API_URL` | `http://localhost:3002` | Em container aponta para o backend do Telovis Barber na rede `orbita_shared` |
| `EVOLUTION_API_URL` | `http://localhost:8081` | — |
| `BRAINIAC_URL` (lado Kalel) | `http://127.0.0.1:5010` | Precisa virar nome de serviço Docker no deploy conjunto |

A rede `orbita_shared` é `external: true` — precisa existir antes do `docker compose up`.
O `docker-compose.yml` registra que o nome do container do backend em dev local é
`orbita-test_api` e que isso muda quando a stack for renomeada antes do deploy na VPS nova.

---

## Integrações planejadas / pendentes

| ID | Item | Estado |
|---|---|---|
| INT-01 | Cutover do backend do Telovis Barber: `CORTEX_URL` → `BRAINIAC_URL` em `notificacoes.js` e `whatsappService.js` | Aberto — bloqueia o uso real do agente |
| INT-02 | Reapontar o webhook das instâncias `${slug}-admin` na Evolution API para o Brainiac | Aberto — mesmo cutover |
| INT-03 | Chaves reais (OpenRouter própria + Evolution dedicada ao Telovis Barber) | OpenRouter feito em 2026-10-14 (RD-017); Evolution em aberto no local, produção não verificada |
| INT-04 | Autenticação nas rotas de entrada do Brainiac | **Não decidido — perguntar ao Willians**. `chat-web` já exige `X-Internal-Key` desde 2026-10-13 |
| INT-05 | Renomear `WHITELABEL_API_URL` e a rede/container quando o branding "orbita" for removido | Aberto, registrado em `telovis-barber/BACKLOG.md` |

[[indice-brainiac]] · [[arquitetura-brainiac]] · [[registro-de-decisoes-brainiac]]
