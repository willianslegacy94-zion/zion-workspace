---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-08-05
owner: willians
---

# Integrações — Órbita Cortex

## Visão Geral

O Cortex opera em dois sentidos de integração:
- **Entrada:** recebe eventos de plataformas externas via `POST`
- **Saída passiva:** grava no banco SQLite que os agentes consultam diretamente

Não há webhook de saída na v1.0 — a comunicação com os agentes é por leitura do banco.

---

## Integração de Entrada — Plataformas Externas

### Contrato do Endpoint

```
POST http://127.0.0.1:5000/api/v1/cortex/processar
Content-Type: application/json
```

### Payload Esperado

```json
{
  "tenant_id": "hotmart_tenant_01",
  "email": "cliente@exemplo.com",
  "nome": "João Silva",
  "valor_transacao": 497.00,
  "progresso_aulas": 35.5,
  "dias_ativos": 12
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `tenant_id` | string | Identificador da plataforma de origem |
| `email` | string | Email do cliente — normalizado internamente |
| `nome` | string | Nome do cliente |
| `valor_transacao` | float | Valor do evento atual em R$ (não o LTV total) |
| `progresso_aulas` | float | Percentual de progresso no momento do evento (0-100) |
| `dias_ativos` | int | Dias desde a compra / primeiro acesso |

### Resposta de Sucesso

```json
{
  "status": "sincronizado",
  "matriz_operacional": {
    "churn_risk": 0,
    "upsell_product": "MENTORIA_VIP"
  }
}
```

### Resposta de Erro

```json
{
  "status": "erro",
  "detalhe": "Falha na sincronização da matriz analítica interna."
}
```

---

## Integração com OpenRouter (IA)

### Endpoint

```
POST https://openrouter.ai/api/v1/chat/completions
Authorization: Bearer {OPENROUTER_API_KEY}
```

### Payload Enviado

```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    {"role": "system", "content": "<regras de classificação>"},
    {"role": "user", "content": "Dias: X | Progresso: Y% | Valor: R$ Z"}
  ],
  "temperature": 0.0
}
```

### Resposta Esperada (JSON puro)

```json
{"churn_risk": 0, "upsell_product": "MENTORIA_VIP"}
```

**Contratos de erro:**
- Timeout (> 15s): capturado por `except`, retorna `{"status": "erro"}`
- JSON inválido na resposta: `json.loads` falha, capturado por `except`
- Markdown na resposta: limpeza preventiva antes do parse

---

## Integração de Saída — Agentes da Holding

### Padrão de Consulta (leitura direta do SQLite)

Os agentes conectam diretamente ao arquivo `orbita_cortex.db` para ler os flags antes de agir.

**Caminho do banco:** `orbita-cortex/orbita_cortex.db`

### Horizon — Consulta de Churn Risk

```python
import sqlite3

conn = sqlite3.connect("../orbita-cortex/orbita_cortex.db")
cursor = conn.cursor()
cursor.execute(
    "SELECT status_churn_risk, nome FROM matriz_inteligencia WHERE email = ?",
    (email.lower().strip(),)
)
resultado = cursor.fetchone()
conn.close()

if resultado and resultado[0] == 1:
    # Ativar fluxo de acolhimento proativo
```

### Pulsar / Quasar — Consulta de Upsell

```python
cursor.execute(
    "SELECT recomendacao_upsell, nome FROM matriz_inteligencia WHERE email = ?",
    (email.lower().strip(),)
)
resultado = cursor.fetchone()

if resultado:
    if resultado[0] == "MENTORIA_VIP":
        # Acionar oferta de Mentoria VIP
    elif resultado[0] == "SUPORTE_ACELERADO":
        # Acionar oferta de Suporte Acelerado
```

---

## Integração com Telegram (Alerta de Falha de Envio)

**Desde:** 2026-08-05 (ver [[registro-de-decisoes-cortex]], RD-008)

O Cortex também envia WhatsApp diretamente (mensageiro do relatório do admin, `notificar_admin` e `webhook_evolution_admin` — ver seção "Integração de Saída" acima não cobre isso; é chamada direta à Evolution API, não ao SQLite). Quando esse envio falha (instância desconectada, HTTP não-2xx, exceção), o Cortex notifica Willians no Telegram em vez de só logar.

### Endpoint

```
POST https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage
```

### Payload Enviado

```json
{"chat_id": "{TELEGRAM_CHAT_ID}", "text": "⚠️ Cortex: falha ao notificar admin via 'thieco-admin' (HTTP 400)..."}
```

### Configuração

`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env` compartilhado da raiz do workspace (local) e em `/var/www/orbita-agents/.env` (VPS produção). Se qualquer uma das duas variáveis estiver ausente, `_alertar_telegram()` vira no-op silencioso — não quebra o fluxo principal.

**Cooldown:** 15min por `instancia` (evita spam quando uma instância fica horas/dias fora do ar).

**Contratos de erro:** best-effort — falha ao notificar o Telegram (timeout, token inválido) é capturada e ignorada, nunca propaga pro chamador original.

---

## Integrações Planejadas (Backlog)

| ID | Integração | Descrição | Prioridade |
|---|---|---|---|
| INT-01 | n8n / Make webhook | Trigger automático a cada evento de plataforma | Alta |
| INT-02 | Hotmart webhook nativo | Receber eventos de compra e progresso diretamente | Alta |
| INT-03 | TheMembers webhook | Integração com plataforma EAD parceira | Média |
| INT-04 | Webhook de saída para agentes | Notificar agentes em tempo real sem polling do banco | Baixa |
| INT-05 | Endpoint GET de consulta | `GET /api/v1/cortex/status/{email}` para debug | Média |
