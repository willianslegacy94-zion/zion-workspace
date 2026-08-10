---
status: stable
domain: kernel-crm
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Arquitetura Técnica — Kernel v2: CRM Conversacional Multi-Tenant

> Referência: [[prd-kernel-crm]] | [[requisitos-funcionais-kernel-crm]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Runtime | Python 3.14 (mantido do Nível 0) | Consistência com Horizon/Pulsar/Quasar/Cortex/Insight — todos Python | — |
| Framework web | FastAPI (`>=0.110.0`, resolvido para 0.139.2 em runtime) | Mesmo motivo do Nível 0 — tipagem via Pydantic, Swagger embutido | Pin de versão solto propositalmente — `pydantic-core` pinado (2.18.2) não tinha wheel pré-compilada pro Python 3.14, exigiria compilar Rust localmente |
| Banco de dados | SQLite (mesmo arquivo `orbita_black.db`, schema evoluído) | 1829 leads, operação single-user — mesmo raciocínio do Nível 0 | Sem suporte a múltiplas gravações concorrentes reais |
| Multi-tenant | `tenant_id` + `tenants_config` (não Postgres/RLS) | Consistência com o padrão já usado por Pulsar/Quasar — evita um terceiro padrão concorrente no ecossistema | Sem isolamento real de segurança entre tenants (mesmo risco aceito por Pulsar/Quasar) |
| IA — qualificação/agendamento | Claude via Anthropic direto OU OpenRouter (`LLM_PROVIDER`) | Tool-calling real testado e funcionando nos dois — flexibilidade de trocar provedor sem reescrever lógica | — |
| WhatsApp | Evolution API (self-hosted, QR code) — decisão de `08-modulo-de-inteligencia-artificial-e-agentes.md` | Multi-instância nativa por tenant, sem custo por mensagem, sem app review da Meta | Parser do webhook não validado contra instância real ainda |
| Painel visual | HTML/CSS/JS estático, servido por `StaticFiles` do FastAPI | Reaproveita 1:1 o painel validado no protótipo Node desta sessão — é só front-end consumindo REST, o backend por trás é irrelevante pra ele | Sem build step, sem framework JS — suficiente pro volume atual |
| HTTP client | `requests` (não SDK oficial `anthropic`) | Mesma escolha do protótipo Node de referência — evita dependência nova só pra chamadas simples de POST | Síncrono — em alta concorrência, migrar pra `httpx` async |

---

## 2. Camadas do sistema

```
[Navegador — painel visual]        [Evolution API — WhatsApp]
              ↓  ↑  HTTP/REST                    ↓  ↑  webhook
[FastAPI + Uvicorn — porta 5000, static/ montado por último]
              ↓  ↑
      [routers/ — validação Pydantic, resolve tenant_id]
              ↓  ↑
   [services/llm_agent.py]  ←→  [tools/crm_tools.py]  ←→  [repositories/]
         ↓  ↑                                                  ↓  ↑
[Anthropic / OpenRouter]                                  [SQLite local]
```

**routers/**: camada de entrada. Um router por recurso (`leads`, `interactions`, `meetings`, `whatsapp`, `black_legacy`). Tenant vai no body (POST/PUT) ou query param (GET/DELETE) — sem header, sem JWT, mesmo padrão simples de Pulsar/Quasar.

**services/llm_agent.py**: orquestra o loop de tool-calling. Não conhece HTTP nem FastAPI — recebe `tenant_id` + `lead_id`, devolve texto de resposta ou levanta `LLMNetworkError`/`LLMAPIError`.

**tools/crm_tools.py**: define as 4 tools e executa efeitos colaterais no CRM via `repositories/`. Isolado do transporte (Anthropic vs OpenRouter formatam a tool-def diferente, mas a execução é a mesma).

**repositories/**: camada de acesso a dado pura (equivalente ao `crmService.js` do protótipo Node) — cada função abre conexão, executa, fecha. Sem lógica de negócio de IA aqui.

**services/whatsapp_evolution.py**: adapter isolado — parser de payload de entrada + `send_message()` de saída. Se `EVOLUTION_API_URL`/`EVOLUTION_API_KEY`/`EVOLUTION_INSTANCE_NAME` não configurados, `send_message()` só loga e retorna `{"simulated": true}`.

---

## 3. Fluxo de dados

### Chat de teste (síncrono, painel)

```
POST /api/test-chat {tenant_id, phone, name, message}
  → get_or_create_lead_by_phone
  → add_interaction(inbound)
  → run_agent(tenant_id, lead_id)
      → busca tenant + monta system prompt dinâmico
      → busca histórico de interactions → messages
      → loop de tool-calling (até 5 iterações)
          → tool_use? → execute_tool → injeta resultado → repete
          → texto final? → retorna
  → add_interaction(outbound)
  → retorna {reply, lead_id}
```

### Webhook WhatsApp real (assíncrono, produção)

```
POST /api/whatsapp/webhook {payload Evolution API}
  → parse_incoming_message(body)  [não validado contra instância real]
  → [None] → {"status": "ignored"}
  → [OK] → BackgroundTasks.add_task(_handle_incoming_message)
  → retorna {"status": "received"} imediatamente
  ...processamento assíncrono...
  → mesmo fluxo do chat de teste, mas ao final chama send_message() de verdade
```

---

## 4. Tratamento de erro — rede vs API

Ponto que já causou confusão real no protótipo Node desta sessão (um `ETIMEDOUT` de rede foi lido como "chave inválida"). Solução estrutural, não só mensagem melhor:

```python
class LLMNetworkError(Exception): ...  # DNS, timeout, conexão recusada
class LLMAPIError(Exception): ...      # HTTP >= 400 retornado pelo provedor

def post_or_raise(url, **kwargs):
    try:
        response = requests.post(url, **kwargs)
    except requests.exceptions.RequestException as e:
        raise LLMNetworkError(...) from e
    if response.status_code >= 400:
        raise LLMAPIError(...)
    return response
```

Nos routers, as duas exceções **nunca** são capturadas juntas — `LLMNetworkError` vira HTTP 503, `LLMAPIError` vira HTTP 502. Testado nesta sessão: chave inválida → 502 confirmado; host inexistente → 503 confirmado.

---

## 5. Pontos de integração

| Integração | Direção | Formato | Autenticação | Status |
|---|---|---|---|---|
| Painel → FastAPI | entrada | REST/JSON | nenhuma (interno) | Ativo |
| FastAPI → Anthropic/OpenRouter | saída | REST/JSON | Bearer/x-api-key no header | Ativo |
| Evolution API → FastAPI | entrada (webhook) | REST/JSON | nenhuma | Parser pronto, **não validado contra instância real** |
| FastAPI → Evolution API | saída | REST/JSON | apikey no header | Pronto, nunca chamado de fato (mesmo comportamento "pronto para integrar" do Nível 0) |

---

## 6. Fronteiras de segurança

- Chaves (`OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`) via `.env` no diretório do projeto — decisão que supera D-07 do PRD original (ver [[registro-de-decisoes-kernel-crm]])
- `.env` protegido por `.gitignore` na raiz do workspace (`*.env`, `.env*`)
- Banco SQLite local, sem porta exposta em rede
- Endpoints sem autenticação de tenant real — mesmo risco aceito por Pulsar/Quasar, documentado como aceitável em fase de desenvolvimento
- `tenant_id` simples no payload é o único isolamento — sem IDOR protection real (diferente do padrão RLS usado por `sistema-orbita-whitelabel`, avaliado e descartado por consistência com os agentes-irmãos, ver [[registro-de-decisoes-kernel-crm]] D-02)

---

## 7. Estratégia de escala

**Limitação atual (herdada do Nível 0):**
- SQLite single-writer
- `requests` síncrono — sem concorrência real de chamadas à IA

**Suficiente para o cenário atual:**
- 1829 leads, tenant único ativo (`orbita`)
- Conversas chegam com espaçamento natural de resposta humana

**O que muda se escalar:**
- 2º tenant real pagante → validar se `tenant_id` simples basta ou se precisa de autenticação (API key por tenant, já cogitado e adiado)
- Volume alto de webhooks simultâneos → SQLite → Postgres, `requests` → `httpx` async
- Evolution API real conectada → validar o parser de `parse_incoming_message` contra payload real, ajustar se necessário

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v1.0 | 2026-06-25 | Nível 0 — motor de disparo + classificação, single-tenant, headless ([[../arquitetura-prospeccao/arquitetura-prospeccao\|arquitetura antiga]]) |
| v2.0 | 2026-07-22 | Evolução multi-tenant + CRM conversacional + painel visual, incorporando qualificação e agendamento com tool-calling real |
