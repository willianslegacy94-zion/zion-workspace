---
status: stable
domain: pulsar
source: claude
created: 2026-06-24
updated: 2026-06-24
owner: willians
---

# Registro de Decisões — Agente Órbita Pulsar

> Referência: [[prd-pulsar]] | [[requisitos-funcionais-pulsar]] | [[arquitetura-pulsar]]

Memória viva do agente. Registra o que mudou, por que mudou e o que isso significa.
Entradas em ordem cronológica crescente — as mais recentes no final.

---

## 2026-06-24 — Criação inicial do agente Órbita Pulsar

**Motivo:** Necessidade de um motor de atendimento IA multi-tenant reutilizável para PMEs clientes da Zion Ops. Primeira versão focada em estrutura core funcional.
**Stack escolhida:** Python + FastAPI + SQLite + OpenRouter (Claude 3.5 Sonnet) + requests.
**Schema inicial:** 3 tabelas — `tenants_config`, `leads_dados`, `historico_conversas`.
**Status:** aplicado
**Artefatos criados:** todos os arquivos core do agente + documentação completa.

---

## 2026-06-24 — Troca de httpx por requests

**Motivo:** `httpx` não estava na lista de dependências definida pelo integrador. `requests` já era dependência declarada no `requirements.txt`.
**Impacto:** Função `chat()` em `openrouter.py` passou de async para síncrona. `await` removido da chamada em `main.py`. Endpoints passaram de `async def` para `def` (compatível com FastAPI síncrono).
**Status:** aplicado
**Artefatos atualizados:** `services/openrouter.py`, `main.py`, [[arquitetura-pulsar]]

---

## 2026-06-24 — Schema v2: novo modelo de dados com feature flags

**Motivo:** Schema inicial genérico (`tenants/leads/history`) foi substituído por schema com semântica de negócio explícita e feature flags por tenant.
**Impacto:**
- `tenants` → `tenants_config` com `flag_enviar_documentos`, `flag_qualificar_lead`, `flag_permitir_transbordo`
- `leads` → `leads_dados` com `etapa_atual`, `perfil_qualificacao`, `dados_adicionais`
- `history` → `historico_conversas` com `timestamp` e `tenant_id`
- `slug` substituído por `tenant_id` (TEXT direto)
- `external_id` substituído por `session_id`
- `system_prompt` substituído por `faq_contexto`
**Status:** aplicado
**Artefatos atualizados:** `database.py`, `main.py`, [[modelo-de-dados-pulsar]], [[requisitos-funcionais-pulsar]]

---

## 2026-06-24 — Separação de camadas Ativa e Passiva

**Motivo:** Dois padrões de uso completamente distintos — receber mensagem (reativo, chama IA) vs. disparar mensagem (proativo, template determinístico). Separar em endpoints distintos com responsabilidades claras.
**Impacto:**
- `POST /api/v1/pulsar/chat` — camada passiva: recebe lead, chama OpenRouter, parseia metadados
- `POST /api/v1/disparos/webhook` — camada ativa: recebe evento, gera template, salva histórico, retorna payload para canal externo
- Camada ativa **não chama OpenRouter** — elimina latência e custo de IA para mensagens estruturadas
**Status:** aplicado
**Artefatos atualizados:** `main.py`, [[arquitetura-pulsar]], [[integracoes-pulsar]]

---

## 2026-06-24 — META_TAG definida como `##META##`

**Motivo:** O código original usava um delimitador de metadados que era removido pelo interface de chat ao ser colado (aparecia como string vazia). Para garantir funcionalidade e legibilidade, foi definido `##META##` como tag explícita.
**Impacto:** System prompt instrui o Claude a finalizar respostas com `##META##{"etapa": "X", "perfil": "Y"}`. Parse no backend faz `split("##META##")` — parte [0] é a resposta limpa, parte [1] é o JSON de metadados.
**Status:** aplicado — aguarda validação em uso real para confirmar que o Claude respeita a tag consistentemente
**Artefatos atualizados:** `main.py`, [[modelo-de-dados-pulsar]], [[integracoes-pulsar]]
**Observação:** Se o Claude não emitir `##META##` (resposta sem metadados), o sistema não falha — `etapa_atual` e `perfil_qualificacao` mantêm o valor anterior sem erro.

---

## 2026-06-24 — Tenant de demonstração pré-cadastrado no init

**Motivo:** Facilitar testes e onboarding sem necessidade de criar o primeiro tenant manualmente. Tenant `tenant_pme_pulsar` (Soluções Alpha Consultoria) representa um caso de uso real de consultoria B2B com todas as flags ativas e FAQ de exemplo incluindo regra de upsell (Mentoria Premium R$ 10.000 para faturamento > R$ 50k/mês).
**Impacto:** `init_pulsar_db()` executa `INSERT OR REPLACE` — tenant de demo é recriado a cada reinicialização se necessário, sem duplicar.
**Status:** aplicado
**Artefatos atualizados:** `database.py`
