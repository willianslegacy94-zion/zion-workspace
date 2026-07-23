from database import get_connection


def get_tenant(tenant_id: str) -> dict | None:
    conn = get_connection()
    row = conn.execute("SELECT * FROM tenants_config WHERE tenant_id = ?", (tenant_id,)).fetchone()
    conn.close()
    return dict(row) if row else None
