"""
Migração 001: leads_prospeccao (single-tenant) -> schema multi-tenant do CRM conversacional.

Idempotente: aborta se já detectar que rodou antes (presença de leads_prospeccao_legacy).
Roda dentro de uma única transação — ou tudo aplica, ou nada aplica.
"""
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "orbita_black.db"

MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS tenants_config (
    tenant_id TEXT PRIMARY KEY,
    nome_empresa TEXT,
    faq_contexto TEXT,
    flag_qualificar_lead BOOLEAN DEFAULT 1,
    flag_agendamento_ia BOOLEAN DEFAULT 1,
    flag_permitir_transbordo BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tenants_config
    (tenant_id, nome_empresa, faq_contexto, flag_qualificar_lead, flag_agendamento_ia, flag_permitir_transbordo)
VALUES (
    'orbita',
    'Órbita Black',
    'A Órbita Black vende uma tecnologia de automação de atendimento e triagem de clientes via IA para destravar gargalos comerciais em PMEs e infoprodutores. Abordagem fria via WhatsApp, oferecendo uma conversa rápida (5 minutos) para apresentar a solução. Não há preço público fixo — a proposta é qualificar e agendar uma reunião com um humano do time comercial.',
    1, 1, 1
);

ALTER TABLE leads_prospeccao RENAME TO leads_prospeccao_legacy;

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone_normalized TEXT,
    email TEXT,
    company TEXT,
    role TEXT,
    source TEXT,
    stage TEXT NOT NULL DEFAULT 'novo'
        CHECK (stage IN ('novo','qualificando','reuniao_marcada','ganho','perdido')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tenant_email
    ON leads(tenant_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON leads(tenant_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage);

CREATE TABLE IF NOT EXISTS interactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    channel TEXT NOT NULL DEFAULT 'whatsapp',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_tenant ON interactions(tenant_id);

CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants_config(tenant_id),
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','realizada','cancelada')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_tenant ON meetings(tenant_id);

INSERT INTO leads (
    id, tenant_id, name, phone, phone_normalized, email, company, role,
    source, stage, notes, created_at, updated_at
)
SELECT
    lower(hex(randomblob(16))),
    'orbita',
    nome,
    telefone,
    CASE
        WHEN length(replace(replace(replace(replace(replace(telefone,' ',''),'(',''),')',''),'-',''),'+',''))
             IN (10, 11)
        THEN '55' || replace(replace(replace(replace(replace(telefone,' ',''),'(',''),')',''),'-',''),'+','')
        ELSE replace(replace(replace(replace(replace(telefone,' ',''),'(',''),')',''),'-',''),'+','')
    END,
    email,
    NULL,
    NULL,
    'csv_import_legado',
    CASE status_disparo
        WHEN 'PENDENTE'    THEN 'novo'
        WHEN 'ENVIADO'     THEN 'novo'
        WHEN 'RESPONDIDO'  THEN 'qualificando'
        WHEN 'INTERESSADO' THEN 'qualificando'
        WHEN 'RECUSADO'    THEN 'perdido'
        ELSE 'novo'
    END,
    '[migração] status_disparo original: ' || status_disparo,
    datetime('now'),
    datetime('now')
FROM leads_prospeccao_legacy;

INSERT INTO interactions (id, tenant_id, lead_id, direction, channel, message, created_at)
SELECT
    lower(hex(randomblob(16))),
    'orbita',
    l.id,
    'outbound',
    'whatsapp',
    'Olá, ' || l.name || '! Tudo bem? Me chamo assistente da Órbita Black.' || char(10) || char(10) ||
    'Estava analisando o perfil do seu negócio e notei que vocês têm uma excelente presença. ' ||
    'Desenvolvemos uma tecnologia que ajuda a automatizar o atendimento e triagem de clientes via IA ' ||
    'para destravar gargalos comerciais.' || char(10) || char(10) ||
    'Faria sentido conversarmos 5 minutos esta semana para eu te mostrar como aplicar isso na sua operação?',
    datetime('now')
FROM leads l
JOIN leads_prospeccao_legacy lp ON lp.email = l.email
WHERE lp.status_disparo = 'ENVIADO' AND l.tenant_id = 'orbita';

UPDATE leads
SET notes = notes || char(10) || '[migração] interação de disparo inicial reconstruída (data exata desconhecida)'
WHERE id IN (
    SELECT l.id FROM leads l
    JOIN leads_prospeccao_legacy lp ON lp.email = l.email
    WHERE lp.status_disparo = 'ENVIADO'
);
"""


def already_migrated(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='leads_prospeccao_legacy'"
    ).fetchone()
    return row[0] > 0


def run():
    if not DB_PATH.exists():
        print(f"ERRO: banco não encontrado em {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")

    if already_migrated(conn):
        print("Migração já executada anteriormente (leads_prospeccao_legacy já existe). Abortando.")
        conn.close()
        sys.exit(1)

    legacy_count = conn.execute("SELECT COUNT(*) FROM leads_prospeccao").fetchone()[0]
    print(f"Leads em leads_prospeccao antes da migração: {legacy_count}")

    try:
        conn.executescript("BEGIN;" + MIGRATION_SQL + "COMMIT;")
    except Exception as e:
        conn.rollback()
        print(f"ERRO na migração, rollback aplicado: {e}")
        conn.close()
        sys.exit(1)

    print("\n--- Verificação pós-migração ---")
    checks = {
        "leads (tenant orbita)": "SELECT COUNT(*) FROM leads WHERE tenant_id = 'orbita'",
        "leads_prospeccao_legacy (intacta)": "SELECT COUNT(*) FROM leads_prospeccao_legacy",
        "tenants_config": "SELECT COUNT(*) FROM tenants_config",
        "interactions outbound (backfill)": "SELECT COUNT(*) FROM interactions WHERE direction = 'outbound'",
    }
    ok = True
    for label, query in checks.items():
        value = conn.execute(query).fetchone()[0]
        print(f"  {label}: {value}")

    print("\n  stage por estágio:")
    for stage, count in conn.execute("SELECT stage, COUNT(*) FROM leads GROUP BY stage"):
        print(f"    {stage}: {count}")

    fk_violations = conn.execute("PRAGMA foreign_key_check").fetchall()
    if fk_violations:
        print(f"\n  AVISO: {len(fk_violations)} violações de foreign key encontradas: {fk_violations}")
        ok = False
    else:
        print("\n  foreign_key_check: OK (nenhuma violação)")

    new_count = conn.execute("SELECT COUNT(*) FROM leads WHERE tenant_id = 'orbita'").fetchone()[0]
    if new_count != legacy_count:
        print(f"\n  AVISO: contagem não bate — legado={legacy_count}, novo={new_count}")
        ok = False

    conn.close()

    if ok:
        print("\nMigração concluída com sucesso.")
    else:
        print("\nMigração aplicada, mas com avisos acima — revisar antes de seguir.")
        sys.exit(1)


if __name__ == "__main__":
    run()
