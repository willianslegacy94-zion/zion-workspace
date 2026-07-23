import json
import os
from urllib.parse import urlparse

import requests

from repositories import interactions_repo, leads_repo, tenants_repo
from tools.crm_tools import execute_tool, tools_for_tenant

PROVIDER = os.getenv("LLM_PROVIDER", "anthropic").lower()

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5")

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-5")

MAX_TOOL_ITERATIONS = 5


class LLMNetworkError(Exception):
    """Falha de rede/DNS/timeout ao conectar no provedor — NÃO é problema de credencial."""


class LLMAPIError(Exception):
    """Erro retornado pela API do provedor (chave inválida, quota, modelo errado, etc.)."""


def post_or_raise(url: str, **kwargs) -> requests.Response:
    try:
        response = requests.post(url, **kwargs)
    except requests.exceptions.RequestException as e:
        host = urlparse(url).hostname
        raise LLMNetworkError(
            f"Falha de rede ao conectar em {host}: {type(e).__name__}: {e}. "
            f"Não é problema de chave de API — tente novamente."
        ) from e
    if response.status_code >= 400:
        raise LLMAPIError(f"Erro da API ({url}): HTTP {response.status_code} — {response.text}")
    return response


def build_system_prompt(tenant: dict) -> str:
    return f"""
Você é o SDR da {tenant['nome_empresa']}, conversando por WhatsApp.

## O que a empresa vende
{tenant['faq_contexto']}

## Seu objetivo nesta conversa
Qualificar o lead e, se fizer sentido, agendar uma reunião com um vendedor humano.
Você NÃO fecha vendas nem faz demonstrações — seu papel é entender o contexto do lead
e decidir o próximo passo certo.

## Critérios de qualificação
Um lead é qualificado quando você entende:
- Porte do negócio (quantas pessoas, quanto fatura, se tem equipe comercial/atendimento)
- Se tem uma dor ativa relacionada a atendimento, triagem ou processos comerciais repetitivos
- Se tem autoridade para decidir ou vai influenciar a decisão
- Se há abertura real pra conversar com o time comercial

Não faça essas perguntas como um formulário. Converse naturalmente, uma pergunta por vez,
e use os dados que a pessoa já deu — não repita perguntas.

## Tom de voz
- Direto, humano, sem parecer script. Frases curtas.
- Nunca invente preços, prazos ou funcionalidades que você não tem certeza.
- Se perguntarem se você é um assistente/IA, responda com honestidade.

## Quando usar as ferramentas
- Assim que entender o contexto do lead, registre com `add_note`.
- Quando o lead demonstrar fit real (bate os critérios acima), chame `update_lead_stage`
  com "qualificando" e proponha agendar uma reunião.
- Se o lead topar um horário, chame `schedule_meeting`.
- Se o lead disser claramente que não tem interesse ou não é o momento, chame
  `update_lead_stage` com "perdido".
- Se surgir uma objeção que você não sabe responder, pedido de desconto, reclamação,
  ou qualquer sinal de urgência/frustração, chame `escalate_to_human` e avise o lead
  que alguém do time vai continuar a conversa.

## Regras rígidas
- Nunca prometa algo que não foi dito explicitamente nas informações acima.
- Nunca finja ser humano se perguntado diretamente.
- Uma pergunta por mensagem. Mensagens curtas (WhatsApp, não email).
""".strip()


def to_anthropic_tools(tools: list[dict]) -> list[dict]:
    return [{"name": t["name"], "description": t["description"], "input_schema": t["parameters"]} for t in tools]


def to_openai_tools(tools: list[dict]) -> list[dict]:
    return [
        {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}}
        for t in tools
    ]


def interactions_to_messages(interactions: list[dict]) -> list[dict]:
    return [
        {"role": "user" if i["direction"] == "inbound" else "assistant", "content": i["message"]}
        for i in interactions
    ]


def fallback_reply(tenant_id: str, lead_id: str) -> str:
    leads_repo.add_note(tenant_id, lead_id, "[AVISO] Agente atingiu limite de chamadas de ferramentas nesta rodada.")
    return "Deixa eu confirmar uma informação aqui e já te retorno, tudo bem?"


def _add_usage(totals: dict, prompt_tokens: int, completion_tokens: int) -> None:
    totals["prompt_tokens"] += prompt_tokens
    totals["completion_tokens"] += completion_tokens


# --- Provedor: Anthropic (API nativa, /v1/messages) -------------------------

def call_anthropic(messages: list[dict], tools: list[dict], system_prompt: str) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise LLMAPIError("ANTHROPIC_API_KEY não configurada no .env")

    response = post_or_raise(
        ANTHROPIC_API_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "max_tokens": 1024,
            "system": system_prompt,
            "tools": to_anthropic_tools(tools),
            "messages": messages,
        },
        timeout=30,
    )
    return response.json()


def run_anthropic_agent(
    tenant: dict, lead_id: str, history: list[dict], system_prompt: str, tools: list[dict]
) -> tuple[str, dict]:
    messages = history
    tenant_id = tenant["tenant_id"]
    usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for _ in range(MAX_TOOL_ITERATIONS):
        data = call_anthropic(messages, tools, system_prompt)
        data_usage = data.get("usage") or {}
        _add_usage(usage, data_usage.get("input_tokens", 0), data_usage.get("output_tokens", 0))

        if data.get("stop_reason") != "tool_use":
            reply = "\n".join(b["text"] for b in data["content"] if b["type"] == "text").strip()
            return reply, usage

        messages = messages + [{"role": "assistant", "content": data["content"]}]

        tool_results = [
            {
                "type": "tool_result",
                "tool_use_id": b["id"],
                "content": json.dumps(execute_tool(tenant_id, lead_id, b["name"], b["input"])),
            }
            for b in data["content"]
            if b["type"] == "tool_use"
        ]
        messages = messages + [{"role": "user", "content": tool_results}]

    return fallback_reply(tenant_id, lead_id), usage


# --- Provedor: OpenRouter (API compatível com OpenAI, /chat/completions) ----

def call_openrouter(messages: list[dict], tools: list[dict], system_prompt: str) -> dict:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise LLMAPIError("OPENROUTER_API_KEY não configurada no .env")

    response = post_or_raise(
        OPENROUTER_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "max_tokens": 1024,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "tools": to_openai_tools(tools),
        },
        timeout=30,
    )
    return response.json()


def run_openrouter_agent(
    tenant: dict, lead_id: str, history: list[dict], system_prompt: str, tools: list[dict]
) -> tuple[str, dict]:
    messages = history
    tenant_id = tenant["tenant_id"]
    usage = {"prompt_tokens": 0, "completion_tokens": 0}

    for _ in range(MAX_TOOL_ITERATIONS):
        data = call_openrouter(messages, tools, system_prompt)
        data_usage = data.get("usage") or {}
        _add_usage(usage, data_usage.get("prompt_tokens", 0), data_usage.get("completion_tokens", 0))

        choice = data["choices"][0]
        message = choice["message"]

        if choice.get("finish_reason") != "tool_calls" or not message.get("tool_calls"):
            return (message.get("content") or "").strip(), usage

        messages = messages + [message]

        tool_messages = []
        for call in message["tool_calls"]:
            try:
                tool_input = json.loads(call["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                tool_input = {}
            result = execute_tool(tenant_id, lead_id, call["function"]["name"], tool_input)
            tool_messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(result)})

        messages = messages + tool_messages

    return fallback_reply(tenant_id, lead_id), usage


# -----------------------------------------------------------------------------

def run_agent(tenant_id: str, lead_id: str) -> tuple[str, dict]:
    tenant = tenants_repo.get_tenant(tenant_id)
    if not tenant:
        raise LLMAPIError(f"Tenant '{tenant_id}' não encontrado em tenants_config")

    system_prompt = build_system_prompt(tenant)
    tools = tools_for_tenant(tenant)
    interactions = interactions_repo.list_interactions(tenant_id, lead_id)
    history = interactions_to_messages(interactions)

    if PROVIDER == "openrouter":
        return run_openrouter_agent(tenant, lead_id, history, system_prompt, tools)
    return run_anthropic_agent(tenant, lead_id, history, system_prompt, tools)
