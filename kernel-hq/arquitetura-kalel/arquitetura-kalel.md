---
status: experimental
domain: kalel
source: claude
created: 2026-08-10
updated: 2026-08-10
owner: willians
---

# Arquitetura Técnica — Kernel Kalel

## Stack

| Camada | Tecnologia | Justificativa (rastreada ao código) |
|---|---|---|
| Runtime | Python 3.12-slim | `FROM python:3.12-slim` no Dockerfile |
| Framework | FastAPI 0.110.0 | Validação automática via Pydantic (`PayloadConversa`) |
| Servidor | Uvicorn 0.28.0 | ASGI; `reload=True` só no `__main__` de dev |
| Estado local | SQLite (`kalel.db`) | Único estado local é histórico de conversa — ver [[modelo-de-dados-kalel]] |
| IA | OpenRouter, `OPENROUTER_MODEL` (default `openai/gpt-5.6-luna`) | Modelo com visão e tool-calling |
| HTTP Client | requests 2.31.0 | Chamadas síncronas ao Kernel, Brainiac, OpenRouter, Evolution |
| Config | python-dotenv 1.0.1 | `.env` **local à pasta** (`Path(__file__).resolve().parent / ".env"`) |
| Timezone | `zoneinfo` (stdlib) | `America/Sao_Paulo` para a saudação por horário |

Quatro dependências no `requirements.txt`. Nada além disso.

---

## Camadas do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                   CAMADA DE ENTRADA                      │
│  POST /webhook/evolution   (WhatsApp real)               │
│  POST /api/v1/kalel/chat   (HTTP, teste/integração)      │
│  GET  /health              (healthcheck do container)    │
└───────────────────────┬─────────────────────────────────┘
                        │ instancia → tenant_id, unidade
┌───────────────────────▼─────────────────────────────────┐
│                CAMADA DE RESOLUÇÃO                       │
│  Kernel: /internal/resolve-instancia                     │
│          /internal/unidade-atendimento  → FAQ dinâmico   │
│  Brainiac: /api/v1/brainiac/atendimento → contexto real  │
│  (falha no Kernel = 404 tenant inválido;                 │
│   falha no Brainiac = segue sem contexto)                │
└───────────────────────┬─────────────────────────────────┘
                        │ system_prompt montado
┌───────────────────────▼─────────────────────────────────┐
│                 CAMADA DE MEMÓRIA                        │
│  SQLite kalel.db → historico_conversas                   │
│  grava a mensagem do cliente, lê as 10 mais recentes     │
│  (ORDER BY id DESC LIMIT 10, revertido)                  │
└───────────────────────┬─────────────────────────────────┘
                        │ messages[]
┌───────────────────────▼─────────────────────────────────┐
│              CAMADA DE RACIOCÍNIO (LLM)                  │
│  OpenRouter | temperature 0.1 | timeout 20s              │
│  tools: transbordo, confirmar_agendamento,               │
│         cancelar_agendamento | tool_choice: auto         │
│  loop de no máximo 5 rodadas                             │
└───────────────────────┬─────────────────────────────────┘
                        │ tool_calls          │ texto final
┌───────────────────────▼──────────┐  ┌───────▼────────────┐
│      CAMADA DE AÇÃO              │  │  CAMADA DE SAÍDA   │
│  Kernel: /internal/transbordo    │  │  Evolution API     │
│          /internal/agendamentos/ │  │  sendText (padrão) │
│            confirmar | cancelar  │  │  sendMedia (gap)   │
└──────────────────────────────────┘  │  falha → Telegram  │
                                      └────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                CAMADA DE TELEMETRIA                      │
│  Kernel: /internal/agente-custo (agente="kalel")         │
│  fire-and-forget — nunca trava a conversa                │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados Detalhado (webhook real)

```
1. Cliente manda mensagem no WhatsApp da instância "{tenant-slug}-{unidade-slug}"
2. Evolution API → POST /webhook/evolution (event: messages.upsert)
3. Descartes: fromMe, evento errado, sem instância/remetente, sem texto nem mídia
4. Se houver imageMessage → busca base64 na Evolution API → data URI
5. GET /internal/resolve-instancia → (tenant_id, unidade_slug)
6. session_id = "{instancia}:{telefone}"
7. GET /internal/unidade-atendimento → _montar_faq() → blocos preenchidos
8. INSERT da mensagem do cliente em historico_conversas
9. SELECT das 10 últimas mensagens da sessão
10. GET /api/v1/brainiac/atendimento → contexto do cliente (best-effort)
11. Se len(historico) <= 1 → injeta bloco de apresentação com saudação por horário
12. POST OpenRouter (loop de tool-calling, máx. 5 rodadas)
13. POST /internal/agente-custo (soma de tokens e custo das rodadas)
14. INSERT da resposta do assistente em historico_conversas
15. POST /message/sendText (ou sendMedia) na Evolution API
16. Se envio falhar → alerta no Telegram (cooldown 15min por instância)
```

---

## Decisões Técnicas

### Por que fork do Quasar e não reuso?
O Quasar atende `sistema-thieco` e `lane-confeitaria` em produção. O `kernel/BACKLOG.md` registra: "Fork, não rename in-place". O que saiu no fork: `tools/lane_confeitaria.py`, o parâmetro `produto`, o SQLite de config de tenant e o FAQ hardcoded por unidade. Ver [[registro-de-decisoes-kalel]], RD-001.

### Por que nenhuma configuração de negócio no agente?
`database.py` diz explicitamente: "Kalel não guarda config de negócio localmente". Toda a persona e as regras vêm do Kernel a cada mensagem. Consequência arquitetural: um tenant novo não exige deploy do agente — e uma edição na tela de Configurações vale na mensagem seguinte, sem cache nem invalidação.

### Por que `temperature: 0.1` e não 0.0?
Diferente do Cortex/Brainiac (classificação, `0.0`, determinismo), aqui a saída é conversa. `0.1` mantém previsibilidade sem tornar a resposta idêntica a cada turno.

### Por que loop de 5 rodadas se costuma ter só 1?
O comentário no código registra a intenção: manter a estrutura pronta para crescer sem reescrever a lógica; o teto de 5 protege contra comportamento repetitivo do modelo. Hoje já há 3 ferramentas — o loop deixou de ser hipotético.

### Por que todo erro secundário é engolido?
Brainiac, telemetria de custo, transbordo, busca de mídia e alerta do Telegram são todos `try/except` que retornam `None` ou uma string de erro. A regra é única: **nada que não seja a resposta ao cliente pode derrubar a conversa**. O único erro que interrompe é o tenant inválido (`HTTPException 404`), porque sem o FAQ não há o que responder.

### Por que `requests` síncrono dentro de handler `async`?
Herdado do Quasar. Sob concorrência real isso bloqueia o event loop do Uvicorn — é o principal ponto de atenção de performance quando o Kalel receber tráfego simultâneo de vários tenants. **Não é problema hoje** (volume baixo, um cliente por vez), mas é o primeiro item a revisitar antes do deploy na VPS nova. Migração para `httpx.AsyncClient` seria localizada nas ~7 funções de I/O.

### Por que `charset=utf-8` explícito?
Sem o charset declarado, alguns clientes HTTP (Invoke-RestMethod do Windows PowerShell 5.1, citado no código) assumem Latin-1/CP1252 e corrompem acentos e emojis, mesmo com o corpo já em UTF-8.

---

## Docker e Rede

| Item | Valor |
|---|---|
| Container | `kernel_kalel` |
| Imagem base | `python:3.12-slim` |
| Usuário | `appuser` (não-root, com `chown` explícito em `/app` para permitir criar `kalel.db`) |
| Porta | `127.0.0.1:5013:5013` — **não exposta na rede externa** |
| Healthcheck | `GET localhost:5013/health` a cada 30s |
| Restart | `unless-stopped` |
| Redes | `default` + `orbita_shared` (external) |
| `extra_hosts` | `host.docker.internal:host-gateway` (para Docker Engine puro no Linux) |

**Porta 5013:** escolhida porque o Brainiac ocupa 5010 e o Kalel chama o Brainiac por HTTP — os dois precisam rodar ao mesmo tempo.

**Nomes de container resolvidos pelo `.env` atual:** `kernel_brainiac:5010`, `kernel_api:3001`, `evolution_api:8080`.

> Nota de branding: a rede `orbita_shared` e a variável `WHITELABEL_API_URL` ainda carregam nomes antigos. O `kernel/BACKLOG.md` registra que são recursos de infraestrutura já existentes e que serão atualizados antes do deploy na VPS nova.

---

## Execução

```bash
# Dev (reload, 127.0.0.1:5013)
python main.py

# Container
docker compose up -d --build
```

---

## Segurança

| Item | Status |
|---|---|
| Autenticação nas rotas do Kalel | ❌ Nenhuma — `/api/v1/kalel/chat` e `/webhook/evolution` são abertas. Mitigado apenas pelo bind em `127.0.0.1` |
| Autenticação nas chamadas ao Kernel | ✅ `X-Internal-Key` (`INTERNAL_SERVICE_KEY`, precisa bater com o `.env` do backend) |
| `.env` fora do repositório | ✅ `.gitignore` cobre `.env`, `*.db`, `__pycache__`, `.venv`, `.claude/` |
| Segredo dentro da imagem Docker | ✅ `.dockerignore` exclui `.env` e `*.db` |
| Container não-root | ✅ `appuser` |
| Stack trace exposto ao cliente | ✅ Nunca — só `print()` no log do container |
| Isolamento multi-tenant | ✅ `tenant_id` explícito em toda query e chamada; queries de histórico filtram por `session_id` **e** `tenant_id` |
| Validação do remetente do webhook | ❌ Qualquer POST em `/webhook/evolution` é processado se tiver o formato certo. **Risco aceito hoje pelo bind local — reavaliar antes de expor na VPS** |
| Rate limit | ❌ Inexistente |

**Ponto de atenção para a VPS nova:** ao publicar o Kalel atrás de nginx, `/webhook/evolution` passa a ser alcançável de fora. Recomendo (não implementado): restringir por IP da Evolution API ou exigir um header compartilhado, no mesmo espírito do `X-Internal-Key` que o Kernel já usa.

[[indice-kalel]] · [[prd-kalel]] · [[modelo-de-dados-kalel]] · [[integracoes-kalel]]
