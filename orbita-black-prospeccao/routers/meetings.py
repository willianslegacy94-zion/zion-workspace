from fastapi import APIRouter, HTTPException

from models.schemas import MeetingCreate, MeetingUpdate
from repositories import leads_repo, meetings_repo

router = APIRouter(prefix="/api", tags=["meetings"])


@router.post("/leads/{lead_id}/meetings", status_code=201)
def create_meeting(lead_id: str, payload: MeetingCreate):
    lead = leads_repo.get_lead_by_id(payload.tenant_id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return meetings_repo.schedule_meeting(payload.tenant_id, lead_id, payload.scheduled_at, payload.notes)


@router.put("/meetings/{meeting_id}")
def update_meeting(meeting_id: str, payload: MeetingUpdate):
    meeting = meetings_repo.update_meeting(payload.tenant_id, meeting_id, payload.status, payload.notes)
    if not meeting:
        raise HTTPException(status_code=404, detail="Reunião não encontrada")
    return meeting
