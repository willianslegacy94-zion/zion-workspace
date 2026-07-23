import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from models.schemas import TestChatIn, TestChatOut
from repositories import interactions_repo, leads_repo
from services import whatsapp_evolution
from services.llm_agent import LLMAPIError, LLMNetworkError, run_agent

router = APIRouter(prefix="/api", tags=["whatsapp"])


def _handle_incoming_message(tenant_id: str, phone: str, name: str | None, text: str):
    lead = leads_repo.get_or_create_lead_by_phone(tenant_id, phone, name)
    interactions_repo.add_interaction(tenant_id, lead["id"], "inbound", text)

    try:
        reply, usage = run_agent(tenant_id, lead["id"])
    except (LLMNetworkError, LLMAPIError) as e:
        print(f"[whatsapp webhook] Erro ao processar mensagem: {e}")
        return

    interactions_repo.add_interaction(
        tenant_id, lead["id"], "outbound", reply,
        prompt_tokens=usage["prompt_tokens"], completion_tokens=usage["completion_tokens"],
    )
    try:
        whatsapp_evolution.send_message(phone, reply)
    except (LLMNetworkError, LLMAPIError) as e:
        print(f"[whatsapp webhook] Erro ao enviar resposta: {e}")


@router.post("/whatsapp/webhook")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    incoming = whatsapp_evolution.parse_incoming_message(body)
    if not incoming:
        return {"status": "ignored"}

    tenant_id = body.get("tenant_id") or os.getenv("DEFAULT_TENANT_ID", "orbita")
    background_tasks.add_task(
        _handle_incoming_message, tenant_id, incoming["phone"], incoming["name"], incoming["text"]
    )
    return {"status": "received"}


@router.post("/test-chat", response_model=TestChatOut)
def test_chat(payload: TestChatIn):
    lead = leads_repo.get_or_create_lead_by_phone(payload.tenant_id, payload.phone, payload.name)
    interactions_repo.add_interaction(payload.tenant_id, lead["id"], "inbound", payload.message, "web")

    try:
        reply, usage = run_agent(payload.tenant_id, lead["id"])
    except LLMNetworkError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except LLMAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    interactions_repo.add_interaction(
        payload.tenant_id, lead["id"], "outbound", reply, "web",
        prompt_tokens=usage["prompt_tokens"], completion_tokens=usage["completion_tokens"],
    )
    return TestChatOut(reply=reply, lead_id=lead["id"])


@router.get("/health")
def health():
    return {"status": "ok", "agent": "Orbita Black"}
