---
status: stable
domain: kernel-crm
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Fluxos Operacionais — Kernel v2: CRM Conversacional Multi-Tenant

> Referência: [[arquitetura-kernel-crm]] | [[requisitos-funcionais-kernel-crm]]

---

## Fluxo 1 — Migração do Banco (executado uma vez)

```
Willians roda: python migrations/001_migrate_to_multitenant_crm.py
        ↓
Script verifica se já rodou (leads_prospeccao_legacy existe?) → se sim, aborta
        ↓
BEGIN transação
        ↓
CREATE tenants_config + INSERT tenant 'orbita'
        ↓
ALTER TABLE leads_prospeccao RENAME TO leads_prospeccao_legacy
        ↓
CREATE leads, interactions, meetings (schema novo)
        ↓
INSERT INTO leads SELECT ... FROM leads_prospeccao_legacy
  (mapeia status_disparo → stage, normaliza telefone)
        ↓
INSERT INTO interactions (backfill outbound para os 3 leads já ENVIADO)
        ↓
COMMIT
        ↓
Verificação: contagens batem? PRAGMA foreign_key_check limpo?
  ├── Sim → "Migração concluída com sucesso"
  └── Não → sys.exit(1), instrução de rollback (restaurar backup)
```

**Resultado real desta execução:** 1829 leads migrados, 0 perda, `leads_prospeccao_legacy` intacta com 1829 linhas.

---

## Fluxo 2 — Chat de Teste (painel → agente, síncrono)

```
Usuário digita mensagem no painel (botão "💬 Testar agente")
        ↓
POST /api/test-chat {tenant_id, phone, name, message}
        ↓
get_or_create_lead_by_phone(tenant_id, phone, name)
        ↓
add_interaction(lead_id, 'inbound', message, channel='web')
        ↓
run_agent(tenant_id, lead_id)
  ├── tenants_repo.get_tenant(tenant_id)
  ├── build_system_prompt(tenant)  [injeta nome_empresa + faq_contexto]
  ├── tools_for_tenant(tenant)     [gate por flag_agendamento_ia / flag_permitir_transbordo]
  ├── interactions_repo.list_interactions → messages (role user/assistant)
  └── loop (máx 5 iterações):
        chamar Anthropic ou OpenRouter com tools
        ├── stop_reason != tool_use → retornar texto final
        └── tool_use → execute_tool() → injeta resultado na conversa → repete
        ↓
add_interaction(lead_id, 'outbound', reply, channel='web')
        ↓
Retorna {reply, lead_id} → painel renderiza a bolha de resposta
```

**Testado nesta sessão:** 4 rodadas de conversa levaram um lead de `novo` → `qualificando` → `reuniao_marcada`, com uma linha real gravada em `meetings` (não simulada).

---

## Fluxo 3 — Disparo em Lote (endpoint legado adaptado)

```
GET /api/v1/black/disparar-lote?tenant_id=orbita&limite=N
        ↓
leads_nao_contatados(tenant_id, N):
  SELECT leads WHERE stage='novo'
    AND NOT EXISTS (interaction outbound pra esse lead_id)
  LIMIT N
        ↓
Para cada lead:
  ├── mensagem_fria(nome) — mesmo texto persuasivo do Nível 0
  ├── add_interaction(lead_id, 'outbound', mensagem)  [marca como contatado]
  └── adiciona à lista de retorno
        ↓
Retorna {status, total_disparados, fila: [{id, nome, telefone, mensagem_gerada}]}
```

**Diferença do Nível 0:** a regra de "não contatado" mudou de `status_disparo='PENDENTE'` para `stage='novo' AND sem outbound` — mais robusto porque não depende de um campo de status paralelo ao funil.

---

## Fluxo 4 — Webhook de Resposta (endpoint legado adaptado)

```
POST /api/v1/black/webhook-resposta {tenant_id, telefone_remetente, texto_mensagem}
        ↓
leads_repo.get_lead_by_phone(tenant_id, telefone_remetente)
        ↓
┌── Lead não encontrado? → {"status": "desconhecido"} → FIM
│
└── Lead encontrado →
      add_interaction(lead_id, 'inbound', texto_mensagem)
      run_agent(tenant_id, lead_id)   [mesmo loop completo do Fluxo 2]
      add_interaction(lead_id, 'outbound', resposta_ia)
      → {status: "processado", resposta_ia, lead_id, stage_atual}
```

**Diferença do Nível 0:** antes o webhook só classificava (INTERESSADO/RECUSADO/NEUTRO). Agora roda o agente completo — pode qualificar, agendar reunião, escalar pra humano, tudo na mesma chamada.

---

## Fluxo 5 — Webhook WhatsApp Real (Evolution API, não validado)

```
Evolution API → POST /api/whatsapp/webhook {event, instance, data: {...}}
        ↓
parse_incoming_message(body)
  ├── event != "messages.upsert"? → None
  ├── key.fromMe? → None (ignora mensagem própria)
  ├── sem texto (conversation/extendedTextMessage)? → None
  └── extrai {phone, name, text, message_id} do remoteJid
        ↓
┌── None → {"status": "ignored"}
│
└── Válido → BackgroundTasks.add_task(_handle_incoming_message)
      retorna {"status": "received"} IMEDIATAMENTE (Evolution exige resposta rápida)
      ...em background...
      mesmo fluxo do chat de teste, mas ao final:
        whatsapp_evolution.send_message(phone, reply)  [chamada real à Evolution API]
```

**Risco assumido:** o parser é baseado no formato público conhecido do evento `messages.upsert`, mas nunca foi testado contra uma instância Evolution real — só validado quando alguém parear um número via QR code.

---

## Estados do funil (mapa completo)

```
        ┌──────────────────────────┐
        ▼                          │
      novo ──update_lead_stage──▶ qualificando
        │                          │
        │                          ▼
        │                   reuniao_marcada ──schedule_meeting──▶ (já move automaticamente)
        │                          │
        ▼                          ▼
     perdido                     ganho
  (final negativo)          (final positivo, manual — sem tool dedicada)
```

`ganho` não tem tool própria — hoje só é setado manualmente no painel (`PUT /api/leads/:id/stage`). O agente de IA nunca fecha venda sozinho, por design do system prompt.
