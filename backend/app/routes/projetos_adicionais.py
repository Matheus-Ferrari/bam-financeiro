"""
Rotas /projetos-adicionais — CRUD completo de projetos adicionais por cliente.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import projetos_adicionais_storage

router = APIRouter()


class ProjetoCreate(BaseModel):
    cliente: str
    tipo: str = "lp"           # lp | apresentacao | site | comercial | outro
    nome: str
    valor: float = 0.0
    competencia: Optional[str] = None
    data_vencimento: Optional[str] = None
    status_pagamento: str = "pendente"  # pendente | pago | em_aberto | parcial
    data_recebimento: Optional[str] = None
    observacoes: Optional[str] = None


class ProjetoUpdate(BaseModel):
    cliente: Optional[str] = None
    tipo: Optional[str] = None
    nome: Optional[str] = None
    valor: Optional[float] = None
    competencia: Optional[str] = None
    data_vencimento: Optional[str] = None
    status_pagamento: Optional[str] = None
    data_recebimento: Optional[str] = None
    observacoes: Optional[str] = None


@router.get("")
def list_projetos():
    projetos = projetos_adicionais_storage.all()
    total        = sum(float(p.get("valor", 0)) for p in projetos)
    total_pago   = sum(float(p.get("valor", 0)) for p in projetos if p.get("status_pagamento") == "pago")
    total_pend   = sum(float(p.get("valor", 0)) for p in projetos if p.get("status_pagamento") != "pago")
    return {
        "projetos":       projetos,
        "total":          round(total, 2),
        "total_pago":     round(total_pago, 2),
        "total_pendente": round(total_pend, 2),
        "quantidade":     len(projetos),
        "pagos":          len([p for p in projetos if p.get("status_pagamento") == "pago"]),
        "pendentes":      len([p for p in projetos if p.get("status_pagamento") != "pago"]),
    }


@router.post("")
def create_projeto(body: ProjetoCreate):
    return projetos_adicionais_storage.create(body.model_dump())


@router.put("/{id}")
def update_projeto(id: str, body: ProjetoUpdate):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = projetos_adicionais_storage.update(id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return updated


@router.delete("/{id}")
def delete_projeto(id: str):
    if not projetos_adicionais_storage.delete(id):
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"ok": True}
