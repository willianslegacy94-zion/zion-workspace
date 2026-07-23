from fastapi import APIRouter, HTTPException

from models.schemas import InteractionCreate
from repositories import interactions_repo, leads_repo

router = APIRouter(prefix="/api/leads", tags=["interactions"])


@router.get("/{lead_id}/interactions")
def list_interactions(lead_id: str, tenant_id: str):
    return interactions_repo.list_interactions(tenant_id, lead_id)


@router.post("/{lead_id}/interactions", status_code=201)
def create_interaction(lead_id: str, payload: InteractionCreate):
    if payload.direction not in ("inbound", "outbound"):
        raise HTTPException(status_code=400, detail="direction deve ser 'inbound' ou 'outbound'")
    lead = leads_repo.get_lead_by_id(payload.tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return interactions_repo.add_interaction(
        payload.tenant_id, lead_id, payload.direction, payload.message, payload.channel or "whatsapp"
    )
