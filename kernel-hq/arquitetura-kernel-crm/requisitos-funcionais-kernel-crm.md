---
status: stable
domain: kernel-crm
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Requisitos Funcionais — Kernel v2: CRM Conversacional Multi-Tenant

> Referência: [[prd-kernel-crm]]

---

## Módulo 1 — Migração Multi-Tenant (migrations/001_migrate_to_multitenant_crm.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-01 | Fazer backup do `.db` completo antes de qualquer alteração de schema | Alta | Implementado |
| RF-02 | Criar `tenants_config` e semear um tenant bootstrap `orbita` | Alta | Implementado |
| RF-03 | Renomear `leads_prospeccao` para `leads_prospeccao_legacy` (nunca apagar) | Alta | Implementado |
| RF-04 | Migrar as 1829 linhas para `leads`, mapeando `status_disparo` → `stage` | Alta | Implementado |
| RF-05 | Reconstruir interação `outbound` para os leads já `ENVIADO` (evita recontato duplicado) | Média | Implementado |
| RF-06 | Script idempotente — aborta se `leads_prospeccao_legacy` já existir | Alta | Implementado |
| RF-07 | Verificação pós-migração obrigatória: contagens batendo + `PRAGMA foreign_key_check` limpo | Alta | Implementado |

---

## Módulo 2 — CRM (repositories/, routers/leads.py, interactions.py, meetings.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-08 | Listar leads por tenant, com filtro opcional por `stage` | Alta | Implementado |
| RF-09 | Buscar lead por telefone normalizado (`phone_normalized`, dígitos + prefixo `55`) | Alta | Implementado |
| RF-10 | Criar lead manualmente com validação de duplicidade por telefone | Alta | Implementado |
| RF-11 | Atualizar estágio do lead com validação contra os 5 estágios válidos | Alta | Implementado |
| RF-12 | Registrar interação (`inbound`/`outbound`) por lead, atualizando `updated_at` | Alta | Implementado |
| RF-13 | Agendar reunião — move o lead automaticamente para `reuniao_marcada` | Alta | Implementado |
| RF-14 | Atualizar status de reunião (`agendada`/`realizada`/`cancelada`) | Média | Implementado |

---

## Módulo 3 — Agente de IA (services/llm_agent.py, tools/crm_tools.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-15 | Loop de tool-calling com até 5 iterações, com fallback textual se estourar o limite | Alta | Implementado |
| RF-16 | Suportar Anthropic direto (`/v1/messages`) e OpenRouter (`/chat/completions`) via `LLM_PROVIDER` | Alta | Implementado |
| RF-17 | 4 tools: `update_lead_stage`, `schedule_meeting`, `add_note`, `escalate_to_human` | Alta | Implementado |
| RF-18 | Gate de tools por feature flag do tenant (`flag_agendamento_ia`, `flag_permitir_transbordo`) | Alta | Implementado |
| RF-19 | System prompt dinâmico por tenant, montado a partir de `nome_empresa` + `faq_contexto` | Alta | Implementado |
| RF-20 | Distinguir `LLMNetworkError` (falha de rede/DNS/timeout) de `LLMAPIError` (erro retornado pela API) | Alta | Implementado |
| RF-21 | Nunca capturar as duas exceções com um `except Exception` genérico nos routers | Alta | Implementado |

---

## Módulo 4 — Endpoints Legados do Black (routers/black_legacy.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-22 | `GET /api/v1/black/disparar-lote` busca leads sem interação outbound ainda (substitui `status_disparo='PENDENTE'`) | Alta | Implementado |
| RF-23 | `POST /api/v1/black/webhook-resposta` roda o agente completo (não só classificação) | Alta | Implementado |
| RF-24 | Retornar `stage_atual` do lead após o agente processar a resposta | Média | Implementado |

---

## Módulo 5 — WhatsApp / Evolution API (services/whatsapp_evolution.py, routers/whatsapp.py)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-25 | `POST /api/whatsapp/webhook` recebe payload Evolution API, processa em background | Alta | Implementado (parser não validado contra instância real) |
| RF-26 | `POST /api/test-chat` roda o agente de forma síncrona, sem depender de WhatsApp real | Alta | Implementado |
| RF-27 | `send_message()` retorna `{"simulated": true}` se credenciais Evolution não configuradas | Alta | Implementado |

---

## Módulo 6 — Painel Visual (static/)

| ID | Requisito | Prioridade | Status |
|---|---|---|---|
| RF-28 | Servir painel estático (kanban, busca, drag-and-drop, drawer, chat de teste) via `StaticFiles` | Alta | Implementado |
| RF-29 | `StaticFiles` montado por último em `main.py` — nunca antes dos routers de API | Alta | Implementado |
| RF-30 | Todo `fetch()` do painel envia `tenant_id` (fixo em `"orbita"` nesta fase) | Alta | Implementado |

---

## Estados do funil (stage)

| Estado | Transições permitidas | Quem transiciona |
|---|---|---|
| `novo` | → qualificando, → perdido | Agente de IA (`update_lead_stage`) ou manual no painel |
| `qualificando` | → reuniao_marcada, → perdido | Agente de IA ou manual |
| `reuniao_marcada` | → ganho, → perdido | Agente de IA (`schedule_meeting`) ou manual |
| `ganho` | — (estado final positivo) | — |
| `perdido` | — (estado final negativo) | — |

---

## Requisitos Não Funcionais

| ID | Requisito | Categoria |
|---|---|---|
| RNF-01 | API disponível em `http://127.0.0.1:5000` | Disponibilidade |
| RNF-02 | Migração de banco nunca destrutiva — dado legado sempre em tabela separada | Segurança de dados |
| RNF-03 | SQLite com `PRAGMA journal_mode=WAL` e `PRAGMA foreign_keys=ON` | Integridade |
| RNF-04 | Erro de rede (503) e erro de API (502) sempre distinguíveis pelo chamador | Observabilidade |
| RNF-05 | `.env` no diretório do próprio projeto (`kernel-hq-prospeccao/.env`) — decisão que supera D-07 do PRD original, ver [[registro-de-decisoes-kernel-crm]] | Configuração |
