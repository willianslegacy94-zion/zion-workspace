---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Integrações — Kernel Kalel

## Visão Geral

O Kalel é **consumidor** de quatro serviços externos e **produtor** de nenhum. Ninguém depende de uma API do Kalel — a única entrada não solicitada é o webhook da Evolution API.

```
Cliente (WhatsApp)
      │
      ▼
Evolution API ──webhook──► KALEL ──► Kernel backend (/internal/*)
      ▲                      ├─────► Brainiac (/api/v1/brainiac/atendimento)
      │                      ├─────► OpenRouter (chat/completions)
      └──── sendText ────────┘       └─► Telegram (só em falha de envio)
```

| Serviço | Sentido | Timeout | Falha derruba a conversa? |
|---|---|---|---|
| Kernel — `/internal/unidade-atendimento` | saída | 5s | **Sim** (404 tenant inválido) |
| Kernel — `/internal/resolve-instancia` | saída | 5s | **Sim** (mensagem descartada) |
| Kernel — `/internal/transbordo` | saída | 5s | Não |
| Kernel — `/internal/agendamentos/*` | saída | 5s | Não |
| Kernel — `/internal/agente-custo` | saída | 5s | Não |
| Brainiac — `/api/v1/brainiac/atendimento` | saída | 3s | Não |
| OpenRouter | saída | 20s | Não (fallback) |
| Evolution API — busca de mídia | saída | 20s | Não |
| Evolution API — envio | saída | 15s | Não (alerta) |
| Evolution API — webhook | **entrada** | — | — |
| Telegram | saída | 5s | Não |

---

## 1. Kernel backend (`WHITELABEL_API_URL`)

Todas as chamadas usam o header `X-Internal-Key: {INTERNAL_SERVICE_KEY}`, que precisa bater com o `INTERNAL_SERVICE_KEY` do `.env` do backend. As rotas `/internal/*` são montadas antes do `authenticate` global do Kernel — são serviço-a-serviço, nunca de usuário logado.

### 1.1 `GET /internal/resolve-instancia`

```
GET /internal/resolve-instancia?instancia=barbearia-exemplo-jardim-mutinga
→ 200 {"tenant_id": 1, "unidade_slug": "jardim-mutinga", "tenant_nome": "Barbearia Exemplo"}
→ 404 {"erro": "Instância não corresponde a nenhum tenant/unidade."}
```

O match é feito no banco (`(t.slug || '-' || u.slug) = $1`) porque tanto o slug do tenant quanto o da unidade podem conter hífen — split de string seria ambíguo.

### 1.2 `GET /internal/unidade-atendimento`

```
GET /internal/unidade-atendimento?tenant_id=1&unidade=jardim-mutinga
```

Resposta (campos que o Kalel consome em `_montar_faq`):

```json
{
  "nome_tenant": "...", "nome_unidade": "...",
  "nome_assistente": "...", "tom_voz": "...",
  "endereco": "...", "mapa_url": "...", "instagram": "...",
  "link_agendamento": "...", "regras_atendimento": "...",
  "mensagem_transbordo": "...",
  "horario": "Seg: 09:00-19:00 ...",
  "equipe": ["..."],
  "precos": [{"nome": "...", "categoria": "servico", "preco": 45.0}]
}
```

Do lado do Kernel, esse pacote combina quatro fontes reais: campos livres de `unidades.atendimento_ia`, `jornada_unidade`, `profissionais` ativos e `catalogo` (categorias `servico` e `combo`, ativos). Nada é duplicado nem hardcoded.

**Contrato de erro:** resposta não-ok ou exceção → `None` → o Kalel levanta `HTTPException 404` ("Tenant inválido no Kalel."). É a única falha de integração que interrompe o atendimento.

**Divergência de contrato registrada:** `_deve_enviar_imagem` espera `info["imagem_url"]`, campo que **não existe** nesta resposta. Ver [[requisitos-funcionais-kalel]], RF-20.

### 1.3 `POST /internal/transbordo`

```json
{"tenant_id": "1", "unidade": "jardim-mutinga",
 "contato_cliente": "5511999999999", "nome_cliente": "João", "motivo": "quer falar com o gerente"}
→ 200 {"ok": true, "notificado_admin": true}
```

Efeito no Kernel: WhatsApp real para o admin do tenant (se ele tiver `notif_canal_whatsapp` e telefone) e uma linha em `notificacoes` com `tipo = 'transbordo_humano'`.

**Ordem obrigatória no prompt:** executar a ferramenta primeiro, responder ao cliente com a `mensagem_transbordo` do tenant depois.

### 1.4 `POST /internal/agendamentos/confirmar` e `/cancelar`

```json
{"tenant_id": 1, "contato": "5511999999999"}
→ 200 {"confirmado": true, "agendamento": {"id":.., "status":"confirmado", "data":"2026-08-12",
        "hora_inicio":"14:00:00", "servico_nome":"Corte", "cliente_nome":"João"}}
→ 404 {"erro": "Nenhum agendamento pendente/confirmado encontrado pra esse contato."}
```

**Como o backend escolhe o agendamento:** `proximoAgendamentoPorContato` — mesmo `tenant_id` e `cliente_contato`, status em (`pendente`, `confirmado`), `(data + hora_inicio) >= NOW()`, ordenado pelo mais próximo, `LIMIT 1`. Sem código nem link de confirmação: a identidade é o próprio telefone da conversa.

**Cancelamento libera o horário na hora** — a `EXCLUDE constraint` de sobreposição do Kernel ignora `status = 'cancelado'`, nenhuma limpeza extra é necessária.

**Mesma transição de status** que o fluxo público por link (`/agendamentos/publico/confirmar` e `/cancelar`) — confirmar pelo Kalel ou pelo link é indistinguível para o resto do sistema.

### 1.5 `POST /internal/agente-custo`

```json
{"tenant_id": 1, "agente": "kalel", "modelo": "openai/gpt-5.6-luna", "origem": "kalel_chat",
 "prompt_tokens": 1200, "completion_tokens": 180, "total_tokens": 1380,
 "custo_usd": 0.0042, "session_id": "barbearia-exemplo-jardim-mutinga:5511999999999",
 "unidade": "jardim-mutinga"}
```

Fire-and-forget dos dois lados. Os totais somam **todas** as rodadas de tool-calling da mesma mensagem, não só a última.

---

## 2. Brainiac (`BRAINIAC_URL`, default `http://127.0.0.1:5010`)

```
GET /api/v1/brainiac/atendimento?tenant_id=1&contato=5511999999999&unidade=jardim-mutinga
→ {"status": "ok", "cliente": {"nome","contato","unidade","tipo",
     "total_visitas","ultima_visita","dias_desde_ultima_visita","churn_risk"}}
→ {"status": "nao_encontrado"} | {"status": "erro", "detalhe": "..."}
```

O Brainiac é repasse puro para `GET /internal/cliente-atendimento` do Kernel, sem chamada de IA. O `churn_risk` é regra determinística: mais de **45 dias** sem visita (`LIMITE_DIAS_CHURN` no backend).

**No Kalel:** só o ramo `status == "ok"` é aproveitado; qualquer outra coisa (inclusive Brainiac fora do ar) resulta em `None` e o prompt cai no bloco simples "Você está atendendo o cliente: {nome}".

**Por que passar pelo Brainiac se o dado é do Kernel?** Preserva a fronteira: o Brainiac é o dono do contexto analítico do cliente; o Kalel é o dono da conversa. A docstring do Brainiac declara: "O Brainiac nunca fala com o cliente final; quem consome esta rota é o Kalel."

---

## 3. OpenRouter

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer {OPENROUTER_API_KEY}
```

```json
{
  "model": "openai/gpt-5.6-luna",
  "messages": [{"role": "system", "content": "<persona + FAQ + contexto do cliente>"}, "..."],
  "temperature": 0.1,
  "tools": [ "acionar_atendimento_humano", "confirmar_agendamento", "cancelar_agendamento" ],
  "tool_choice": "auto",
  "usage": {"include": true}
}
```

**Chave própria do Kalel**, independente do Brainiac e de qualquer outro agente (`.env` local, não o compartilhado da raiz do workspace).

**Contratos de erro:**
- HTTP != 200 ou resposta sem `choices` → log com status e corpo, depois `KeyError` capturado pelo `except` externo → `FALLBACK_RESPOSTA`
- Timeout (> 20s) → `FALLBACK_RESPOSTA`
- 5 rodadas de tool-calling sem resposta final → log + `FALLBACK_RESPOSTA`

**Estado atual:** `OPENROUTER_API_KEY` ainda é o placeholder `TROQUE-AQUI` — em teste local isso produz 401 e o cliente recebe o fallback. Comportamento correto e já observado nos testes de 2026-08-05.

---

## 4. Evolution API (`EVOLUTION_API_URL`, header `apikey`)

### 4.1 Entrada — webhook

Configurado no Kernel (`backend/services/whatsappService.js`), evento `MESSAGES_UPSERT`. O Kalel exige `body.event == "messages.upsert"`, ignora `key.fromMe`, e extrai `instance`, `key.remoteJid` (telefone antes do `@`) e `pushName`.

### 4.2 Busca de mídia

```
POST /chat/getBase64FromMediaMessage/{instancia}
{"message": {"key": <key original do webhook>}}
→ {"base64": "..."}  →  "data:{mimetype};base64,{...}"
```

Necessário porque mídia do WhatsApp é criptografada ponta a ponta — o webhook só entrega metadados. Falha → `None`, e o Kalel ainda responde ao texto/legenda se houver.

### 4.3 Envio

| Caso | Endpoint | Payload |
|---|---|---|
| Padrão | `POST /message/sendText/{instancia}` | `{number, text, linkPreview: false}` |
| Com imagem da unidade | `POST /message/sendMedia/{instancia}` | `{number, mediatype: "image", media, caption, fileName: "unidade.jpg"}` |

`linkPreview: false` evita que o WhatsApp gere thumbnail quando a resposta contém link — sem isso, o cliente vê a resposta como "mensagem com imagem".

**Uma instância por unidade**, nomeada `{tenant-slug}-{unidade-slug}`. A `EVOLUTION_API_KEY` é compartilhada entre Kalel e Brainiac (uma instância Evolution dedicada ao Kernel, distinta da usada por thieco/lane).

---

## 5. Telegram (alerta de falha de envio)

```
POST https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage
{"chat_id": "{TELEGRAM_CHAT_ID}",
 "text": "⚠️ Kalel: falha ao enviar WhatsApp pra {telefone} via '{instancia}' (HTTP {status}). Provável instância desconectada — cliente não recebeu resposta."}
```

Mesmo padrão adotado no Cortex em 2026-08-05 (ver [[registro-de-decisoes-cortex]], RD-008), motivado por um incidente real em que uma instância ficou mais de uma semana desconectada sem ninguém perceber.

- **Cooldown:** 900s (15min) por instância, em dicionário na memória do processo (`_ULTIMO_ALERTA_TELEGRAM`) — reinicia junto com o container
- **No-op silencioso** se `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` estiverem ausentes
- **Estado atual:** as duas variáveis estão **vazias** no `.env` do Kalel — nenhum alerta é enviado hoje. Preencher antes do deploy
- **Best-effort:** falha ao alertar é engolida, nunca propaga
- **Sem retry** do envio original — o alerta serve para o Willians agir manualmente

---

## Variáveis de ambiente

| Variável | Uso | Estado no `.env` atual |
|---|---|---|
| `OPENROUTER_API_KEY` | Bearer do OpenRouter | placeholder `TROQUE-AQUI` |
| `OPENROUTER_MODEL` | Modelo (default `openai/gpt-5.6-luna`) | preenchida |
| `BRAINIAC_URL` | Contexto do cliente | `http://kernel_brainiac:5010` |
| `EVOLUTION_API_URL` | WhatsApp | `http://evolution_api:8080` |
| `EVOLUTION_API_KEY` | Header `apikey` | placeholder `TROQUE-AQUI` |
| `WHITELABEL_API_URL` | Backend do Kernel | `http://kernel_api:3001` |
| `INTERNAL_SERVICE_KEY` | Header `X-Internal-Key` | preenchida |
| `TELEGRAM_BOT_TOKEN` | Alerta | **vazia** |
| `TELEGRAM_CHAT_ID` | Alerta | **vazia** |

---

## Integrações planejadas (backlog)

| ID | Integração | Origem | Prioridade |
|---|---|---|---|
| INT-01 | Gateway de pagamento (Pix Copia e Cola / link de cartão na conversa) | `kernel/BACKLOG.md`, cenário A | Em aberto |
| INT-02 | Leitura de comprovante Pix por print (cenário B, usa a visão já existente) | `kernel/BACKLOG.md` | Em aberto |
| INT-03 | Autenticação do webhook `/webhook/evolution` antes de expor na VPS | recomendação de arquitetura | Alta |
| INT-04 | Retry automático de envio pela Evolution API | herdado do padrão do Cortex | Média |

[[indice-kalel]] · [[arquitetura-kalel]] · [[registro-de-decisoes-kalel]]
