---
status: draft
domain: orbita-quasar
source: claude
created: 2026-06-25
updated: 2026-08-02
owner: willians
---

# PRD — Órbita Quasar

---

## O que é

Órbita Quasar nasceu como engine de atendimento AI voltado só a empresas de mentoria/serviços de alto ticket — mas evoluiu (2026-07-30 a 2026-08-02) pra um engine genuinamente multi-domínio, atendendo hoje 3 tipos de negócio bem diferentes na mesma base de código: mentoria/agendamento (tenant original), barbearia (Thieco, agendamento real), e confeitaria sob encomenda (Lane Confeitaria — catálogo, agenda de produção, registro de pedido, visão computacional e validação de pagamento). Opera como concierge: atende clientes pelo nome, responde dúvidas com base no contexto de negócio de cada empresa, e age com autonomia (agendar, registrar pedido, confirmar comprovante) via Function Calling.

O Quasar não é um chatbot genérico. Cada tenant tem sua própria persona (inclusive nome próprio, como "Mel" do Lane Confeitaria), FAQ, ferramentas dedicadas (`LANE_TOOLS_DEFINITION` vs. `TOOLS_DEFINITION` genérico) e capacidades habilitadas via feature flags/`produto`. O engine é o mesmo pra todos — o comportamento muda por configuração no banco e pelo parâmetro `produto`.

---

## Problema

Empresas de mentoria alto ticket precisam de atendimento personalizado para seus alunos: confirmar renovações, lembrar de calls, verificar disponibilidade de agenda e fechar contratos. Fazer isso manualmente escala mal. Terceirizar para atendente genérico perde o tom de elite da marca.

O Quasar resolve isso com um concierge AI que conhece o negócio do tenant, reconhece o cliente pelo nome e e-mail, e age com autonomia dentro dos limites que o tenant define.

---

## Para quem

**Tenant (empresa contratante):** negócio de mentoria ou serviço B2C alto ticket que quer um concierge AI com identidade própria, sem construir do zero.

**Cliente final:** aluno ou cliente ativo da empresa que acessa via canal conectado ao Quasar (WhatsApp, widget web, etc.) e espera atendimento rápido e personalizado.

---

## Capacidades por feature flag

| Capacidade | Flag | Comportamento |
|---|---|---|
| Atendimento conversacional com contexto do negócio | sempre ativo | AI responde perguntas usando `faq_contexto` do tenant |
| Agendamento autônomo de calls | `flag_agendamento_ia` | AI checa disponibilidade e confirma reserva sem intervenção humana |
| Fechamento comercial | `flag_fechamento_comercial` | AI tem autorização para enviar links de checkout e conduzir renovação de assinatura |

---

## Fora do escopo atual

Integração real com Google Calendar ou Calendly pro tenant original de mentoria (calendário é mock em memória — Thieco e Lane Confeitaria já usam agenda real de cada sistema, isso não se aplica a eles).
Notificação por e-mail real (confirmação de agendamento é simulada, tenant original).
**Interface de administração para cadastro/monitoramento de tenants** — ainda feito diretamente no banco/código (`database.py`), sem tela. Escopo mapeado em `kernel-hq-arquitetura/12-backlog-painel-admin-cortex-quasar.md` (painel próprio, visão de custo por tenant via `usage.cost` do OpenRouter, hoje descartado).
Persistência de memória de conversa entre deploys — `orbita_quasar.db` não sobrevive a rebuild do container (gap real descoberto 2026-08-02, bloqueia produção).
Rate limiting e log de custo por tenant — todos dividem a mesma `OPENROUTER_API_KEY` sem rastreio.

**Deixou de ser "fora do escopo" em 2026-08-02:**
- ~~Multi-canal nativo~~ — WhatsApp real via Evolution API já é canal ativo (Lane Confeitaria conectado e testado; Thieco já tinha isso desde antes)
- ~~Visão/mídia~~ — leitura de foto (referência de produto, comprovante de pagamento) implementada pro produto="lane"

---

## Métricas que importam

| O que medir | Meta |
|---|---|
| Agendamento realizado sem intervenção humana | > 80% das solicitações com `flag_agendamento_ia = true` |
| Latência do endpoint `/api/v1/quasar/chat` | < 5 segundos (inclui chamadas ao LLM) |
| Isolamento de tenant | nenhuma mensagem de um tenant visível em outro |
| Histórico recuperado por sessão | até 10 mensagens por `session_id + tenant_id` |
