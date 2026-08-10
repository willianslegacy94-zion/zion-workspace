---
status: stable
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Arquitetura Técnica — Órbita Insight

> Referência: [[prd-insight]] | [[requisitos-funcionais-insight]]

---

## 1. Stack de decisão

| Componente | Tecnologia escolhida | Motivo da escolha | O que essa escolha fecha |
|---|---|---|---|
| Framework API | FastAPI 0.110.0 | Validação automática via Pydantic, docs interativas em `/docs`, async nativo, tipagem forte | Não serve frontend — API-only por design |
| Runtime | Python 3.14 + Uvicorn | Ecossistema de IA/ML, facilidade de integração com SDKs de LLM | Performance CPU-intensiva seria melhor com Go |
| Banco de dados | SQLite (arquivo local) | Zero configuração, zero custo, suficiente para auditoria de logs no MVP | Não escala para múltiplos produtores simultâneos sem migrar para PostgreSQL |
| Provedor de IA | OpenRouter (claude-3.5-sonnet) | Acesso unificado a múltiplos modelos, sem vendor lock-in, billing por uso | Depende de conectividade externa — offline não funciona |
| Validação | Pydantic v2 | Tipos forçados em runtime, mensagens de erro claras, integrado ao FastAPI | — |
| Configuração | python-dotenv | Separação de secrets do código, padrão de mercado | `.env` na raiz da workspace — não commitado |

---

## 2. Camadas do sistema

```
[Integrador externo — webhook / automação]
         ↓  (HTTP POST com JSON)
[FastAPI — main.py]
    ↓ Validação Pydantic (PayloadAnalise)
    ↓ Classificação comportamental (3 regras)
    ↓ Chamada HTTP → OpenRouter API
    ↓ Persistência → SQLite (database_insight.py)
    ↓ Response JSON com insight pronto
         ↑
[Produtor recebe no WhatsApp via integrador]
```

**FastAPI (main.py):** Ponto de entrada único. Valida o payload, aplica as regras de negócio no system prompt, chama a IA via `requests`, persiste o log e retorna o insight.

**database_insight.py:** Módulo de inicialização e escrita do SQLite. Cria a tabela `logs_insights` se não existir. Usado como biblioteca pelo `main.py` — `DATABASE_NAME` é a constante compartilhada.

**OpenRouter:** Proxy de LLMs. Recebe o payload com `model`, `messages` e `temperature`. Retorna o texto gerado. Autenticado via `OPENROUTER_API_KEY` no header `Authorization`.

**SQLite (`orbita_insight.db`):** Arquivo gerado na raiz de `orbita-insght/` após executar `database_insight.py`. Persiste o histórico auditável de todos os insights gerados.

---

## 3. Fluxo de dados

```
[POST /api/v1/insight/analise]
    → [Pydantic valida 7 campos obrigatórios]
    → [system_prompt + contexto_aluno montados com dados do payload]
    → [requests.post → OpenRouter (timeout 15s)]
    → [response.json()['choices'][0]['message']['content']]
    → [salvar_insight_no_banco() → INSERT logs_insights]
    → [Response 200: {status, enviar_para_whatsapp, mensagem_insight_pronta}]
```

**Fluxo de erro:**
```
[OpenRouter retorna status != 200]
    → [raise HTTPException(502)]

[Qualquer outra exceção]
    → [return {status: "erro", detalhe: mensagem genérica}]
```

---

## 4. Pontos de integração

| Integração | Direção | Formato | Autenticação | Observação |
|---|---|---|---|---|
| Integrador externo → API | entrada | REST/JSON POST | nenhuma no MVP | Fase 2: API Key por produtor |
| API → OpenRouter | saída | REST/JSON | Bearer Token (`OPENROUTER_API_KEY`) | Timeout 15s; erro controlado |
| API → SQLite | interna | sqlite3 driver | nenhuma (arquivo local) | `orbita_insight.db` na raiz do projeto |

---

## 5. Fronteiras de segurança

- **Chave de IA:** `OPENROUTER_API_KEY` carregada exclusivamente via `.env` com `python-dotenv` — nunca hardcoded
- **Banco de dados:** Arquivo SQLite local, não exposto via rede — acesso apenas pelo processo Python
- **Erros:** Stack traces nunca expostos na response da API — mensagens genéricas para o consumidor
- **Validação de entrada:** Pydantic rejeita payloads malformados antes de qualquer processamento (HTTP 422)
- **Autenticação:** Não implementada no MVP — API aberta localmente; Fase 2 adiciona API Key por produtor

---

## 6. Estratégia de escala

**Gargalos previstos (MVP):**
- SQLite sem suporte a escritas concorrentes — bloqueante se múltiplas chamadas simultâneas
- Chamada síncrona à IA via `requests` — endpoint bloqueia durante o timeout de 15s

**Estratégia atual (suficiente para MVP):**
- Single-tenant, volume baixo — SQLite e chamada síncrona são adequados
- Uvicorn com `reload=True` para desenvolvimento; `workers=N` para produção quando necessário

**O que exige migração acima de X:**
- Múltiplos produtores simultâneos → migrar SQLite para PostgreSQL, chamada síncrona para `httpx` async
- Volume acima de 100 req/min → fila de processamento (Redis + Celery) para desacoplar geração do insight

---

## Histórico de versão

| Versão | Data | Decisão |
|---|---|---|
| v0.1 | 2026-06-25 | Criação inicial — FastAPI + SQLite + OpenRouter + 3 regras de classificação |
