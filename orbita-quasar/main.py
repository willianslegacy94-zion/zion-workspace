# main.py
import os
import json
import sqlite3
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from database import DATABASE_NAME
import tools.calendar_mock as calendar_tool

load_dotenv()
app = FastAPI(title="Órbita Quasar — Engine de Agendamento Avançado")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CORTEX_URL = os.getenv("CORTEX_URL", "http://127.0.0.1:5000")

class PayloadConversa(BaseModel):
    tenant_id: str
    session_id: str
    mensagem: str
    nome_cliente: str = "Cliente"
    email_cliente: str = "suporte@orbita.com"
    # Tenants sem e-mail como identificador (ex.: sistema_thieco, cliente é
    # identificado por telefone) preenchem este campo em vez de email_cliente.
    contato_cliente: str | None = None

def buscar_contexto_cortex(tenant_id: str, contato_cliente: str):
    """
    Consulta o Órbita Cortex pelo contexto real do cliente (piloto
    "atendimento ao cliente"). Nunca deve derrubar o Quasar: qualquer falha
    (Cortex fora do ar, tenant não suportado, timeout) retorna None e o
    concierge segue sem esse contexto extra.
    """
    try:
        resp = requests.get(
            f"{CORTEX_URL}/api/v1/cortex/atendimento",
            params={"tenant_id": tenant_id, "contato": contato_cliente},
            timeout=3,
        )
        dados = resp.json()
        if dados.get("status") == "ok":
            return dados["cliente"]
    except Exception:
        pass
    return None

def buscar_tenant(tenant_id: str):
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial FROM tenants_config WHERE tenant_id = ?", (tenant_id,))
        return cursor.fetchone()

def gerenciar_memoria(session_id: str, tenant_id: str, role: str = None, content: str = None, recuperar: bool = False):
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        if recuperar:
            cursor.execute("SELECT role, content FROM historico_conversas WHERE session_id = ? AND tenant_id = ? ORDER BY timestamp ASC LIMIT 10", (session_id, tenant_id))
            return [{"role": r, "content": c} for r, c in cursor.fetchall()]
        else:
            cursor.execute("INSERT INTO historico_conversas (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)", (session_id, tenant_id, role, content))
            conn.commit()

# DEFINIÇÃO DAS FERRAMENTAS QUE O CLAUDE VAI ENXERGAR (JSON SCHEMA)
TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "checar_disponibilidade_agenda",
            "description": "Consulta se um determinado dia e hora está livre na agenda da empresa para marcar uma reunião ou mentoria.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data_com_hora": {
                        "type": "string",
                        "description": "A data e hora no formato estrito 'YYYY-MM-DD HH:MM'. Exemplo: '2026-06-25 14:00'"
                    }
                },
                "required": ["data_com_hora"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "confirmar_agendamento_call",
            "description": "Efetua a reserva final e confirma o agendamento da reunião na agenda oficial.",
            "parameters": {
                "type": "object",
                "properties": {
                    "data_com_hora": {
                        "type": "string",
                        "description": "A data e hora confirmada no formato 'YYYY-MM-DD HH:MM'."
                    }
                },
                "required": ["data_com_hora"]
            }
        }
    }
]

@app.post("/api/v1/quasar/chat")
async def processar_atendimento_quasar(payload: PayloadConversa):
    config = buscar_tenant(payload.tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant inválido no Quasar.")

    nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial = config

    # Registra a entrada do usuário
    gerenciar_memoria(payload.session_id, payload.tenant_id, "user", payload.mensagem)
    historico = gerenciar_memoria(payload.session_id, payload.tenant_id, recuperar=True)

    # Contexto real do cliente vindo do Órbita Cortex (piloto "atendimento ao
    # cliente") — só é buscado quando o tenant identifica o cliente por
    # telefone em vez de e-mail. Falha ao buscar não interrompe o atendimento.
    contexto_cortex = None
    if payload.contato_cliente:
        contexto_cortex = buscar_contexto_cortex(payload.tenant_id, payload.contato_cliente)

    bloco_contexto_cliente = f"Você está atendendo o cliente: {payload.nome_cliente} (E-mail: {payload.email_cliente})."
    if contexto_cortex:
        bloco_contexto_cliente = f"""Você está atendendo o cliente: {contexto_cortex['nome']} (telefone: {contexto_cortex['contato']}).

    Contexto do cliente (fonte: Órbita Cortex — dados reais do negócio):
    - Unidade: {contexto_cortex['unidade']}
    - Total de visitas: {contexto_cortex['total_visitas']}
    - Última visita: {contexto_cortex['ultima_visita'] or 'sem registro'} ({contexto_cortex['dias_desde_ultima_visita'] if contexto_cortex['dias_desde_ultima_visita'] is not None else '?'} dias atrás)
    - Risco de afastamento: {'ALTO — cliente sumido há mais de 45 dias, priorize acolhimento' if contexto_cortex['churn_risk'] else 'baixo — cliente ativo'}"""

    # Prompt de Sistema do Concierge Quasar
    system_prompt = f"""
    Você é o assistente concierge de elite da empresa '{nome_empresa}', operando pelo módulo de alta tecnologia Órbita Quasar.
    Seu foco é gerenciar alunos de mentoria alto ticket, lembrar de prazos de renovação e realizar agendamentos.
    {bloco_contexto_cliente}

    FAQ de Negócios e Contexto:
    {faq_contexto}

    Regras de Capacidade de Ferramentas (Feature Flags):
    - Capacidade de Agendamento via IA ativa: {flag_agendamento_ia}. Você possui acesso a ferramentas de verificação de agenda. Se o cliente manifestar desejo de marcar uma reunião, execute a ferramenta necessária em background antes de responder.
    - Fechamento Comercial ativo: {flag_fechamento_comercial}. Você tem autorização para conduzir o fechamento e enviar links de checkout/renovação de assinatura fornecidos no FAQ.

    Seja elegante, direto, prestativo e use parágrafos curtos.
    """

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    # Prepara payload injetando as ferramentas de Function Calling se a flag estiver ativa
    payload_api = {
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [{"role": "system", "content": system_prompt}] + historico,
        "temperature": 0.1
    }

    if flag_agendamento_ia:
        payload_api["tools"] = TOOLS_DEFINITION
        payload_api["tool_choice"] = "auto"

    try:
        response = requests.post(url, headers=headers, json=payload_api, timeout=20)
        res_json = response.json()
        message_out = res_json['choices'][0]['message']

        # VERIFICAÇÃO: O CLAUDE DECIDIU CHAMAR UMA FERRAMENTA?
        if message_out.get("tool_calls"):
            tool_call = message_out["tool_calls"][0]
            function_name = tool_call["function"]["name"]
            arguments = json.loads(tool_call["function"]["arguments"])

            # Executa a função Python real de forma dinâmica
            if function_name == "checar_disponibilidade_agenda":
                resultado_tool = calendar_tool.checar_disponibilidade_agenda(arguments["data_com_hora"])
            elif function_name == "confirmar_agendamento_call":
                resultado_tool = calendar_tool.confirmar_agendamento_call(payload.nome_cliente, payload.email_cliente, arguments["data_com_hora"])
            else:
                resultado_tool = "Ferramenta desconhecida."

            # Segunda chamada: injeta o retorno da ferramenta de volta para o Claude responder o cliente
            historico_com_tool = historico + [
                message_out,
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": function_name,
                    "content": resultado_tool
                }
            ]

            payload_rechamada = {
                "model": "anthropic/claude-3.5-sonnet",
                "messages": [{"role": "system", "content": system_prompt}] + historico_com_tool,
                "temperature": 0.2
            }

            re_response = requests.post(url, headers=headers, json=payload_rechamada, timeout=20)
            resposta_final_texto = re_response.json()['choices'][0]['message']['content']
        else:
            # Resposta conversacional direta sem uso de ferramentas
            resposta_final_texto = message_out["content"]

        # Salva na memória do banco e retorna ao cliente
        gerenciar_memoria(payload.session_id, payload.tenant_id, "assistant", resposta_final_texto)
        return {"acao": "MANTER_NA_IA", "resposta_ia": resposta_final_texto}

    except Exception as e:
        return {"acao": "MANTER_NA_IA", "resposta_ia": "Olá! Estou otimizando meu calendário de mentorias. Poderia tentar reagendar ou enviar sua dúvida em instantes?"}

if __name__ == "__main__":
    import uvicorn
    # Porta 5003: Cortex já ocupa 5000 e agora Quasar chama o Cortex via HTTP
    # (buscar_contexto_cortex) — os dois precisam rodar ao mesmo tempo.
    uvicorn.run("main:app", host="127.0.0.1", port=5003, reload=True)
