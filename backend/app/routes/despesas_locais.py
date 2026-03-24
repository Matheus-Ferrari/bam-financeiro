"""
Rotas /despesas-locais — CRUD de despesas fixas/manuais (não importadas via Excel).
Suporta parcelamento (ex: 7/12).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import despesas_locais_storage

router = APIRouter()


class DespesaLocalCreate(BaseModel):
    nome: str
    categoria: Optional[str] = "outros"
    subcategoria: Optional[str] = None
    valor: float = 0.0
    competencia: Optional[str] = None
    parcelado: bool = False
    total_parcelas: Optional[int] = None
    parcela_atual: Optional[int] = None
    status: str = "pendente"          # pendente | pago
    observacoes: Optional[str] = None


class DespesaLocalUpdate(BaseModel):
    nome: Optional[str] = None
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    valor: Optional[float] = None
    competencia: Optional[str] = None
    parcelado: Optional[bool] = None
    total_parcelas: Optional[int] = None
    parcela_atual: Optional[int] = None
    status: Optional[str] = None
    observacoes: Optional[str] = None


@router.get("")
def list_despesas_locais():
    despesas   = despesas_locais_storage.all()
    total      = sum(float(d.get("valor", 0)) for d in despesas)
    total_pago = sum(float(d.get("valor", 0)) for d in despesas if d.get("status") == "pago")
    total_pend = sum(float(d.get("valor", 0)) for d in despesas if d.get("status") != "pago")
    return {
        "despesas":       despesas,
        "total":          round(total, 2),
        "total_pago":     round(total_pago, 2),
        "total_pendente": round(total_pend, 2),
        "quantidade":     len(despesas),
    }


@router.post("")
def create_despesa_local(body: DespesaLocalCreate):
    return despesas_locais_storage.create(body.model_dump())


@router.put("/{id}")
def update_despesa_local(id: str, body: DespesaLocalUpdate):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = despesas_locais_storage.update(id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return updated


@router.delete("/{id}")
def delete_despesa_local(id: str):
    if not despesas_locais_storage.delete(id):
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return {"ok": True}
