---
status: stable
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Arquitetura Técnica — Agente Órbita Pulsar

> Referência: [[prd-pulsar]] | [[requisitos-funcionais-pulsar]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Framework API | FastAPI 0.110 | Tipagem via Pydantic, docs automáticas no `/docs`, sintaxe limpa | Performance de I/O intensivo seria melhor com async nativo — mas requests síncronos são suficientes para escala atual |
| Runtime | Python 3.x + Uvicorn 0.28 | Ecossistema Python dominante em IA/automação; Uvicorn como servidor ASGI de produção | Não é a linguagem mais rápida — suficiente para o volume de PMEs |
| Banco de dados | SQLite (arquivo local) | Zero configuração, zero dependência externa, portátil, suficiente para volume de leads de PMEs individuais | Não suporta escritas concorrentes pesadas — se um tenant tiver alto volume simultâneo, migrar para PostgreSQL |
| Cliente HTTP | requests 2.31 | Simples, síncrono, zero config — adequado para chamadas únicas ao OpenRouter por request | Sem suporte a async — se escala exigir concorrência, migrar para httpx |
| IA | Claude 3.5 Sonnet via OpenRouter | Melhor relação custo/qualidade para raciocínio em português, qualificação de leads e geração de texto consultivo | Custo por token — volume alto de mensagens aumenta custo proporcional |
| Variáveis de ambiente | python-dotenv 1.0.1 | Padrão de mercado para separar configuração de código | — |

---

## 2. Camadas do sistema

```
[Canal Externo — WhatsApp / Chat / CRM]
         ↓  ↑  (HTTP/REST via JSON + Bearer Token)
[FastAPI — main.py]
    ├── Camada Ativa:   POST /api/v1/disparos/webhook
    └── Camada Passiva: POST /api/v1/pulsar/chat
         ↓  ↑
[Helpers SQLite — database.py]
         ↓  ↑  (sqlite3 driver)
[SQLite — orbita_pulsar.db]
         ↓  (só na camada passiva)
[OpenRouter Gateway — services/openrouter.py]
         ↓  ↑  (HTTPS / requests)
[Claude 3.5 Sonnet — OpenRouter API]
```

**Canal externo:** Qualquer sistema que consuma a API — WhatsApp Business API, n8n, Make, CRM. Pulsar não conhece o canal; apenas responde com payload estruturado.

**FastAPI (main.py):** Roteamento, autenticação, orquestração. Chama helpers de banco e o gateway de IA. Não contém lógica de negócio de banco (delegada aos helpers) nem lógica de IA (delegada ao openrouter.py).

**Helpers SQLite (database.py):** Schema DDL, inicialização e CRUD das 3 tabelas. Separado do main.py para isolamento de responsabilidade.

**OpenRouter Gateway (services/openrouter.py):** Única função: montar o payload e chamar a API. Encapsula URL, headers, modelo e tratamento de erro.

---

## 3. Fluxo de dados

### Camada Passiva (chat receptivo)

```
POST /api/v1/pulsar/chat
  → verify_token()
  → buscar_config_pulsar(tenant_id)
  → gerenciar_lead_pulsar(session_id)          # lê dados existentes
  → gerenciar_memoria(role="user", content)    # salva mensagem do lead
  → gerenciar_memoria(recuperar=True)          # puxa últimas 8 mensagens
  → montar system_prompt com FAQ + flags + perfil do lead
  → requisitar_claude_pulsar(system_prompt, historico)
  → gerenciar_memoria(role="assistant", content)   # salva resposta
  → parse ##META## → atualiza leads_dados silenciosamente
  → resposta_limpa = remover bloco ##META##
  → Response { session_id, resposta, flags, qualificacao }
```

### Camada Ativa (disparo proativo)

```
POST /api/v1/disparos/webhook
  → verify_token()
  → buscar_config_pulsar(tenant_id)
  → selecionar template por tipo_evento (cobranca / boas_vindas / generico)
  → gerenciar_memoria(role="assistant", content=mensagem_gerada)
  → Response { status, destino, mensagem_gerada }
```

> Na camada ativa **não há chamada ao OpenRouter** — a mensagem é gerada por template Python determinístico. IA só entra na camada passiva.

---

## 4. Estrutura de arquivos

```
orbita-pulsar/
├── .env                        # Chaves e configurações locais
├── requirements.txt            # Dependências Python
├── database.py                 # Schema SQLite + helpers CRUD
├── main.py                     # FastAPI — rotas, auth, orquestração
└── services/
    └── openrouter.py           # Gateway Claude via OpenRouter
```

---

## 5. Autenticação e segurança

- **Bearer Token:** `WEBHOOK_TOKEN` no `.env` — validado em todas as rotas exceto `/health`
- **Sem autenticação de tenant:** quem conhece o token pode operar qualquer `tenant_id` — autorização é por token único de integração, não por tenant
- **Chave OpenRouter:** apenas no `.env`, nunca exposta em logs ou responses
- **SQLite local:** não exposto a rede — acesso apenas pelo processo Python local
- **Erros tratados:** falha no OpenRouter retorna string amigável em PT-BR, sem stack trace

---

## 6. Estratégia de escala

**Gargalos previstos:**
- SQLite com escritas simultâneas de múltiplos tenants com alto volume
- Latência do OpenRouter em horários de pico

**Estratégia atual (suficiente para PMEs individuais):**
- SQLite suporta dezenas de leituras simultâneas sem problema
- Uma escrita por request — volume de PMEs não atinge limite do SQLite
- Timeout de 15s no OpenRouter cobre latência normal

**O que exige reescrita acima de X:**
- Se Pulsar operar 10+ tenants com tráfego simultâneo → migrar para PostgreSQL + conexão pooled
- Se latência do OpenRouter se tornar gargalo → adicionar fila assíncrona (Celery ou asyncio)
- Se logs e auditoria se tornarem requisito → adicionar tabela de `eventos` ou integrar observability

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-06-24 | Criação inicial — FastAPI + SQLite + OpenRouter/Claude 3.5 Sonnet |
