# main.py
import os
import json
import sqlite3
import requests
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from dotenv import load_dotenv
from database import DATABASE_NAME, init_quasar_db
import tools.calendar_mock as calendar_tool

load_dotenv()
app = FastAPI(title="Órbita Quasar — Engine de Agendamento Avançado")

# Idempotente (CREATE TABLE IF NOT EXISTS + INSERT OR REPLACE) — garante que
# o container tenha o schema e os tenants seed mesmo partindo de um volume
# vazio (orbita_quasar.db não é copiado pra imagem, ver .dockerignore).
init_quasar_db()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CORTEX_URL = os.getenv("CORTEX_URL", "http://127.0.0.1:5000")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://127.0.0.1:8081")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY")

@app.get("/health")
async def health():
    return {"status": "ok"}

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

FALLBACK_RESPOSTA = "Olá! Estou otimizando meu calendário de mentorias. Poderia tentar reagendar ou enviar sua dúvida em instantes?"

async def gerar_resposta_quasar(tenant_id: str, session_id: str, mensagem: str,
                                 nome_cliente: str = "Cliente", email_cliente: str = "suporte@orbita.com",
                                 contato_cliente: str | None = None) -> str:
    """
    Núcleo do concierge Quasar — monta o contexto (Cortex + FAQ do tenant),
    chama o Claude (com tool-calling se a flag do tenant permitir) e devolve
    o texto final da resposta. Reaproveitado tanto pela rota HTTP
    (/api/v1/quasar/chat) quanto pelo webhook de WhatsApp (/webhook/evolution)
    — mesma lógica de atendimento, dois jeitos de chegar até ela.
    """
    config = buscar_tenant(tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant inválido no Quasar.")

    nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial = config

    # Registra a entrada do usuário
    gerenciar_memoria(session_id, tenant_id, "user", mensagem)
    historico = gerenciar_memoria(session_id, tenant_id, recuperar=True)

    # Contexto real do cliente vindo do Órbita Cortex (piloto "atendimento ao
    # cliente") — só é buscado quando o tenant identifica o cliente por
    # telefone em vez de e-mail. Falha ao buscar não interrompe o atendimento.
    contexto_cortex = None
    if contato_cliente:
        contexto_cortex = buscar_contexto_cortex(tenant_id, contato_cliente)

    bloco_contexto_cliente = f"Você está atendendo o cliente: {nome_cliente} (E-mail: {email_cliente})."
    if contexto_cortex:
        bloco_contexto_cliente = f"""Você está atendendo o cliente: {contexto_cortex['nome']} (telefone: {contexto_cortex['contato']}).

    Contexto do cliente (fonte: Órbita Cortex — dados reais do negócio):
    - Unidade: {contexto_cortex['unidade']}
    - Total de visitas: {contexto_cortex['total_visitas']}
    - Última visita: {contexto_cortex['ultima_visita'] or 'sem registro'} ({contexto_cortex['dias_desde_ultima_visita'] if contexto_cortex['dias_desde_ultima_visita'] is not None else '?'} dias atrás)
    - Risco de afastamento: {'ALTO — cliente sumido há mais de 45 dias, priorize acolhimento' if contexto_cortex['churn_risk'] else 'baixo — cliente ativo'}"""

    # Prompt de Sistema do Concierge Quasar — genérico por design: nenhuma
    # suposição de segmento (mentoria, barbearia, etc.) fica hardcoded aqui.
    # Todo o conteúdo específico do negócio vem de faq_contexto (config do
    # tenant em tenants_config).
    system_prompt = f"""
    Você é o assistente virtual de atendimento da empresa '{nome_empresa}', respondendo pelo WhatsApp através do Órbita Quasar.
    {bloco_contexto_cliente}

    Informações e regras de negócio:
    {faq_contexto}

    Regras de Capacidade de Ferramentas (Feature Flags):
    - Agendamento via IA ativo: {flag_agendamento_ia}. Se ativo, você possui acesso a ferramentas de verificação de agenda — se o cliente manifestar desejo de marcar um horário, execute a ferramenta necessária em background antes de responder.
    - Fechamento comercial ativo: {flag_fechamento_comercial}. Se ativo, você tem autorização para conduzir o fechamento e enviar links de checkout/pagamento fornecidos nas informações de negócio acima.

    Responda sempre em português do Brasil, com parágrafos curtos, no tom indicado nas informações de negócio.
    """

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

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
        if response.status_code != 200 or 'choices' not in res_json:
            print(f"[quasar] OpenRouter respondeu {response.status_code}: {res_json}")
        message_out = res_json['choices'][0]['message']

        # VERIFICAÇÃO: O CLAUDE DECIDIU CHAMAR UMA FERRAMENTA?
        if message_out.get("tool_calls"):
            tool_call = message_out["tool_calls"][0]
            function_name = tool_call["function"]["name"]
            arguments = json.loads(tool_call["function"]["arguments"])

            if function_name == "checar_disponibilidade_agenda":
                resultado_tool = calendar_tool.checar_disponibilidade_agenda(arguments["data_com_hora"])
            elif function_name == "confirmar_agendamento_call":
                resultado_tool = calendar_tool.confirmar_agendamento_call(nome_cliente, email_cliente, arguments["data_com_hora"])
            else:
                resultado_tool = "Ferramenta desconhecida."

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
            resposta_final_texto = message_out["content"]

        gerenciar_memoria(session_id, tenant_id, "assistant", resposta_final_texto)
        return resposta_final_texto

    except Exception as e:
        print(f"[quasar] Falha ao gerar resposta via OpenRouter: {e!r}")
        return FALLBACK_RESPOSTA

@app.post("/api/v1/quasar/chat")
async def processar_atendimento_quasar(payload: PayloadConversa):
    resposta_final_texto = await gerar_resposta_quasar(
        tenant_id=payload.tenant_id, session_id=payload.session_id, mensagem=payload.mensagem,
        nome_cliente=payload.nome_cliente, email_cliente=payload.email_cliente,
        contato_cliente=payload.contato_cliente,
    )
    return {"acao": "MANTER_NA_IA", "resposta_ia": resposta_final_texto}

# Mapeamento instância Evolution API → tenant_id. Por ora só sistema_thieco
# (piloto Mutinga) — extensível quando outros tenants ganharem atendimento
# automatizado.
INSTANCIA_PREFIXO_TENANT = {"thieco": "sistema_thieco"}

def _extrair_texto_mensagem(msg: dict) -> str | None:
    """Extrai o texto de tipos comuns de mensagem do payload da Evolution API."""
    if not msg:
        return None
    return (
        msg.get("conversation")
        or msg.get("extendedTextMessage", {}).get("text")
        or None
    )

@app.post("/webhook/evolution")
async def webhook_evolution(request: Request):
    """
    Recebe o evento de mensagem recebida da Evolution API (configurado em
    sistema-thieco/backend/services/whatsappService.js, evento
    MESSAGES_UPSERT) e responde automaticamente via WhatsApp usando a mesma
    lógica de /api/v1/quasar/chat. Nunca lança — a Evolution API só espera
    um 200 rápido; qualquer erro fica só no log.
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ignorado", "motivo": "payload inválido"}

    if body.get("event") != "messages.upsert":
        return {"status": "ignorado", "motivo": "evento não tratado"}

    data = body.get("data") or {}
    key = data.get("key") or {}

    if key.get("fromMe"):
        return {"status": "ignorado", "motivo": "mensagem enviada por nós mesmos"}

    texto = _extrair_texto_mensagem(data.get("message"))
    if not texto:
        return {"status": "ignorado", "motivo": "mensagem sem texto (mídia, etc.)"}

    instancia = body.get("instance")
    telefone = (key.get("remoteJid") or "").split("@")[0]
    if not instancia or not telefone:
        return {"status": "ignorado", "motivo": "instância ou remetente ausente"}

    # thieco-mutinga -> tenant sistema_thieco (prefixo antes do primeiro '-')
    prefixo = instancia.split("-")[0]
    tenant_id = INSTANCIA_PREFIXO_TENANT.get(prefixo)
    if not tenant_id:
        return {"status": "ignorado", "motivo": f"instância '{instancia}' sem tenant mapeado"}

    session_id = f"{instancia}:{telefone}"

    try:
        resposta = await gerar_resposta_quasar(
            tenant_id=tenant_id, session_id=session_id, mensagem=texto,
            contato_cliente=telefone,
        )
        if EVOLUTION_API_KEY:
            requests.post(
                f"{EVOLUTION_API_URL}/message/sendText/{instancia}",
                headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
                json={"number": telefone, "text": resposta},
                timeout=10,
            )
        print(f"🤖 QUASAR -> respondeu {telefone} via {instancia}")
        return {"status": "ok"}
    except Exception as e:
        print(f"🤖 QUASAR -> falha ao processar webhook: {e}")
        return {"status": "erro"}

if __name__ == "__main__":
    import uvicorn
    # Porta 5003: Cortex já ocupa 5000 e agora Quasar chama o Cortex via HTTP
    # (buscar_contexto_cortex) — os dois precisam rodar ao mesmo tempo.
    uvicorn.run("main:app", host="127.0.0.1", port=5003, reload=True)
