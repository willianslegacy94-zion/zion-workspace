from pydantic import BaseModel, ConfigDict


class LeadCreate(BaseModel):
    tenant_id: str
    name: str
    phone: str
    company: str | None = None
    role: str | None = None
    source: str | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    tenant_id: str
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    role: str | None = None
    source: str | None = None
    notes: str | None = None


class LeadStageUpdate(BaseModel):
    tenant_id: str
    stage: str


class InteractionCreate(BaseModel):
    tenant_id: str
    direction: str
    message: str
    channel: str | None = "whatsapp"


class MeetingCreate(BaseModel):
    tenant_id: str
    scheduled_at: str
    notes: str | None = None


class MeetingUpdate(BaseModel):
    tenant_id: str
    status: str | None = None
    notes: str | None = None


class TestChatIn(BaseModel):
    tenant_id: str
    phone: str
    name: str | None = None
    message: str


class TestChatOut(BaseModel):
    reply: str
    lead_id: str


class WhatsAppWebhookIn(BaseModel):
    """Payload cru da Evolution API — validação leve, o parser real fica em services/whatsapp_evolution.py."""
    model_config = ConfigDict(extra="allow")

    event: str | None = None
    instance: str | None = None
    data: dict | None = None
