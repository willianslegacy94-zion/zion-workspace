import uuid
from database import get_connection
from utils.phone import normalize_phone


def _new_id() -> str:
    return uuid.uuid4().hex


def list_leads(tenant_id: str, stage: str | None = None) -> list[dict]:
    conn = get_connection()
    if stage:
        rows = conn.execute(
            "SELECT * FROM leads WHERE tenant_id = ? AND stage = ? ORDER BY updated_at DESC",
            (tenant_id, stage),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM leads WHERE tenant_id = ? ORDER BY updated_at DESC", (tenant_id,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_lead_by_id(tenant_id: str, lead_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM leads WHERE tenant_id = ? AND id = ?", (tenant_id, lead_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_lead_by_phone(tenant_id: str, phone: str) -> dict | None:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM leads WHERE tenant_id = ? AND phone_normalized = ? ORDER BY updated_at DESC LIMIT 1",
        (tenant_id, normalize_phone(phone)),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_lead(
    tenant_id: str,
    name: str,
    phone: str,
    company: str | None = None,
    role: str | None = None,
    source: str | None = None,
    notes: str | None = None,
) -> dict:
    conn = get_connection()
    lead_id = _new_id()
    conn.execute(
        """INSERT INTO leads (id, tenant_id, name, phone, phone_normalized, company, role, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (lead_id, tenant_id, name, phone, normalize_phone(phone), company, role, source or "manual", notes),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    conn.close()
    return dict(row)


def get_or_create_lead_by_phone(tenant_id: str, phone: str, fallback_name: str | None = None) -> dict:
    existing = get_lead_by_phone(tenant_id, phone)
    if existing:
        return existing
    return create_lead(tenant_id, fallback_name or phone, phone, source="whatsapp")


def update_lead(tenant_id: str, lead_id: str, fields: dict) -> dict | None:
    allowed = {"name", "phone", "company", "role", "source", "notes"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return get_lead_by_id(tenant_id, lead_id)

    conn = get_connection()
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())
    if "phone" in updates:
        set_clause += ", phone_normalized = ?"
        values.append(normalize_phone(updates["phone"]))
    values.extend([tenant_id, lead_id])

    conn.execute(
        f"UPDATE leads SET {set_clause}, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        values,
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM leads WHERE tenant_id = ? AND id = ?", (tenant_id, lead_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_stage(tenant_id: str, lead_id: str, stage: str) -> dict | None:
    conn = get_connection()
    conn.execute(
        "UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        (stage, tenant_id, lead_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM leads WHERE tenant_id = ? AND id = ?", (tenant_id, lead_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def add_note(tenant_id: str, lead_id: str, note: str) -> dict | None:
    lead = get_lead_by_id(tenant_id, lead_id)
    if not lead:
        return None
    combined = f"{lead['notes']}\n{note}" if lead["notes"] else note
    conn = get_connection()
    conn.execute(
        "UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
        (combined, tenant_id, lead_id),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM leads WHERE tenant_id = ? AND id = ?", (tenant_id, lead_id)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_lead(tenant_id: str, lead_id: str) -> bool:
    conn = get_connection()
    cur = conn.execute("DELETE FROM leads WHERE tenant_id = ? AND id = ?", (tenant_id, lead_id))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted
