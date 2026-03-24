"""
Rotas /cortes — CRUD de planos de redução de gastos.
Cada corte representa uma economia mensal planejada ou aprovada.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import cortes_storage

router = APIRouter()


class CorteCreate(BaseModel):
    descricao: str
    categoria: str
    economia_mensal: float
    status: str = "planejado"   # planejado | em_analise | aprovado | aplicado
    ativo: bool = True
    observacao: Optional[str] = None


class CorteUpdate(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    economia_mensal: Optional[float] = None
    status: Optional[str] = None
    ativo: Optional[bool] = None
    observacao: Optional[str] = None


@router.get("")
def list_cortes():
    """Lista todos os cortes com impacto acumulado."""
    cortes = cortes_storage.all()
    ativos = [c for c in cortes if c.get("ativo", True)]

    economia_total  = sum(c.get("economia_mensal", 0) for c in cortes)
    economia_ativa  = sum(c.get("economia_mensal", 0) for c in ativos)

    return {
        "cortes": cortes,
        "resumo": {
            "total":                     len(cortes),
            "ativos":                    len(ativos),
            "economia_total_potencial":  round(economia_total, 2),
            "economia_ativa":            round(economia_ativa, 2),
            "impacto_3m":                round(economia_ativa * 3, 2),
            "impacto_6m":                round(economia_ativa * 6, 2),
            "impacto_12m":               round(economia_ativa * 12, 2),
        },
    }


@router.post("")
def create_corte(body: CorteCreate):
    """Cria um novo item de corte/redução."""
    return cortes_storage.create(body.model_dump())


@router.put("/{id}")
def update_corte(id: str, body: CorteUpdate):
    """Atualiza um corte existente (toggle ativo/inativo incluído)."""
    payload = body.model_dump()
    # Remove None, mas mantém ativo=False (truthy check não funciona aqui)
    update_data = {k: v for k, v in payload.items() if v is not None or k == "ativo"}
    update_data = {k: v for k, v in update_data.items() if v is not None}
    atualizado = cortes_storage.update(id, update_data)
    if not atualizado:
        raise HTTPException(status_code=404, detail="Corte não encontrado")
    return atualizado


@router.delete("/{id}")
def delete_corte(id: str):
    """Remove um corte pelo id."""
    if not cortes_storage.delete(id):
        raise HTTPException(status_code=404, detail="Corte não encontrado")
    return {"ok": True}
