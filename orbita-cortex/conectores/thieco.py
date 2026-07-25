# conectores/thieco.py
"""
Conector read-only ao Postgres do sistema-thieco (piloto de "atendimento ao
cliente" da Órbita Cortex). Usa a role dedicada `cortex_readonly`, que só tem
GRANT SELECT em `clientes` — este módulo nunca escreve no banco do Thieco.
"""
import os
from datetime import date

import psycopg2
import psycopg2.extras

LIMITE_DIAS_CHURN = 45


def _conectar():
    dsn = os.getenv("THIECO_DATABASE_URL")
    if not dsn:
        raise RuntimeError("THIECO_DATABASE_URL não configurada no .env.")
    return psycopg2.connect(dsn)


def buscar_cliente_thieco(contato: str, unidade: str | None = None):
    """
    Busca o cliente do sistema-thieco pelo telefone (contato). Retorna um
    dict com o perfil computado, ou None se não encontrado.

    `churn_risk` segue o mesmo espírito da regra determinística já usada na
    matriz EAD do Cortex: 1 se o cliente está há mais de 45 dias sem visitar.
    """
    sql = """
        SELECT nome, contato, unidade, tipo, primeira_visita, ultima_visita, total_visitas
        FROM clientes
        WHERE contato = %s
    """
    params = [contato]
    if unidade:
        sql += " AND unidade = %s"
        params.append(unidade)
    sql += " ORDER BY ultima_visita DESC NULLS LAST LIMIT 1"

    conn = _conectar()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    dias_desde_ultima_visita = None
    if row["ultima_visita"]:
        dias_desde_ultima_visita = (date.today() - row["ultima_visita"]).days

    churn_risk = 1 if (
        dias_desde_ultima_visita is not None and dias_desde_ultima_visita > LIMITE_DIAS_CHURN
    ) else 0

    return {
        "nome": row["nome"],
        "contato": row["contato"],
        "unidade": row["unidade"],
        "tipo": row["tipo"],
        "primeira_visita": row["primeira_visita"].isoformat() if row["primeira_visita"] else None,
        "ultima_visita": row["ultima_visita"].isoformat() if row["ultima_visita"] else None,
        "total_visitas": row["total_visitas"],
        "dias_desde_ultima_visita": dias_desde_ultima_visita,
        "churn_risk": churn_risk,
    }
