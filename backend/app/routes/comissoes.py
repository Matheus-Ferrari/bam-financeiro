"""
Rotas /comissoes — CRUD de comissões de membros da equipe.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import comissoes_storage

router = APIRouter()


class ComissaoCreate(BaseModel):
    nome: str
    responsavel: str
    regra: Optional[str] = None       # Descrição da regra / cálculo
    valor: float = 0.0
    competencia: Optional[str] = None
    status: str = "pendente"          # pendente | pago
    observacoes: Optional[str] = None


class ComissaoUpdate(BaseModel):
    nome: Optional[str] = None
    responsavel: Optional[str] = None
    regra: Optional[str] = None
    valor: Optional[float] = None
    competencia: Optional[str] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


@router.get("")
def list_comissoes():
    comissoes    = comissoes_storage.all()
    total        = sum(float(c.get("valor", 0)) for c in comissoes)
    total_pago   = sum(float(c.get("valor", 0)) for c in comissoes if c.get("status") == "pago")
    total_pend   = sum(float(c.get("valor", 0)) for c in comissoes if c.get("status") != "pago")
    return {
        "comissoes":      comissoes,
        "total":          round(total, 2),
        "total_pago":     round(total_pago, 2),
        "total_pendente": round(total_pend, 2),
        "quantidade":     len(comissoes),
    }


@router.post("")
def create_comissao(body: ComissaoCreate):
    return comissoes_storage.create(body.model_dump())


@router.put("/{id}")
def update_comissao(id: str, body: ComissaoUpdate):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = comissoes_storage.update(id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Comissão não encontrada")
    return updated


@router.delete("/{id}")
def delete_comissao(id: str):
    if not comissoes_storage.delete(id):
        raise HTTPException(status_code=404, detail="Comissão não encontrada")
    return {"ok": True}
