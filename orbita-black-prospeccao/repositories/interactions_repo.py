import uuid
from database import get_connection


def list_interactions(tenant_id: str, lead_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM interactions WHERE tenant_id = ? AND lead_id = ? ORDER BY created_at ASC",
        (tenant_id, lead_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_interaction(
    tenant_id: str,
    lead_id: str,
    direction: str,
    message: str,
    channel: str = "whatsapp",
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> dict:
    conn = get_connection()
    interaction_id = uuid.uuid4().hex
    conn.execute(
        """INSERT INTO interactions
               (id, tenant_id, lead_id, direction, channel, message, prompt_tokens, completion_tokens)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (interaction_id, tenant_id, lead_id, direction, channel, message, prompt_tokens, completion_tokens),
    )
    conn.execute(
        "UPDATE leads SET updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        (tenant_id, lead_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM interactions WHERE id = ?", (interaction_id,)).fetchone()
    conn.close()
    return dict(row)
