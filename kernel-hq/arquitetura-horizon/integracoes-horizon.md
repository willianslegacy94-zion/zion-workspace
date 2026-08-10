---
status: archived
domain: horizon
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Integrações — Agente Órbita Horizon

> Referência: [[arquitetura-horizon]] | [[requisitos-funcionais-horizon]]

---

## 1. OpenRouter — Gateway de IA

| Atributo | Valor |
|---|---|
| URL | `https://openrouter.ai/api/v1/chat/completions` |
| Modelo | `anthropic/claude-3-haiku` |
| Autenticação | `Authorization: Bearer {OPENROUTER_API_KEY}` |
| Temperature | `0.3` — leve liberdade criativa para respostas de suporte mais naturais |
| Timeout | `12 segundos` |
| Headers | `Content-Type: application/json` |

**Payload enviado:**

```json
{
  "model": "anthropic/claude-3-haiku",
  "messages": [
    { "role": "system", "content": "<system_prompt montado pelo Horizon>" },
    { "role": "user",      "content": "mensagem 1 do aluno" },
    { "role": "assistant", "content": "resposta 1 da IA" },
    { "role": "user",      "content": "mensagem atual" }
  ],
  "temperature": 0.3
}
```

**Resposta consumida:**

```json
{
  "choices": [
    { "message": { "content": "resposta da IA com possível [ACIONAR_TRANSBORDO]" } }
  ]
}
```

**Tratamento de erro:**
- `status_code != 200` → retorna `"[Erro OpenRouter]: Resposta inválida do servidor de IA."`
- Exception de rede → retorna `"[Erro Conexão]: Falha de rede ao tentar se comunicar com o OpenRouter."`
- Nenhum stack trace é propagado ao canal externo

**Por que Haiku e não Sonnet:** Claude 3 Haiku é mais rápido (< 1s vs 3-5s) e mais barato por token. Para FAQ de suporte de nível 1 (login, senha, certificado) o raciocínio do Haiku é suficiente. Sonnet seria custo desnecessário para esse caso de uso.

---

## 2. Webhook Inbound — Canal Externo → Horizon

Contrato que sistemas externos (bots WhatsApp, widgets de chat, n8n, Make) devem seguir para enviar mensagens ao Horizon.

**Endpoint:** `POST /api/v1/horizon/chat`

**Headers (atual — v1.0 sem auth):**
```
Content-Type: application/json
```

> **Atenção:** autenticação Bearer Token está planejada no backlog (F2) mas não implementada na v1.0. Não expor o endpoint à internet sem implementar F2.

**Body — aluno com autenticação:**
```json
{
  "tenant_id": "tenant_teste_01",
  "session_id": "5511999990000",
  "mensagem": "Como acesso a plataforma?",
  "email_autenticacao": "aluno@email.com"
}
```

**Body — sem autenticação (Horizon Puro, `flag_validar_aluno = 0`):**
```json
{
  "tenant_id": "tenant_publico_01",
  "session_id": "5511999990000",
  "mensagem": "Quero saber sobre os cursos disponíveis"
}
```

| Campo | Obrigatório | Descrição |
|---|---|---|
| `tenant_id` | sim | ID do tenant configurado no banco |
| `session_id` | sim | Identificador único e estável da conversa (ex: número de WhatsApp, ID de chat) |
| `mensagem` | sim | Texto enviado pelo aluno |
| `email_autenticacao` | não* | E-mail para validação de matrícula — *obrigatório funcionalmente quando `flag_validar_aluno = 1` |

**Responses:**

```json
// Aluno autenticado, sem transbordo (200)
{ "acao": "MANTER_NA_IA", "resposta_ia": "Olá, Andréa! Para acessar a plataforma..." }

// Aluno pediu humano (200)
{ "acao": "GATILHO_HUMANO_DETECTADO", "resposta_ia": "Entendo sua situação...\n\n(Aviso: suporte sinalizado)." }

// E-mail não encontrado (200)
{ "acao": "MANTER_NA_IA", "resposta_ia": "Não encontrei nenhuma assinatura ativa na Zion Academy vinculada ao e-mail enviado..." }

// Tenant não cadastrado (404)
{ "detail": "Tenant não cadastrado neste agente." }
```

---

## 3. Integração Futura — CRM / Painel Humano (stub)

Quando `GATILHO_HUMANO_DETECTADO` é acionado, existe um stub comentado no `main.py` (~linha 88) para integração futura:

```python
# TODO: INTEGRAÇÃO FUTURA COM SEU CRM PRÓPRIO / PAINEL HUMANO
# payload_crm = {"session_id": payload.session_id, "usuario": nome_usuario}
# requests.post("https://crm.suaempresa.com/webhook", json=payload_crm)
```

**Estado atual:** log no console — `⚙️ LOG CONSOLE: Sessão {session_id} solicitou suporte humano.`

**Quando implementar (F4 do backlog):** quando houver CRM ou painel de atendimento definido. O stub já está no lugar certo — só descomentar e preencher a URL do webhook do CRM.

---

## 4. Integração CSV — Base de Alunos (TheMembers / outras plataformas)

Import pontual executado diretamente via terminal:

```bash
python database.py "Cópia de Base de Clientes - CS - Carteira de Clientes.csv"
```

**Fonte:** Export de carteira de clientes da TheMembers (ou qualquer plataforma com colunas equivalentes).

**Colunas esperadas no CSV:**

| Coluna CSV | Mapeamento | Regra |
|---|---|---|
| `E-mail Admin` | `alunos_base.email` | Obrigatório — linha pulada se NaN |
| `Contrato - Contato` | `alunos_base.nome` | Preferencial |
| `Nome da plataforma` | `alunos_base.nome` (fallback) | Usado quando `Contrato - Contato` está vazio |

**Comportamento na importação:**
- Cria/substitui `tenant_teste_01` (Zion Academy) via `INSERT OR REPLACE`
- Insere até 15 registros da amostra — ajustar `df.head(15)` para importação completa em produção
- Linhas com e-mail ou nome NaN são puladas silenciosamente
- `status_assinatura` fixo como `'ATIVA'` — não mapeado do CSV na v1.0

---

## 5. Endpoints disponíveis

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/v1/horizon/chat` | sem auth (v1) | Chat receptivo com IA + validação de aluno |
| GET | `/docs` | — | Documentação automática Swagger (FastAPI) |

**Planejado (backlog):**

| Método | Rota | Item | Descrição |
|---|---|---|---|
| DELETE | `/historico/{session_id}` | F3 | Limpeza de sessão antiga |
| POST | `/tenants` | — | Gestão de tenants via API sem editar banco |
| GET | `/health` | — | Health check padronizado |
