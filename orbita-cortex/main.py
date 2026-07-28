# main.py
import os
import json
import sqlite3
import requests
from fastapi import FastAPI, HTTPException, Request
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
THIECO_API_URL = os.getenv("THIECO_API_URL", "http://localhost:3001")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY")
# Modelo barato pra classificar o pedido de relatório do admin — tarefa
# curta (poucas linhas de entrada, JSON pequeno de saída), não precisa do
# modelo mais caro que o Quasar usa pra atendimento de cliente.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5.6-luna")

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
    # Número cadastrado sem o DDI (55) faz a Evolution API recusar o envio
    # (WhatsApp reporta o JID como inexistente) — normaliza antes de mandar.
    if len(digitos) in (10, 11) and not digitos.startswith("55"):
        digitos = f"55{digitos}"

    try:
        resp = requests.post(
            f"{EVOLUTION_API_URL}/message/sendText/{instancia}",
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            json={"number": digitos, "text": payload.mensagem},
            timeout=10,
        )
        if not resp.ok:
            print(f"🧠 CORTEX -> Evolution API respondeu {resp.status_code} em {instancia}: {resp.text}")
            return {"status": "erro", "detalhe": f"Evolution API respondeu HTTP {resp.status_code}"}
        # Registra o id da mensagem enviada — se o canal admin for o próprio
        # número pessoal do gestor (self-chat), esse relatório também chega
        # de volta como evento fromMe=true no webhook; sem isso, o Cortex
        # tentaria classificar seu próprio relatório como se fosse uma
        # pergunta nova.
        _registrar_envio_proprio(resp.json())
        print(f"🧠 CORTEX -> notificou admin do tenant '{payload.tenant_id}' via {instancia}")
        return {"status": "ok"}
    except Exception as e:
        print(f"🧠 CORTEX -> falha ao notificar admin via {instancia}: {e!r}")
        return {"status": "erro", "detalhe": "Falha ao notificar o admin via WhatsApp."}

# ── Relatório sob demanda: admin pergunta, Cortex interpreta e responde ────
#
# Reaproveita as MESMAS consultas do relatório periódico (GET
# /notificacoes/relatorio-sob-demanda no sistema-thieco) — o Cortex não
# acessa o Postgres de vendas/catálogo diretamente, só interpreta a
# pergunta e formata a resposta. A autorização (só o telefone cadastrado
# como admin pode puxar relatório) é validada no lado do sistema-thieco,
# não aqui — o Cortex só repassa o telefone de quem perguntou.

TENANT_POR_INSTANCIA_ADMIN = {v: k for k, v in INSTANCIA_ADMIN_POR_TENANT.items()}

TIPOS_RELATORIO_VALIDOS = {
    "faturamento", "produtos_mais_vendidos", "servicos_mais_realizados",
    "ticket_medio_barbeiro", "ranking_barbeiros", "estoque_parado", "estoque_alerta",
}
UNIDADES_VALIDAS_RELATORIO = {"mutinga", "tambore"}

# IDs das mensagens que o próprio Cortex mandou (webhook OU relatório
# periódico) — necessário porque o canal admin é pareado no número pessoal
# do próprio gestor: quando ele manda mensagem "pra si mesmo" perguntando
# algo, ela chega marcada fromMe=true (mesma marca de uma mensagem enviada
# pela nossa própria API), então não dá pra usar só fromMe pra diferenciar
# "pergunta real do admin" de "eco da nossa própria resposta". Guardamos o
# id de tudo que a gente manda; se um evento fromMe=true chegar com um id
# que está aqui, é eco — ignora. Se não está, é mensagem de verdade que o
# admin escreveu. Cap simples de tamanho evita crescimento sem fim.
IDS_ENVIADOS_PELO_CORTEX: set[str] = set()

def _registrar_envio_proprio(resposta_evolution: dict) -> None:
    try:
        msg_id = (resposta_evolution or {}).get("key", {}).get("id")
        if msg_id:
            if len(IDS_ENVIADOS_PELO_CORTEX) > 200:
                IDS_ENVIADOS_PELO_CORTEX.clear()
            IDS_ENVIADOS_PELO_CORTEX.add(msg_id)
    except Exception:
        pass

def _telefone_e_admin_autorizado(telefone: str) -> bool:
    """
    Confirma no sistema-thieco se `telefone` é o admin cadastrado, ANTES de
    responder qualquer coisa — inclusive a mensagem de "não entendi". Sem
    essa checagem no fallback, uma resposta de outro agente da Holding (ex.:
    o Quasar recusando educadamente um assunto fora do escopo dele) podia
    cair aqui, ser tratada como "não entendi" e voltar pro Quasar, que
    respondia nao entendida de novo — loop infinito entre os dois bots, é
    exatamente o que aconteceu no primeiro teste. Falha de rede = nega por
    padrão (fail closed).
    """
    try:
        resp = requests.get(
            f"{THIECO_API_URL}/notificacoes/admin-autorizado",
            headers={"X-Internal-Key": INTERNAL_SERVICE_KEY or ""},
            params={"telefone": telefone},
            timeout=5,
        )
        return bool(resp.json().get("autorizado"))
    except Exception as e:
        print(f"🧠 CORTEX -> falha ao checar autorizacao de {telefone}: {e!r}")
        return False

MENSAGEM_AJUDA_RELATORIO = (
    "🥇 *Barbearia Thieco Leandro*\n\n"
    "Não entendi o pedido. Pergunte sobre:\n"
    "• Faturamento (\"como está o faturamento hoje?\")\n"
    "• Produtos mais vendidos\n"
    "• Serviços mais realizados\n"
    "• Ticket médio por barbeiro\n"
    "• Ranking de barbeiros\n"
    "• Estoque parado ou estoque com alerta (zerado/baixo)\n\n"
    "Pode falar de uma unidade (Mutinga/Tamboré) ou das duas, e de um período "
    "(hoje, essa semana, esse mês)."
)

def _classificar_pedido_relatorio(texto: str) -> dict:
    """
    Interpreta a pergunta livre do admin em {tipo, unidade, periodo_dias}
    via um modelo barato (tarefa curta, saída pequena). Nunca lança —
    qualquer falha vira tipo=None, tratado como "não entendi".
    """
    system_prompt = """
    Você classifica pedidos de relatório de um admin de barbearia, enviados por WhatsApp.

    Tipos de relatório disponíveis (chave "tipo"):
    - "faturamento": quanto faturou em dinheiro.
    - "produtos_mais_vendidos": ranking de produtos vendidos.
    - "servicos_mais_realizados": ranking de serviços realizados.
    - "ticket_medio_barbeiro": valor médio por atendimento, por barbeiro.
    - "ranking_barbeiros": ranking de barbeiros por faturamento/atendimentos.
    - "estoque_parado": produtos cadastrados há muito tempo que nunca venderam.
    - "estoque_alerta": produtos zerados ou com estoque baixo agora.
    Se a mensagem não pedir claramente um desses, use tipo=null.

    Unidade (chave "unidade"): "mutinga" ou "tambore" APENAS se a mensagem
    citar claramente o nome de uma unidade. Na dúvida, ou se a mensagem não
    mencionar nenhuma unidade, use null (relatório sai das duas) — NUNCA
    infira ou adivinhe uma unidade que não foi dita explicitamente.

    Período (chave "periodo_dias"): quantos dias pra trás o relatório cobre.
    "hoje"/sem período especificado = 1. "essa semana" = 7. "esse mês" = 30.
    Interprete outras menções de prazo de forma razoável.

    Responda ESTRITAMENTE um objeto JSON com as chaves tipo, unidade,
    periodo_dias. Sem markdown, sem crases, sem explicação.
    """
    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": texto},
                ],
                "temperature": 0.0,
            },
            timeout=15,
        )
        conteudo = resp.json()["choices"][0]["message"]["content"].strip()
        if conteudo.startswith("```"):
            conteudo = conteudo.replace("```json", "").replace("```", "").strip()
        dados = json.loads(conteudo)
        tipo = dados.get("tipo")
        if tipo not in TIPOS_RELATORIO_VALIDOS:
            return {"tipo": None}
        unidade = dados.get("unidade")
        if unidade not in UNIDADES_VALIDAS_RELATORIO:
            unidade = None
        try:
            periodo_dias = int(dados.get("periodo_dias") or 1)
        except (TypeError, ValueError):
            periodo_dias = 1
        return {"tipo": tipo, "unidade": unidade, "periodo_dias": max(1, periodo_dias)}
    except Exception as e:
        print(f"🧠 CORTEX -> falha ao classificar pedido de relatório: {e!r}")
        return {"tipo": None}

def _formatar_resposta_relatorio(resultados: list) -> str:
    partes = ["🥇 *Barbearia Thieco Leandro*", "_Relatório sob demanda_", ""]
    for r in resultados:
        partes.append(f"*{r['titulo']} — {r['unidade']}*")
        partes.append(r["mensagem"])
        partes.append("")
    return "\n".join(partes).strip()

def _extrair_texto_mensagem(msg: dict) -> str | None:
    if not msg:
        return None
    return msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text") or None

@app.post("/webhook/evolution")
async def webhook_evolution_admin(request: Request):
    """
    Recebe mensagens do canal admin (instância thieco-admin) e responde
    relatórios sob demanda. Nunca lança — a Evolution API só espera um 200
    rápido; qualquer erro fica só no log.
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ignorado", "motivo": "payload inválido"}

    if body.get("event") != "messages.upsert":
        return {"status": "ignorado", "motivo": "evento não tratado"}

    data = body.get("data") or {}
    key = data.get("key") or {}
    msg_id = key.get("id")

    if key.get("fromMe"):
        if msg_id in IDS_ENVIADOS_PELO_CORTEX:
            IDS_ENVIADOS_PELO_CORTEX.discard(msg_id)
            return {"status": "ignorado", "motivo": "eco da propria resposta do Cortex"}
        # fromMe=true SEM ser eco nosso = o admin escreveu pra si mesmo no
        # self-chat (canal admin pareado no número pessoal dele) — trata
        # como mensagem de verdade, não ignora.

    texto = _extrair_texto_mensagem(data.get("message"))
    if not texto:
        return {"status": "ignorado", "motivo": "mensagem sem texto (mídia, etc.)"}

    instancia = body.get("instance")
    telefone = (key.get("remoteJid") or "").split("@")[0]
    tenant_id = TENANT_POR_INSTANCIA_ADMIN.get(instancia)
    if not tenant_id or not telefone:
        return {"status": "ignorado", "motivo": f"instância '{instancia}' sem tenant admin mapeado"}

    # Autorização SEMPRE checada antes de responder qualquer coisa — mesmo
    # o fallback de "não entendi" (ver docstring de _telefone_e_admin_autorizado).
    if not _telefone_e_admin_autorizado(telefone):
        print(f"🧠 CORTEX -> mensagem de numero nao autorizado ignorada: {telefone}")
        return {"status": "ignorado", "motivo": "solicitante não autorizado"}

    classificacao = _classificar_pedido_relatorio(texto)

    if not classificacao["tipo"]:
        resposta = MENSAGEM_AJUDA_RELATORIO
    else:
        try:
            params = {
                "tipo": classificacao["tipo"],
                "periodo_dias": classificacao["periodo_dias"],
                "telefone_solicitante": telefone,
            }
            if classificacao["unidade"]:
                params["unidade"] = classificacao["unidade"]
            resp = requests.get(
                f"{THIECO_API_URL}/notificacoes/relatorio-sob-demanda",
                headers={"X-Internal-Key": INTERNAL_SERVICE_KEY or ""},
                params=params,
                timeout=10,
            )
            if resp.status_code == 403:
                # Número não cadastrado como admin — não confirma nada pra
                # quem perguntou, só ignora silenciosamente.
                print(f"🧠 CORTEX -> pedido de relatório de numero nao autorizado: {telefone}")
                return {"status": "ignorado", "motivo": "solicitante não autorizado"}
            dados = resp.json()
            if not dados.get("encontrado"):
                resposta = "🥇 *Barbearia Thieco Leandro*\n\nNada a reportar pra esse período/unidade."
            else:
                resposta = _formatar_resposta_relatorio(dados["resultados"])
        except Exception as e:
            print(f"🧠 CORTEX -> falha ao buscar relatorio sob demanda: {e!r}")
            resposta = "🥇 *Barbearia Thieco Leandro*\n\nDeu um erro buscando esse relatório, tenta de novo em instantes."

    if EVOLUTION_API_KEY:
        try:
            resp_envio = requests.post(
                f"{EVOLUTION_API_URL}/message/sendText/{instancia}",
                headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
                json={"number": telefone, "text": resposta, "linkPreview": False},
                timeout=10,
            )
            _registrar_envio_proprio(resp_envio.json() if resp_envio.ok else None)
        except Exception as e:
            print(f"🧠 CORTEX -> falha ao enviar resposta do relatorio: {e!r}")

    print(f"🧠 CORTEX -> respondeu relatorio sob demanda pra {telefone} via {instancia}")
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
