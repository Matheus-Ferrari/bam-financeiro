"""
Rotas /fechamento — CRUD do Fechamento do Mês.
Cada registro representa o fechamento de um mês/competência.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.services.storage_service import fechamento_storage, clientes_storage, comissoes_storage

router = APIRouter()


# ── Modelos ───────────────────────────────────────────────────────────────

class DespesaPrevista(BaseModel):
    descricao: str
    categoria: str = ""
    valor: float = 0.0
    vencimento: Optional[str] = None
    status: str = "previsto"          # previsto | confirmado | pago | adiado
    observacao: str = ""


class Reducao(BaseModel):
    descricao: str
    categoria: str = ""
    valor: float = 0.0
    impacto_mensal: float = 0.0
    observacao: str = ""


class NovoGasto(BaseModel):
    descricao: str
    tipo: str = "novo_gasto"          # novo_gasto | investimento | comissao | ajuste
    valor: float = 0.0
    prioridade: str = "media"         # alta | media | baixa
    impacto_mes: float = 0.0
    observacao: str = ""


class Anotacao(BaseModel):
    decisoes: str = ""
    proximos_passos: str = ""
    pendencias: str = ""
    observacoes: str = ""


class FechamentoCreate(BaseModel):
    competencia: str                   # "2026-04"
    despesas_previstas: List[DespesaPrevista] = []
    reducoes: List[Reducao] = []
    novos_gastos: List[NovoGasto] = []
    anotacoes: Optional[Anotacao] = None


class FechamentoUpdate(BaseModel):
    despesas_previstas: Optional[List[DespesaPrevista]] = None
    reducoes: Optional[List[Reducao]] = None
    novos_gastos: Optional[List[NovoGasto]] = None
    anotacoes: Optional[Anotacao] = None


# ── Helpers ───────────────────────────────────────────────────────────────

def _build_resumo(fech: dict, competencia: str) -> dict:
    """Calcula os totais do fechamento a partir dos dados salvos + clientes + comissões."""
    dp = fech.get("despesas_previstas", [])
    rd = fech.get("reducoes", [])
    ng = fech.get("novos_gastos", [])

    total_desp_confirmadas = sum(d.get("valor", 0) for d in dp if d.get("status") in ("confirmado", "pago"))
    total_desp_previstas   = sum(d.get("valor", 0) for d in dp if d.get("status") == "previsto")
    total_reducoes         = sum(r.get("valor", 0) for r in rd)
    total_novos            = sum(g.get("valor", 0) for g in ng)

    # Clientes do mês
    clientes = clientes_storage.all()
    clientes_ativo = [c for c in clientes if c.get("status") == "ativo"]

    # Receita confirmada: apenas clientes com data_pagamento dentro do mês da competência
    clientes_pagos_mes = [
        c for c in clientes_ativo
        if (c.get("data_pagamento") or "").startswith(competencia)
        and float(c.get("valor_recebido", 0)) > 0
    ]
    # Também considera status_pagamento == 'pago' se não há data mas tem valor
    clientes_status_pago = [
        c for c in clientes_ativo
        if c.get("status_pagamento") == "pago"
        and float(c.get("valor_recebido", 0)) > 0
        and not (c.get("data_pagamento") or "").startswith(competencia)  # evita dupla contagem
    ]

    receita_confirmada = (
        sum(float(c.get("valor_recebido", 0)) for c in clientes_pagos_mes)
        + sum(float(c.get("valor_recebido", 0)) for c in clientes_status_pago)
    )

    # Pendentes: ativos sem pagamento no mês
    pagos_ids = {c["id"] for c in clientes_pagos_mes} | {c["id"] for c in clientes_status_pago}
    clientes_pendentes = [c for c in clientes_ativo if c["id"] not in pagos_ids]
    receita_pendente   = sum(float(c.get("valor_mensal", 0) or c.get("valor_previsto", 0)) for c in clientes_pendentes)

    # Comissões do mês
    todas_comissoes = comissoes_storage.all()
    comissoes_mes   = [c for c in todas_comissoes if c.get("competencia", "").startswith(competencia)]
    total_comissoes = sum(float(c.get("valor", 0)) for c in comissoes_mes)

    saldo_projetado = (
        receita_confirmada
        + receita_pendente
        - total_desp_confirmadas
        - total_desp_previstas
        - total_novos
        + total_reducoes
        - total_comissoes
    )

    return {
        "receita_confirmada":    round(receita_confirmada, 2),
        "receita_pendente":      round(receita_pendente, 2),
        "despesas_confirmadas":  round(total_desp_confirmadas, 2),
        "despesas_previstas":    round(total_desp_previstas, 2),
        "reducoes":              round(total_reducoes, 2),
        "novos_gastos":          round(total_novos, 2),
        "comissoes":             round(total_comissoes, 2),
        "saldo_projetado":       round(saldo_projetado, 2),
        "clientes_pagos":        len(clientes_pagos_mes) + len(clientes_status_pago),
        "clientes_pendentes":    len(clientes_pendentes),
        "valor_recebido":        round(receita_confirmada, 2),
        "valor_em_aberto":       round(receita_pendente, 2),
        "cenario_conservador":   round(receita_confirmada - total_desp_confirmadas - total_desp_previstas - total_novos + total_reducoes - total_comissoes, 2),
        "cenario_realista":      round(receita_confirmada + receita_pendente * 0.6 - total_desp_confirmadas - total_desp_previstas - total_novos + total_reducoes - total_comissoes, 2),
        "cenario_otimista":      round(receita_confirmada + receita_pendente - total_desp_confirmadas - total_desp_previstas - total_novos + total_reducoes - total_comissoes, 2),
    }


# ── Rotas ─────────────────────────────────────────────────────────────────

@router.get("")
def list_fechamentos():
    return fechamento_storage.all()


@router.get("/{competencia}")
def get_fechamento(competencia: str):
    """Retorna o fechamento de um mês + resumo calculado + clientes + comissões."""
    items = fechamento_storage.all()
    fech  = next((f for f in items if f.get("competencia") == competencia), None)

    if not fech:
        fech = {
            "competencia": competencia,
            "despesas_previstas": [],
            "reducoes": [],
            "novos_gastos": [],
            "anotacoes": {"decisoes": "", "proximos_passos": "", "pendencias": "", "observacoes": ""},
        }

    resumo = _build_resumo(fech, competencia)

    # Clientes detalhados — mesma lógica do resumo
    clientes = clientes_storage.all()
    clientes_ativo = [c for c in clientes if c.get("status") == "ativo"]

    clientes_pagos_mes = [
        c for c in clientes_ativo
        if (c.get("data_pagamento") or "").startswith(competencia)
        and float(c.get("valor_recebido", 0)) > 0
    ]
    clientes_status_pago = [
        c for c in clientes_ativo
        if c.get("status_pagamento") == "pago"
        and float(c.get("valor_recebido", 0)) > 0
        and not (c.get("data_pagamento") or "").startswith(competencia)
    ]
    pagos_ids = {c["id"] for c in clientes_pagos_mes} | {c["id"] for c in clientes_status_pago}
    clientes_pagos     = clientes_pagos_mes + clientes_status_pago
    clientes_pendentes = [c for c in clientes_ativo if c["id"] not in pagos_ids]

    # Comissões do mês
    todas_comissoes = comissoes_storage.all()
    comissoes_mes   = [c for c in todas_comissoes if c.get("competencia", "").startswith(competencia)]

    return {
        "fechamento": fech,
        "resumo":     resumo,
        "clientes_pagos":     clientes_pagos,
        "clientes_pendentes": clientes_pendentes,
        "comissoes_mes":      comissoes_mes,
    }


@router.post("")
def save_fechamento(body: FechamentoCreate):
    """Cria ou atualiza o fechamento de um mês."""
    items = fechamento_storage.all()
    existing = next((f for f in items if f.get("competencia") == body.competencia), None)

    payload = body.model_dump()
    if body.anotacoes:
        payload["anotacoes"] = body.anotacoes.model_dump()

    if existing:
        updated = fechamento_storage.update(existing["id"], payload)
        return updated
    else:
        return fechamento_storage.create(payload)


@router.put("/{id}")
def update_fechamento(id: str, body: FechamentoUpdate):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    # Converter sub-modelos
    if "anotacoes" in payload and payload["anotacoes"]:
        payload["anotacoes"] = payload["anotacoes"] if isinstance(payload["anotacoes"], dict) else payload["anotacoes"].model_dump()
    updated = fechamento_storage.update(id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    return updated


@router.delete("/{id}")
def delete_fechamento(id: str):
    if not fechamento_storage.delete(id):
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    return {"ok": True}
