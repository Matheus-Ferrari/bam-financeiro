"""
Rotas /financeiro — todos os endpoints financeiros principais.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.services.financeiro_service import FinanceiroService
from app.services.operacao_service import OperacaoService
from app.services.projection_service import ProjectionService
from app.services.saude_service import SaudeService

router = APIRouter()
_fin   = FinanceiroService()
_proj  = ProjectionService()
_saude = SaudeService()
_ops   = OperacaoService()


class CaixaUpdateRequest(BaseModel):
    valor_atual: float
    observacao: str = ""


@router.get("/resumo")
def get_resumo():
    """Visão consolidada mensal de receitas e despesas."""
    try:
        return _fin.get_resumo_mensal()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/kpis")
def get_kpis():
    """KPIs principais: receita total, despesa, resultado, margem, lançamentos."""
    try:
        return _fin.get_kpis()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/receitas")
def get_receitas():
    """Lista e agregações de receitas."""
    try:
        return _fin.get_receitas()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/despesas")
def get_despesas():
    """Lista e agregações de despesas por categoria."""
    try:
        return _fin.get_despesas()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/projecoes")
def get_projecoes(
    crescimento_pct: float = Query(default=10.0, description="Crescimento percentual mensal de receita"),
    novos_clientes_crm: int = Query(default=10, description="Novos clientes no módulo CRM (R$100/cliente)"),
    meses: int = Query(default=6, ge=1, le=24, description="Horizonte de projeção em meses"),
):
    """Simulação de crescimento com parâmetros configuráveis."""
    try:
        return _proj.get_projecoes(
            crescimento_pct=crescimento_pct,
            novos_clientes_crm=novos_clientes_crm,
            meses=meses,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/cenarios")
def get_cenarios():
    """Cenários de corte de despesas: conservador, moderado e agressivo."""
    try:
        return _proj.get_cenarios_corte()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/alertas")
def get_alertas():
    """Alertas financeiros automáticos baseados nos KPIs."""
    try:
        return _fin.get_alertas()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/saude")
def get_saude():
    """Score de saúde financeira, semáforo, riscos e recomendações."""
    try:
        return _saude.get_saude()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/insights")
def get_insights():
    """Insights automáticos baseados nos dados financeiros."""
    try:
        return _saude.get_insights()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/operacao-mes")
def get_operacao_mes():
    """Visão operacional do mês com receber x pagar, caixa e conferência diária."""
    try:
        return _ops.get_operacao_mes()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/caixa")
def get_caixa():
    """Retorna caixa atual, caixa anterior e histórico de atualizações."""
    try:
        return _ops.get_caixa()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/caixa")
def update_caixa(body: CaixaUpdateRequest):
    """Atualiza manualmente o caixa atual com histórico."""
    try:
        registro = _ops.update_caixa(
            valor_atual=body.valor_atual,
            observacao=body.observacao,
            origem="manual",
        )
        return {"ok": True, "registro": registro}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
