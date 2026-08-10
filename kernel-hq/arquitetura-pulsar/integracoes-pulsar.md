---
status: stable
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Integrações — Agente Órbita Pulsar

> Referência: [[arquitetura-pulsar]] | [[requisitos-funcionais-pulsar]]

---

## 1. OpenRouter — Gateway de IA

| Atributo | Valor |
|---|---|
| URL | `https://openrouter.ai/api/v1/chat/completions` |
| Modelo | `anthropic/claude-3.5-sonnet` |
| Autenticação | `Authorization: Bearer {OPENROUTER_API_KEY}` |
| Temperature | `0.2` — baixa para minimizar alucinações em contexto de negócio |
| Timeout | `15 segundos` |
| Headers extras | `HTTP-Referer: https://orbita.pulsar` / `X-Title: Orbita Pulsar` |

**Payload enviado:**

```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    { "role": "system", "content": "<system_prompt montado pelo Pulsar>" },
    { "role": "user",      "content": "mensagem 1 do lead" },
    { "role": "assistant", "content": "resposta 1 da IA" },
    { "role": "user",      "content": "mensagem atual" }
  ],
  "temperature": 0.2
}
```

**Resposta consumida:**

```json
{
  "choices": [
    { "message": { "content": "resposta da IA com possíveis tags e ##META##" } }
  ]
}
```

**Tratamento de erro:**
- `status_code != 200` → retorna `"[Erro OpenRouter]: Falha ao processar raciocínio do Claude 3.5."`
- Exception de rede → retorna `"[Erro Conexão]: Sem resposta da rede externa de IA."`
- Nenhum stack trace é propagado ao canal externo

---

## 2. Webhook Inbound — Canal Externo → Pulsar

Contrato que sistemas externos (WhatsApp, n8n, Make, CRM) devem seguir para enviar mensagens ao Pulsar.

**Endpoint:** `POST /api/v1/pulsar/chat`

**Headers obrigatórios:**
```
Authorization: Bearer <WEBHOOK_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "tenant_id": "tenant_pme_pulsar",
  "session_id": "5511999990000",
  "mensagem": "Olá, quero saber sobre o pacote básico",
  "nome": "João Silva",
  "email": "joao@empresa.com"
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `tenant_id` | sim | ID do tenant configurado no banco |
| `session_id` | sim | Identificador único e estável da conversa (ex: número de telefone) |
| `mensagem` | sim | Texto enviado pelo lead |
| `nome` | não | Nome do lead — atualiza `leads_dados` se fornecido |
| `email` | não | Email do lead — atualiza `leads_dados` se fornecido |

**Response de sucesso (200):**
```json
{
  "session_id": "5511999990000",
  "resposta": "Olá, João! Nosso pacote básico custa R$ 1.500/mês...",
  "flags": {
    "transbordo": false,
    "enviar_arquivo": false,
    "perfil_upsell": false
  },
  "qualificacao": {
    "etapa": "Dúvida sobre preço",
    "perfil": "Prospect Inicial"
  }
}
```

---

## 3. Webhook Outbound — Pulsar → Canal Externo (Disparo Ativo)

Contrato que sistemas externos enviam para acionar disparos proativos do Pulsar.

**Endpoint:** `POST /api/v1/disparos/webhook`

**Headers obrigatórios:**
```
Authorization: Bearer <WEBHOOK_TOKEN>
Content-Type: application/json
```

**Body — tipo `cobranca`:**
```json
{
  "tenant_id": "tenant_pme_pulsar",
  "telefone_destino": "5511999990000",
  "nome_cliente": "Maria Oliveira",
  "tipo_evento": "cobranca",
  "valor_pendente": 1500.00,
  "chave_pix": "00020126330014BR.GOV.BCB.PIX..."
}
```

**Body — tipo `boas_vindas`:**
```json
{
  "tenant_id": "tenant_pme_pulsar",
  "telefone_destino": "5511999990000",
  "nome_cliente": "Carlos Souza",
  "tipo_evento": "boas_vindas"
}
```

**Tipos de evento suportados:**

| tipo_evento | Campos extras obrigatórios | Template gerado |
|---|---|---|
| `cobranca` | `valor_pendente`, `chave_pix` | Mensagem com valor e Pix copia e cola |
| `boas_vindas` | — | Apresentação do assistente virtual |
| qualquer outro | — | Mensagem genérica de atualização |

**Response de sucesso (200):**
```json
{
  "status": "disparado",
  "destino": "5511999990000",
  "mensagem_gerada": "Olá, Maria Oliveira! Tudo bem? Identificamos que..."
}
```

> **Importante:** Pulsar retorna a mensagem gerada mas **não envia**. O sistema externo que chamou o endpoint é responsável por transmitir ao destinatário via WhatsApp Business API, Twilio, Z-API ou similar.

---

## 4. Tags de automação no response

O campo `resposta` pode conter tags que o canal externo deve processar:

| Tag | Ação esperada pelo canal |
|---|---|
| `[ENVIAR_ARQUIVO_XYZ]` | Enviar o arquivo/documento referenciado ao lead |
| `[PERFIL_UPSELL]` | Acionar fluxo de vendas de alto ticket |
| `[ACIONAR_TRANSBORDO]` | Transferir conversa para operador humano |

As tags são incluídas na `resposta` pelo Claude quando a feature flag correspondente está ativa. O canal externo deve fazer o parse dessas tags após receber o response.

---

## 5. Endpoints disponíveis

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/tenants` | Bearer | Criar/atualizar tenant |
| GET | `/tenants/{tenant_id}` | Bearer | Consultar configuração do tenant |
| POST | `/api/v1/pulsar/chat` | Bearer | Chat receptivo com IA |
| POST | `/api/v1/disparos/webhook` | Bearer | Disparo ativo proativo |
| GET | `/leads/{session_id}/history` | Bearer | Histórico de conversa |
| GET | `/health` | — | Status do agente |
| GET | `/docs` | — | Documentação automática FastAPI (Swagger) |
