"""
FluxoCaixaService — fluxo de caixa unificado + conciliação financeira.

Lê dados reais do Excel (Base Receitas + Base Despesas) e do JSON storage
(movimentacoes), constrói lançamentos padronizados e suporta conciliação
manual. Preparado para futura integração com banco/Open Finance.
"""

import logging
import math
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import pandas as pd

from app.services.excel_service import ExcelService
from app.services.storage_service import (
    caixa_storage,
    clientes_storage,
    conciliacao_storage,
    movimentacoes_storage,
    status_overrides_storage,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

_MES_NOME_NUM: Dict[str, int] = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}

_MESES_ABR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
               "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

# Status válidos para conciliação
STATUS_CONCILIACAO = {"conciliado", "pendente", "divergente"}

# Origem por tipo de categoria de despesa
_FIXAS_KEYWORDS = {"salario", "beneficio", "fixo", "fixas", "administrativo",
                   "licenca", "ferramenta", "infraestrutura"}


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _norm(text: str) -> str:
    """Remove acentos e converte para minúsculas sem espaços."""
    t = unicodedata.normalize("NFD", str(text).strip().lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return "".join(c for c in t if c.isalnum() or c == " ").strip()


def _clean(val) -> str:
    """Converte valor pandas para string limpa, ignorando NaN."""
    if val is None:
        return ""
    try:
        if math.isnan(float(val)):
            return ""
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return "" if s.lower() == "nan" else s


def _mes_num(nome: str) -> int:
    return _MES_NOME_NUM.get(_norm(nome), 0)


def _mes_to_iso(nome: str, ano: Optional[int] = None) -> Optional[str]:
    ano = ano or date.today().year
    num = _mes_num(nome)
    return f"{ano}-{num:02d}-01" if num else None


def _to_float(val) -> float:
    try:
        v = float(val)
        return 0.0 if math.isnan(v) or math.isinf(v) else v
    except (TypeError, ValueError):
        return 0.0


def _origem_despesa(categoria: str) -> str:
    words = _norm(categoria).split()
    for w in words:
        if any(k in w for k in _FIXAS_KEYWORDS):
            return "despesa_fixa"
    return "despesa_variavel"


# ---------------------------------------------------------------------------
# Serviço principal
# ---------------------------------------------------------------------------

class FluxoCaixaService:
    def __init__(self):
        self.excel = ExcelService()

    # ── Helpers de construção de lançamentos ────────────────────────────

    def _conc_map(self) -> Dict[str, Dict]:
        """Retorna mapa lancamento_id → registro de conciliação."""
        return {str(r.get("lancamento_id", "")): r
                for r in conciliacao_storage.all()
                if r.get("lancamento_id")}

    def _status_map(self) -> Dict[str, Dict]:
        """Retorna mapa lancamento_id → override de status manual."""
        return {str(r.get("lancamento_id", "")): r
                for r in status_overrides_storage.all()
                if r.get("lancamento_id")}

    def _build_receitas(self, cm: Dict, sm: Dict) -> List[Dict]:
        """Lê Base Receitas do Excel → lançamentos de ENTRADA."""
        df = self.excel.get_base_receitas()
        if df is None or df.empty:
            return []
        ano = date.today().year
        result = []
        for i, row in df.iterrows():
            mes_nome = _clean(row.get("Mês", ""))
            data_comp = _mes_to_iso(mes_nome, ano)
            if not data_comp:
                continue
            status_raw = _clean(row.get("Status", "")).upper()
            status = "recebido" if status_raw == "PAGO" else "previsto"
            valor_prev = _to_float(row.get("Valor Previsto", 0))

            lid = f"rec_{i + 1}"
            conc = cm.get(lid, {})
            override = sm.get(lid, {})

            # Aplica override de status manual
            if override.get("status"):
                status = override["status"]
            if override.get("valor_realizado") is not None:
                valor_real = _to_float(override["valor_realizado"])
            else:
                valor_real = valor_prev if status == "recebido" else 0.0

            result.append({
                "id":                 lid,
                "data_competencia":   data_comp,
                "data_vencimento":    data_comp,
                "data_pagamento":     data_comp if status == "recebido" else None,
                "descricao":          _clean(row.get("Descrição", "")) or _clean(row.get("Serviço", "")) or "Receita",
                "cliente":            _clean(row.get("Cliente", "")),
                "categoria":          _clean(row.get("Serviço", "")) or "Receita",
                "subcategoria":       "",
                "tipo":               "entrada",
                "valor_previsto":     round(valor_prev, 2),
                "valor_realizado":    round(valor_real, 2),
                "status":             status,
                "recorrente":         True,
                "origem":             "cliente_mensal",
                "forma_pagamento":    _clean(row.get("Pagamento", "")),
                "conta_financeira":   "conta_principal",
                "conciliado":         conc.get("status_conciliacao") == "conciliado",
                "status_conciliacao": conc.get("status_conciliacao", "pendente"),
                "observacao":         conc.get("observacao", ""),
                "fonte":              "excel",
            })
        return result

    def _build_despesas(self, cm: Dict, sm: Dict) -> List[Dict]:
        """Lê Base Despesas do Excel → lançamentos de SAÍDA."""
        df = self.excel.get_base_despesas()
        if df is None or df.empty:
            return []
        ano = date.today().year
        result = []
        for i, row in df.iterrows():
            mes_nome = _clean(row.get("Mês", ""))
            data_comp = _mes_to_iso(mes_nome, ano)
            if not data_comp:
                continue
            status_raw = _clean(row.get("Status", "")).upper()
            status = "pago" if status_raw == "PAGO" else "previsto"
            valor = _to_float(row.get("Valor", 0))
            categoria = _clean(row.get("Categoria", "")) or "Despesa"

            lid = f"dep_{i + 1}"
            conc = cm.get(lid, {})
            override = sm.get(lid, {})

            # Aplica override de status manual
            if override.get("status"):
                status = override["status"]
            if override.get("valor_realizado") is not None:
                valor_real = _to_float(override["valor_realizado"])
            else:
                valor_real = valor if status == "pago" else 0.0

            result.append({
                "id":                 lid,
                "data_competencia":   data_comp,
                "data_vencimento":    data_comp,
                "data_pagamento":     data_comp if status == "pago" else None,
                "descricao":          _clean(row.get("Despesa", "")) or categoria,
                "cliente":            "",
                "categoria":          categoria,
                "subcategoria":       "",
                "tipo":               "saida",
                "valor_previsto":     round(valor, 2),
                "valor_realizado":    round(valor_real, 2),
                "status":             status,
                "recorrente":         False,
                "origem":             _origem_despesa(categoria),
                "forma_pagamento":    "",
                "conta_financeira":   "conta_principal",
                "conciliado":         conc.get("status_conciliacao") == "conciliado",
                "status_conciliacao": conc.get("status_conciliacao", "pendente"),
                "observacao":         conc.get("observacao", ""),
                "fonte":              "excel",
            })
        return result

    def _build_manuais(self, cm: Dict) -> List[Dict]:
        """Retorna lançamentos manuais do JSON storage."""
        result = []
        for m in movimentacoes_storage.all():
            if m.get("tipo") == "ajuste_caixa":
                continue
            lid = f"mov_{m.get('id', '')}"
            conc = cm.get(lid, {})
            tipo_raw = str(m.get("tipo", "")).lower()
            if tipo_raw in ("entrada", "recebimento"):
                tipo, status = "entrada", "recebido"
            elif tipo_raw in ("saida", "despesa", "pagamento"):
                tipo, status = "saida", "pago"
            else:
                tipo, status = tipo_raw, "previsto"
            data_str = str(m.get("data", ""))[:10]
            valor = _to_float(m.get("valor", 0))
            result.append({
                "id":                 lid,
                "data_competencia":   data_str,
                "data_vencimento":    data_str,
                "data_pagamento":     data_str,
                "descricao":          m.get("descricao", "Lançamento manual"),
                "cliente":            m.get("cliente_relacionado") or "",
                "categoria":          m.get("categoria") or "manual",
                "subcategoria":       "",
                "tipo":               tipo,
                "valor_previsto":     round(valor, 2),
                "valor_realizado":    round(valor, 2),
                "status":             status,
                "recorrente":         False,
                "origem":             "ajuste_manual",
                "forma_pagamento":    "",
                "conta_financeira":   "conta_principal",
                "conciliado":         conc.get("status_conciliacao") == "conciliado",
                "status_conciliacao": conc.get("status_conciliacao", "pendente"),
                "observacao":         m.get("observacao") or conc.get("observacao", ""),
                "fonte":              "manual",
            })
        return result

    def _caixa_atual(self) -> float:
        registros = sorted(caixa_storage.all(),
                           key=lambda r: str(r.get("data", "")),
                           reverse=True)
        return _to_float(registros[0].get("valor_atual")) if registros else 0.0

    # ── Endpoints públicos ───────────────────────────────────────────────

    def get_fluxo(
        self,
        mes:       Optional[int] = None,
        ano:       Optional[int] = None,
        tipo:      Optional[str] = None,
        status:    Optional[str] = None,
        cliente:   Optional[str] = None,
        categoria: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retorna fluxo de caixa unificado com totais e lançamentos filtrados."""
        cm = self._conc_map()
        sm = self._status_map()
        todos: List[Dict] = self._build_receitas(cm, sm) + self._build_despesas(cm, sm) + self._build_manuais(cm)

        # Filtros opcionais
        ano_ref = ano or date.today().year
        if mes:
            todos = [l for l in todos
                     if l.get("data_competencia", "").startswith(f"{ano_ref}-{mes:02d}")]
        elif ano:
            todos = [l for l in todos
                     if l.get("data_competencia", "").startswith(str(ano_ref))]

        if tipo and tipo in ("entrada", "saida"):
            todos = [l for l in todos if l["tipo"] == tipo]
        if status:
            todos = [l for l in todos if l["status"].lower() == status.lower()]
        if cliente:
            q = cliente.lower()
            todos = [l for l in todos if q in l["cliente"].lower()]
        if categoria:
            q = categoria.lower()
            todos = [l for l in todos if q in l["categoria"].lower()]

        todos.sort(key=lambda l: l.get("data_competencia") or "")

        # Totais
        ent_prev = sum(l["valor_previsto"]  for l in todos if l["tipo"] == "entrada")
        ent_real = sum(l["valor_realizado"] for l in todos if l["tipo"] == "entrada")
        sai_prev = sum(l["valor_previsto"]  for l in todos if l["tipo"] == "saida")
        sai_real = sum(l["valor_realizado"] for l in todos if l["tipo"] == "saida")

        saldo_ini       = self._caixa_atual()
        saldo_prev      = saldo_ini + ent_prev - sai_prev
        saldo_real      = saldo_ini + ent_real - sai_real
        divergencia     = saldo_real - saldo_prev

        conciliados     = sum(1 for l in todos if l["conciliado"])
        pend_conc       = len(todos) - conciliados

        return {
            "saldo_inicial":              round(saldo_ini,   2),
            "total_entradas_previsto":    round(ent_prev,    2),
            "total_entradas_realizado":   round(ent_real,    2),
            "total_saidas_previsto":      round(sai_prev,    2),
            "total_saidas_realizado":     round(sai_real,    2),
            "saldo_final_previsto":       round(saldo_prev,  2),
            "saldo_final_realizado":      round(saldo_real,  2),
            "divergencia":                round(divergencia, 2),
            "total_conciliados":          conciliados,
            "total_pendentes_conciliacao": pend_conc,
            "total_lancamentos":          len(todos),
            "lancamentos":                todos,
        }

    def get_conciliacao(
        self,
        mes: Optional[int] = None,
        ano: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retorna KPIs e lançamentos para a tela de conciliação."""
        cm = self._conc_map()
        sm = self._status_map()
        todos = self._build_receitas(cm, sm) + self._build_despesas(cm, sm) + self._build_manuais(cm)

        ano_ref = ano or date.today().year
        if mes:
            todos = [l for l in todos
                     if l.get("data_competencia", "").startswith(f"{ano_ref}-{mes:02d}")]

        total        = len(todos)
        conciliados  = [l for l in todos if l["status_conciliacao"] == "conciliado"]
        pendentes    = [l for l in todos if l["status_conciliacao"] == "pendente"]
        divergentes  = [l for l in todos if l["status_conciliacao"] == "divergente"]
        pct          = round(len(conciliados) / total * 100, 1) if total > 0 else 0.0

        return {
            "total_lancamentos":   total,
            "total_conciliado":    len(conciliados),
            "total_pendente":      len(pendentes),
            "total_divergente":    len(divergentes),
            "percentual_conciliado": pct,
            "valor_conciliado":    round(sum(l["valor_previsto"] for l in conciliados), 2),
            "valor_pendente":      round(sum(l["valor_previsto"] for l in pendentes),   2),
            "valor_divergente":    round(sum(l["valor_previsto"] for l in divergentes), 2),
            "lancamentos":         todos,
        }

    def marcar_conciliacao(
        self,
        lancamento_id:      str,
        status_conciliacao: str,
        observacao:         str  = "",
        valor_extrato:      Optional[float] = None,
    ) -> Dict[str, Any]:
        """Marca/atualiza status de conciliação de um lançamento."""
        if status_conciliacao not in STATUS_CONCILIACAO:
            raise ValueError(f"status_conciliacao deve ser um de {STATUS_CONCILIACAO}")

        cm = self._conc_map()
        existing = cm.get(lancamento_id)
        payload  = {
            "lancamento_id":      lancamento_id,
            "status_conciliacao": status_conciliacao,
            "observacao":         observacao,
            "valor_extrato":      valor_extrato,
            "data_conciliacao":   datetime.now().isoformat(),
        }
        if existing:
            conciliacao_storage.update(str(existing["id"]), payload)
        else:
            conciliacao_storage.create(payload)

        return {"ok": True, "lancamento_id": lancamento_id, "status": status_conciliacao}

    def update_status(
        self,
        lancamento_id:   str,
        status:          str,
        valor_realizado: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Persiste uma alteração manual de status de um lançamento."""
        sm       = self._status_map()
        existing = sm.get(lancamento_id)
        payload: Dict[str, Any] = {
            "lancamento_id":  lancamento_id,
            "status":         status,
            "atualizado_em":  datetime.now().isoformat(),
        }
        if valor_realizado is not None:
            payload["valor_realizado"] = valor_realizado

        if existing:
            status_overrides_storage.update(str(existing["id"]), payload)
        else:
            status_overrides_storage.create(payload)

        return {"ok": True, "lancamento_id": lancamento_id, "status": status}

    def get_recebimentos_clientes(
        self,
        mes: Optional[int] = None,
        ano: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retorna visão consolidada de recebimentos por cliente ativo."""
        hoje    = date.today()
        mes_ref = mes or hoje.month
        ano_ref = ano or hoje.year

        # Agrega receitas Excel por cliente no mês de referência
        receitas_por_cliente: Dict[str, Dict[str, float]] = {}
        df = self.excel.get_base_receitas()
        if df is not None and not df.empty:
            for _, row in df.iterrows():
                nome = _clean(row.get("Cliente", ""))
                if not nome:
                    continue
                mn = _mes_num(_clean(row.get("Mês", "")))
                if mn != mes_ref:
                    continue
                valor = _to_float(row.get("Valor Previsto", 0))
                status = _clean(row.get("Status", "")).upper()

                if nome not in receitas_por_cliente:
                    receitas_por_cliente[nome] = {"previsto": 0.0, "recebido": 0.0}
                receitas_por_cliente[nome]["previsto"] += valor
                if status == "PAGO":
                    receitas_por_cliente[nome]["recebido"] += valor

        clientes = [c for c in clientes_storage.all() if c.get("status") == "ativo"]
        resultado: List[Dict] = []

        for c in clientes:
            nome        = c.get("nome", "")
            exc         = receitas_por_cliente.get(nome, {})
            val_mensal  = _to_float(c.get("valor_mensal") or c.get("valor_previsto"))
            prev_excel  = exc.get("previsto", 0.0)
            rec_excel   = exc.get("recebido",  0.0)

            total_prev  = prev_excel if prev_excel > 0 else val_mensal
            total_rec   = rec_excel  if rec_excel  > 0 else _to_float(c.get("valor_recebido"))

            # Determina status de pagamento
            if total_rec >= total_prev > 0:
                st_pgto = "pago"
            elif 0 < total_rec < total_prev:
                st_pgto = "parcial"
            else:
                st_pgto = c.get("status_pagamento", "pendente")

            # Próximo vencimento
            dia_venc = int(c.get("dia_pagamento") or 25)
            try:
                prox = date(hoje.year, hoje.month, dia_venc)
            except ValueError:
                prox = date(hoje.year, hoje.month, 28)
            if prox < hoje and st_pgto not in ("pago", "parcial"):
                st_pgto = "vencido"

            resultado.append({
                "id":                    c.get("id"),
                "cliente":               nome,
                "responsavel":           c.get("responsavel") or "",
                "valor_mensal":          round(val_mensal,  2),
                "projetos_adicionais":   0.0,
                "total_previsto":        round(total_prev,  2),
                "total_recebido":        round(total_rec,   2),
                "pendencia":             round(max(total_prev - total_rec, 0), 2),
                "vencimento":            prox.isoformat(),
                "status_pagamento":      st_pgto,
                "cobranca_status":       c.get("cobranca_status", "sem_cobrar"),
                "dia_pagamento":         dia_venc,
                "forma_cobranca":        c.get("forma_contato", "whatsapp"),
                "email_financeiro":      c.get("email_financeiro", ""),
                "whatsapp_financeiro":   c.get("whatsapp_financeiro", ""),
                "cobrar_automaticamente": c.get("cobrar_automaticamente", False),
                "ultimo_pagamento":      c.get("data_pagamento"),
            })

        ordem = {"vencido": 0, "pendente": 1, "parcial": 2, "pago": 3}
        resultado.sort(key=lambda x: ordem.get(x["status_pagamento"], 9))

        total_prev   = sum(r["total_previsto"] for r in resultado)
        total_rec    = sum(r["total_recebido"] for r in resultado)
        total_pend   = sum(r["pendencia"]      for r in resultado)
        n_pagos      = sum(1 for r in resultado if r["status_pagamento"] == "pago")
        n_vencidos   = sum(1 for r in resultado if r["status_pagamento"] == "vencido")
        n_pendentes  = sum(1 for r in resultado if r["status_pagamento"] in ("pendente", "parcial"))

        return {
            "mes_referencia":  f"{_MESES_ABR[mes_ref - 1]}/{str(ano_ref)[-2:]}",
            "total_previsto":  round(total_prev,  2),
            "total_recebido":  round(total_rec,   2),
            "total_pendente":  round(total_pend,  2),
            "n_pagos":         n_pagos,
            "n_vencidos":      n_vencidos,
            "n_pendentes":     n_pendentes,
            "clientes":        resultado,
        }
