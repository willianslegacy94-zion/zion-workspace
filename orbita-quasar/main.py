# main.py
import os
import json
import sqlite3
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from database import DATABASE_NAME, init_quasar_db, UNIDADES_INFO
import tools.calendar_mock as calendar_tool
import tools.lane_confeitaria as lane_tool

def saudacao_por_horario() -> str:
    """Bom dia / Boa tarde / Boa noite conforme o horário de Brasília — o
    modelo não sabe a hora real sozinho, por isso calculamos aqui.
    Madrugada (0h-5h59) conta como "Boa noite", não "Bom dia"."""
    hora = datetime.now(ZoneInfo("America/Sao_Paulo")).hour
    if hora < 6:
        return "Boa noite"
    if hora < 12:
        return "Bom dia"
    if hora < 18:
        return "Boa tarde"
    return "Boa noite"

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
THIECO_API_URL = os.getenv("THIECO_API_URL", "http://127.0.0.1:3001")
# Backend compartilhado do whitelabel — um Quasar só, atende qualquer
# cliente que nascer ali (isolado por tenant_id nos dados, nunca por
# deploy). Ver Playbook DevOps, "Plano de portabilidade whitelabel".
WHITELABEL_API_URL = os.getenv("WHITELABEL_API_URL", "http://127.0.0.1:3002")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY")
# Modelo usado nas chamadas à OpenRouter — configurável por env pra permitir
# testar custo/qualidade sem precisar mexer em código a cada troca.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5.6-luna")

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
    # Tenants multi-unidade (ex.: sistema_thieco) informam a unidade pra
    # isolar o contexto — vazio usa a linha padrão do tenant.
    unidade: str = ""
    # "thieco" (config local, SQLite) ou "whitelabel" (config buscada em
    # tempo real na API do whitelabel) — ver buscar_tenant_whitelabel.
    produto: str = "thieco"
    # URL pública ou data URI (data:image/...;base64,...) de uma foto de
    # referência do cliente — mesmo campo que o webhook do WhatsApp preenche
    # depois de buscar a mídia na Evolution API. Opcional, só pra permitir
    # testar o fluxo de visão sem depender do WhatsApp real.
    imagem_url: str | None = None

def buscar_contexto_cortex(tenant_id: str, contato_cliente: str, unidade: str | None = None):
    """
    Consulta o Órbita Cortex pelo contexto real do cliente (piloto
    "atendimento ao cliente"). Nunca deve derrubar o Quasar: qualquer falha
    (Cortex fora do ar, tenant não suportado, timeout) retorna None e o
    concierge segue sem esse contexto extra. `unidade`, quando informada,
    restringe a busca à unidade do cliente que está conversando (evita
    trazer contexto de um cliente com mesmo telefone em outra unidade).
    """
    try:
        params = {"tenant_id": tenant_id, "contato": contato_cliente}
        if unidade:
            params["unidade"] = unidade
        resp = requests.get(
            f"{CORTEX_URL}/api/v1/cortex/atendimento",
            params=params,
            timeout=3,
        )
        dados = resp.json()
        if dados.get("status") == "ok":
            return dados["cliente"]
    except Exception:
        pass
    return None

def buscar_tenant(tenant_id: str, unidade: str = ""):
    """
    Busca a config do tenant para a unidade informada. Cai para a linha
    "padrão" (unidade='') se não existir uma linha específica pra essa
    unidade — cobre tenants de localidade única, que só têm a linha padrão.
    """
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial FROM tenants_config WHERE tenant_id = ? AND unidade = ?",
            (tenant_id, unidade),
        )
        row = cursor.fetchone()
        if row or not unidade:
            return row
        cursor.execute(
            "SELECT nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial FROM tenants_config WHERE tenant_id = ? AND unidade = ''",
            (tenant_id,),
        )
        return cursor.fetchone()

def _buscar_info_unidade_whitelabel(tenant_id, unidade: str) -> dict | None:
    """
    Busca o pacote de conteúdo de negócio de uma unidade do whitelabel (ver
    GET /internal/unidade-atendimento no backend dele) — substitui o SQLite
    local (tenants_config) que só existe pro sistema-thieco. Nunca lança:
    falha vira None, tratado como tenant inválido.
    """
    try:
        resp = requests.get(
            f"{WHITELABEL_API_URL}/internal/unidade-atendimento",
            headers={"X-Internal-Key": INTERNAL_SERVICE_KEY or ""},
            params={"tenant_id": tenant_id, "unidade": unidade},
            timeout=5,
        )
        if resp.ok:
            return resp.json()
    except Exception as e:
        print(f"[quasar] Falha ao buscar unidade-atendimento do whitelabel: {e!r}")
    return None

def _montar_faq_whitelabel(info: dict) -> str:
    """
    Monta o texto de FAQ (mesmo formato usado nas constantes hardcoded do
    sistema-thieco) a partir do pacote dinâmico do whitelabel — só inclui os
    blocos que o admin do tenant realmente preencheu, nada fica vazio/falso
    no prompt.
    """
    partes = []
    if info.get("nome_assistente") or info.get("tom_voz"):
        linhas = ["PERSONA"]
        if info.get("nome_assistente"):
            linhas.append(f"- Nome do assistente: {info['nome_assistente']}")
        if info.get("tom_voz"):
            linhas.append(f"- Tom de voz: {info['tom_voz']}")
        partes.append("\n".join(linhas))
    if info.get("horario"):
        partes.append(f"HORÁRIO DE FUNCIONAMENTO\n{info['horario']}")
    if info.get("endereco"):
        bloco = f"ENDEREÇO\n{info['endereco']}"
        if info.get("mapa_url"):
            bloco += f"\nMapa: {info['mapa_url']}"
        partes.append(bloco)
    if info.get("instagram"):
        partes.append(f"INSTAGRAM\n{info['instagram']}")
    if info.get("equipe"):
        partes.append(f"EQUIPE\n{', '.join(info['equipe'])}")
    if info.get("link_agendamento"):
        partes.append(
            f"AGENDAMENTO\n{info['link_agendamento']}\n"
            "SÓ envie esse link quando o cliente pedir explicitamente para agendar/marcar um horário."
        )
    if info.get("precos"):
        lista = " | ".join(f"{p['nome']}: R$ {p['preco']:.2f}" for p in info["precos"])
        partes.append(f"TABELA DE PREÇOS\n{lista}\nNUNCA informe preços que não estejam nesta lista.")
    if info.get("regras_atendimento"):
        partes.append(f"REGRAS DE ATENDIMENTO\n{info['regras_atendimento']}")
    if info.get("mensagem_transbordo"):
        partes.append(
            "TRANSBORDO PARA HUMANO\n"
            "Quando o cliente pedir para falar com uma pessoa, tiver uma reclamação, ou uma dúvida que você não "
            "consegue responder: primeiro execute a ferramenta acionar_atendimento_humano (resumindo o motivo), "
            f"e só depois responda ao cliente exatamente:\n\"{info['mensagem_transbordo']}\""
        )
    return "\n\n".join(partes).strip()

def buscar_tenant_whitelabel(tenant_id, unidade: str):
    """
    Equivalente a buscar_tenant(), mas pro whitelabel: nada de SQLite local
    nem constante Python — o conteúdo vem inteiro da API do whitelabel,
    editável pelo próprio admin do tenant (ver Configurações). Retorna a
    MESMA tupla que buscar_tenant() (nome_empresa, faq_contexto,
    flag_agendamento_ia, flag_fechamento_comercial) pra reaproveitar
    gerar_resposta_quasar sem duplicar lógica.

    flag_agendamento_ia e flag_fechamento_comercial ficam sempre desligadas
    por ora — o whitelabel ainda não tem essas flags por unidade (mesma
    decisão já tomada pro sistema_thieco: piloto de atendimento não
    inclui agendamento/fechamento autônomo).
    """
    info = _buscar_info_unidade_whitelabel(tenant_id, unidade)
    if not info:
        return None
    nome_empresa = info.get("nome_tenant") or info.get("nome_unidade") or "Atendimento"
    faq_contexto = _montar_faq_whitelabel(info)
    return (nome_empresa, faq_contexto, 0, 0)

def gerenciar_memoria(session_id: str, tenant_id: str, role: str = None, content: str = None, recuperar: bool = False):
    with sqlite3.connect(DATABASE_NAME) as conn:
        cursor = conn.cursor()
        if recuperar:
            # ORDER BY id DESC pega as 10 mensagens MAIS RECENTES (id, não
            # timestamp — CURRENT_TIMESTAMP do SQLite só tem granularidade de
            # 1s, insuficiente pra desempatar mensagens seguidas); depois
            # reverte pra ordem cronológica. Buscar por timestamp ASC LIMIT 10
            # pegava sempre as 10 mais ANTIGAS, então assim que a conversa
            # passava de 10 mensagens a nova mensagem do usuário ficava de
            # fora e o histórico enviado à IA terminava numa fala do
            # assistente — rejeitado pela OpenRouter ("must end with a user
            # message"), caindo sempre no fallback dali em diante.
            cursor.execute("SELECT role, content FROM historico_conversas WHERE session_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 10", (session_id, tenant_id))
            return [{"role": r, "content": c} for r, c in reversed(cursor.fetchall())]
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

# Transbordo pra humano — disponível em TODO tenant, independente da flag de
# agendamento via IA (é uma válvula de segurança do atendimento, não uma
# capacidade de agendamento). Ver _acionar_atendimento_humano.
TOOL_TRANSBORDO = {
    "type": "function",
    "function": {
        "name": "acionar_atendimento_humano",
        "description": "Notifica um atendente humano em tempo real. Use sempre que o cliente pedir para falar com uma pessoa, fizer uma reclamação, ou tiver uma dúvida que você não consegue responder com as informações disponíveis.",
        "parameters": {
            "type": "object",
            "properties": {
                "motivo": {
                    "type": "string",
                    "description": "Resumo curto do que o cliente precisa, para dar contexto a quem for responder."
                }
            },
            "required": ["motivo"]
        }
    }
}

# Silenciar mesmo assunto já escalado — pra thieco/whitelabel. NÃO silencia
# a conversa inteira: só o tópico que já foi passado pro humano. Não há
# fila real do lado do Quasar pra saber se o humano já respondeu — o
# próprio histórico (a mensagem fixa de transbordo já registrada como
# "assistant" na rodada anterior, ver TRANSBORDO PARA HUMANO no FAQ) é o
# sinal que o modelo usa pra reconhecer "já escalei isso" e decidir se a
# mensagem nova é continuação do mesmo assunto ou algo novo que ele já
# sabe responder.
TOOL_MANTER_SILENCIO_MESMO_ASSUNTO = {
    "type": "function",
    "function": {
        "name": "manter_silencio_mesmo_assunto",
        "description": (
            "Use quando o cliente mandar uma nova mensagem AINDA sobre o mesmo assunto que você já "
            "escalou pra atendimento humano nesta conversa (você já chamou acionar_atendimento_humano "
            "sobre esse tema e, pelo histórico, ainda não há resposta do humano). NÃO use se o cliente "
            "perguntar algo diferente que você já sabe responder com as informações de negócio — nesse "
            "caso responda normalmente, mesmo havendo uma escalada em aberto sobre outro assunto. Depois "
            "de chamar esta ferramenta, não escreva nenhuma mensagem de texto."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "motivo": {
                    "type": "string",
                    "description": "O mesmo assunto já escalado, só pra log — não repita isso ao cliente.",
                }
            },
            "required": ["motivo"],
        },
    },
}

# Preço real do sistema-thieco — nunca hardcoded/de memória. Ver
# _calcular_total_servicos: casa os nomes que o cliente mencionou contra o
# catálogo real (GET /agendamentos/servicos) e soma sem arredondar.
TOOL_CALCULAR_TOTAL_SERVICOS = {
    "type": "function",
    "function": {
        "name": "calcular_total_servicos",
        "description": (
            "Consulta o preço REAL de um ou mais serviços/combos direto no sistema da barbearia (nunca "
            "invente nem use de memória, mesmo que a tabela de preços das informações de negócio pareça "
            "suficiente) e soma o total, sem arredondar. Use sempre que o cliente perguntar o preço de um "
            "serviço específico ou quanto fica a soma de vários serviços."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "servicos": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Nomes dos serviços mencionados pelo cliente, como ele disse (ex.: ['corte', 'barba']).",
                }
            },
            "required": ["servicos"],
        },
    },
}

# Ferramentas específicas do domínio do Lane Confeitaria (bolos sob
# encomenda) — não reaproveitam TOOLS_DEFINITION acima, que é genérico pra
# reunião/mentoria (data+hora única), domínio bem diferente de encomenda de
# bolo (sabor, peso, data de entrega, sinal). Usadas só quando produto=="lane".
LANE_TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "consultar_catalogo_bolos",
            "description": "Consulta os sabores de bolo (com preço por kg, quando já definido) e o menu de docinhos por cento da Confeitaria da Lane. Chame isso antes de informar qualquer preço ao cliente.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_disponibilidade_agenda",
            "description": "Consulta quais dos próximos dias ainda têm vaga de produção de bolo. Chame isso antes de prometer qualquer data de entrega ao cliente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dias": {
                        "type": "integer",
                        "description": "Quantos dias a partir de hoje consultar. Padrão 14 se não especificado.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_cliente_por_contato",
            "description": "Verifica se o telefone de quem está conversando já é cliente da Lane e se é recorrente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contato": {"type": "string", "description": "Telefone/WhatsApp do cliente."}
                },
                "required": ["contato"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_pedido",
            "description": "Registra o pedido de bolo de verdade no sistema da Lane. Só chame depois de confirmar com o cliente todos os campos necessários.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cliente_nome": {"type": "string", "description": "Nome do cliente."},
                    "cliente_contato": {"type": "string", "description": "Telefone/WhatsApp do cliente."},
                    "sabor_nomes": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "1 ou 2 nomes de sabor, exatamente como aparecem no catálogo consultado.",
                    },
                    "massa": {"type": "string", "enum": ["BRANCA", "CHOCOLATE"], "description": "Massa escolhida."},
                    "peso_kg": {"type": "number", "description": "Peso do bolo em kg (mínimo 1.5)."},
                    "data_entrega": {"type": "string", "description": "Data de entrega no formato YYYY-MM-DD, já confirmada como disponível."},
                    "valor_base": {"type": "number", "description": "Valor combinado com o cliente para o bolo (sem acréscimos)."},
                    "acrescimo_cartao": {"type": "boolean", "description": "Cliente vai pagar no cartão?"},
                    "acrescimo_glitter": {"type": "boolean", "description": "Bolo com muito glitter?"},
                    "acrescimo_topper": {"type": "boolean", "description": "Cliente quer topper?"},
                    "modelo_referencia": {"type": "string", "description": "Descrição ou link do modelo de referência que o cliente enviou."},
                },
                "required": ["cliente_nome", "cliente_contato", "sabor_nomes", "massa", "peso_kg", "data_entrega", "valor_base"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "confirmar_pagamento_sinal",
            "description": "Sinaliza no pedido que o cliente mandou um comprovante de Pix e o valor/destinatário parecem corretos (conferência visual sua). Isso NÃO marca o sinal como pago — só avisa a Lane pra ela validar pelo extrato real e dar baixa. Nunca chame isso sem o cliente ter enviado um comprovante.",
            "parameters": {
                "type": "object",
                "properties": {
                    "resumo_comprovante": {
                        "type": "string",
                        "description": "O que você viu no comprovante: valor, data, nome de quem enviou e de quem recebeu.",
                    }
                },
                "required": ["resumo_comprovante"],
            },
        },
    },
]

def _acionar_atendimento_humano(produto: str, tenant_id, unidade: str, contato_cliente: str | None, nome_cliente: str, motivo: str) -> str:
    """
    Notifica o admin do tenant (WhatsApp real + registro visível na tela de
    notificações) de que um cliente precisa de atendimento humano. Nunca
    lança — se a chamada falhar, o Claude ainda assim responde ao cliente
    com a mensagem de transbordo (só o alerta em si que pode falhar).
    """
    if produto == "whitelabel":
        url, corpo = f"{WHITELABEL_API_URL}/internal/transbordo", {
            "tenant_id": tenant_id, "unidade": unidade,
            "contato_cliente": contato_cliente, "nome_cliente": nome_cliente, "motivo": motivo,
        }
    elif produto == "lane":
        # Lane Confeitaria não tem endpoint de notificação (WhatsApp/push) —
        # em vez disso, move o card do pedido em aberto pra fila marcada como
        # "atendimento humano" nas Configurações → Filas (ver
        # tools/lane_confeitaria.acionar_atendimento_humano). Nunca chamar o
        # endpoint do Thieco/whitelabel com dado de outro tenant.
        return lane_tool.acionar_atendimento_humano(contato_cliente or "", motivo)
    else:
        url, corpo = f"{THIECO_API_URL}/notificacoes/transbordo", {
            "unidade": unidade, "contato_cliente": contato_cliente,
            "nome_cliente": nome_cliente, "motivo": motivo,
        }
    try:
        resp = requests.post(
            url,
            headers={"X-Internal-Key": INTERNAL_SERVICE_KEY or "", "Content-Type": "application/json"},
            json=corpo,
            timeout=5,
        )
        if resp.ok:
            return "Atendente humano notificado com sucesso."
        return f"Falha ao notificar atendente humano (HTTP {resp.status_code})."
    except Exception as e:
        print(f"[quasar] Falha ao acionar atendimento humano: {e!r}")
        return "Falha ao notificar atendente humano (erro de conexão)."

def _fmt_reais(valor: float) -> str:
    return f"R$ {valor:.2f}".replace(".", ",")

def _consultar_precos_servicos_thieco(unidade: str) -> list[dict] | None:
    """
    Preço real, direto do catálogo do sistema-thieco (`catalogo.preco_venda`)
    — endpoint público /agendamentos/servicos (TASK-23), nunca hardcoded.
    Retorna None se a chamada falhar, pra quem chamar cair no fallback (a
    tabela estática do FAQ) sem quebrar o atendimento.
    """
    try:
        resp = requests.get(f"{THIECO_API_URL}/agendamentos/servicos", params={"unidade": unidade}, timeout=5)
        if resp.ok:
            return resp.json()
    except Exception as e:
        print(f"[quasar] Falha ao consultar preços reais ({unidade}): {e!r}")
    return None

def _calcular_total_servicos(unidade: str, nomes_servicos: list[str]) -> str:
    """
    Casa os nomes de serviço mencionados pelo cliente contra o catálogo real
    da unidade e soma o total sem arredondar (Artigo IV — No Invention: o
    valor nunca sai da cabeça do modelo, sempre do banco). Match por
    substring case-insensitive nos dois sentidos — cliente raramente digita
    o nome exatamente como está cadastrado (ex.: "sobrancelha" deve casar
    com "Sobrancelha com Cera" também, então preferimos o match mais curto/
    exato quando houver mais de um candidato).
    """
    catalogo = _consultar_precos_servicos_thieco(unidade)
    if catalogo is None:
        return ("Não consegui consultar a tabela de preços em tempo real agora. Use os valores das "
                "informações de negócio abaixo como referência (podem estar levemente desatualizados) e, "
                "se for fechar um total exato, avise o cliente que vai confirmar antes de cobrar.")

    encontrados, nao_encontrados = [], []
    for nome_pedido in nomes_servicos:
        alvo = nome_pedido.strip().lower()
        candidatos = [c for c in catalogo if alvo in c["nome"].lower() or c["nome"].lower() in alvo]
        if candidatos:
            encontrados.append(min(candidatos, key=lambda c: len(c["nome"])))
        else:
            nao_encontrados.append(nome_pedido)

    if not encontrados:
        nomes_disponiveis = ", ".join(c["nome"] for c in catalogo)
        return f"Nenhum dos serviços informados foi encontrado no catálogo real. Serviços disponíveis: {nomes_disponiveis}."

    total = sum(float(c["preco_venda"]) for c in encontrados)
    linhas = "\n".join(f"- {c['nome']}: {_fmt_reais(float(c['preco_venda']))}" for c in encontrados)
    resposta = f"{linhas}\nTotal: {_fmt_reais(total)}"
    if nao_encontrados:
        resposta += f"\n(Não encontrei no catálogo: {', '.join(nao_encontrados)} — não informe preço pra esses, pergunte mais detalhes ao cliente.)"
    return resposta

FALLBACK_RESPOSTA = "Olá! Estou otimizando meu calendário de mentorias. Poderia tentar reagendar ou enviar sua dúvida em instantes?"

async def gerar_resposta_quasar(tenant_id: str, session_id: str, mensagem: str,
                                 nome_cliente: str = "Cliente", email_cliente: str = "suporte@orbita.com",
                                 contato_cliente: str | None = None, unidade: str = "",
                                 produto: str = "thieco", imagem_url: str | None = None) -> str | None:
    """
    Núcleo do concierge Quasar — monta o contexto (Cortex + FAQ do tenant),
    chama o Claude (com tool-calling se a flag do tenant permitir) e devolve
    o texto final da resposta. Reaproveitado tanto pela rota HTTP
    (/api/v1/quasar/chat) quanto pelo webhook de WhatsApp (/webhook/evolution)
    — mesma lógica de atendimento, dois jeitos de chegar até ela.

    `produto` diferencia sistema-thieco (config local em SQLite,
    tenants_config) de qualquer tenant do whitelabel (config buscada em
    tempo real na API dele, sem SQLite nem constante Python nenhuma) — ver
    buscar_tenant_whitelabel.
    """
    config = buscar_tenant_whitelabel(tenant_id, unidade) if produto == "whitelabel" else buscar_tenant(tenant_id, unidade)
    if not config:
        raise HTTPException(status_code=404, detail="Tenant inválido no Quasar.")

    nome_empresa, faq_contexto, flag_agendamento_ia, flag_fechamento_comercial = config

    # Registra a entrada do usuário (só o texto/legenda — a imagem em si não
    # fica guardada no histórico, só é anexada na chamada da mensagem atual)
    gerenciar_memoria(session_id, tenant_id, "user", mensagem)
    historico = gerenciar_memoria(session_id, tenant_id, recuperar=True)

    # Registra o card de "Atendimento" no board da Lane assim que alguém
    # fala com a Mel (1ª mensagem) e avança pra "Em negociação" a partir da
    # 2ª em diante — automático, não depende de a IA lembrar de chamar uma
    # ferramenta pra isso (ver tools/lane_confeitaria.registrar_progresso_atendimento).
    if produto == "lane" and contato_cliente:
        lane_tool.registrar_progresso_atendimento(nome_cliente, contato_cliente, len(historico) <= 1)

    # Se veio uma foto de referência junto (WhatsApp real ou teste via
    # imagem_url), troca o conteúdo da última mensagem (a atual) por um
    # bloco multimodal — assim o modelo (com visão) realmente enxerga a
    # imagem em vez de só saber que "uma foto foi enviada".
    if imagem_url and historico:
        historico[-1] = {
            "role": "user",
            "content": [
                {"type": "text", "text": mensagem or "Cliente enviou uma foto de referência."},
                {"type": "image_url", "image_url": {"url": imagem_url}},
            ],
        }

    # Atendimento humanizado: se o pedido em aberto desse contato já está na
    # fila marcada como "atendimento humano", a Mel fica em silêncio — só a
    # Lane responde a partir daqui. Consulta a fila real a cada mensagem, sem
    # estado duplicado no lado do Quasar: assim que a Lane mover o card pra
    # outro lugar, a Mel volta a responder sozinha na mensagem seguinte.
    if produto == "lane" and contato_cliente and lane_tool.cliente_em_atendimento_humano(contato_cliente):
        return None

    # Contexto real do cliente vindo do Órbita Cortex (piloto "atendimento ao
    # cliente") — só é buscado quando o tenant identifica o cliente por
    # telefone em vez de e-mail. Falha ao buscar não interrompe o atendimento.
    contexto_cortex = None
    if contato_cliente:
        contexto_cortex = buscar_contexto_cortex(tenant_id, contato_cliente, unidade)

    # historico já inclui a mensagem recém-inserida do cliente — se não
    # sobrou mais nada além dela, é a primeira mensagem desta conversa
    # (session_id novo), e a apresentação só entra aqui, uma vez.
    bloco_saudacao = ""
    if len(historico) <= 1:
        if produto == "lane":
            apresentacao = "Aqui é a Mel, assistente da Confeitaria Artesanal da Lane!"
        else:
            # Apresentação fixa do piloto Thieco — mantida como estava pra
            # não alterar comportamento já em produção.
            apresentacao = "Aqui é o Theo, atendente da barbearia Thieco Leandro."
        bloco_saudacao = (
            f'\nEsta é a primeira mensagem desta conversa. Comece sua resposta com '
            f'"{saudacao_por_horario()}! {apresentacao}" — exatamente essa saudação, uma única vez, '
            f'sem adicionar nenhuma outra saudação (bom dia/boa tarde/boa noite) em nenhum outro ponto '
            f'da mensagem — e só depois responda o que o cliente perguntou. Não repita essa apresentação '
            f'nas próximas mensagens desta mesma conversa.\n'
        )

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
    {bloco_saudacao}

    Informações e regras de negócio:
    {faq_contexto}

    Regras de Capacidade de Ferramentas (Feature Flags):
    - Agendamento via IA ativo: {flag_agendamento_ia}. Se ativo, você possui acesso a ferramentas de verificação de agenda — se o cliente manifestar desejo de marcar um horário, execute a ferramenta necessária em background antes de responder.
    - Fechamento comercial ativo: {flag_fechamento_comercial}. Se ativo, você tem autorização para conduzir o fechamento e enviar links de checkout/pagamento fornecidos nas informações de negócio acima.

    Responda sempre em português do Brasil, com parágrafos curtos, no tom indicado nas informações de negócio.

    Adaptação de linguagem: sua voz é sempre uma MISTURA de dois ingredientes, nunca só
    um. Base (o que nunca muda): o jeito de falar indicado nas informações de negócio
    acima — frases curtas, direto ao ponto, expressões próprias tipo "Perfeito 👍",
    "Consigo sim", "Gostaria de fechar?". Camada de cima (o que varia): o registro do
    cliente nesta conversa — se ele for descontraído/usar gíria (ex.: "é nóis", "valeu",
    "tamo junto"), pode responder no mesmo clima, sem forçar nem exagerar; se ele for
    mais formal, seja mais formal também. Mas a estrutura de base nunca desaparece —
    você não vira um chatbot genérico nem começa a escrever parágrafos longos só porque
    o cliente é formal, e não sacrifica clareza nem as regras de negócio acima só pra
    soar descontraído.
    """

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    # Transbordo pra humano é sempre disponível. Lane Confeitaria tem seu
    # próprio conjunto de ferramentas (domínio de bolo, não de reunião) —
    # as flags flag_agendamento_ia/flag_fechamento_comercial não se aplicam
    # a ela, só ao par TOOLS_DEFINITION genérico usado por thieco/whitelabel.
    if produto == "lane":
        ferramentas_disponiveis = [TOOL_TRANSBORDO] + LANE_TOOLS_DEFINITION
    else:
        ferramentas_disponiveis = [TOOL_TRANSBORDO, TOOL_MANTER_SILENCIO_MESMO_ASSUNTO] + (TOOLS_DEFINITION if flag_agendamento_ia else [])
        if produto == "thieco":
            # Preço real só existe pro piloto sistema-thieco (THIECO_API_URL +
            # tabela catalogo) — whitelabel ainda não tem esse endpoint.
            ferramentas_disponiveis = ferramentas_disponiveis + [TOOL_CALCULAR_TOTAL_SERVICOS]

    def executar_tool_call(tool_call: dict) -> str:
        function_name = tool_call["function"]["name"]
        arguments = json.loads(tool_call["function"]["arguments"])

        if function_name == "checar_disponibilidade_agenda":
            return calendar_tool.checar_disponibilidade_agenda(arguments["data_com_hora"])
        elif function_name == "confirmar_agendamento_call":
            return calendar_tool.confirmar_agendamento_call(nome_cliente, email_cliente, arguments["data_com_hora"])
        elif function_name == "calcular_total_servicos":
            return _calcular_total_servicos(unidade, arguments.get("servicos", []))
        elif function_name == "acionar_atendimento_humano":
            return _acionar_atendimento_humano(produto, tenant_id, unidade, contato_cliente, nome_cliente, arguments.get("motivo", ""))
        elif function_name == "consultar_catalogo_bolos":
            return lane_tool.consultar_catalogo_bolos()
        elif function_name == "consultar_disponibilidade_agenda":
            return lane_tool.consultar_disponibilidade_agenda(arguments.get("dias", 14))
        elif function_name == "consultar_cliente_por_contato":
            return lane_tool.consultar_cliente_por_contato(arguments.get("contato") or contato_cliente or "")
        elif function_name == "registrar_pedido":
            return lane_tool.registrar_pedido(
                cliente_nome=arguments.get("cliente_nome", nome_cliente),
                cliente_contato=arguments.get("cliente_contato") or contato_cliente or "",
                sabor_nomes=arguments.get("sabor_nomes", []),
                massa=arguments.get("massa", ""),
                peso_kg=arguments.get("peso_kg", 0),
                data_entrega=arguments.get("data_entrega", ""),
                valor_base=arguments.get("valor_base", 0),
                acrescimo_cartao=arguments.get("acrescimo_cartao", False),
                acrescimo_glitter=arguments.get("acrescimo_glitter", False),
                acrescimo_topper=arguments.get("acrescimo_topper", False),
                modelo_referencia=arguments.get("modelo_referencia", ""),
            )
        elif function_name == "confirmar_pagamento_sinal":
            return lane_tool.confirmar_pagamento_sinal(
                contato_cliente or "", arguments.get("resumo_comprovante", "")
            )
        else:
            return "Ferramenta desconhecida."

    try:
        # Loop de tool-calling de verdade: o modelo pode precisar de VÁRIAS
        # rodadas em sequência (ex.: checar catálogo+agenda, e só DEPOIS de
        # ver o resultado, chamar registrar_pedido) — uma única rechamada
        # fixa não é suficiente, e sem reenviar `tools` em toda rechamada o
        # modelo fica impossibilitado de pedir uma 2ª ferramenta mesmo
        # querendo. Limite de 5 rodadas evita loop infinito em caso de bug/
        # comportamento repetitivo do modelo.
        mensagens_atuais = list(historico)
        resposta_final_texto = None
        for _ in range(5):
            payload_chamada = {
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "system", "content": system_prompt}] + mensagens_atuais,
                "temperature": 0.1,
                "tools": ferramentas_disponiveis,
                "tool_choice": "auto",
            }
            response = requests.post(url, headers=headers, json=payload_chamada, timeout=20)
            res_json = response.json()
            if response.status_code != 200 or 'choices' not in res_json:
                print(f"[quasar] OpenRouter respondeu {response.status_code}: {res_json}")
            message_out = res_json['choices'][0]['message']

            if not message_out.get("tool_calls"):
                resposta_final_texto = message_out["content"]
                break

            tool_mesmo_assunto = next(
                (tc for tc in message_out["tool_calls"] if tc["function"]["name"] == "manter_silencio_mesmo_assunto"),
                None,
            )
            if tool_mesmo_assunto:
                motivo = json.loads(tool_mesmo_assunto["function"]["arguments"] or "{}").get("motivo", "")
                print(f"🤖 QUASAR -> silenciado (mesmo assunto já escalado: {motivo}) pra {contato_cliente} via {session_id}")
                # Sem gerenciar_memoria de resposta "assistant" — não houve
                # resposta. A mensagem fixa de transbordo da rodada anterior
                # continua sendo o último "assistant" no histórico, então a
                # próxima mensagem do cliente ainda dá pro modelo reconhecer
                # se é o mesmo assunto ou algo novo.
                return None

            mensagens_tool = [
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": tool_call["function"]["name"],
                    "content": executar_tool_call(tool_call),
                }
                for tool_call in message_out["tool_calls"]
            ]
            mensagens_atuais = mensagens_atuais + [message_out] + mensagens_tool
        else:
            print("[quasar] limite de 5 rodadas de tool-calling atingido sem resposta final")
            resposta_final_texto = FALLBACK_RESPOSTA

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
        contato_cliente=payload.contato_cliente, unidade=payload.unidade, produto=payload.produto,
        imagem_url=payload.imagem_url,
    )
    # charset=utf-8 explícito no Content-Type — sem isso, alguns clientes
    # HTTP (ex.: Invoke-RestMethod do Windows PowerShell 5.1) assumem
    # Latin-1/CP1252 na ausência de charset declarado e corrompem acentos e
    # emojis (ainda que o corpo já estivesse em UTF-8 corretamente).
    if resposta_final_texto is None:
        return JSONResponse(
            content={"acao": "ATENDIMENTO_HUMANO_ATIVO", "resposta_ia": None},
            media_type="application/json; charset=utf-8",
        )
    return JSONResponse(
        content={"acao": "MANTER_NA_IA", "resposta_ia": resposta_final_texto},
        media_type="application/json; charset=utf-8",
    )

# Mapeamento instância Evolution API → tenant_id. Por ora só sistema_thieco
# (piloto Mutinga) — extensível quando outros tenants ganharem atendimento
# automatizado.
INSTANCIA_PREFIXO_TENANT = {"thieco": "sistema_thieco"}

def _resolver_origem_cliente(instancia: str):
    """
    Descobre qual produto/tenant/unidade uma instância da Evolution API
    pertence, pra decidir de onde vem o contexto de atendimento — mesmo
    padrão do _resolver_origem_admin do Cortex.

    Tenta primeiro o mapeamento fixo do thieco (thieco-mutinga ->
    sistema_thieco/mutinga); se não bater, assume que é uma instância do
    whitelabel (tenant-unidade, ambos slugs dinâmicos, por isso resolvidos
    via join exato no backend em vez de partition() client-side — ver
    GET /internal/resolve-instancia) e consulta lá.

    Retorna (produto, tenant_id, unidade, nome_tenant) ou None se a
    instância não corresponder a nada conhecido.
    """
    # Lane Confeitaria — single-tenant, uma única instância fixa (criada em
    # Configurações → WhatsApp no próprio Lane Confeitaria). Checa antes do
    # whitelabel pra não gastar uma chamada HTTP à toa nesse caso.
    if instancia == "lane_confeitaria":
        return ("lane", "lane_confeitaria", "", "Confeitaria Artesanal da Lane")

    prefixo, _, unidade = instancia.partition("-")
    tenant_id_thieco = INSTANCIA_PREFIXO_TENANT.get(prefixo)
    if tenant_id_thieco:
        return ("thieco", tenant_id_thieco, unidade, "Barbearia Thieco Leandro")

    try:
        resp = requests.get(
            f"{WHITELABEL_API_URL}/internal/resolve-instancia",
            headers={"X-Internal-Key": INTERNAL_SERVICE_KEY or ""},
            params={"instancia": instancia},
            timeout=5,
        )
        if resp.ok:
            dados = resp.json()
            if dados.get("tenant_id"):
                return (
                    "whitelabel",
                    str(dados["tenant_id"]),
                    dados.get("unidade_slug") or "",
                    dados.get("tenant_nome") or instancia,
                )
    except Exception as e:
        print(f"[quasar] falha ao resolver instância '{instancia}' no whitelabel: {e}")

    return None

def _extrair_texto_mensagem(msg: dict) -> str | None:
    """Extrai o texto de tipos comuns de mensagem do payload da Evolution API
    — inclui a legenda de foto (imageMessage.caption), quando houver."""
    if not msg:
        return None
    return (
        msg.get("conversation")
        or msg.get("extendedTextMessage", {}).get("text")
        or msg.get("imageMessage", {}).get("caption")
        or None
    )

def _extrair_imagem_mensagem(instancia: str, data: dict) -> str | None:
    """
    Se a mensagem recebida for uma foto, busca o conteúdo real (base64) via
    Evolution API — mídia do WhatsApp é ponta-a-ponta criptografada, então o
    webhook só traz metadados, não o arquivo. Nunca lança: falha na busca
    vira None (a Mel trata como se não tivesse mídia, mas ainda responde ao
    texto/legenda, se houver).
    """
    image_message = (data.get("message") or {}).get("imageMessage")
    if not image_message:
        return None
    try:
        resp = requests.post(
            f"{EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instancia}",
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            json={"message": {"key": data.get("key")}},
            timeout=20,
        )
        if not resp.ok:
            print(f"[quasar] falha ao buscar mídia da Evolution API: HTTP {resp.status_code}")
            return None
        base64_conteudo = resp.json().get("base64")
        if not base64_conteudo:
            return None
        mimetype = image_message.get("mimetype", "image/jpeg")
        return f"data:{mimetype};base64,{base64_conteudo}"
    except Exception as e:
        print(f"[quasar] erro ao buscar mídia da Evolution API: {e!r}")
        return None

def _deve_enviar_imagem_thieco(unidade: str, resposta: str) -> str | None:
    """Regra do sistema-thieco: manda a foto quando a resposta cita o link do
    Booksy ou um trecho característico do endereço. Retorna a URL da imagem
    (ou None se não deve enviar)."""
    info_unidade = UNIDADES_INFO.get(unidade) or {}
    imagem_url = info_unidade.get("imagem_url")
    menciona = (
        info_unidade.get("booksy_url") and info_unidade["booksy_url"] in resposta
    ) or (
        info_unidade.get("endereco_match") and info_unidade["endereco_match"] in resposta
    )
    return imagem_url if (imagem_url and menciona) else None

def _deve_enviar_imagem_whitelabel(info: dict | None, resposta: str) -> str | None:
    """Mesma ideia pro whitelabel, a partir do pacote dinâmico da unidade —
    só o link de agendamento é checado (endereço livre não tem um trecho
    curto e estável garantido pra combinar contra a resposta parafraseada,
    diferente do "endereco_match" fixo do thieco)."""
    if not info:
        return None
    imagem_url = info.get("imagem_url")
    link = info.get("link_agendamento")
    return imagem_url if (imagem_url and link and link in resposta) else None

def _enviar_resposta_whatsapp(instancia: str, telefone: str, resposta: str, imagem_url: str | None) -> None:
    """
    Manda a resposta pro cliente via Evolution API. Se `imagem_url` vier
    preenchido (decidido pelo chamador — ver _deve_enviar_imagem_thieco /
    _deve_enviar_imagem_whitelabel), manda a foto com a resposta como
    legenda em vez de só texto — nos outros casos, texto puro (com
    linkPreview desligado).
    """
    if imagem_url:
        endpoint, payload = "sendMedia", {
            "number": telefone,
            "mediatype": "image",
            "media": imagem_url,
            "caption": resposta,
            "fileName": "barbearia.jpg",
        }
    else:
        # linkPreview: false — sem isso o WhatsApp gera uma prévia com
        # thumbnail (imagem) toda vez que a resposta tem um link (Booksy,
        # Google Maps), o que aparece pro cliente como "mensagem com imagem".
        endpoint, payload = "sendText", {"number": telefone, "text": resposta, "linkPreview": False}

    resp = requests.post(
        f"{EVOLUTION_API_URL}/message/{endpoint}/{instancia}",
        headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
        json=payload,
        timeout=15,
    )
    if not resp.ok:
        print(f"[quasar] Evolution API respondeu {resp.status_code} em {endpoint}: {resp.text}")

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

    instancia = body.get("instance")
    telefone = (key.get("remoteJid") or "").split("@")[0]
    if not instancia or not telefone:
        return {"status": "ignorado", "motivo": "instância ou remetente ausente"}

    texto = _extrair_texto_mensagem(data.get("message"))
    imagem_url = _extrair_imagem_mensagem(instancia, data)
    if not texto and not imagem_url:
        return {"status": "ignorado", "motivo": "mensagem sem texto nem mídia reconhecida"}
    if not texto:
        # Foto sem legenda — dá pro modelo um texto neutro pra ele saber que
        # tem uma imagem anexada e reagir a ela (ver historico[-1] em
        # gerar_resposta_quasar).
        texto = "Cliente enviou uma foto de referência."

    origem = _resolver_origem_cliente(instancia)
    if not origem:
        return {"status": "ignorado", "motivo": f"instância '{instancia}' sem tenant mapeado"}
    produto, tenant_id, unidade, _nome_tenant = origem

    session_id = f"{instancia}:{telefone}"
    # Nome de exibição do WhatsApp — só um ponto de partida (pode ser
    # apelido, nome da família, etc.). O nome real pro cadastro do pedido é
    # sempre confirmado na conversa (ver regra em FAQ_LANE_CONFEITARIA).
    nome_whatsapp = data.get("pushName") or "Cliente"

    try:
        resposta = await gerar_resposta_quasar(
            tenant_id=tenant_id, session_id=session_id, mensagem=texto,
            nome_cliente=nome_whatsapp, contato_cliente=telefone, unidade=unidade, produto=produto,
            imagem_url=imagem_url,
        )
        if resposta is None:
            print(f"🤖 QUASAR -> silenciado (atendimento humano ativo) pra {telefone} via {instancia}")
            return {"status": "ok", "acao": "ATENDIMENTO_HUMANO_ATIVO"}
        if EVOLUTION_API_KEY:
            if produto == "whitelabel":
                info_unidade = _buscar_info_unidade_whitelabel(tenant_id, unidade)
                imagem_saida = _deve_enviar_imagem_whitelabel(info_unidade, resposta)
            elif produto == "lane":
                # Lane Confeitaria não tem regra de "sempre manda essa foto
                # quando a resposta cita X" (isso é do piloto thieco/
                # whitelabel) — resposta sempre só texto por enquanto.
                imagem_saida = None
            else:
                imagem_saida = _deve_enviar_imagem_thieco(unidade, resposta)
            _enviar_resposta_whatsapp(instancia, telefone, resposta, imagem_saida)
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
