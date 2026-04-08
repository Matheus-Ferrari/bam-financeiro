"""
FluxoCaixaService — fluxo de caixa unificado + conciliação financeira.

Lê dados de receitas e despesas do Firestore e do storage de movimentacoes,
constrói lançamentos padronizados e suporta conciliação manual.
"""

import calendar
import logging
import math
import unicodedata
from datetime import date, datetime
from typing import Any, Dict, List, Optional

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
        pass  # sem dependência de Excel

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
        """Lê receitas do Firestore → lançamentos de ENTRADA."""
        from app.repositories import receitas_repo
        items = receitas_repo.all()
        if not items:
            return []
        ano = date.today().year
        result = []
        for item in items:
            mes_nome = _clean(item.get("mes", ""))
            data_comp = _mes_to_iso(mes_nome, ano)
            if not data_comp:
                continue
            status_raw = _clean(item.get("status", "")).upper()
            status = "recebido" if status_raw == "PAGO" else "previsto"
            valor_prev = _to_float(item.get("valor_previsto", 0))

            lid    = item["id"]
            conc   = cm.get(lid, {})
            override = sm.get(lid, {})

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
                "descricao":          item.get("descricao", "") or item.get("servico", "") or "Receita",
                "cliente":            item.get("cliente", ""),
                "categoria":          item.get("servico", "") or "Receita",
                "subcategoria":       "",
                "tipo":               "entrada",
                "valor_previsto":     round(valor_prev, 2),
                "valor_realizado":    round(valor_real, 2),
                "status":             status,
                "recorrente":         True,
                "origem":             "receita_fixa",
                "forma_pagamento":    item.get("pagamento", ""),
                "conta_financeira":   "conta_principal",
                "conciliado":         conc.get("status_conciliacao") == "conciliado",
                "status_conciliacao": conc.get("status_conciliacao", "pendente"),
                "observacao":         conc.get("observacao", ""),
                "fonte":              "firestore",
            })
        return result

    def _build_despesas(self, cm: Dict, sm: Dict) -> List[Dict]:
        """Lê despesas do Firestore → lançamentos de SAÍDA."""
        from app.repositories import despesas_repo
        items = despesas_repo.all()
        if not items:
            return []
        ano = date.today().year
        result = []
        for item in items:
            mes_nome = _clean(item.get("mes", ""))
            data_comp = _mes_to_iso(mes_nome, ano)
            if not data_comp:
                continue
            status_raw = _clean(item.get("status", "")).upper()
            status = "pago" if status_raw == "PAGO" else "previsto"
            valor = _to_float(item.get("valor", 0))
            categoria = item.get("categoria", "") or "Despesa"

            lid    = item["id"]
            conc   = cm.get(lid, {})
            override = sm.get(lid, {})

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
                "descricao":          item.get("descricao", "") or categoria,
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
                "fonte":              "firestore",
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

    def _build_clientes(
        self, cm: Dict, sm: Dict,
        mes: Optional[int] = None, ano: Optional[int] = None
    ) -> List[Dict]:
        """Gera lançamentos de ENTRADA a partir de clientes ativos no storage JSON.
        ID format: cli_{client_id}_{year}{month:02d}  — único por cliente por mês.
        """
        hoje    = date.today()
        mes_ref = mes if mes is not None else hoje.month
        ano_ref = ano if ano is not None else hoje.year

        result = []
        for c in clientes_storage.all():
            if c.get("status") != "ativo":
                continue
            valor = _to_float(c.get("valor_previsto") or c.get("valor_mensal") or 0)
            if valor <= 0:
                continue

            dia     = int(c.get("dia_pagamento") or 1)
            max_day = calendar.monthrange(ano_ref, mes_ref)[1]
            dia     = min(dia, max_day)
            data_comp = f"{ano_ref}-{mes_ref:02d}-{dia:02d}"

            status_pgto = str(c.get("status_pagamento", "pendente")).lower()
            if status_pgto == "pago":
                status = "recebido"
            elif status_pgto in ("atrasado",):
                status = "vencido"
            else:
                status = "previsto"

            lid  = f"cli_{c['id']}_{ano_ref}{mes_ref:02d}"
            conc = cm.get(lid, {})
            ov   = sm.get(lid, {})

            if ov.get("status"):
                status = ov["status"]
            if ov.get("valor_realizado") is not None:
                valor_real = _to_float(ov["valor_realizado"])
            elif status == "recebido":
                valor_real = _to_float(c.get("valor_recebido") or valor)
            else:
                valor_real = 0.0

            result.append({
                "id":                 lid,
                "data_competencia":   ov.get("data_competencia") or data_comp,
                "data_vencimento":    data_comp,
                "data_pagamento":     c.get("data_pagamento") if status == "recebido" else None,
                "descricao":          ov.get("descricao") or c.get("nome", "Cliente"),
                "cliente":            ov.get("cliente") or c.get("nome", ""),
                "categoria":          ov.get("categoria") or "Mensalidade",
                "subcategoria":       "",
                "tipo":               ov.get("tipo") or "entrada",
                "valor_previsto":     round(_to_float(ov.get("valor_previsto") or valor), 2),
                "valor_realizado":    round(valor_real, 2),
                "status":             status,
                "recorrente":         True,
                "origem":             ov.get("origem") or "cliente_mensal",
                "forma_pagamento":    "",
                "conta_financeira":   "conta_principal",
                "conciliado":         conc.get("status_conciliacao") == "conciliado",
                "status_conciliacao": conc.get("status_conciliacao", "pendente"),
                "observacao":         conc.get("observacao", ""),
                "fonte":              "cliente",
            })
        return result

    def _apply_field_overrides(self, todos: List[Dict], sm: Dict) -> List[Dict]:
        """Aplica overrides de campos não-status/valor_realizado (gerados via update_lancamento)
        a lançamentos do Excel e manuais. Clientes já aplicam seus overrides internamente."""
        fields = ["data_competencia", "descricao", "cliente", "categoria",
                  "tipo", "origem", "valor_previsto"]
        result = []
        for l in todos:
            if l.get("fonte") == "cliente":
                # already fully overridden in _build_clientes
                result.append(l)
                continue
            ov = sm.get(l["id"], {})
            if not ov:
                result.append(l)
                continue
            updated = dict(l)
            for f in fields:
                if ov.get(f) is not None:
                    updated[f] = ov[f]
            result.append(updated)
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

        clientes_lancamentos = self._build_clientes(cm, sm, mes=mes, ano=ano)
        todos: List[Dict] = (
            self._build_receitas(cm, sm)
            + self._build_despesas(cm, sm)
            + self._build_manuais(cm)
        )

        # Deduplicação: remove receitas_fixa que já existem nos clientes JSON
        # (mesmo nome de cliente + mesmo mês-ano)
        cli_months = {
            (_norm(l["cliente"]), l["data_competencia"][:7])
            for l in clientes_lancamentos
            if l.get("cliente")
        }
        todos = [
            l for l in todos
            if not (
                l.get("origem") == "receita_fixa"
                and l.get("cliente")
                and (_norm(l["cliente"]), l.get("data_competencia", "")[:7]) in cli_months
            )
        ]

        todos = todos + clientes_lancamentos

        # Aplica overrides de campos adicionais (data, descricao, etc.)
        todos = self._apply_field_overrides(todos, sm)

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
        clientes_lancamentos = self._build_clientes(cm, sm, mes=mes, ano=ano)
        todos = self._build_receitas(cm, sm) + self._build_despesas(cm, sm) + self._build_manuais(cm)
        cli_months = {
            (_norm(l["cliente"]), l["data_competencia"][:7])
            for l in clientes_lancamentos if l.get("cliente")
        }
        todos = [
            l for l in todos
            if not (
                l.get("origem") == "receita_fixa" and l.get("cliente")
                and (_norm(l["cliente"]), l.get("data_competencia", "")[:7]) in cli_months
            )
        ]
        todos = self._apply_field_overrides(todos + clientes_lancamentos, sm)

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

    def update_lancamento(
        self,
        lancamento_id:    str,
        data_competencia: Optional[str]   = None,
        descricao:        Optional[str]   = None,
        cliente:          Optional[str]   = None,
        categoria:        Optional[str]   = None,
        tipo:             Optional[str]   = None,
        valor_previsto:   Optional[float] = None,
        valor_realizado:  Optional[float] = None,
        status:           Optional[str]   = None,
        origem:           Optional[str]   = None,
    ) -> Dict[str, Any]:
        """Persiste edição completa de um lançamento via status_overrides_storage.
        Aplica regras de consistência previsto × realizado."""
        # Regra: realizado > 0 → status não pode ser previsto
        tipo_ref = tipo or "entrada"
        if valor_realizado is not None:
            if valor_realizado > 0 and (status is None or status == "previsto"):
                status = "recebido" if tipo_ref == "entrada" else "pago"
            elif valor_realizado == 0 and status in ("recebido", "pago"):
                status = "previsto"

        sm       = self._status_map()
        existing = sm.get(lancamento_id)
        payload: Dict[str, Any] = {
            "lancamento_id": lancamento_id,
            "atualizado_em": datetime.now().isoformat(),
        }
        for field, value in [
            ("data_competencia", data_competencia),
            ("descricao",        descricao),
            ("cliente",          cliente),
            ("categoria",        categoria),
            ("tipo",             tipo),
            ("valor_previsto",   valor_previsto),
            ("valor_realizado",  valor_realizado),
            ("status",           status),
            ("origem",           origem),
        ]:
            if value is not None:
                payload[field] = value

        if existing:
            merged = {**existing, **payload, "id": str(existing["id"])}
            status_overrides_storage.update(str(existing["id"]), merged)
        else:
            status_overrides_storage.create(payload)

        return {"ok": True, "lancamento_id": lancamento_id}

    def get_recebimentos_clientes(
        self,
        mes: Optional[int] = None,
        ano: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Retorna visão consolidada de recebimentos por cliente ativo."""
        hoje    = date.today()
        mes_ref = mes or hoje.month
        ano_ref = ano or hoje.year

        # Agrega receitas Firestore por cliente no mês de referência
        receitas_por_cliente: Dict[str, Dict[str, float]] = {}
        from app.repositories import receitas_repo
        for item in receitas_repo.all():
            nome = _clean(item.get("cliente", ""))
            if not nome:
                continue
            mn = _mes_num(_clean(item.get("mes", "")))
            if mn != mes_ref:
                continue
            valor = _to_float(item.get("valor_previsto", 0))
            status = _clean(item.get("status", "")).upper()

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
