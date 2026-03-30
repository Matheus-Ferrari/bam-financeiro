"""
Rotas /clientes — CRUD completo de gestão de clientes.
Storage: JSON (pronto para migração para PostgreSQL).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import clientes_storage

router = APIRouter()


class ClienteCreate(BaseModel):
    nome: str
    status: str = "ativo"
    tipo: str = "recorrente"
    valor_mensal: float = 0.0
    valor_previsto: Optional[float] = None
    valor_recebido: float = 0.0
    status_pagamento: str = "pendente"
    data_pagamento: Optional[str] = None
    mes_referencia_pagamento: Optional[str] = None
    observacao_pagamento: Optional[str] = None
    data_inicio: Optional[str] = None
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None
    dia_pagamento: Optional[int] = None
    cobranca_status: str = "sem_cobrar"
    cobranca_obs: Optional[str] = None
    ultimo_contato: Optional[str] = None
    proximo_followup: Optional[str] = None
    forma_contato: Optional[str] = "whatsapp"


class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    status: Optional[str] = None
    tipo: Optional[str] = None
    valor_mensal: Optional[float] = None
    valor_previsto: Optional[float] = None
    valor_recebido: Optional[float] = None
    status_pagamento: Optional[str] = None
    data_pagamento: Optional[str] = None
    mes_referencia_pagamento: Optional[str] = None
    observacao_pagamento: Optional[str] = None
    data_inicio: Optional[str] = None
    responsavel: Optional[str] = None
    observacoes: Optional[str] = None
    dia_pagamento: Optional[int] = None
    cobranca_status: Optional[str] = None
    cobranca_obs: Optional[str] = None
    ultimo_contato: Optional[str] = None
    proximo_followup: Optional[str] = None
    forma_contato: Optional[str] = None


@router.get("")
def list_clientes():
    """Lista todos os clientes com resumo estatístico."""
    clientes    = clientes_storage.all()
    ativos      = [c for c in clientes if c.get("status") == "ativo"]
    recorrentes = [c for c in clientes if c.get("tipo") == "recorrente"]
    receita_mensal = sum(c.get("valor_mensal", 0) for c in ativos)
    pagos = [c for c in clientes if str(c.get("status_pagamento", "")).lower() == "pago"]
    pendentes = [c for c in clientes if str(c.get("status_pagamento", "pendente")).lower() != "pago"]

    total_previsto_receber = 0.0
    total_recebido = 0.0
    for c in clientes:
        previsto = c.get("valor_previsto")
        if previsto is None:
            previsto = c.get("valor_mensal", 0)
        total_previsto_receber += float(previsto or 0)
        total_recebido += float(c.get("valor_recebido", 0) or 0)

    return {
        "clientes": clientes,
        "resumo": {
            "total":                    len(clientes),
            "ativos":                   len(ativos),
            "receita_mensal_estimada":  round(receita_mensal, 2),
            "recorrentes":              len(recorrentes),
            "pagos_mes":                len(pagos),
            "pendentes_mes":            len(pendentes),
            "total_previsto_receber":   round(total_previsto_receber, 2),
            "total_recebido":           round(total_recebido, 2),
            "total_pendente_receber":   round(total_previsto_receber - total_recebido, 2),
        },
    }


@router.post("")
def create_cliente(body: ClienteCreate):
    """Cria um novo cliente."""
    return clientes_storage.create(body.model_dump())


@router.put("/{id}")
def update_cliente(id: str, body: ClienteUpdate):
    """Atualiza campos de um cliente existente."""
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    atualizado = clientes_storage.update(id, payload)
    if not atualizado:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return atualizado


@router.delete("/{id}")
def delete_cliente(id: str):
    """Remove um cliente pelo id."""
    if not clientes_storage.delete(id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"ok": True}
