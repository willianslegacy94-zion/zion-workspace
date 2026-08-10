---
status: archived
domain: orbita-insight
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Requisitos Funcionais — Órbita Insight

> Referência: [[prd-insight]]

---

## Módulo 1 — Ingestão de dados (API)

| ID | Requisito | Prioridade |
|---|---|---|
| RF-001 | O sistema deve expor um endpoint `POST /api/v1/insight/analise` que aceite um payload JSON com 7 campos obrigatórios | MUST |
| RF-002 | O payload deve ser validado via Pydantic antes de qualquer processamento; campos faltantes ou com tipo errado retornam HTTP 422 | MUST |
| RF-003 | Os 7 campos obrigatórios são: `produtor_whatsapp`, `nome_aluno`, `email_aluno`, `nome_produto`, `valor_pago`, `dias_desde_a_compra`, `progresso_aulas` | MUST |
| RF-004 | O campo `progresso_aulas` deve aceitar float de 0.0 a 100.0 representando percentual de aulas concluídas | MUST |

---

## Módulo 2 — Classificação comportamental

| ID | Requisito | Prioridade |
|---|---|---|
| RF-005 | O sistema deve classificar o aluno na **Regra Churn**: `dias_desde_a_compra <= 7` E `progresso_aulas < 10` → alerta de risco máximo de reembolso | MUST |
| RF-006 | O sistema deve classificar o aluno na **Regra Upsell**: `progresso_aulas > 70` → oportunidade de oferta de próxima esteira | MUST |
| RF-007 | O sistema deve classificar o aluno na **Regra Reengajamento**: `dias_desde_a_compra > 15` E `progresso_aulas >= 10` E `progresso_aulas <= 40` → aluno desmotivado | MUST |
| RF-008 | As 3 regras são mutuamente exclusivas e avaliadas nesta ordem: Churn → Upsell → Reengajamento | MUST |
| RF-009 | A regra aplicada deve ser transmitida ao prompt do modelo como instrução de contexto, não como campo isolado | SHOULD |

---

## Módulo 3 — Geração de insight via IA

| ID | Requisito | Prioridade |
|---|---|---|
| RF-010 | O sistema deve chamar o modelo `anthropic/claude-3.5-sonnet` via OpenRouter para geração do insight | MUST |
| RF-011 | O system prompt deve instruir o modelo a agir como consultor de negócios especialista em infoprodutos e retenção de alunos | MUST |
| RF-012 | O insight gerado deve começar com um emoji de alerta ou oportunidade | SHOULD |
| RF-013 | O insight deve ter no máximo 3 parágrafos curtos com chamadas acionáveis para o produtor | MUST |
| RF-014 | O insight deve ser redigido diretamente ao produtor, falando sobre o aluno em terceira pessoa | MUST |
| RF-015 | A temperatura do modelo deve ser 0.2 para garantir consistência e evitar criatividade excessiva | MUST |
| RF-016 | O timeout da chamada à IA é de 15 segundos; ultrapassado, o endpoint retorna erro controlado | MUST |

---

## Módulo 4 — Persistência e auditoria

| ID | Requisito | Prioridade |
|---|---|---|
| RF-017 | Cada insight gerado com sucesso deve ser persistido na tabela `logs_insights` do SQLite | MUST |
| RF-018 | O log deve conter: `produtor_whatsapp`, `email_aluno`, `nome_aluno`, `produto`, `insight_gerado`, `status_envio`, `timestamp` | MUST |
| RF-019 | O status inicial de todo insight persistido é `PENDENTE` | MUST |
| RF-020 | O banco `orbita_insight.db` é criado automaticamente ao executar `database_insight.py` | MUST |
| RF-021 | Erros na chamada à IA não devem apagar ou corromper registros anteriores no banco | MUST |

---

## Módulo 5 — Resposta da API

| ID | Requisito | Prioridade |
|---|---|---|
| RF-022 | Em caso de sucesso, o endpoint retorna JSON com: `status`, `enviar_para_whatsapp`, `mensagem_insight_pronta` | MUST |
| RF-023 | Em caso de erro na IA, o endpoint retorna JSON com `status: "erro"` e `detalhe` descritivo — sem expor stack trace | MUST |
| RF-024 | Erro de comunicação com OpenRouter deve retornar HTTP 502 com mensagem genérica | MUST |

---

## Regras de Negócio

| ID | Regra | Origem |
|---|---|---|
| RN-001 | Churn: ≤ 7 dias + < 10% progresso = risco de reembolso iminente | PRD §2 |
| RN-002 | Upsell: > 70% progresso = aluno em momentum, receptivo à oferta | PRD §2 |
| RN-003 | Reengajamento: > 15 dias + entre 10% e 40% = aluno travado ou desmotivado | PRD §2 |
| RN-004 | A chave `OPENROUTER_API_KEY` nunca é exposta em código — carregada via `.env` | PRD §8 |
| RN-005 | O sistema não realiza o envio do WhatsApp — entrega o texto pronto ao integrador | PRD §6 |
