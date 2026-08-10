---
status: stable
domain: kernel-crm
source: claude
created: 2026-07-22
updated: 2026-07-22
owner: willians
---

# Modelo de Dados — Kernel v2: CRM Conversacional Multi-Tenant

> Referência: [[prd-kernel-crm]] | [[arquitetura-kernel-crm]]

---

## Entidades

| Entidade | Conceito de negócio | Por que existe no sistema |
|---|---|---|
| `tenants_config` | Um cliente da Órbita operando sua própria instância do CRM | Isola dado por cliente e liga feature flags (agendamento, transbordo) por tenant |
| `leads` | Um contato em algum ponto do funil de qualificação | Substitui `leads_prospeccao` — agora carrega estágio de funil, não só status de disparo |
| `interactions` | Uma mensagem trocada (inbound do lead ou outbound do agente/operador) | Histórico vira o contexto que o agente de IA usa a cada resposta |
| `meetings` | Uma reunião agendada com um lead | Persistência real — ao contrário do mock em memória do Quasar |
| `leads_prospeccao_legacy` | Estado exato da tabela antes da migração | Trilha de auditoria, fora do fluxo da aplicação, nunca apagada |

---

## Atributos — tenants_config

| Atributo | Tipo SQLite | Obrigatório | Descrição |
|---|---|---|---|
| tenant_id | TEXT PRIMARY KEY | sim | identificador do tenant (`"orbita"` hoje) |
| nome_empresa | TEXT | não | usado no system prompt do agente |
| faq_contexto | TEXT | não | descrição do produto/negócio, injetada no system prompt |
| flag_qualificar_lead | BOOLEAN DEFAULT 1 | não | reservado — hoje qualificação está sempre ativa via `update_lead_stage` |
| flag_agendamento_ia | BOOLEAN DEFAULT 1 | não | gate real: se 0, a tool `schedule_meeting` não é oferecida ao modelo |
| flag_permitir_transbordo | BOOLEAN DEFAULT 1 | não | gate real: se 0, a tool `escalate_to_human` não é oferecida ao modelo |

## Atributos — leads

| Atributo | Tipo SQLite | Obrigatório | Descrição |
|---|---|---|---|
| id | TEXT PRIMARY KEY | sim | `uuid4().hex` |
| tenant_id | TEXT NOT NULL | sim | FK lógica para `tenants_config` |
| name | TEXT NOT NULL | sim | nome do lead |
| phone | TEXT NOT NULL | sim | telefone no formato original (**não único** — ver nota abaixo) |
| phone_normalized | TEXT | não | dígitos-only, prefixo `55` se sobrarem 10-11 dígitos — usado para lookup e casamento com `remoteJid` da Evolution API |
| email | TEXT | não | preservado da base original de infoprodutores |
| company, role, source | TEXT | não | dados complementares de qualificação |
| stage | TEXT NOT NULL DEFAULT 'novo' | sim | domínio: `novo` / `qualificando` / `reuniao_marcada` / `ganho` / `perdido` |
| notes | TEXT | não | anotações do agente (`add_note`) + rastro de migração |
| created_at, updated_at | TEXT | sim | timestamps |

**Nota crítica:** `phone` **não é `UNIQUE`**. Na inspeção do banco real, 30 grupos de telefone apareciam duplicados nos 1829 leads originais, com formatos inconsistentes (`"41 988389442"` vs `"(11) 90000-0000"`). Um `UNIQUE` quebraria a migração. A unicidade de negócio fica em `(tenant_id, email)` via índice único parcial (`WHERE email IS NOT NULL`).

## Atributos — interactions

| Atributo | Tipo SQLite | Obrigatório | Descrição |
|---|---|---|---|
| id | TEXT PRIMARY KEY | sim | `uuid4().hex` |
| tenant_id | TEXT NOT NULL | sim | — |
| lead_id | TEXT NOT NULL | sim | FK → `leads(id)` ON DELETE CASCADE |
| direction | TEXT NOT NULL | sim | `inbound` (lead → agente) ou `outbound` (agente → lead) |
| channel | TEXT DEFAULT 'whatsapp' | não | `whatsapp` ou `web` (chat de teste) |
| message | TEXT NOT NULL | sim | texto — vira `role: user/assistant` ao montar o histórico do agente |
| created_at | TEXT | sim | ordena a conversa |

## Atributos — meetings

| Atributo | Tipo SQLite | Obrigatório | Descrição |
|---|---|---|---|
| id | TEXT PRIMARY KEY | sim | `uuid4().hex` |
| tenant_id | TEXT NOT NULL | sim | — |
| lead_id | TEXT NOT NULL | sim | FK → `leads(id)` ON DELETE CASCADE |
| scheduled_at | TEXT NOT NULL | sim | ISO 8601, definido pela tool `schedule_meeting` |
| status | TEXT DEFAULT 'agendada' | sim | `agendada` / `realizada` / `cancelada` |
| notes | TEXT | não | contexto pro vendedor humano |

---

## Origem dos dados (migração)

| Campo em `leads` | Origem em `leads_prospeccao_legacy` | Regra de mapeamento |
|---|---|---|
| name | `nome` | direto |
| phone | `telefone` | direto (preservado no formato original) |
| phone_normalized | `telefone` | dígitos-only + prefixo `55` se restarem 10-11 dígitos |
| email | `email` | direto |
| stage | `status_disparo` | `PENDENTE`/`ENVIADO`→`novo`, `RESPONDIDO`/`INTERESSADO`→`qualificando`, `RECUSADO`→`perdido` |
| notes | — | `"[migração] status_disparo original: {valor}"` |

**Volume migrado:** 1829 leads, 0 perda de dado (verificado por contagem + `PRAGMA foreign_key_check`).

---

## Relacionamentos

```
tenants_config (1) ──< (N) leads
leads (1) ──< (N) interactions
leads (1) ──< (N) meetings
```

Todas as FKs são `ON DELETE CASCADE` a partir de `leads` — apagar um lead limpa seu histórico. `tenants_config` não tem cascade (não se apaga tenant com dado ativo por acidente).

---

## Propriedade e acesso

| Operação | Quem executa | Endpoint / Função |
|---|---|---|
| Migrar schema | Willians (uma vez) | `python migrations/001_migrate_to_multitenant_crm.py` |
| CRUD de leads | Painel / agente de IA | `routers/leads.py`, `repositories/leads_repo.py` |
| Registrar interação | Agente de IA / painel (chat de teste) | `repositories/interactions_repo.py` |
| Agendar reunião | Agente de IA (tool `schedule_meeting`) | `repositories/meetings_repo.py` |

---

## Ciclo de retenção

| Entidade | Retenção | Nunca excluir |
|---|---|---|
| `leads`, `interactions`, `meetings` | permanente | histórico de qualificação é auditoria comercial |
| `leads_prospeccao_legacy` | permanente | trilha de auditoria da migração |

---

## DDL de referência

```sql
CREATE TABLE tenants_config (
    tenant_id TEXT PRIMARY KEY,
    nome_empresa TEXT,
    faq_contexto TEXT,
    flag_qualificar_lead BOOLEAN DEFAULT 1,
    flag_agendamento_ia BOOLEAN DEFAULT 1,
    flag_permitir_transbordo BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_normalized TEXT,
    email TEXT,
    company TEXT, role TEXT, source TEXT,
    stage TEXT NOT NULL DEFAULT 'novo'
        CHECK (stage IN ('novo','qualificando','reuniao_marcada','ganho','perdido')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_leads_tenant_email ON leads(tenant_id, email) WHERE email IS NOT NULL;

CREATE TABLE interactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
