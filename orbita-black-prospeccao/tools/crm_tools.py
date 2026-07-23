from repositories import leads_repo, meetings_repo

# Definição neutra das tools — convertida para o formato de cada provedor em services/llm_agent.py
TOOL_DEFS = [
    {
        "name": "update_lead_stage",
        "description": "Atualiza o estágio do lead no funil de vendas do CRM.",
        "parameters": {
            "type": "object",
            "properties": {
                "stage": {
                    "type": "string",
                    "enum": ["novo", "qualificando", "reuniao_marcada", "ganho", "perdido"],
                },
            },
            "required": ["stage"],
        },
    },
    {
        "name": "schedule_meeting",
        "description": "Agenda uma reunião com o lead e move o estágio para 'reuniao_marcada'.",
        "parameters": {
            "type": "object",
            "properties": {
                "scheduled_at": {
                    "type": "string",
                    "description": "Data e hora combinadas com o lead, em ISO 8601 (ex: 2026-07-25T15:00:00)",
                },
                "notes": {"type": "string", "description": "Contexto da reunião para o vendedor humano"},
            },
            "required": ["scheduled_at"],
        },
    },
    {
        "name": "add_note",
        "description": "Registra uma anotação sobre o lead no CRM (contexto, respostas de qualificação, etc.)",
        "parameters": {
            "type": "object",
            "properties": {"note": {"type": "string"}},
            "required": ["note"],
        },
    },
    {
        "name": "escalate_to_human",
        "description": "Sinaliza que um humano do time de vendas precisa assumir a conversa.",
        "parameters": {
            "type": "object",
            "properties": {
                "reason": {"type": "string", "description": "Por que a conversa precisa de um humano"},
            },
            "required": ["reason"],
        },
    },
]


def tools_for_tenant(tenant: dict) -> list[dict]:
    """Gate por feature flag: schedule_meeting e escalate_to_human só entram se o tenant permitir."""
    allowed_names = {"update_lead_stage", "add_note"}
    if tenant.get("flag_agendamento_ia"):
        allowed_names.add("schedule_meeting")
    if tenant.get("flag_permitir_transbordo"):
        allowed_names.add("escalate_to_human")
    return [t for t in TOOL_DEFS if t["name"] in allowed_names]


def execute_tool(tenant_id: str, lead_id: str, name: str, tool_input: dict) -> dict:
    if name == "update_lead_stage":
        leads_repo.update_stage(tenant_id, lead_id, tool_input["stage"])
        return {"ok": True, "stage": tool_input["stage"]}

    if name == "schedule_meeting":
        meetings_repo.schedule_meeting(tenant_id, lead_id, tool_input["scheduled_at"], tool_input.get("notes"))
        return {"ok": True, "scheduled_at": tool_input["scheduled_at"]}

    if name == "add_note":
        leads_repo.add_note(tenant_id, lead_id, tool_input["note"])
        return {"ok": True}

    if name == "escalate_to_human":
        leads_repo.add_note(tenant_id, lead_id, f"[ESCALADO PARA HUMANO] {tool_input['reason']}")
        return {"ok": True, "escalated": True}

    return {"ok": False, "error": f"Tool desconhecida: {name}"}
