"""
FinanceiroService — consolida receitas, despesas, KPIs e alertas.
Lê dados reais de Base Receitas e Base Despesas do Excel.
Fallback automático para dados mock caso o Excel não esteja disponível.
"""

import logging
import unicodedata
from datetime import date
from typing import Any, Dict, List, Optional

import pandas as pd

from app.services.excel_service import ExcelService

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Mapeamentos de meses em português
# ------------------------------------------------------------------

_MES_NOME_NUM: Dict[str, int] = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}
_MES_ABREV = {1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
              7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"}

# Cores por posição (atribuídas na ordem de maior valor)
_CORES_CATEGORIA = ["#12F0C6", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"]

# Mapeamento de categoria de despesa → centro de custo
_CAT_CENTRO: Dict[str, str] = {
    "salarios e beneficios": "RH",
    "marketing publicidade": "MKT",
    "licencas ferramentas": "TI",
    "custos fixos": "ADM",
    "administrativo": "ADM",
    "materiais estrutura": "ADM",
}

# ------------------------------------------------------------------
# Dados mock — contexto 2026 (fallback quando Excel não disponível)
# ------------------------------------------------------------------

MOCK_MESES: List[Dict[str, Any]] = [
    {"mes": "Jan/26", "mes_num": 1, "ano": 2026, "receita": 28_050, "a_receber": 4_300, "recebido": 23_750, "despesa": 31_200, "resultado": -3_150, "margem_pct": -11.2},
    {"mes": "Fev/26", "mes_num": 2, "ano": 2026, "receita": 30_560, "a_receber": 5_100, "recebido": 25_460, "despesa": 30_800, "resultado":   -240, "margem_pct":  -0.8},
    {"mes": "Mar/26", "mes_num": 3, "ano": 2026, "receita": 30_600, "a_receber": 8_200, "recebido": 22_400, "despesa": 29_600, "resultado":  1_000, "margem_pct":   3.3},
]


def _normalizar(text: str) -> str:
    """Remove acentos e converte para minúsculas sem espaços."""
    t = unicodedata.normalize("NFD", str(text).strip().lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return "".join(c for c in t if c.isalnum() or c == " ").strip()


def _mes_label(mes_num: int, ano: int) -> str:
    return f"{_MES_ABREV.get(mes_num, '?')}/{str(ano)[-2:]}"


def _status_receita(raw) -> str:
    """Tudo que não é PAGO = Pendente (inclui NaN e strings vazias)."""
    if pd.isna(raw):
        return "Pendente"
    r = str(raw).upper().strip()
    if r == "PAGO":
        return "Recebido"
    return "Pendente"


def _centro_custo(categoria: str) -> str:
    key = _normalizar(categoria).replace(" ", "")
    # try word-based match
    norm_words = _normalizar(categoria)
    for k, v in _CAT_CENTRO.items():
        if any(w in norm_words for w in k.split()):
            return v
    return "ADM"


class FinanceiroService:
    def __init__(self):
        self.excel = ExcelService()

    # ------------------------------------------------------------------
    # Carregadores internos
    # ------------------------------------------------------------------

    def _carregar_receitas_df(self) -> Optional[pd.DataFrame]:
        df = self.excel.get_base_receitas()
        if df is None or df.empty:
            return None
        df = df.copy()
        df["Valor Previsto"] = pd.to_numeric(df.get("Valor Previsto"), errors="coerce").fillna(0)
        df["Mês"]    = df["Mês"].astype(str).str.strip()
        df["Status"] = df.get("Status", "").astype(str).str.upper().str.strip()
        return df

    def _carregar_despesas_df(self) -> Optional[pd.DataFrame]:
        df = self.excel.get_base_despesas()
        if df is None or df.empty:
            return None
        df = df.copy()
        df["Valor"]     = pd.to_numeric(df.get("Valor"), errors="coerce").fillna(0)
        df["Mês"]       = df["Mês"].astype(str).str.strip()
        df["Categoria"] = df.get("Categoria", "").astype(str).str.strip()
        return df

    def _mes_para_num(self, nome: str) -> int:
        return _MES_NOME_NUM.get(_normalizar(nome), 0)

    # ------------------------------------------------------------------
    # Resumo mensal
    # ------------------------------------------------------------------

    def get_resumo_mensal(self) -> Dict[str, Any]:
        df_r = self._carregar_receitas_df()
        df_d = self._carregar_despesas_df()

        if df_r is None and df_d is None:
            total_r = sum(m["receita"] for m in MOCK_MESES)
            total_d = sum(m["despesa"] for m in MOCK_MESES)
            return {
                "fonte": "mock",
                "meses": MOCK_MESES,
                "total_receita": total_r,
                "total_despesa": total_d,
                "total_resultado": total_r - total_d,
            }

        ano_ref = date.today().year

        # Agrega receitas por mês
        resumo_r: Dict[int, Dict[str, float]] = {}
        if df_r is not None:
            df_r["_mes_num"] = df_r["Mês"].apply(self._mes_para_num)
            for mes_num, grp in df_r[df_r["_mes_num"] > 0].groupby("_mes_num"):
                recebido  = float(grp[grp["Status"] == "PAGO"]["Valor Previsto"].sum())
                a_receber = float(grp[grp["Status"] != "PAGO"]["Valor Previsto"].fillna(0).sum())
                resumo_r[int(mes_num)] = {
                    "receita":    recebido + a_receber,
                    "recebido":   recebido,
                    "a_receber":  a_receber,
                }

        # Agrega despesas por mês
        resumo_d: Dict[int, float] = {}
        if df_d is not None:
            df_d["_mes_num"] = df_d["Mês"].apply(self._mes_para_num)
            for mes_num, grp in df_d[df_d["_mes_num"] > 0].groupby("_mes_num"):
                resumo_d[int(mes_num)] = float(grp["Valor"].sum())

        all_meses = sorted(set(list(resumo_r.keys()) + list(resumo_d.keys())))
        meses = []
        for mn in all_meses:
            r_data = resumo_r.get(mn, {"receita": 0.0, "recebido": 0.0, "a_receber": 0.0})
            d      = resumo_d.get(mn, 0.0)
            r      = r_data["receita"]
            res    = r - d
            margem = (res / r * 100) if r > 0 else 0.0
            meses.append({
                "mes":        _mes_label(mn, ano_ref),
                "mes_num":    mn,
                "ano":        ano_ref,
                "receita":    round(r, 2),
                "recebido":   round(r_data["recebido"], 2),
                "a_receber":  round(r_data["a_receber"], 2),
                "despesa":    round(d, 2),
                "resultado":  round(res, 2),
                "margem_pct": round(margem, 2),
            })

        total_r = sum(m["receita"] for m in meses)
        total_d = sum(m["despesa"] for m in meses)

        # Totais realizados: apenas meses com receita confirmada (ignora futuros planejados)
        meses_real = [m for m in meses if m.get("receita", 0) > 0]
        total_r_real = sum(m["receita"] for m in meses_real)
        total_d_real = sum(m["despesa"] for m in meses_real)

        return {
            "fonte":            "excel",
            "meses":            meses,
            "anos_disponiveis": [ano_ref],
            "total_receita":    round(total_r_real, 2),
            "total_despesa":    round(total_d_real, 2),
            "total_resultado":  round(total_r_real - total_d_real, 2),
            "total_receita_all": round(total_r, 2),
            "total_despesa_all": round(total_d, 2),
        }

    # ------------------------------------------------------------------
    # KPIs
    # ------------------------------------------------------------------

    def get_kpis(self) -> Dict[str, Any]:
        resumo = self.get_resumo_mensal()
        meses  = resumo.get("meses") or MOCK_MESES

        total_r   = resumo.get("total_receita",  sum(m.get("receita", 0) for m in meses))
        total_d   = resumo.get("total_despesa",  sum(m.get("despesa", 0) for m in meses))
        total_res = total_r - total_d
        margem    = (total_res / total_r * 100) if total_r > 0 else 0.0

        meses_ord = sorted(meses, key=lambda m: (m.get("ano", 0), m.get("mes_num", 0)))

        # Último mês com receita real (ignora meses futuros só com despesas planejadas)
        meses_com_receita = [m for m in meses_ord if m.get("receita", 0) > 0]
        ultimo = meses_com_receita[-1] if meses_com_receita else (meses_ord[-1] if meses_ord else {})

        r_ult     = ultimo.get("receita", 0)
        d_ult     = ultimo.get("despesa", 0)
        a_receber = sum(m.get("a_receber", 0) for m in meses)

        df_r = self.excel.get_base_receitas()
        df_d = self.excel.get_base_despesas()
        n_lanc = (len(df_r) if df_r is not None and not df_r.empty else 0) + \
                 (len(df_d) if df_d is not None and not df_d.empty else 0)
        if n_lanc == 0:
            n_lanc = 24  # mock fallback

        periodo = ""
        if meses_com_receita:
            periodo = f"{meses_ord[0].get('mes','')} a {meses_com_receita[-1].get('mes','')}"
        elif meses_ord:
            periodo = meses_ord[0].get("mes", "")

        return {
            "fonte":                resumo.get("fonte", "mock"),
            "periodo":              periodo,
            "total_receita":        round(total_r, 2),
            "total_despesa":        round(total_d, 2),
            "total_resultado":      round(total_res, 2),
            "margem_pct":           round(margem, 2),
            "total_lancamentos":    n_lanc,
            "receita_ultimo_mes":   round(r_ult, 2),
            "despesa_ultimo_mes":   round(d_ult, 2),
            "resultado_ultimo_mes": round(r_ult - d_ult, 2),
            "mes_referencia":       ultimo.get("mes", ""),
            "a_receber":            round(a_receber, 2),
        }

    # ------------------------------------------------------------------
    # Receitas
    # ------------------------------------------------------------------

    def get_receitas(self) -> Dict[str, Any]:
        df = self._carregar_receitas_df()
        ano_ref = date.today().year

        if df is None or df.empty:
            return {
                "fonte": "mock",
                "lancamentos": [],
                "total": 0,
                "por_categoria": [],
                "total_lancamentos": 0,
            }

        df["_mes_num"] = df["Mês"].apply(self._mes_para_num)
        lancamentos = []
        for i, row in df.iterrows():
            mn = int(row.get("_mes_num", 0))
            lancamentos.append({
                "id":        i + 1,
                "descricao": str(row.get("Descrição", "") or ""),
                "categoria": str(row.get("Serviço", "") or "Outros"),
                "cliente":   str(row.get("Cliente", "") or ""),
                "valor":     float(row.get("Valor Previsto", 0)),
                "mes":       _mes_label(mn, ano_ref) if mn else str(row.get("Mês", "")),
                "mes_num":   mn,
                "ano":       ano_ref,
                "status":    _status_receita(row.get("Status", "")),
                "pagamento": str(row.get("Pagamento", "") or ""),
            })

        por_cat: Dict[str, float] = {}
        for lc in lancamentos:
            if lc["valor"] > 0:  # ignora linhas com valor zero ou NaN
                c = lc["categoria"] or "Outros"
                por_cat[c] = por_cat.get(c, 0) + lc["valor"]

        total = sum(lc["valor"] for lc in lancamentos)
        por_cat_sorted = sorted(por_cat.items(), key=lambda x: -x[1])
        tot_cat = sum(v for _, v in por_cat_sorted)

        return {
            "fonte":             "excel",
            "lancamentos":       lancamentos,
            "total":             round(total, 2),
            "total_lancamentos": len(lancamentos),
            "por_categoria": [
                {
                    "categoria":  k,
                    "valor":      round(v, 2),
                    "percentual": round(v / tot_cat * 100, 1) if tot_cat > 0 else 0,
                    "cor":        _CORES_CATEGORIA[i % len(_CORES_CATEGORIA)],
                }
                for i, (k, v) in enumerate(por_cat_sorted)
            ],
        }

    # ------------------------------------------------------------------
    # Despesas
    # ------------------------------------------------------------------

    def get_despesas(self) -> Dict[str, Any]:
        df = self._carregar_despesas_df()
        ano_ref = date.today().year

        if df is None or df.empty:
            return {
                "fonte": "mock",
                "lancamentos": [],
                "total": 0,
                "por_categoria": [],
                "total_lancamentos": 0,
            }

        df["_mes_num"] = df["Mês"].apply(self._mes_para_num)
        lancamentos = []
        for i, row in df.iterrows():
            mn  = int(row.get("_mes_num", 0))
            cat = str(row.get("Categoria", "") or "Outros")
            lancamentos.append({
                "id":          i + 1,
                "descricao":   str(row.get("Despesa", "") or ""),
                "categoria":   cat,
                "centro_custo": _centro_custo(cat),
                "valor":       float(row.get("Valor", 0)),
                "mes":         _mes_label(mn, ano_ref) if mn else str(row.get("Mês", "")),
                "mes_num":     mn,
                "ano":         ano_ref,
                "status":      str(row.get("Status", "") or ""),
                "pagamento":   str(row.get("Pagamento", "") or ""),
            })

        por_cat: Dict[str, float] = {}
        for lc in lancamentos:
            c = lc["categoria"] or "Outros"
            por_cat[c] = por_cat.get(c, 0) + lc["valor"]

        total = sum(lc["valor"] for lc in lancamentos)
        por_cat_sorted = sorted(por_cat.items(), key=lambda x: -x[1])
        tot_cat = sum(v for _, v in por_cat_sorted)

        return {
            "fonte":             "excel",
            "lancamentos":       lancamentos,
            "total":             round(total, 2),
            "total_lancamentos": len(lancamentos),
            "por_categoria": [
                {
                    "categoria":  k,
                    "valor":      round(v, 2),
                    "percentual": round(v / tot_cat * 100, 1) if tot_cat > 0 else 0,
                    "cor":        _CORES_CATEGORIA[i % len(_CORES_CATEGORIA)],
                }
                for i, (k, v) in enumerate(por_cat_sorted)
            ],
        }

    # ------------------------------------------------------------------
    # Alertas
    # ------------------------------------------------------------------

    def get_alertas(self) -> Dict[str, Any]:
        kpis   = self.get_kpis()
        margem  = kpis.get("margem_pct", 0)
        total_r = kpis.get("total_receita", 1)
        total_d = kpis.get("total_despesa", 0)
        res_ult = kpis.get("resultado_ultimo_mes", 0)
        a_rec   = kpis.get("a_receber", 0)
        ratio_d = total_d / total_r if total_r > 0 else 0

        alertas: List[Dict[str, Any]] = []

        if res_ult > 0:
            alertas.append({
                "tipo":     "success",
                "titulo":   "Resultado positivo no último mês",
                "descricao": "A operação encerrou o mês com resultado positivo.",
                "icone":    "CheckCircle",
            })
        elif res_ult < 0:
            alertas.append({
                "tipo":     "warning",
                "titulo":   "Resultado negativo no último mês",
                "descricao": f"Resultado de R$ {res_ult:,.0f} — despesas superaram receitas.",
                "icone":    "TrendingDown",
            })

        if margem >= 20:
            alertas.append({
                "tipo":     "success",
                "titulo":   "Margem líquida saudável",
                "descricao": f"Margem atual de {margem:.1f}% — performance positiva.",
                "icone":    "TrendingUp",
            })
        elif margem < 0:
            alertas.append({
                "tipo":     "error",
                "titulo":   "Margem negativa — atenção crítica",
                "descricao": f"Margem atual: {margem:.1f}%. Despesas superam receitas totais.",
                "icone":    "AlertTriangle",
            })
        elif margem < 20:
            alertas.append({
                "tipo":     "warning",
                "titulo":   "Margem abaixo de 20%",
                "descricao": f"Margem atual: {margem:.1f}%. Avalie reduções de custo.",
                "icone":    "TrendingDown",
            })

        if a_rec > 0:
            alertas.append({
                "tipo":     "info",
                "titulo":   f"A receber: R$ {a_rec:,.0f}",
                "descricao": "Receitas pendentes de pagamento no período.",
                "icone":    "Info",
            })

        if ratio_d > 1.0:
            alertas.append({
                "tipo":     "error",
                "titulo":   "Despesas superam receitas",
                "descricao": "Proporção crítica — revise urgentemente os custos fixos.",
                "icone":    "AlertTriangle",
            })
        elif ratio_d > 0.80:
            alertas.append({
                "tipo":     "warning",
                "titulo":   "Despesas acima de 80% da receita",
                "descricao": "Proporção elevada — revise fornecedores e contratos.",
                "icone":    "AlertTriangle",
            })

        alertas.append({
            "tipo":     "info",
            "titulo":   "Módulo CRM em desenvolvimento",
            "descricao": "Cada novo cliente no CRM gera R$ 100/mês de receita adicional.",
            "icone":    "Info",
        })

        return {"total": len(alertas), "alertas": alertas}
