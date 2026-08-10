---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Arquitetura Técnica — Órbita Cortex

## Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Python 3.14 | Já instalado no ambiente |
| Framework | FastAPI 0.110.0 | Validação automática via Pydantic, async nativo |
| Servidor | Uvicorn 0.28.0 | ASGI com reload em dev |
| Banco | SQLite (`orbita_cortex.db`) | Zero dependência externa, banco compartilhado local |
| IA | Claude 3.5 Sonnet via OpenRouter | Raciocínio superior + temperature 0.0 determinístico |
| HTTP Client | requests 2.31.0 | Chamadas síncronas ao OpenRouter |
| Config | python-dotenv 1.0.1 | `.env` global na raiz do workspace |

---

## Camadas do Sistema

```
┌─────────────────────────────────────────────┐
│              CAMADA DE ENTRADA               │
│   Plataformas externas / n8n / Make / cURL   │
│         POST /api/v1/cortex/processar        │
└─────────────────┬───────────────────────────┘
                  │ PayloadPlataforma (Pydantic)
┌─────────────────▼───────────────────────────┐
│            CAMADA DE VALIDAÇÃO               │
│   FastAPI + Pydantic — valida tipos e campos │
│   Normaliza email (lowercase + strip)        │
└─────────────────┬───────────────────────────┘
                  │ dados validados
┌─────────────────▼───────────────────────────┐
│          CAMADA DE CLASSIFICAÇÃO IA          │
│   OpenRouter → Claude 3.5 Sonnet            │
│   temperature: 0.0 | timeout: 15s           │
│   Retorna: {churn_risk, upsell_product}      │
└─────────────────┬───────────────────────────┘
                  │ flags classificados
┌─────────────────▼───────────────────────────┐
│          CAMADA DE PERSISTÊNCIA              │
│   SQLite — orbita_cortex.db                 │
│   INSERT ... ON CONFLICT DO UPDATE          │
│   LTV acumulativo | flags sobrescritos       │
└─────────────────┬───────────────────────────┘
                  │ leitura passiva
┌─────────────────▼───────────────────────────┐
│           CAMADA DE CONSUMO                  │
│   Horizon → lê status_churn_risk            │
│   Pulsar  → lê recomendacao_upsell          │
│   Quasar  → lê recomendacao_upsell          │
└─────────────────────────────────────────────┘
```

---

## Fluxo de Dados Detalhado

```
1. Plataforma envia evento
   POST /api/v1/cortex/processar
   body: {tenant_id, email, nome, valor_transacao, progresso_aulas, dias_ativos}

2. FastAPI valida o payload via Pydantic
   → Erro de validação: HTTP 422 automático

3. Cortex monta o prompt com os dados comportamentais
   → system_prompt: regras de classificação (determinístico)
   → user_content: dias, progresso, valor

4. Chamada ao OpenRouter (Claude 3.5 Sonnet, temperature=0.0)
   → Resposta: JSON puro {"churn_risk": 0|1, "upsell_product": "..."}

5. Limpeza preventiva de markdown na resposta
   → json.loads() → dict Python

6. Upsert no SQLite
   → Novo cliente: INSERT completo
   → Cliente existente: LTV acumula, flags e progresso sobrescritos

7. Resposta ao caller
   → {"status": "sincronizado", "matriz_operacional": {...}}

8. Agentes consultam o banco de forma independente
   → Horizon: SELECT status_churn_risk WHERE email = ?
   → Pulsar/Quasar: SELECT recomendacao_upsell WHERE email = ?
```

---

## Decisões Técnicas

### Por que SQLite e não PostgreSQL?
O banco é local e compartilhado por acesso direto de arquivo — não há rede entre o Cortex e os agentes na v1.0. SQLite é suficiente e elimina dependência de servidor. Migração para PostgreSQL entra no backlog quando a Holding operar em servidores separados.

### Por que temperature 0.0?
Classificações analíticas exigem determinismo. O mesmo perfil de cliente deve sempre gerar o mesmo flag. Temperature > 0 introduziria variação não-determinística nas flags que orientam os agentes.

### Por que Claude 3.5 Sonnet e não Haiku?
O Cortex raciocina sobre regras compostas (combinação de dias + progresso + valor). O Haiku é adequado para suporte conversacional (Horizon). A classificação analítica exige o modelo mais capaz para minimizar erros de flag.

### Por que `requests` síncrono e não `httpx` async?
Simplicidade. O endpoint do Cortex tem baixo volume — cada evento é processado individualmente. Async traz complexidade sem ganho real de throughput no cenário atual.

---

## Porta e Execução

| Ambiente | Host | Porta |
|---|---|---|
| Desenvolvimento | 127.0.0.1 | 5000 |
| Produção (VPS) | 0.0.0.0 | 5000 (nginx proxy) |

```bash
# Dev (com reload)
python3 main.py

# Produção
uvicorn main:app --host 0.0.0.0 --port 5000
```

---

## Segurança (v1.0)

| Item | Status | Backlog |
|---|---|---|
| Bearer Token na API | ❌ Sem auth | F2 |
| `.env` fora do repositório | ✅ `.gitignore` | — |
| Stack trace exposto | ❌ Nunca — retorna erro genérico | — |
| CORS | ❌ Não configurado | F6 |
