# database.py
import sqlite3

DATABASE_NAME = "orbita_quasar.db"

def init_quasar_db():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    # Configuração dos Tenants PME Alto Ticket
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tenants_config (
            tenant_id TEXT PRIMARY KEY,
            nome_empresa TEXT,
            faq_contexto TEXT,
            flag_agendamento_ia BOOLEAN DEFAULT 1,
            flag_fechamento_comercial BOOLEAN DEFAULT 0
        )
    """)

    # Histórico de Conversas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS historico_conversas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            tenant_id TEXT,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Popula um Tenant Elite de Mentorias Mentoria VIP
    cursor.execute("""
        INSERT OR REPLACE INTO tenants_config (tenant_id, nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial)
        VALUES (?, ?, ?, ?, ?)
    """, (
        "tenant_quasar_vip",
        "Scale Up Mentorias",
        "Oferecemos mentorias individuais de negócios de alto ticket por R$ 5.000. Alunos ativos têm direito a uma call de alinhamento estratégica de 30 minutos. Os agendamentos são feitos de forma autônoma na nossa agenda para o dia 2026-06-25 nos horários comerciais (13h às 17h). Nosso link de renovação é https://scaleup.com/renovar.",
        1,
        1
    ))

    # Piloto "atendimento ao cliente" — sistema-thieco (Barbearia Thieco
    # Leandro). Cliente é identificado por telefone (contato_cliente), não
    # e-mail — o contexto real (última visita, total de visitas, risco de
    # afastamento) vem do Órbita Cortex, não deste faq_contexto estático.
    # Agendamento e fechamento comercial ficam fora deste piloto de propósito
    # (próximas fatias reaproveitam o mesmo conector).
    cursor.execute("""
        INSERT OR REPLACE INTO tenants_config (tenant_id, nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial)
        VALUES (?, ?, ?, ?, ?)
    """, (
        "sistema_thieco",
        "Barbearia Thieco Leandro",
        "Barbearia com duas unidades: Mutinga e Tamboré. Atendemos com serviços de corte, barba e combos, além de produtos de cuidado capilar e de barba à venda no balcão. Em caso de dúvida sobre horários, endereço ou disponibilidade de agenda, informe que um atendente humano confirma os detalhes — a marcação automática ainda não está habilitada para este tenant.",
        0,
        0
    ))

    conn.commit()
    conn.close()
    print("🚀 Banco de Dados do Agente Órbita Quasar Inicializado!")

if __name__ == "__main__":
    init_quasar_db()
