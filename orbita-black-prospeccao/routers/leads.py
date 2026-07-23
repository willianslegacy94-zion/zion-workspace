from fastapi import APIRouter, HTTPException

from models.schemas import LeadCreate, LeadStageUpdate, LeadUpdate
from repositories import interactions_repo, leads_repo, meetings_repo

router = APIRouter(prefix="/api/leads", tags=["leads"])

STAGES = ["novo", "qualificando", "reuniao_marcada", "ganho", "perdido"]


@router.get("")
def list_leads(tenant_id: str, stage: str | None = None):
    return leads_repo.list_leads(tenant_id, stage)


@router.get("/by-phone/{phone}")
def get_lead_by_phone(phone: str, tenant_id: str):
    lead = leads_repo.get_lead_by_phone(tenant_id, phone)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.get("/{lead_id}")
def get_lead(lead_id: str, tenant_id: str):
    lead = leads_repo.get_lead_by_id(tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return {
        **lead,
        "interactions": interactions_repo.list_interactions(tenant_id, lead_id),
        "meetings": meetings_repo.list_meetings(tenant_id, lead_id),
    }


@router.post("", status_code=201)
def create_lead(payload: LeadCreate):
    existing = leads_repo.get_lead_by_phone(payload.tenant_id, payload.phone)
    if existing:
        raise HTTPException(status_code=409, detail="Já existe um lead com esse telefone")
    return leads_repo.create_lead(
        payload.tenant_id, payload.name, payload.phone,
        payload.company, payload.role, payload.source, payload.notes,
    )


@router.put("/{lead_id}")
def update_lead(lead_id: str, payload: LeadUpdate):
    lead = leads_repo.update_lead(payload.tenant_id, lead_id, payload.model_dump(exclude={"tenant_id"}))
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.put("/{lead_id}/stage")
def update_stage(lead_id: str, payload: LeadStageUpdate):
    if payload.stage not in STAGES:
        raise HTTPException(status_code=400, detail=f"stage inválido. Use um de: {', '.join(STAGES)}")
    lead = leads_repo.update_stage(payload.tenant_id, lead_id, payload.stage)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: str, tenant_id: str):
    if not leads_repo.delete_lead(tenant_id, lead_id):
        raise HTTPException(status_code=404, detail="Lead não encontrado")
