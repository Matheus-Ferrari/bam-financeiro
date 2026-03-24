"""
ProjectionService — simulações de crescimento e cenários de corte de despesas.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List

from app.services.financeiro_service import FinanceiroService, MOCK_MESES

logger = logging.getLogger(__name__)

CRM_PRECO_UNITARIO = 100.0  # R$ por cliente/mês
MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


class ProjectionService:
    def __init__(self):
        self._fin = FinanceiroService()

    # ------------------------------------------------------------------
    # Projeções de crescimento
    # ------------------------------------------------------------------

    def get_projecoes(
        self,
        crescimento_pct: float = 10.0,
        novos_clientes_crm: int = 10,
        meses: int = 6,
    ) -> Dict[str, Any]:
        resumo = self._fin.get_resumo_mensal()
        historico = resumo.get("meses") or MOCK_MESES
        historico = sorted(historico, key=lambda m: (m.get("ano", 0), m.get("mes_num", 0)))

        # Usa o último mês com receita real como base (ignora meses só com despesas planejadas)
        historico_com_receita = [m for m in historico if m.get("receita", 0) > 0]
        ultimo = historico_com_receita[-1] if historico_com_receita else historico[-1]

        receita_base = float(ultimo.get("receita", 170_000)) or 170_000
        despesa_base = float(ultimo.get("despesa", 115_000)) or 115_000
        receita_crm  = novos_clientes_crm * CRM_PRECO_UNITARIO
        fator        = 1 + crescimento_pct / 100

        agora     = datetime.now()
        mes_ini   = agora.month
        ano_ini   = agora.year

        projecoes: List[Dict[str, Any]] = []
        receita_acc = despesa_acc = resultado_acc = 0.0

        for i in range(meses):
            idx_abs  = mes_ini + i - 1
            nome_mes = f"{MESES_PT[idx_abs % 12]}/{str(ano_ini + idx_abs // 12)[-2:]}"

            r = receita_base * (fator ** (i + 1)) + receita_crm
            d = despesa_base * (1 + 0.015 * (i + 1))   # crescimento orgânico de 1,5%/mês
            res = r - d
            margem = res / r * 100 if r > 0 else 0.0

            receita_acc   += r
            despesa_acc   += d
            resultado_acc += res

            projecoes.append({
                "mes":                  nome_mes,
                "receita_projetada":    round(r, 2),
                "despesa_projetada":    round(d, 2),
                "resultado_projetado":  round(res, 2),
                "margem_pct":           round(margem, 2),
                "receita_acumulada":    round(receita_acc, 2),
                "resultado_acumulado":  round(resultado_acc, 2),
            })

        # Cenários CRM paramétricos
        crm_cenarios = [
            {
                "clientes": n,
                "receita_mensal_extra": n * CRM_PRECO_UNITARIO,
                "receita_total_periodo": n * CRM_PRECO_UNITARIO * meses,
            }
            for n in (5, 10, 20)
        ]

        return {
            "parametros": {
                "crescimento_pct":      crescimento_pct,
                "novos_clientes_crm":   novos_clientes_crm,
                "valor_crm_por_cliente": CRM_PRECO_UNITARIO,
                "receita_crm_mensal":   receita_crm,
                "meses":                meses,
            },
            "projecoes":     projecoes,
            "crm_cenarios":  crm_cenarios,
            "totais": {
                "receita_acumulada":    round(receita_acc, 2),
                "despesa_acumulada":    round(despesa_acc, 2),
                "resultado_acumulado":  round(resultado_acc, 2),
            },
        }

    # ------------------------------------------------------------------
    # Cenários de corte de despesas
    # ------------------------------------------------------------------

    def get_cenarios_corte(self) -> Dict[str, Any]:
        resumo   = self._fin.get_resumo_mensal()
        historico = resumo.get("meses") or MOCK_MESES
        historico = sorted(historico, key=lambda m: (m.get("ano", 0), m.get("mes_num", 0)))

        historico_com_receita = [m for m in historico if m.get("receita", 0) > 0]
        ultimo    = historico_com_receita[-1] if historico_com_receita else historico[-1]

        despesa_base = float(ultimo.get("despesa", 138_000)) or 138_000
        receita_base = float(ultimo.get("receita", 201_000)) or 201_000
        resultado_base = receita_base - despesa_base

        def build(nome: str, descricao: str, pct: float, areas: List[str]) -> Dict[str, Any]:
            reducao      = despesa_base * pct / 100
            nova_despesa = despesa_base - reducao
            novo_res     = receita_base - nova_despesa
            nova_margem  = novo_res / receita_base * 100 if receita_base > 0 else 0.0
            return {
                "nome":               nome,
                "descricao":          descricao,
                "reducao_pct":        pct,
                "reducao_valor":      round(reducao, 2),
                "nova_despesa":       round(nova_despesa, 2),
                "novo_resultado":     round(novo_res, 2),
                "melhoria_resultado": round(novo_res - resultado_base, 2),
                "nova_margem_pct":    round(nova_margem, 2),
                "impacto_anual":      round(reducao * 12, 2),
                "areas_sugeridas":    areas,
            }

        return {
            "base": {
                "despesa_atual":    despesa_base,
                "receita_atual":    receita_base,
                "resultado_atual":  resultado_base,
                "margem_atual_pct": round(resultado_base / receita_base * 100, 2) if receita_base > 0 else 0,
            },
            "cenarios": {
                "conservador": build(
                    "Conservador",
                    "Otimizações pontuais sem impacto operacional.",
                    5.0,
                    ["Ferramentas SaaS não utilizadas", "Otimização de anúncios", "Revisão de licenças"],
                ),
                "moderado": build(
                    "Moderado",
                    "Revisão de processos e renegociação ativa de contratos.",
                    12.0,
                    ["Revisão de fornecedores", "Migração para soluções open-source", "Home office parcial"],
                ),
                "agressivo": build(
                    "Agressivo",
                    "Reestruturação profunda — máximo impacto, maior complexidade.",
                    22.0,
                    ["Revisão de equipe e terceirização", "Consolidação de escritório", "Renegociação de todos os contratos"],
                ),
            },
        }
