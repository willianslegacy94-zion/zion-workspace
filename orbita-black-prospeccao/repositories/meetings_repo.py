import uuid
from database import get_connection


def list_meetings(tenant_id: str, lead_id: str) -> list[dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM meetings WHERE tenant_id = ? AND lead_id = ? ORDER BY scheduled_at ASC",
        (tenant_id, lead_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def schedule_meeting(tenant_id: str, lead_id: str, scheduled_at: str, notes: str | None = None) -> dict:
    conn = get_connection()
    meeting_id = uuid.uuid4().hex
    conn.execute(
        """INSERT INTO meetings (id, tenant_id, lead_id, scheduled_at, notes)
           VALUES (?, ?, ?, ?, ?)""",
        (meeting_id, tenant_id, lead_id, scheduled_at, notes),
    )
    conn.execute(
        "UPDATE leads SET stage = 'reuniao_marcada', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        (tenant_id, lead_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM meetings WHERE id = ?", (meeting_id,)).fetchone()
    conn.close()
    return dict(row)


def update_meeting(tenant_id: str, meeting_id: str, status: str | None = None, notes: str | None = None) -> dict | None:
    conn = get_connection()
    conn.execute(
        """UPDATE meetings SET status = COALESCE(?, status), notes = COALESCE(?, notes)
           WHERE tenant_id = ? AND id = ?""",
        (status, notes, tenant_id, meeting_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM meetings WHERE tenant_id = ? AND id = ?", (tenant_id, meeting_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
