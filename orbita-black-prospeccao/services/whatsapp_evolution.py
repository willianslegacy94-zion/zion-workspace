"""
Adapter para a Evolution API (WhatsApp self-hosted, decisão estratégica documentada em
orbita-black/orbita-black-arquitetura/08-modulo-de-inteligencia-artificial-e-agentes.md).

O parser abaixo segue o formato PÚBLICO conhecido do evento `messages.upsert` da Evolution API,
mas NÃO foi validado contra uma instância real rodando — isso exige parear um número via QR code
(passo de infra interativo, fora do escopo desta migração). Antes de usar em produção, confirme o
payload exato contra uma instância de verdade e ajuste este parser se necessário.
"""
import os

from services.llm_agent import LLMAPIError, LLMNetworkError, post_or_raise


def parse_incoming_message(body: dict) -> dict | None:
    try:
        if body.get("event") != "messages.upsert":
            return None

        data = body["data"]
        key = data["key"]
        if key.get("fromMe"):
            return None

        message = data.get("message", {})
        text = message.get("conversation") or message.get("extendedTextMessage", {}).get("text")
        if not text:
            return None

        phone = key["remoteJid"].split("@")[0]
        return {
            "instance": body.get("instance"),
            "phone": phone,
            "name": data.get("pushName"),
            "text": text,
            "message_id": key.get("id"),
        }
    except (KeyError, TypeError):
        return None


def send_message(phone: str, text: str) -> dict:
    api_url = os.getenv("EVOLUTION_API_URL")
    api_key = os.getenv("EVOLUTION_API_KEY")
    instance_name = os.getenv("EVOLUTION_INSTANCE_NAME")

    if not api_url or not api_key or not instance_name:
        print(f"[whatsapp_evolution] Evolution API não configurada — mensagem não enviada: {text}")
        return {"simulated": True}

    try:
        response = post_or_raise(
            f"{api_url}/message/sendText/{instance_name}",
            headers={"apikey": api_key, "content-type": "application/json"},
            json={"number": phone, "text": text},
            timeout=15,
        )
    except (LLMNetworkError, LLMAPIError) as e:
        print(f"[whatsapp_evolution] Falha ao enviar mensagem: {e}")
        raise
    return response.json()
