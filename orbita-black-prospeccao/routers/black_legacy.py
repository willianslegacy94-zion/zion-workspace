from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from repositories import interactions_repo, leads_repo
from services import prospeccao
from services.llm_agent import LLMAPIError, LLMNetworkError, run_agent

router = APIRouter(prefix="/api/v1/black", tags=["black-legacy"])


class WebhookRespostaIn(BaseModel):
    tenant_id: str
    telefone_remetente: str
    texto_mensagem: str


@router.get("/disparar-lote")
def disparar_lote(tenant_id: str, limite: int = 5):
    """Busca leads sem contato outbound ainda e gera+grava a mensagem inicial de prospecção
    (substitui a antiga regra status_disparo='PENDENTE')."""
    leads = prospeccao.leads_nao_contatados(tenant_id, limite)

    disparados = []
    for lead in leads:
        mensagem = prospeccao.mensagem_fria(lead["name"])
        interactions_repo.add_interaction(tenant_id, lead["id"], "outbound", mensagem)
        disparados.append({"id": lead["id"], "nome": lead["name"], "telefone": lead["phone"], "mensagem_gerada": mensagem})

    return {"status": "sucesso", "total_disparados": len(disparados), "fila": disparados}


@router.post("/webhook-resposta")
def webhook_resposta(payload: WebhookRespostaIn):
    """Recebe a resposta de um lead prospectado e roda o loop completo de tool-calling
    (qualificação + agendamento), não só a classificação de interesse do protótipo original."""
    lead = leads_repo.get_lead_by_phone(payload.tenant_id, payload.telefone_remetente)
    if not lead:
        return {"status": "desconhecido", "msg": "Telefone não localizado na base de prospecção ativa."}

    interactions_repo.add_interaction(payload.tenant_id, lead["id"], "inbound", payload.texto_mensagem)

    try:
        resposta_ia, usage = run_agent(payload.tenant_id, lead["id"])
    except LLMNetworkError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except LLMAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    interactions_repo.add_interaction(
        payload.tenant_id, lead["id"], "outbound", resposta_ia,
        prompt_tokens=usage["prompt_tokens"], completion_tokens=usage["completion_tokens"],
    )
    lead_atualizado = leads_repo.get_lead_by_id(payload.tenant_id, lead["id"])

    return {
        "status": "processado",
        "resposta_ia": resposta_ia,
        "lead_id": lead["id"],
        "stage_atual": lead_atualizado["stage"],
    }
