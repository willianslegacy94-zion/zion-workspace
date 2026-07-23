import sqlite3
from pathlib import Path

DATABASE_NAME = str(Path(__file__).resolve().parent / "orbita_black.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    """Idempotente — cria o schema do zero se o banco não existir ainda (instalação nova).
    Se já existir (banco migrado da versão single-tenant), não faz nada além de garantir
    o tenant bootstrap 'orbita'."""
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tenants_config (
            tenant_id TEXT PRIMARY KEY,
            nome_empresa TEXT,
            faq_contexto TEXT,
            flag_qualificar_lead BOOLEAN DEFAULT 1,
            flag_agendamento_ia BOOLEAN DEFAULT 1,
            flag_permitir_transbordo BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

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
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
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
    """)
    conn.execute(
        """INSERT OR IGNORE INTO tenants_config
               (tenant_id, nome_empresa, faq_contexto, flag_qualificar_lead, flag_agendamento_ia, flag_permitir_transbordo)
           VALUES (?, ?, ?, 1, 1, 1)""",
        (
            "orbita",
            "Órbita Black",
            "A Órbita Black vende uma tecnologia de automação de atendimento e triagem de clientes via IA "
            "para destravar gargalos comerciais em PMEs e infoprodutores. Abordagem fria via WhatsApp, "
            "oferecendo uma conversa rápida (5 minutos) para apresentar a solução. Não há preço público fixo "
            "— a proposta é qualificar e agendar uma reunião com um humano do time comercial.",
        ),
    )

    existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(interactions)")}
    for column in ("prompt_tokens", "completion_tokens"):
        if column not in existing_columns:
            conn.execute(f"ALTER TABLE interactions ADD COLUMN {column} INTEGER")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Banco inicializado em {DATABASE_NAME}")
