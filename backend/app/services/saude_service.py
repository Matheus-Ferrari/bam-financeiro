"""
SaudeService — calcula score de saúde financeira, riscos e insights.
"""

import logging
from typing import Any, Dict, List

from app.services.financeiro_service import FinanceiroService
from app.services.storage_service import clientes_storage, cortes_storage

logger = logging.getLogger(__name__)


class SaudeService:
    def __init__(self):
        self._fin = FinanceiroService()

    # ------------------------------------------------------------------
    # Saúde financeira
    # ------------------------------------------------------------------

    def get_saude(self) -> Dict[str, Any]:
        kpis      = self._fin.get_kpis()
        desp      = self._fin.get_despesas()
        rec       = self._fin.get_receitas()
        clientes  = clientes_storage.all()

        margem   = kpis.get("margem_pct", 0)
        total_r  = kpis.get("total_receita", 0)
        total_d  = kpis.get("total_despesa", 0)
        a_rec    = kpis.get("a_receber", 0)

        score    = self._calcular_score(margem, total_r, total_d, clientes)
        semaforo = "verde" if score >= 65 else ("amarelo" if score >= 40 else "vermelho")

        por_cat      = desp.get("por_categoria", [])
        lanc_receita = rec.get("lancamentos", [])
        conc_cliente = self._concentracao_cliente(lanc_receita)
        riscos       = self._gerar_riscos(margem, total_r, total_d, a_rec, conc_cliente, por_cat)
        recomendacoes = self._gerar_recomendacoes(margem, riscos, clientes)

        return {
            "score":                  score,
            "semaforo":               semaforo,
            "margem_pct":             round(margem, 2),
            "total_receita":          round(total_r, 2),
            "total_despesa":          round(total_d, 2),
            "resultado":              round(total_r - total_d, 2),
            "a_receber":              round(a_rec, 2),
            "equilibrio_pct":         round(total_d / total_r * 100, 1) if total_r > 0 else 0,
            "concentracao_cliente":   conc_cliente,
            "por_categoria_despesa":  por_cat,
            "riscos":                 riscos,
            "recomendacoes":          recomendacoes,
        }

    # ------------------------------------------------------------------
    # Insights automáticos
    # ------------------------------------------------------------------

    def get_insights(self) -> Dict[str, Any]:
        kpis      = self._fin.get_kpis()
        resumo    = self._fin.get_resumo_mensal()
        desp      = self._fin.get_despesas()
        cortes    = cortes_storage.all()
        clientes  = clientes_storage.all()

        meses      = resumo.get("meses", [])
        meses_real = [m for m in meses if m.get("receita", 0) > 0]
        insights: List[Dict] = []

        # Tendência de margem
        if len(meses_real) >= 2:
            primeira = meses_real[0].get("margem_pct", 0)
            ultima   = meses_real[-1].get("margem_pct", 0)
            delta    = ultima - primeira
            if delta > 2:
                insights.append({
                    "tipo":      "positive",
                    "titulo":    "Margem em tendência crescente",
                    "descricao": f"Margem evoluiu de {primeira:.1f}% para {ultima:.1f}% nos últimos meses.",
                    "icone":     "TrendingUp",
                })
            elif delta < -2:
                insights.append({
                    "tipo":      "warning",
                    "titulo":    "Margem em queda",
                    "descricao": f"Margem caiu de {primeira:.1f}% para {ultima:.1f}%. Monitorar despesas.",
                    "icone":     "TrendingDown",
                })

        # Resultado do último mês
        if meses_real:
            ult = meses_real[-1]
            if ult.get("resultado", 0) > 0:
                insights.append({
                    "tipo":      "positive",
                    "titulo":    f"Resultado positivo em {ult.get('mes','')}",
                    "descricao": f"Saldo de R$ {ult['resultado']:,.0f} no último mês — operação saudável.",
                    "icone":     "CheckCircle",
                })

        # Cortes ativos planejados
        cortes_ativos = [c for c in cortes if c.get("ativo", True)]
        if cortes_ativos:
            economia = sum(c.get("economia_mensal", 0) for c in cortes_ativos)
            insights.append({
                "tipo":      "info",
                "titulo":    f"{len(cortes_ativos)} corte(s) ativo(s) planejado(s)",
                "descricao": f"Economia mensal potencial de R$ {economia:,.0f} se todos forem aplicados.",
                "icone":     "Scissors",
            })

        # Clientes ativos
        ativos = [c for c in clientes if c.get("status") == "ativo"]
        if ativos:
            receita_cli = sum(c.get("valor_mensal", 0) for c in ativos)
            insights.append({
                "tipo":      "positive",
                "titulo":    f"{len(ativos)} cliente(s) ativo(s) cadastrado(s)",
                "descricao": f"Receita mensal estimada de R$ {receita_cli:,.0f} via gestão de clientes.",
                "icone":     "Users",
            })

        # A receber elevado
        a_rec   = kpis.get("a_receber", 0)
        total_r = kpis.get("total_receita", 1)
        if total_r > 0 and a_rec / total_r > 0.3:
            insights.append({
                "tipo":      "warning",
                "titulo":    "Alto volume a receber",
                "descricao": f"R$ {a_rec:,.0f} ({a_rec/total_r*100:.0f}% da receita) ainda não foi recebida.",
                "icone":     "Clock",
            })

        # Top categoria de despesa
        por_cat = desp.get("por_categoria", [])
        if por_cat:
            top = por_cat[0]
            insights.append({
                "tipo":      "info",
                "titulo":    f"Maior despesa: {top['categoria']}",
                "descricao": f"Representa R$ {top['valor']:,.0f} ({top.get('percentual', 0):.1f}% das despesas).",
                "icone":     "BarChart2",
            })

        return {"insights": insights, "total": len(insights)}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _calcular_score(self, margem: float, receita: float, despesa: float, clientes: list) -> int:
        score = 50  # base neutra

        if margem >= 20:    score += 30
        elif margem >= 10:  score += 15
        elif margem >= 0:   score += 5
        elif margem >= -10: score -= 10
        else:               score -= 25

        if receita > 0:
            ratio = despesa / receita
            if ratio < 0.7:   score += 15
            elif ratio < 0.9: score += 5
            elif ratio > 1.0: score -= 20

        ativos = len([c for c in clientes if c.get("status") == "ativo"])
        if ativos >= 5:   score += 10
        elif ativos >= 2: score += 5

        return max(0, min(100, score))

    def _concentracao_cliente(self, lancamentos: list) -> Dict[str, Any]:
        totais: Dict[str, float] = {}
        for lc in lancamentos:
            c = lc.get("cliente", "Desconhecido") or "Desconhecido"
            totais[c] = totais.get(c, 0) + lc.get("valor", 0)
        if not totais:
            return {"top_clientes": [], "concentracao_top3_pct": 0}
        total = sum(totais.values())
        top   = sorted(totais.items(), key=lambda x: -x[1])[:5]
        top3  = sum(v for _, v in top[:3])
        return {
            "top_clientes": [
                {"cliente": k, "valor": round(v, 2), "pct": round(v / total * 100, 1)}
                for k, v in top
            ],
            "concentracao_top3_pct": round(top3 / total * 100, 1) if total > 0 else 0,
        }

    def _gerar_riscos(self, margem, receita, despesa, a_receber, conc, por_cat) -> List[Dict]:
        riscos = []
        if margem < 0:
            riscos.append({"nivel": "critico", "titulo": "Margem negativa",
                           "descricao": f"Despesas superam receitas em {abs(margem):.1f}%.", "icone": "XCircle"})
        elif margem < 10:
            riscos.append({"nivel": "alto", "titulo": "Margem muito baixa",
                           "descricao": f"Margem de {margem:.1f}% oferece pouca segurança.", "icone": "AlertTriangle"})

        if conc.get("concentracao_top3_pct", 0) > 60:
            riscos.append({"nivel": "medio", "titulo": "Concentração de receita",
                           "descricao": f"Top 3 clientes representam {conc['concentracao_top3_pct']}% da receita.", "icone": "Users"})

        if receita > 0 and a_receber / receita > 0.4:
            riscos.append({"nivel": "medio", "titulo": "Alto volume a receber",
                           "descricao": "Mais de 40% da receita ainda não foi efetivamente recebida.", "icone": "Clock"})

        if por_cat and por_cat[0].get("percentual", 0) > 50:
            riscos.append({"nivel": "medio", "titulo": f"Concentração em {por_cat[0]['categoria']}",
                           "descricao": f"Responde por {por_cat[0]['percentual']}% das despesas.", "icone": "PieChart"})
        return riscos

    def _gerar_recomendacoes(self, margem: float, riscos: list, clientes: list) -> List[str]:
        recs = []
        if margem < 0:
            recs.append("Prioridade máxima: reverter resultado negativo — revisar despesas fixas imediatamente.")
        elif margem < 15:
            recs.append("Elevar margem acima de 15% via controle de custos ou aumento de receita.")
        ativos = [c for c in clientes if c.get("status") == "ativo"]
        if len(ativos) < 3:
            recs.append("Diversificar base de clientes para reduzir dependência de poucos contratos.")
        if any(r["nivel"] == "critico" for r in riscos):
            recs.append("Fazer reunião de revisão financeira urgente com os sócios.")
        recs.append("Manter planilha de controle atualizada mensalmente para rastreabilidade.")
        return recs
