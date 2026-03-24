"""
Rotas /quick-update para parse, confirmação e histórico.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.quick_update_service import QuickUpdateService
from app.services.storage_service import quick_updates_storage

router = APIRouter(prefix="/quick-update", tags=["quick-update"])
_service = QuickUpdateService()


class ParseRequest(BaseModel):
    text: str


class ApplyRequest(BaseModel):
    parsed_payload: dict
    confirmed: bool = False


@router.post("/parse")
def parse_update(body: ParseRequest):
    try:
        return _service.parse(body.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/apply")
def apply_update(body: ApplyRequest):
    try:
        result = _service.apply(body.parsed_payload, body.confirmed)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("message", "Falha ao aplicar atualização"))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/history")
def quick_update_history(limit: int = 50):
    try:
        all_items = quick_updates_storage.all()
        ordered = sorted(all_items, key=lambda item: str(item.get("created_at", "")), reverse=True)
        return {
            "items": ordered[: max(1, min(limit, 200))],
            "total": len(all_items),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
