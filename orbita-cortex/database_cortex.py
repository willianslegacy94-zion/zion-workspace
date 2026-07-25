# database_cortex.py
import sqlite3

DATABASE_NAME = "orbita_cortex.db"

def init_cortex_db():
    """Cria a tabela central de Inteligência de Leads para alimentar a Holding de Robôs"""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matriz_inteligencia (
            email TEXT PRIMARY KEY,
            tenant_id TEXT,
            nome TEXT,
            ltv REAL DEFAULT 0.0,
            progresso_curso REAL DEFAULT 0.0,
            status_churn_risk BOOLEAN DEFAULT 0,
            recomendacao_upsell TEXT DEFAULT 'NENHUMA',
            ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("🧠 Banco de Dados Órbita Cortex (Agência Core) Inicializado!")

if __name__ == "__main__":
    init_cortex_db()
