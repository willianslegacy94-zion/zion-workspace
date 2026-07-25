# test_local.py — Teste completo sem API externa
import json
import sqlite3
from database import DATABASE_NAME, init_quasar_db
import tools.calendar_mock as calendar_tool

# ──────────────────────────────────────────────
# MOCK: simula respostas do OpenRouter/Claude
# ──────────────────────────────────────────────

def mock_openrouter(payload: dict) -> dict:
    """
    Simula o comportamento do Claude:
    - 1ª chamada: decide usar a tool checar_disponibilidade_agenda
    - 2ª chamada (com resultado da tool): gera resposta final ao cliente
    """
    messages = payload["messages"]
    ultima_msg = messages[-1]

    # Se a última mensagem é um resultado de tool → gera resposta final
    if isinstance(ultima_msg.get("content"), str) and "Indisponível" in ultima_msg.get("content", ""):
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Infelizmente o horário das 14h já está reservado. Tenho disponibilidade às 13h, 13h30, 16h ou 17h no dia 25/06. Qual prefere?"
                }
            }]
        }

    if isinstance(ultima_msg.get("content"), str) and "Disponível" in ultima_msg.get("content", ""):
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Perfeito! Horário confirmado. Sua call está agendada. Um convite será enviado para seu e-mail em instantes."
                }
            }]
        }

    # Verifica se tem role=tool na conversa (resultado já injetado)
    has_tool_result = any(
        m.get("role") == "tool" for m in messages
    )
    if has_tool_result:
        tool_content = next(m["content"] for m in messages if m.get("role") == "tool")
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": f"Com base na verificação da agenda: {tool_content} Posso confirmar o agendamento para você?"
                }
            }]
        }

    # 1ª chamada: Claude decide usar a tool (pega a última mensagem do usuário)
    user_text = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )
    if any(kw in user_text.lower() for kw in ["agendar", "marcar", "reservar", "call", "horário", "hora", "disponível", "às", "16h", "13h", "15h", "17h"]):
        data_hora = "2026-06-25 14:00"
        for token in user_text.split():
            if "16h" in token or "16:00" in token:
                data_hora = "2026-06-25 16:00"
            elif "13h" in token or "13:00" in token:
                data_hora = "2026-06-25 13:00"

        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "tool_calls": [{
                        "id": "call_mock_001",
                        "type": "function",
                        "function": {
                            "name": "checar_disponibilidade_agenda",
                            "arguments": json.dumps({"data_com_hora": data_hora})
                        }
                    }]
                }
            }]
        }

    # Resposta conversacional simples
    return {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "Olá! Sou o concierge da Scale Up Mentorias. Como posso ajudá-lo hoje?"
            }
        }]
    }


# ──────────────────────────────────────────────
# HELPERS (espelhando main.py)
# ──────────────────────────────────────────────

def buscar_tenant(tenant_id: str):
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial "
            "FROM tenants_config WHERE tenant_id = ?", (tenant_id,)
        )
        return cursor.fetchone()

def gerenciar_memoria(session_id, tenant_id, role=None, content=None, recuperar=False):
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        if recuperar:
            cursor.execute(
                "SELECT role, content FROM historico_conversas "
                "WHERE session_id = ? AND tenant_id = ? ORDER BY timestamp ASC LIMIT 10",
                (session_id, tenant_id)
            )
            return [{"role": r, "content": c} for r, c in cursor.fetchall()]
        cursor.execute(
            "INSERT INTO historico_conversas (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)",
            (session_id, tenant_id, role, content)
        )
        conn.commit()


def rodar_conversa_local(tenant_id, session_id, mensagem, nome_cliente, email_cliente):
    config = buscar_tenant(tenant_id)
    if not config:
        print("❌ Tenant não encontrado")
        return

    nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial = config
    gerenciar_memoria(session_id, tenant_id, "user", mensagem)
    historico = gerenciar_memoria(session_id, tenant_id, recuperar=True)

    system_prompt = f"Você é concierge de {nome_empresa}. Atendendo: {nome_cliente} ({email_cliente})."

    payload_api = {
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "system", "content": system_prompt}] + historico,
    }

    if flag_agendamento_ia:
        payload_api["tools"] = ["checar_disponibilidade_agenda", "confirmar_agendamento_call"]

    res = mock_openrouter(payload_api)
    message_out = res["choices"][0]["message"]

    if message_out.get("tool_calls"):
        tool_call = message_out["tool_calls"][0]
        fn = tool_call["function"]["name"]
        args = json.loads(tool_call["function"]["arguments"])

        print(f"\n  🔧 Claude acionou tool: {fn}({args})")

        if fn == "checar_disponibilidade_agenda":
            resultado_tool = calendar_tool.checar_disponibilidade_agenda(args["data_com_hora"])
        elif fn == "confirmar_agendamento_call":
            resultado_tool = calendar_tool.confirmar_agendamento_call(nome_cliente, email_cliente, args["data_com_hora"])
        else:
            resultado_tool = "Tool desconhecida."

        print(f"  📦 Resultado da tool: {resultado_tool}")

        historico_com_tool = historico + [
            message_out,
            {"role": "tool", "tool_call_id": tool_call["id"], "name": fn, "content": resultado_tool}
        ]

        payload_rechamada = {
            "model": "anthropic/claude-3.5-sonnet",
            "messages": [{"role": "system", "content": system_prompt}] + historico_com_tool,
        }

        re_res = mock_openrouter(payload_rechamada)
        resposta_final = re_res["choices"][0]["message"]["content"]
    else:
        resposta_final = message_out["content"]

    gerenciar_memoria(session_id, tenant_id, "assistant", resposta_final)
    return resposta_final


# ──────────────────────────────────────────────
# CENÁRIOS DE TESTE
# ──────────────────────────────────────────────

def separador(titulo):
    print(f"\n{'='*55}")
    print(f"  {titulo}")
    print('='*55)

if __name__ == "__main__":
    print("\n🚀 Inicializando banco de dados...")
    init_quasar_db()

    SESSION = "sess_test_local"
    TENANT  = "tenant_quasar_vip"
    NOME    = "João Silva"
    EMAIL   = "joao@scaleup.com"

    # ── TESTE 1: Saudação simples ──────────────────
    separador("TESTE 1 — Saudação simples")
    msg = "Oi, quem é você?"
    print(f"  👤 Cliente: {msg}")
    resp = rodar_conversa_local(TENANT, SESSION, msg, NOME, EMAIL)
    print(f"  🤖 Quasar : {resp}")

    # ── TESTE 2: Horário OCUPADO ───────────────────
    separador("TESTE 2 — Tentar agendar horário OCUPADO (14h)")
    msg = "Quero marcar minha call para 25/06 às 14h"
    print(f"  👤 Cliente: {msg}")
    resp = rodar_conversa_local(TENANT, SESSION, msg, NOME, EMAIL)
    print(f"  🤖 Quasar : {resp}")

    # ── TESTE 3: Horário LIVRE ─────────────────────
    separador("TESTE 3 — Tentar agendar horário LIVRE (16h)")
    msg = "E às 16h, está disponível?"
    print(f"  👤 Cliente: {msg}")
    resp = rodar_conversa_local(TENANT, SESSION, msg, NOME, EMAIL)
    print(f"  🤖 Quasar : {resp}")

    # ── TESTE 4: Confirmar agendamento ────────────
    separador("TESTE 4 — Confirmar agendamento (16h)")
    resultado = calendar_tool.confirmar_agendamento_call(NOME, EMAIL, "2026-06-25 16:00")
    print(f"  🔥 Tool direta: {resultado}")

    # ── TESTE 5: Verificar histórico no banco ─────
    separador("TESTE 5 — Histórico salvo no SQLite")
    historico = gerenciar_memoria(SESSION, TENANT, recuperar=True)
    for i, h in enumerate(historico, 1):
        prefixo = "👤" if h["role"] == "user" else "🤖"
        print(f"  [{i}] {prefixo} {h['role']}: {h['content'][:70]}...")

    separador("✅ TODOS OS TESTES CONCLUÍDOS")
