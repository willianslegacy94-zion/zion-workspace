from database import get_connection


def mensagem_fria(nome: str) -> str:
    return (
        f"Olá, {nome}! Tudo bem? Me chamo assistente da Órbita Black.\n\n"
        f"Estava analisando o perfil do seu negócio e notei que vocês têm uma excelente presença. "
        f"Desenvolvemos uma tecnologia que ajuda a automatizar o atendimento e triagem de clientes via IA "
        f"para destravar gargalos comerciais.\n\n"
        f"Faria sentido conversarmos 5 minutos esta semana para eu te mostrar como aplicar isso na sua operação?"
    )


def leads_nao_contatados(tenant_id: str, limite: int) -> list[dict]:
    """stage='novo' e nenhuma interação outbound ainda — substitui o antigo status_disparo='PENDENTE'."""
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT l.id, l.name, l.phone
        FROM leads l
        WHERE l.tenant_id = ?
          AND l.stage = 'novo'
          AND NOT EXISTS (
              SELECT 1 FROM interactions i WHERE i.lead_id = l.id AND i.direction = 'outbound'
          )
        LIMIT ?
        """,
        (tenant_id, limite),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
