---
status: stable
domain: cortex
source: claude
created: 2026-06-25
updated: 2026-06-25
owner: willians
---

# Modelo de Dados — Órbita Cortex

## Banco de Dados

| Atributo | Valor |
|---|---|
| Engine | SQLite |
| Arquivo | `orbita_cortex.db` |
| Localização | `cortex/` (raiz do projeto) |
| Acesso | Leitura direta de arquivo pelos agentes da Holding |
| Inicialização | `python3 database_cortex.py` |

---

## Entidade: `matriz_inteligencia`

Tabela central e única do Cortex. Representa o estado analítico atual de cada cliente no ecossistema da Holding.

| Campo | Tipo SQLite | Padrão | Obrigatório | Descrição |
|---|---|---|---|---|
| `email` | TEXT | — | Sim (PK) | Identificador único do cliente, normalizado lowercase |
| `tenant_id` | TEXT | — | Sim | Plataforma de origem (ex: `hotmart_tenant_01`) |
| `nome` | TEXT | — | Sim | Nome do cliente |
| `ltv` | REAL | 0.0 | — | Life Time Value acumulado em R$ |
| `progresso_curso` | REAL | 0.0 | — | Percentual de progresso atual (0.0 a 100.0) |
| `status_churn_risk` | BOOLEAN | 0 | — | **Flag para Horizon** — 1 = cliente em risco de abandono |
| `recomendacao_upsell` | TEXT | `'NENHUMA'` | — | **Flag para Pulsar/Quasar** — produto recomendado pela IA |
| `ultima_atualizacao` | DATETIME | CURRENT_TIMESTAMP | — | Timestamp da última sincronização |

---

## Valores Possíveis por Flag

### `status_churn_risk`

| Valor | Significado | Comportamento dos Agentes |
|---|---|---|
| `0` | Cliente engajado | Atendimento padrão |
| `1` | Risco de churn detectado | Horizon prioriza acolhimento proativo |

**Regra de classificação:**
> `churn_risk = 1` se `dias_ativos < 7` **E** `progresso_aulas < 10%`

---

### `recomendacao_upsell`

| Valor | Significado | Comportamento dos Agentes |
|---|---|---|
| `'NENHUMA'` | Sem recomendação | Atendimento padrão |
| `'MENTORIA_VIP'` | Aluno avançado, alta aderência | Pulsar oferece Mentoria VIP |
| `'SUPORTE_ACELERADO'` | Aluno estagnado, reengajamento | Pulsar/Quasar oferecem Suporte Acelerado |

**Regras de classificação:**
> `MENTORIA_VIP` se `progresso_aulas > 70%`
> `SUPORTE_ACELERADO` se `dias_ativos > 15` **E** `progresso_aulas < 30%`
> `NENHUMA` nos demais casos

---

## Comportamento do Upsert

```sql
INSERT INTO matriz_inteligencia
  (email, tenant_id, nome, ltv, progresso_curso, status_churn_risk, recomendacao_upsell)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(email) DO UPDATE SET
    ltv = ltv + excluded.ltv,               -- acumula, não sobrescreve
    progresso_curso = excluded.progresso_curso,
    status_churn_risk = excluded.status_churn_risk,
    recomendacao_upsell = excluded.recomendacao_upsell,
    ultima_atualizacao = CURRENT_TIMESTAMP;
```

**Regra do LTV:** Cada evento soma ao LTV existente — representa o valor total gasto pelo cliente na plataforma ao longo do tempo.

---

## Ciclo de Vida de um Registro

```
Evento chega (nova compra / progresso / acesso)
        ↓
Email não existe → INSERT com todos os campos
Email existe    → UPDATE: ltv acumula, flags e progresso sobrescritos
        ↓
Horizon lê status_churn_risk antes de responder
Pulsar/Quasar leem recomendacao_upsell antes de abordar
        ↓
Próximo evento → ciclo reinicia
```

---

## Consultas que os Agentes Fazem

```sql
-- Horizon: verificar risco de churn antes de responder
SELECT status_churn_risk, nome, ltv
FROM matriz_inteligencia
WHERE email = ? AND tenant_id = ?;

-- Pulsar/Quasar: verificar recomendação de upsell
SELECT recomendacao_upsell, nome, progresso_curso, ltv
FROM matriz_inteligencia
WHERE email = ?;
```

---

## Evolução do Schema (backlog)

| Versão | Campo | Motivação |
|---|---|---|
| v1.1 | `historico_flags` JSON | Audit trail de classificações anteriores |
| v1.2 | `segmento` TEXT | Segmentação adicional além dos dois flags atuais |
| v2.0 | Migração para PostgreSQL | Quando agentes operarem em servidores separados |
