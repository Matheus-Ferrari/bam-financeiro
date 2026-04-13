"""
Rotas /clientes — CRUD completo de gestão de clientes.
Storage: JSON (pronto para migração para PostgreSQL).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.storage_service import clientes_storage, fechamento_storage

router = APIRouter()


def _get_competencia_atual():
    """Retorna a competência atual no formato '2026-04'."""
    from datetime import date
    hoje = date.today()
    return f"{hoje.year}-{hoje.month:02d}"


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
    # Contato
    empresa: Optional[str] = None
    cnpj_cpf: Optional[str] = None
    email_principal: Optional[str] = None
    email_financeiro: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    nome_contato_financeiro: Optional[str] = None
    nome_contato_principal: Optional[str] = None
    tipo_contato_principal: Optional[str] = None
    # Fiscal / Faturamento
    razao_social: Optional[str] = None
    cnpj_faturamento: Optional[str] = None
    codigo_servico_nf: Optional[str] = None
    descricao_padrao_nf: Optional[str] = None
    observacoes_fiscais: Optional[str] = None
    forma_cobranca: Optional[str] = None
    # NF / Boleto (placeholders para futura API)
    nf_status: Optional[str] = None
    nf_numero: Optional[str] = None
    nf_ultima_emissao: Optional[str] = None
    boleto_status: Optional[str] = None
    boleto_ultima_geracao: Optional[str] = None
    cobranca_ultimo_envio: Optional[str] = None
    cobranca_canal_ultimo_envio: Optional[str] = None


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
    origem: Optional[str] = None
    forma_contato: Optional[str] = None
    # Contato
    empresa: Optional[str] = None
    cnpj_cpf: Optional[str] = None
    email_principal: Optional[str] = None
    email_financeiro: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    nome_contato_financeiro: Optional[str] = None
    nome_contato_principal: Optional[str] = None
    tipo_contato_principal: Optional[str] = None
    # Fiscal / Faturamento
    razao_social: Optional[str] = None
    cnpj_faturamento: Optional[str] = None
    codigo_servico_nf: Optional[str] = None
    descricao_padrao_nf: Optional[str] = None
    observacoes_fiscais: Optional[str] = None
    forma_cobranca: Optional[str] = None
    # NF / Boleto
    nf_status: Optional[str] = None
    nf_numero: Optional[str] = None
    nf_ultima_emissao: Optional[str] = None
    boleto_status: Optional[str] = None
    boleto_ultima_geracao: Optional[str] = None
    cobranca_ultimo_envio: Optional[str] = None
    cobranca_canal_ultimo_envio: Optional[str] = None


@router.get("")
def list_clientes(competencia: Optional[str] = None):
    """Lista todos os clientes com resumo estatístico, sincronizando com fechamento."""
    comp = competencia or _get_competencia_atual()
    clientes = clientes_storage.all()

    # Buscar dados do fechamento para enriquecer clientes
    items_fech = fechamento_storage.all()
    fech = next((f for f in items_fech if f.get("competencia") == comp), None)

    # Montar mapa de clientes do fechamento (pagos/pendentes baseado no storage)
    clientes_ativo = [c for c in clientes if c.get("status") == "ativo"]
    clientes_pagos_mes = [
        c for c in clientes_ativo
        if (c.get("data_pagamento") or "").startswith(comp)
        and float(c.get("valor_recebido", 0)) > 0
    ]
    clientes_status_pago = [
        c for c in clientes_ativo
        if c.get("status_pagamento") == "pago"
        and float(c.get("valor_recebido", 0)) > 0
        and not (c.get("data_pagamento") or "").startswith(comp)
    ]
    pagos_ids = {c["id"] for c in clientes_pagos_mes} | {c["id"] for c in clientes_status_pago}
    clientes_pendentes = [c for c in clientes_ativo if c["id"] not in pagos_ids]

    # Calcular totais reais
    total_previsto = 0.0
    total_recebido = 0.0
    em_atraso = 0
    hoje = __import__("datetime").date.today()

    for c in clientes:
        previsto = c.get("valor_previsto") or c.get("valor_mensal", 0)
        total_previsto += float(previsto or 0)
        total_recebido += float(c.get("valor_recebido", 0) or 0)
        # Detectar atraso
        if c.get("status") == "ativo" and c.get("status_pagamento") != "pago":
            dia = c.get("dia_pagamento")
            if dia and hoje.day > dia:
                em_atraso += 1

    return {
        "clientes": clientes,
        "resumo": {
            "total":                  len(clientes),
            "ativos":                 len(clientes_ativo),
            "receita_mensal_estimada": round(sum(float(c.get("valor_mensal", 0)) for c in clientes_ativo), 2),
            "recorrentes":            len([c for c in clientes if c.get("tipo") == "recorrente"]),
            "pagos_mes":              len(clientes_pagos_mes) + len(clientes_status_pago),
            "pendentes_mes":          len(clientes_pendentes),
            "total_previsto_receber": round(total_previsto, 2),
            "total_recebido":         round(total_recebido, 2),
            "total_pendente_receber": round(total_previsto - total_recebido, 2),
            "em_atraso":              em_atraso,
        },
        "competencia": comp,
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
