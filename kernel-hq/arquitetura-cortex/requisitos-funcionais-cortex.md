---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Requisitos Funcionais — Órbita Cortex

## Módulo 1 — Ingestão de Dados

### RF-01 — Endpoint de Processamento
- **Rota:** `POST /api/v1/cortex/processar`
- **Payload obrigatório:** `tenant_id`, `email`, `nome`, `valor_transacao`, `progresso_aulas`, `dias_ativos`
- **Validação:** Pydantic (`PayloadPlataforma`) — campos ausentes retornam HTTP 422
- **Normalização:** `email` convertido para lowercase e sem espaços antes de gravar

### RF-02 — Configuração de Ambiente
- O `.env` é carregado da raiz do workspace (`parents[1]/.env`), não do diretório do projeto
- Variável obrigatória: `OPENROUTER_API_KEY`
- Falha na leitura da chave não deve expor traceback — retornar erro genérico

---

## Módulo 2 — Classificação via IA

### RF-03 — Chamada ao Modelo
- **Modelo:** `anthropic/claude-3.5-sonnet` via OpenRouter
- **Temperature:** `0.0` — classificação determinística
- **Timeout:** 15 segundos
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

### RF-04 — Prompt de Classificação
O system prompt deve instruir o modelo a retornar **apenas JSON puro** com duas chaves:

| Chave | Tipo | Regra |
|---|---|---|
| `churn_risk` | int (0 ou 1) | 1 se dias_ativos < 7 E progresso_aulas < 10% |
| `upsell_product` | string | `MENTORIA_VIP` se progresso > 70%; `SUPORTE_ACELERADO` se dias > 15 e progresso < 30%; `NENHUMA` caso contrário |

### RF-05 — Limpeza de Resposta
- Antes do `json.loads`, remover blocos de código markdown se presentes (` ```json `, ` ``` `)
- Falha no `json.loads` deve ser capturada e retornar `{"status": "erro"}`

---

## Módulo 3 — Sincronização de Flags

### RF-06 — Persistência com Upsert
- **Tabela:** `matriz_inteligencia` em `orbita_cortex.db`
- **Comportamento:** `INSERT ... ON CONFLICT(email) DO UPDATE`
- **LTV:** acumulado por soma (`ltv = ltv + excluded.ltv`) — não sobrescrito
- **Progresso e flags:** sempre sobrescritos pelo valor mais recente
- **Timestamp:** `ultima_atualizacao` atualizado automaticamente em cada upsert

### RF-07 — Schema da Tabela

| Campo | Tipo | Padrão | Descrição |
|---|---|---|---|
| `email` | TEXT (PK) | — | Identificador único do cliente |
| `tenant_id` | TEXT | — | Plataforma de origem |
| `nome` | TEXT | — | Nome do cliente |
| `ltv` | REAL | 0.0 | Valor total acumulado |
| `progresso_curso` | REAL | 0.0 | Progresso percentual atual |
| `status_churn_risk` | BOOLEAN | 0 | Flag para Horizon |
| `recomendacao_upsell` | TEXT | `'NENHUMA'` | Flag para Pulsar/Quasar |
| `ultima_atualizacao` | DATETIME | CURRENT_TIMESTAMP | Última sincronização |

### RF-08 — Resposta do Endpoint
- **Sucesso:** `{"status": "sincronizado", "matriz_operacional": {churn_risk, upsell_product}}`
- **Erro:** `{"status": "erro", "detalhe": "Falha na sincronização da matriz analítica interna."}`
- Log no console: nome do cliente, churn flag e upsell gerados

---

## Backlog (fora do escopo v1.0)

| ID | Requisito | Prioridade |
|---|---|---|
| F2 | Bearer Token authentication na API | Alta |
| F3 | Endpoint `GET /api/v1/cortex/status/{email}` para consulta de flags | Média |
| F4 | Webhook de saída para notificar agentes em tempo real | Baixa |
| F5 | Histórico de classificações por cliente (audit trail) | Baixa |
