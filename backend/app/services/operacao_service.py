"""
Serviços operacionais mensais: caixa, conferência e visão diária.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.services.financeiro_service import FinanceiroService
from app.services.storage_service import (
    caixa_storage,
    clientes_storage,
    movimentacoes_storage,
    quick_updates_storage,
)

_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


def _mes_label_ref(dt: date) -> str:
    return f"{_MESES[dt.month - 1]}/{str(dt.year)[-2:]}"


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _normalize_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if "pago" in raw or "recebido" in raw or "quitado" in raw:
        return "pago"
    return "pendente"


def _is_same_month(date_str: Optional[str], ref: date) -> bool:
    if not date_str:
        return False
    try:
        dt = datetime.fromisoformat(str(date_str)).date()
        return dt.month == ref.month and dt.year == ref.year
    except Exception:
        return False


class OperacaoService:
    def __init__(self):
        self.fin = FinanceiroService()

    def get_caixa(self) -> Dict[str, Any]:
        registros = caixa_storage.all()
        if not registros:
            return {
                "caixa_atual": 0.0,
                "caixa_anterior": 0.0,
                "atualizado_em": None,
                "historico": [],
            }

        ordenados = sorted(registros, key=lambda r: str(r.get("data", "")), reverse=True)
        atual = ordenados[0]
        anterior = ordenados[1] if len(ordenados) > 1 else None
        return {
            "caixa_atual": _to_float(atual.get("valor_atual")),
            "caixa_anterior": _to_float(anterior.get("valor_atual")) if anterior else _to_float(atual.get("valor_anterior")),
            "atualizado_em": atual.get("data"),
            "historico": ordenados[:30],
        }

    def update_caixa(self, valor_atual: float, observacao: str = "", origem: str = "manual") -> Dict[str, Any]:
        caixa_info = self.get_caixa()
        valor_anterior = _to_float(caixa_info.get("caixa_atual"))
        payload = {
            "valor_anterior": round(valor_anterior, 2),
            "valor_atual": round(_to_float(valor_atual), 2),
            "delta": round(_to_float(valor_atual) - valor_anterior, 2),
            "observacao": observacao,
            "origem": origem,
            "data": datetime.now().isoformat(),
        }
        registro = caixa_storage.create(payload)

        movimentacoes_storage.create(
            {
                "tipo": "ajuste_caixa",
                "descricao": "Ajuste manual de caixa",
                "valor": round(_to_float(valor_atual), 2),
                "data": datetime.now().isoformat(),
                "cliente_relacionado": None,
                "categoria": "caixa",
                "observacao": observacao,
                "caixa_anterior": round(valor_anterior, 2),
                "caixa_atual": round(_to_float(valor_atual), 2),
                "origem": origem,
            }
        )
        return registro

    def _find_cliente(self, nome: Optional[str]) -> Optional[Dict[str, Any]]:
        if not nome:
            return None
        q = str(nome).strip().lower()
        if not q:
            return None

        clientes = clientes_storage.all()
        exato = next((c for c in clientes if str(c.get("nome", "")).strip().lower() == q), None)
        if exato:
            return exato
        return next((c for c in clientes if q in str(c.get("nome", "")).strip().lower()), None)

    def atualizar_status_cliente(
        self,
        cliente_nome: str,
        status_pagamento: str,
        valor_recebido: Optional[float] = None,
        data_pagamento: Optional[str] = None,
        observacao: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        cliente = self._find_cliente(cliente_nome)
        if not cliente:
            return None

        hoje = date.today()
        pago = str(status_pagamento).strip().lower() == "pago"
        payload = {
            "status_pagamento": "pago" if pago else "pendente",
            "mes_referencia_pagamento": _mes_label_ref(hoje),
        }

        if pago:
            payload["data_pagamento"] = data_pagamento or datetime.now().isoformat()
            if valor_recebido is not None:
                payload["valor_recebido"] = round(_to_float(valor_recebido), 2)
            elif cliente.get("valor_recebido") in [None, "", 0, 0.0]:
                payload["valor_recebido"] = round(
                    _to_float(cliente.get("valor_previsto") or cliente.get("valor_mensal") or 0),
                    2,
                )
        else:
            payload["data_pagamento"] = None
            if valor_recebido is not None:
                payload["valor_recebido"] = round(_to_float(valor_recebido), 2)

        if observacao:
            payload["observacao_pagamento"] = observacao

        return clientes_storage.update(str(cliente.get("id")), payload)

    def registrar_movimentacao(self, data: Dict[str, Any], origem: str = "manual") -> Dict[str, Any]:
        payload = {
            "tipo": data.get("tipo"),
            "descricao": data.get("descricao", "Movimentação manual"),
            "valor": round(_to_float(data.get("valor")), 2),
            "data": data.get("data") or datetime.now().isoformat(),
            "cliente_relacionado": data.get("cliente_relacionado"),
            "categoria": data.get("categoria"),
            "observacao": data.get("observacao"),
            "origem": origem,
        }
        return movimentacoes_storage.create(payload)

    def get_operacao_mes(self) -> Dict[str, Any]:
        ref = date.today()
        mes_label = _mes_label_ref(ref)
        hoje_iso = date.today().isoformat()

        receitas = self.fin.get_receitas().get("lancamentos", [])
        despesas = self.fin.get_despesas().get("lancamentos", [])
        clientes = clientes_storage.all()
        movs = movimentacoes_storage.all()

        receitas_mes = [r for r in receitas if str(r.get("mes")) == mes_label]
        despesas_mes = [d for d in despesas if str(d.get("mes")) == mes_label]

        total_previsto_receitas = sum(_to_float(r.get("valor")) for r in receitas_mes)
        total_recebido = sum(_to_float(r.get("valor")) for r in receitas_mes if _normalize_status(r.get("status")) == "pago")

        total_previsto_despesas = sum(_to_float(d.get("valor")) for d in despesas_mes)
        total_pago = sum(_to_float(d.get("valor")) for d in despesas_mes if _normalize_status(d.get("status")) == "pago")

        movs_mes = [m for m in movs if _is_same_month(m.get("data"), ref)]
        entradas_manuais = sum(_to_float(m.get("valor")) for m in movs_mes if str(m.get("tipo")) in ["entrada", "recebimento"])
        saidas_manuais = sum(_to_float(m.get("valor")) for m in movs_mes if str(m.get("tipo")) in ["saida", "despesa"])

        total_previsto_receitas += entradas_manuais
        total_recebido += entradas_manuais
        total_previsto_despesas += saidas_manuais
        total_pago += saidas_manuais

        total_pendente_receber = max(total_previsto_receitas - total_recebido, 0)
        total_pendente_pagar = max(total_previsto_despesas - total_pago, 0)

        pagos_mes = [c for c in clientes if str(c.get("status_pagamento", "")).lower() == "pago"]
        pendentes_mes = [c for c in clientes if str(c.get("status_pagamento", "pendente")).lower() != "pago"]

        pagou_hoje = [
            c for c in clientes
            if str(c.get("status_pagamento", "")).lower() == "pago"
            and str(c.get("data_pagamento", "")).startswith(hoje_iso)
        ]

        faltam_pagar = sorted(
            pendentes_mes,
            key=lambda c: str(c.get("nome", "")).lower(),
        )

        despesas_previstas = sorted(despesas_mes, key=lambda d: _to_float(d.get("valor")), reverse=True)
        despesas_pagas = [d for d in despesas_mes if _normalize_status(d.get("status")) == "pago"]

        caixa_info = self.get_caixa()
        caixa_atual = _to_float(caixa_info.get("caixa_atual"))
        saldo_projetado = caixa_atual + total_pendente_receber - total_pendente_pagar

        movimentacoes_recentes = sorted(
            movs,
            key=lambda m: str(m.get("data", "")),
            reverse=True,
        )[:20]

        ultimos_registros_manuais = sorted(
            quick_updates_storage.all(),
            key=lambda item: str(item.get("created_at", "")),
            reverse=True,
        )[:20]

        return {
            "mes_referencia": mes_label,
            "caixa_atual": round(caixa_atual, 2),
            "total_previsto_receitas_mes": round(total_previsto_receitas, 2),
            "total_recebido_mes": round(total_recebido, 2),
            "total_pendente_recebimento": round(total_pendente_receber, 2),
            "total_previsto_despesas_mes": round(total_previsto_despesas, 2),
            "total_pago_mes": round(total_pago, 2),
            "total_pendente_pagamento": round(total_pendente_pagar, 2),
            "saldo_projetado_mes": round(saldo_projetado, 2),
            "clientes_pagos": pagos_mes,
            "clientes_pendentes": pendentes_mes,
            "quem_pagou_hoje": pagou_hoje,
            "quem_falta_pagar": faltam_pagar,
            "despesas_previstas_mes": despesas_previstas,
            "despesas_pagas_mes": despesas_pagas,
            "movimentacoes_recentes": movimentacoes_recentes,
            "ultimos_registros_manuais": ultimos_registros_manuais,
        }
