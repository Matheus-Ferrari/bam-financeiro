/**
 * saude.ts — SaudeService
 * Equivalent to Python saude_service.py
 */

import { clientesStorage, cortesStorage } from "../lib/firestore";
import { FinanceiroService } from "./financeiro";

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class SaudeService {
  constructor(private fin: FinanceiroService) {}

  async getSaude(): Promise<Record<string, unknown>> {
    const [kpis, despData, recData, clientes] = await Promise.all([
      this.fin.getKpis(),
      this.fin.getDespesas(),
      this.fin.getReceitas(),
      clientesStorage.all(),
    ]);

    const margem = (kpis.margem_pct as number) || 0;
    const totalR = (kpis.total_receita as number) || 0;
    const totalD = (kpis.total_despesa as number) || 0;
    const aRec = (kpis.a_receber as number) || 0;

    const score = this._calcularScore(margem, totalR, totalD, clientes);
    const semaforo = score >= 65 ? "verde" : score >= 40 ? "amarelo" : "vermelho";

    const porCat = (despData.por_categoria as Record<string, unknown>[]) || [];
    const lancReceitaRaw = (recData.lancamentos as Record<string, unknown>[]) || [];
    const concCliente = this._concentracaoCliente(lancReceitaRaw);
    const riscos = this._gerarRiscos(margem, totalR, totalD, aRec, concCliente, porCat);
    const recomendacoes = this._gerarRecomendacoes(margem, riscos, clientes);

    return {
      score, semaforo, margem_pct: round2(margem),
      total_receita: round2(totalR), total_despesa: round2(totalD),
      resultado: round2(totalR - totalD), a_receber: round2(aRec),
      equilibrio_pct: totalR > 0 ? Math.round(totalD / totalR * 100 * 10) / 10 : 0,
      concentracao_cliente: concCliente, por_categoria_despesa: porCat,
      riscos, recomendacoes,
    };
  }

  async getInsights(): Promise<Record<string, unknown>> {
    const [kpis, resumo, despData, cortes, clientes] = await Promise.all([
      this.fin.getKpis(),
      this.fin.getResumoMensal(),
      this.fin.getDespesas(),
      cortesStorage.all(),
      clientesStorage.all(),
    ]);

    const meses = (resumo.meses as Record<string, number>[]) || [];
    const mesesReal = meses.filter((m) => m.receita > 0);
    const insights: Record<string, unknown>[] = [];

    if (mesesReal.length >= 2) {
      const primeira = mesesReal[0].margem_pct || 0;
      const ultima = mesesReal[mesesReal.length - 1].margem_pct || 0;
      const delta = ultima - primeira;
      if (delta > 2) insights.push({ tipo: "positive", titulo: "Margem em tendência crescente", descricao: `Margem evoluiu de ${primeira.toFixed(1)}% para ${ultima.toFixed(1)}% nos últimos meses.`, icone: "TrendingUp" });
      else if (delta < -2) insights.push({ tipo: "warning", titulo: "Margem em queda", descricao: `Margem caiu de ${primeira.toFixed(1)}% para ${ultima.toFixed(1)}%. Monitorar despesas.`, icone: "TrendingDown" });
    }

    if (mesesReal.length) {
      const ult = mesesReal[mesesReal.length - 1];
      if ((ult.resultado || 0) > 0) insights.push({ tipo: "positive", titulo: `Resultado positivo em ${ult.mes}`, descricao: `Saldo de R$ ${Math.round(ult.resultado).toLocaleString("pt-BR")} no último mês — operação saudável.`, icone: "CheckCircle" });
    }

    const cortesAtivos = cortes.filter((c) => c.ativo !== false);
    if (cortesAtivos.length) {
      const economia = cortesAtivos.reduce((s, c) => s + toFloat(c.economia_mensal), 0);
      insights.push({ tipo: "info", titulo: `${cortesAtivos.length} corte(s) ativo(s) planejado(s)`, descricao: `Economia mensal potencial de R$ ${Math.round(economia).toLocaleString("pt-BR")} se todos forem aplicados.`, icone: "Scissors" });
    }

    const ativos = clientes.filter((c) => c.status === "ativo");
    if (ativos.length) {
      const receitaCli = ativos.reduce((s, c) => s + toFloat(c.valor_mensal), 0);
      insights.push({ tipo: "positive", titulo: `${ativos.length} cliente(s) ativo(s) cadastrado(s)`, descricao: `Receita mensal estimada de R$ ${Math.round(receitaCli).toLocaleString("pt-BR")} via gestão de clientes.`, icone: "Users" });
    }

    const aRec = (kpis.a_receber as number) || 0;
    const totalRKpi = (kpis.total_receita as number) || 1;
    if (totalRKpi > 0 && aRec / totalRKpi > 0.3) {
      insights.push({ tipo: "warning", titulo: "Alto volume a receber", descricao: `R$ ${Math.round(aRec).toLocaleString("pt-BR")} (${(aRec / totalRKpi * 100).toFixed(0)}% da receita) ainda não foi recebida.`, icone: "Clock" });
    }

    const porCat = (despData.por_categoria as Record<string, unknown>[]) || [];
    if (porCat.length) {
      const top = porCat[0];
      insights.push({ tipo: "info", titulo: `Maior despesa: ${top.categoria}`, descricao: `Representa R$ ${Math.round(toFloat(top.valor)).toLocaleString("pt-BR")} (${top.percentual}% das despesas).`, icone: "BarChart2" });
    }

    return { insights, total: insights.length };
  }

  private _calcularScore(margem: number, receita: number, despesa: number, clientes: Record<string, unknown>[]): number {
    let score = 50;
    if (margem >= 20) score += 30;
    else if (margem >= 10) score += 15;
    else if (margem >= 0) score += 5;
    else if (margem >= -10) score -= 10;
    else score -= 25;

    if (receita > 0) {
      const ratio = despesa / receita;
      if (ratio < 0.7) score += 15;
      else if (ratio < 0.9) score += 5;
      else if (ratio > 1.0) score -= 20;
    }

    const ativos = clientes.filter((c) => c.status === "ativo").length;
    if (ativos >= 5) score += 10;
    else if (ativos >= 2) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private _concentracaoCliente(lancamentos: Record<string, unknown>[]): Record<string, unknown> {
    const totais: Record<string, number> = {};
    for (const lc of lancamentos) {
      const c = (lc.cliente as string) || "Desconhecido";
      totais[c] = (totais[c] || 0) + toFloat(lc.valor);
    }
    if (!Object.keys(totais).length) return { top_clientes: [], concentracao_top3_pct: 0 };
    const total = Object.values(totais).reduce((s, v) => s + v, 0);
    const top = Object.entries(totais).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const top3 = top.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    return {
      top_clientes: top.map(([k, v]) => ({ cliente: k, valor: round2(v), pct: total > 0 ? Math.round(v / total * 100 * 10) / 10 : 0 })),
      concentracao_top3_pct: total > 0 ? Math.round(top3 / total * 100 * 10) / 10 : 0,
    };
  }

  private _gerarRiscos(margem: number, receita: number, despesa: number, aReceber: number, conc: Record<string, unknown>, porCat: Record<string, unknown>[]): Record<string, unknown>[] {
    const riscos: Record<string, unknown>[] = [];
    if (margem < 0) riscos.push({ nivel: "critico", titulo: "Margem negativa", descricao: `Despesas superam receitas em ${Math.abs(margem).toFixed(1)}%.`, icone: "XCircle" });
    else if (margem < 10) riscos.push({ nivel: "alto", titulo: "Margem muito baixa", descricao: `Margem de ${margem.toFixed(1)}% oferece pouca segurança.`, icone: "AlertTriangle" });

    if ((conc.concentracao_top3_pct as number) > 60) riscos.push({ nivel: "medio", titulo: "Concentração de receita", descricao: `Top 3 clientes representam ${conc.concentracao_top3_pct}% da receita.`, icone: "Users" });

    if (receita > 0 && aReceber / receita > 0.4) riscos.push({ nivel: "medio", titulo: "Alto volume a receber", descricao: "Mais de 40% da receita ainda não foi efetivamente recebida.", icone: "Clock" });

    if (porCat.length && (porCat[0].percentual as number) > 50) riscos.push({ nivel: "medio", titulo: `Concentração em ${porCat[0].categoria}`, descricao: `Responde por ${porCat[0].percentual}% das despesas.`, icone: "PieChart" });
    return riscos;
  }

  private _gerarRecomendacoes(margem: number, riscos: Record<string, unknown>[], clientes: Record<string, unknown>[]): string[] {
    const recs: string[] = [];
    if (margem < 0) recs.push("Prioridade máxima: reverter resultado negativo — revisar despesas fixas imediatamente.");
    else if (margem < 15) recs.push("Elevar margem acima de 15% via controle de custos ou aumento de receita.");
    const ativos = clientes.filter((c) => c.status === "ativo");
    if (ativos.length < 3) recs.push("Diversificar base de clientes para reduzir dependência de poucos contratos.");
    if (riscos.some((r) => r.nivel === "critico")) recs.push("Fazer reunião de revisão financeira urgente com os sócios.");
    recs.push("Manter planilha de controle atualizada mensalmente para rastreabilidade.");
    return recs;
  }
}
