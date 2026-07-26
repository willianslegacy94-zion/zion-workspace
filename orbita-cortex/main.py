# main.py
import os
import json
import sqlite3
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv
from database_cortex import DATABASE_NAME
from conectores.thieco import buscar_cliente_thieco

# Busca o .env global na raiz do workspace
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8081")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY")

app = FastAPI(title="Órbita Cortex — Central Inteligente da Agência")

@app.get("/health")
async def health():
    return {"status": "ok"}

class PayloadPlataforma(BaseModel):
    tenant_id: str
    email: str
    nome: str
    valor_transacao: float
    progresso_aulas: float
    dias_ativos: int

@app.post("/api/v1/cortex/processar")
async def processar_inteligencia_agencia(payload: PayloadPlataforma):
    """
    Injeta dados brutos das plataformas, processa a classificação analítica
    com o Claude 3.5 Sonnet e altera o comportamento global dos bots de atendimento.
    """
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    # Prompt estrito para devolver apenas variáveis operacionais legíveis pelo sistema (JSON)
    system_prompt = """
    Você é a inteligência analítica central de uma Holding de Robôs de IA. Sua função é ler os dados comportamentais de um cliente e mapear seu perfil em variáveis booleanas e strings operacionais para o banco de dados.

    Você deve retornar estritamente um objeto JSON com duas chaves:
    1. 'churn_risk': (1 se o aluno comprou há menos de 7 dias e assistiu menos de 10% das aulas, caso contrário 0).
    2. 'upsell_product': ('MENTORIA_VIP' se assistiu mais de 70% das aulas, ou 'SUPORTE_ACELERADO' se comprou há mais de 15 dias e está com menos de 30% de progresso, ou 'NENHUMA').

    Responda APENAS o JSON puro, sem formatação markdown, sem crases e sem explicações.
    """

    dados_brutos = f"""
    Dias de curso: {payload.dias_ativos}
    Progresso: {payload.progresso_aulas}%
    Valor Gasto: R$ {payload.valor_transacao}
    """

    payload_api = {
        "model": "anthropic/claude-3.5-sonnet",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": dados_brutos}
        ],
        "temperature": 0.0
    }

    try:
        response = requests.post(url, headers=headers, json=payload_api, timeout=15)
        resultado_ia = response.json()['choices'][0]['message']['content'].strip()

        # Limpeza preventiva de possíveis crases de bloco de código que a IA possa colocar
        if resultado_ia.startswith("```"):
            resultado_ia = resultado_ia.replace("```json", "").replace("```", "").strip()

        dados_finais = json.loads(resultado_ia)

        # Injeta/Atualiza a inteligência de negócios no SQLite Central da agência
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO matriz_inteligencia (email, tenant_id, nome, ltv, progresso_curso, status_churn_risk, recomendacao_upsell)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                ltv = ltv + excluded.ltv,
                progresso_curso = excluded.progresso_curso,
                status_churn_risk = excluded.status_churn_risk,
                recomendacao_upsell = excluded.recomendacao_upsell,
                ultima_atualizacao = CURRENT_TIMESTAMP
        """, (
            payload.email.lower().strip(), payload.tenant_id, payload.nome,
            payload.valor_transacao, payload.progresso_aulas,
            dados_finais['churn_risk'], dados_finais['upsell_product']
        ))
        conn.commit()
        conn.close()

        print(f"🧠 CORTEX AGÊNCIA ATUALIZADO -> {payload.nome} | Churn Flag: {dados_finais['churn_risk']} | Upsell: {dados_finais['upsell_product']}")
        return {"status": "sincronizado", "matriz_operacional": dados_finais}

    except Exception as e:
        return {"status": "erro", "detalhe": "Falha na sincronização da matriz analítica interna."}

# Tenants habilitados para o piloto de "atendimento ao cliente" — consulta
# pull direto no Postgres do negócio, sem passar pela matriz EAD.
TENANTS_ATENDIMENTO_SUPORTADOS = {"sistema_thieco"}

@app.get("/api/v1/cortex/atendimento")
async def atendimento_cliente(tenant_id: str, contato: str, unidade: str | None = None):
    """
    Consulta sob demanda usada pelos agentes de atendimento (ex.: Quasar) para
    enriquecer a conversa com o contexto real do cliente. Sem chamada de IA —
    leitura direta (role read-only) + regra determinística de churn_risk. O
    Cortex nunca fala com o cliente final; quem consome esta rota são os
    agentes da Holding.
    """
    if tenant_id not in TENANTS_ATENDIMENTO_SUPORTADOS:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' não suportado neste endpoint.")

    try:
        cliente = buscar_cliente_thieco(contato, unidade)
    except Exception:
        return {"status": "erro", "detalhe": "Falha ao consultar a base do tenant."}

    if not cliente:
        return {"status": "nao_encontrado"}

    return {"status": "ok", "cliente": cliente}

# Instância Evolution API por tenant, dedicada ao número pessoal do gestor
# (canal 'admin' no whatsappService.js do sistema-thieco — pareado via QR
# na própria tela de Configurações do tenant, o Cortex não gera QR nenhum).
INSTANCIA_ADMIN_POR_TENANT = {"sistema_thieco": "thieco-admin"}

class PayloadNotificarAdmin(BaseModel):
    tenant_id: str
    telefone: str
    mensagem: str

@app.post("/api/v1/cortex/notificar-admin")
async def notificar_admin(payload: PayloadNotificarAdmin):
    """
    Cortex como mensageiro (não decisor): o tenant já gerou o conteúdo do
    relatório (faturamento/ranking/estoque parado) — aqui só repassamos pro
    WhatsApp do admin via Evolution API. Nenhuma chamada de IA envolvida.
    """
    instancia = INSTANCIA_ADMIN_POR_TENANT.get(payload.tenant_id)
    if not instancia:
        raise HTTPException(status_code=404, detail=f"Tenant '{payload.tenant_id}' não suportado neste endpoint.")
    if not EVOLUTION_API_KEY:
        return {"status": "erro", "detalhe": "EVOLUTION_API_KEY não configurada no Cortex."}

    digitos = "".join(c for c in payload.telefone if c.isdigit())

    try:
        resp = requests.post(
            f"{EVOLUTION_API_URL}/message/sendText/{instancia}",
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            json={"number": digitos, "text": payload.mensagem},
            timeout=10,
        )
        if not resp.ok:
            return {"status": "erro", "detalhe": f"Evolution API respondeu HTTP {resp.status_code}"}
        print(f"🧠 CORTEX -> notificou admin do tenant '{payload.tenant_id}' via {instancia}")
        return {"status": "ok"}
    except Exception:
        return {"status": "erro", "detalhe": "Falha ao notificar o admin via WhatsApp."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
