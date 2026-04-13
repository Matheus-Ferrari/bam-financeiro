/**
 * financeiro.ts — FinanceiroService + ProjectionService
 * Equivalent to Python financeiro_service.py + projection_service.py
 */

import { baseReceitasStorage, baseDespesasStorage } from "../lib/firestore";

// ── Helpers ──────────────────────────────────────────────────────────────

const MES_NOME_NUM: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4,
  maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const MES_ABREV = [
  "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const CORES_CATEGORIA = [
  "#12F0C6", "#6366F1", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6",
];
const CAT_CENTRO: Record<string, string> = {
  "salarios e beneficios": "RH",
  "marketing publicidade": "MKT",
  "licencas ferramentas": "TI",
  "custos fixos": "ADM",
  "administrativo": "ADM",
  "materiais estrutura": "ADM",
};
const CRM_PRICE = 100.0;
const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Mock fallback data (2026 context)
const MOCK_MESES = [
  { mes: "Jan/26", mes_num: 1, ano: 2026, receita: 28050, a_receber: 4300, recebido: 23750, despesa: 31200, resultado: -3150, margem_pct: -11.2 },
  { mes: "Fev/26", mes_num: 2, ano: 2026, receita: 30560, a_receber: 5100, recebido: 25460, despesa: 30800, resultado: -240, margem_pct: -0.8 },
  { mes: "Mar/26", mes_num: 3, ano: 2026, receita: 30600, a_receber: 8200, recebido: 22400, despesa: 29600, resultado: 1000, margem_pct: 3.3 },
];

function normStr(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function mesLabel(mesNum: number, ano: number): string {
  return `${MES_ABREV[mesNum] || "?"}/${String(ano).slice(-2)}`;
}

function mesNomeToNum(nome: string): number {
  return MES_NOME_NUM[normStr(nome)] || 0;
}

function centroCusto(categoria: string): string {
  const norm = normStr(categoria);
  for (const [k, v] of Object.entries(CAT_CENTRO)) {
    if (k.split(" ").some((w) => norm.includes(w))) return v;
  }
  return "ADM";
}

function statusReceita(raw: unknown): string {
  if (raw == null) return "Pendente";
  return String(raw).toUpperCase().trim() === "PAGO" ? "Recebido" : "Pendente";
}

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface ReceitaDoc {
  "Mês"?: string;
  "Serviço"?: string;
  "Cliente"?: string;
  "Pagamento"?: string;
  "Dia"?: unknown;
  "Valor Previsto"?: unknown;
  "Descrição"?: string;
  "Status"?: string;
  _idx?: number;
}

export interface DespesaDoc {
  "Mês"?: string;
  "Categoria"?: string;
  "Despesa"?: string;
  "Valor"?: unknown;
  "Status"?: string;
  _idx?: number;
  id?: string;
}

// ── FinanceiroService ────────────────────────────────────────────────────

export class FinanceiroService {
  private _recCache: ReceitaDoc[] | null = null;
  private _depCache: DespesaDoc[] | null = null;
  private _cacheTs = 0;
  private readonly CACHE_TTL = 60_000;

  /** Load raw receitas from Firestore (cached). */
  async loadReceitas(): Promise<ReceitaDoc[]> {
    if (this._recCache && Date.now() - this._cacheTs < this.CACHE_TTL) {
      return this._recCache;
    }
    const docs = await baseReceitasStorage.all();
    this._recCache = docs as unknown as ReceitaDoc[];
    this._cacheTs = Date.now();
    return this._recCache;
  }

  /** Load raw despesas from Firestore (cached). */
  async loadDespesas(): Promise<DespesaDoc[]> {
    if (this._depCache && Date.now() - this._cacheTs < this.CACHE_TTL) {
      return this._depCache;
    }
    const docs = await baseDespesasStorage.all();
    this._depCache = docs as unknown as DespesaDoc[];
    return this._depCache;
  }

  /** Bust the in-memory cache (call after external writes). */
  invalidateCache(): void {
    this._recCache = null;
    this._depCache = null;
    this._cacheTs = 0;
  }

  // ── Resumo Mensal ──────────────────────────────────────────────────────

  async getResumoMensal(): Promise<Record<string, unknown>> {
    const recDocs = await this.loadReceitas();
    const depDocs = await this.loadDespesas();
    const anoRef = new Date().getFullYear();

    if (!recDocs.length && !depDocs.length) {
      const totalR = MOCK_MESES.reduce((s, m) => s + m.receita, 0);
      const totalD = MOCK_MESES.reduce((s, m) => s + m.despesa, 0);
      return { fonte: "mock", meses: MOCK_MESES, total_receita: totalR, total_despesa: totalD, total_resultado: totalR - totalD };
    }

    const resumoR: Record<number, { receita: number; recebido: number; a_receber: number }> = {};
    for (const r of recDocs) {
      const mn = mesNomeToNum(r["Mês"] || "");
      if (!mn) continue;
      const val = toFloat(r["Valor Previsto"]);
      const isPago = (r["Status"] || "").toUpperCase().trim() === "PAGO";
      if (!resumoR[mn]) resumoR[mn] = { receita: 0, recebido: 0, a_receber: 0 };
      resumoR[mn].receita += val;
      if (isPago) resumoR[mn].recebido += val;
      else resumoR[mn].a_receber += val;
    }

    const resumoD: Record<number, number> = {};
    for (const d of depDocs) {
      const mn = mesNomeToNum(d["Mês"] || "");
      if (!mn) continue;
      resumoD[mn] = (resumoD[mn] || 0) + toFloat(d["Valor"]);
    }

    const allNums = [...new Set([...Object.keys(resumoR), ...Object.keys(resumoD)])]
      .map(Number).sort((a, b) => a - b);

    const meses = allNums.map((mn) => {
      const rd = resumoR[mn] || { receita: 0, recebido: 0, a_receber: 0 };
      const d = resumoD[mn] || 0;
      const r = rd.receita;
      const res = r - d;
      return {
        mes: mesLabel(mn, anoRef), mes_num: mn, ano: anoRef,
        receita: round2(r), recebido: round2(rd.recebido), a_receber: round2(rd.a_receber),
        despesa: round2(d), resultado: round2(res),
        margem_pct: r > 0 ? round2(res / r * 100) : 0,
      };
    });

    const mesesReal = meses.filter((m) => m.receita > 0);
    const totalR = mesesReal.reduce((s, m) => s + m.receita, 0);
    const totalD = mesesReal.reduce((s, m) => s + m.despesa, 0);

    return {
      fonte: "excel", meses, anos_disponiveis: [anoRef],
      total_receita: round2(totalR), total_despesa: round2(totalD),
      total_resultado: round2(totalR - totalD),
      total_receita_all: round2(meses.reduce((s, m) => s + m.receita, 0)),
      total_despesa_all: round2(meses.reduce((s, m) => s + m.despesa, 0)),
    };
  }

  // ── KPIs ──────────────────────────────────────────────────────────────

  async getKpis(): Promise<Record<string, unknown>> {
    const resumo = await this.getResumoMensal();
    const meses = (resumo.meses as typeof MOCK_MESES) || MOCK_MESES;
    const totalR = (resumo.total_receita as number) ?? meses.reduce((s, m) => s + m.receita, 0);
    const totalD = (resumo.total_despesa as number) ?? meses.reduce((s, m) => s + m.despesa, 0);
    const totalRes = totalR - totalD;
    const margem = totalR > 0 ? totalRes / totalR * 100 : 0;

    const mesesOrd = [...meses].sort((a, b) => (a.ano * 100 + a.mes_num) - (b.ano * 100 + b.mes_num));
    const mesesComR = mesesOrd.filter((m) => m.receita > 0);
    const ultimo = mesesComR.length ? mesesComR[mesesComR.length - 1] : (mesesOrd[mesesOrd.length - 1] || {});

    const rUlt = ((ultimo as unknown as Record<string, unknown>).receita as number) || 0;
    const dUlt = ((ultimo as unknown as Record<string, unknown>).despesa as number) || 0;
    const aReceber = meses.reduce((s, m) => s + (((m as unknown as Record<string, unknown>).a_receber as number) || 0), 0);

    const recDocs = await this.loadReceitas();
    const depDocs = await this.loadDespesas();
    const nLanc = recDocs.length + depDocs.length || 24;

    let periodo = "";
    if (mesesComR.length && mesesOrd.length) {
      periodo = `${(mesesOrd[0] as unknown as Record<string, unknown>).mes} a ${(mesesComR[mesesComR.length - 1] as unknown as Record<string, unknown>).mes}`;
    } else if (mesesOrd.length) {
      periodo = String((mesesOrd[0] as unknown as Record<string, unknown>).mes || "");
    }

    return {
      fonte: resumo.fonte, periodo,
      total_receita: round2(totalR), total_despesa: round2(totalD),
      total_resultado: round2(totalRes), margem_pct: round2(margem),
      total_lancamentos: nLanc,
      receita_ultimo_mes: round2(rUlt), despesa_ultimo_mes: round2(dUlt),
      resultado_ultimo_mes: round2(rUlt - dUlt),
      mes_referencia: String((ultimo as unknown as Record<string, unknown>).mes || ""),
      a_receber: round2(aReceber),
    };
  }

  // ── Receitas ──────────────────────────────────────────────────────────

  async getReceitas(): Promise<Record<string, unknown>> {
    const docs = await this.loadReceitas();
    const anoRef = new Date().getFullYear();

    if (!docs.length) {
      return { fonte: "mock", lancamentos: [], total: 0, por_categoria: [], total_lancamentos: 0 };
    }

    const lancamentos = docs.map((row, i) => {
      const mn = mesNomeToNum(row["Mês"] || "");
      return {
        id: i + 1,
        descricao: String(row["Descrição"] || ""),
        categoria: String(row["Serviço"] || "Outros"),
        cliente: String(row["Cliente"] || ""),
        valor: toFloat(row["Valor Previsto"]),
        mes: mn ? mesLabel(mn, anoRef) : String(row["Mês"] || ""),
        mes_num: mn, ano: anoRef,
        status: statusReceita(row["Status"]),
        pagamento: String(row["Pagamento"] || ""),
      };
    });

    const porCat: Record<string, number> = {};
    for (const lc of lancamentos) {
      if (lc.valor > 0) porCat[lc.categoria || "Outros"] = (porCat[lc.categoria || "Outros"] || 0) + lc.valor;
    }
    const total = lancamentos.reduce((s, l) => s + l.valor, 0);
    const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const totCat = sorted.reduce((s, [, v]) => s + v, 0);

    return {
      fonte: "excel", lancamentos,
      total: round2(total), total_lancamentos: lancamentos.length,
      por_categoria: sorted.map(([k, v], i) => ({
        categoria: k, valor: round2(v),
        percentual: totCat > 0 ? Math.round(v / totCat * 100 * 10) / 10 : 0,
        cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
      })),
    };
  }

  // ── Despesas ──────────────────────────────────────────────────────────

  async getDespesas(): Promise<Record<string, unknown>> {
    const docs = await this.loadDespesas();
    const anoRef = new Date().getFullYear();

    if (!docs.length) {
      return { fonte: "mock", lancamentos: [], total: 0, por_categoria: [], total_lancamentos: 0 };
    }

    const lancamentos = docs.map((row, i) => {
      const mn = mesNomeToNum(row["Mês"] || "");
      const cat = String(row["Categoria"] || "Outros");
      return {
        id: i + 1,
        descricao: String(row["Despesa"] || ""),
        categoria: cat, centro_custo: centroCusto(cat),
        valor: toFloat(row["Valor"]),
        mes: mn ? mesLabel(mn, anoRef) : String(row["Mês"] || ""),
        mes_num: mn, ano: anoRef,
        status: String(row["Status"] || ""), pagamento: "",
      };
    });

    const porCat: Record<string, number> = {};
    for (const lc of lancamentos) {
      const c = lc.categoria || "Outros";
      porCat[c] = (porCat[c] || 0) + lc.valor;
    }
    const total = lancamentos.reduce((s, l) => s + l.valor, 0);
    const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    const totCat = sorted.reduce((s, [, v]) => s + v, 0);

    return {
      fonte: "excel", lancamentos,
      total: round2(total), total_lancamentos: lancamentos.length,
      por_categoria: sorted.map(([k, v], i) => ({
        categoria: k, valor: round2(v),
        percentual: totCat > 0 ? Math.round(v / totCat * 100 * 10) / 10 : 0,
        cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
      })),
    };
  }

  // ── Alertas ───────────────────────────────────────────────────────────

  async getAlertas(): Promise<Record<string, unknown>> {
    const kpis = await this.getKpis();
    const margem = (kpis.margem_pct as number) || 0;
    const totalR = (kpis.total_receita as number) || 1;
    const totalD = (kpis.total_despesa as number) || 0;
    const resUlt = (kpis.resultado_ultimo_mes as number) || 0;
    const aRec = (kpis.a_receber as number) || 0;
    const ratioD = totalR > 0 ? totalD / totalR : 0;

    const alertas: Record<string, unknown>[] = [];

    if (resUlt > 0) alertas.push({ tipo: "success", titulo: "Resultado positivo no último mês", descricao: "A operação encerrou o mês com resultado positivo.", icone: "CheckCircle" });
    else if (resUlt < 0) alertas.push({ tipo: "warning", titulo: "Resultado negativo no último mês", descricao: `Resultado de R$ ${resUlt.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} — despesas superaram receitas.`, icone: "TrendingDown" });

    if (margem >= 20) alertas.push({ tipo: "success", titulo: "Margem líquida saudável", descricao: `Margem atual de ${margem.toFixed(1)}% — performance positiva.`, icone: "TrendingUp" });
    else if (margem < 0) alertas.push({ tipo: "error", titulo: "Margem negativa — atenção crítica", descricao: `Margem atual: ${margem.toFixed(1)}%. Despesas superam receitas totais.`, icone: "AlertTriangle" });
    else alertas.push({ tipo: "warning", titulo: "Margem abaixo de 20%", descricao: `Margem atual: ${margem.toFixed(1)}%. Avalie reduções de custo.`, icone: "TrendingDown" });

    if (aRec > 0) alertas.push({ tipo: "info", titulo: `A receber: R$ ${Math.round(aRec).toLocaleString("pt-BR")}`, descricao: "Receitas pendentes de pagamento no período.", icone: "Info" });

    if (ratioD > 1.0) alertas.push({ tipo: "error", titulo: "Despesas superam receitas", descricao: "Proporção crítica — revise urgentemente os custos fixos.", icone: "AlertTriangle" });
    else if (ratioD > 0.80) alertas.push({ tipo: "warning", titulo: "Despesas acima de 80% da receita", descricao: "Proporção elevada — revise fornecedores e contratos.", icone: "AlertTriangle" });

    alertas.push({ tipo: "info", titulo: "Módulo CRM em desenvolvimento", descricao: "Cada novo cliente no CRM gera R$ 100/mês de receita adicional.", icone: "Info" });
    return { total: alertas.length, alertas };
  }

  // ── Projeções ─────────────────────────────────────────────────────────

  async getProjecoes(crescimentoPct = 10.0, novosClientesCrm = 10, meses = 6): Promise<Record<string, unknown>> {
    const resumo = await this.getResumoMensal();
    const historico = [...((resumo.meses as typeof MOCK_MESES) || MOCK_MESES)]
      .sort((a, b) => (a.ano * 100 + a.mes_num) - (b.ano * 100 + b.mes_num));
    const comReceita = historico.filter((m) => m.receita > 0);
    const ultimo = comReceita.length ? comReceita[comReceita.length - 1] : historico[historico.length - 1];

    const recBase = (ultimo?.receita || 0) || 170_000;
    const depBase = (ultimo?.despesa || 0) || 115_000;
    const recCrm = novosClientesCrm * CRM_PRICE;
    const fator = 1 + crescimentoPct / 100;
    const mesIni = new Date().getMonth();
    const anoIni = new Date().getFullYear();

    let recAcc = 0, depAcc = 0, resAcc = 0;
    const projecoes = Array.from({ length: meses }, (_, i) => {
      const idx = mesIni + i;
      const nomeMes = `${MESES_PT[idx % 12]}/${String(anoIni + Math.floor(idx / 12)).slice(-2)}`;
      const r = recBase * Math.pow(fator, i + 1) + recCrm;
      const d = depBase * (1 + 0.015 * (i + 1));
      const res = r - d;
      recAcc += r; depAcc += d; resAcc += res;
      return { mes: nomeMes, receita_projetada: round2(r), despesa_projetada: round2(d), resultado_projetado: round2(res), margem_pct: r > 0 ? round2(res / r * 100) : 0, receita_acumulada: round2(recAcc), resultado_acumulado: round2(resAcc) };
    });

    return {
      parametros: { crescimento_pct: crescimentoPct, novos_clientes_crm: novosClientesCrm, valor_crm_por_cliente: CRM_PRICE, receita_crm_mensal: recCrm, meses },
      projecoes,
      crm_cenarios: [5, 10, 20].map((n) => ({ clientes: n, receita_mensal_extra: n * CRM_PRICE, receita_total_periodo: n * CRM_PRICE * meses })),
      totais: { receita_acumulada: round2(recAcc), despesa_acumulada: round2(depAcc), resultado_acumulado: round2(resAcc) },
    };
  }

  async getCenariosCorte(): Promise<Record<string, unknown>> {
    const resumo = await this.getResumoMensal();
    const historico = [...((resumo.meses as typeof MOCK_MESES) || MOCK_MESES)]
      .sort((a, b) => (a.ano * 100 + a.mes_num) - (b.ano * 100 + b.mes_num));
    const comReceita = historico.filter((m) => m.receita > 0);
    const ultimo = comReceita.length ? comReceita[comReceita.length - 1] : historico[historico.length - 1];

    const depBase = (ultimo?.despesa || 0) || 138_000;
    const recBase = (ultimo?.receita || 0) || 201_000;
    const resBase = recBase - depBase;

    const build = (nome: string, desc: string, pct: number, areas: string[]) => {
      const reducao = depBase * pct / 100;
      const novaDep = depBase - reducao;
      const novoRes = recBase - novaDep;
      return { nome, descricao: desc, reducao_pct: pct, reducao_valor: round2(reducao), nova_despesa: round2(novaDep), novo_resultado: round2(novoRes), melhoria_resultado: round2(novoRes - resBase), nova_margem_pct: recBase > 0 ? round2(novoRes / recBase * 100) : 0, impacto_anual: round2(reducao * 12), areas_sugeridas: areas };
    };

    return {
      base: { despesa_atual: depBase, receita_atual: recBase, resultado_atual: resBase, margem_atual_pct: recBase > 0 ? round2(resBase / recBase * 100) : 0 },
      cenarios: {
        conservador: build("Conservador", "Otimizações pontuais sem impacto operacional.", 5.0, ["Ferramentas SaaS não utilizadas", "Otimização de anúncios", "Revisão de licenças"]),
        moderado: build("Moderado", "Revisão de processos e renegociação ativa de contratos.", 12.0, ["Revisão de fornecedores", "Migração para soluções open-source", "Home office parcial"]),
        agressivo: build("Agressivo", "Reestruturação profunda — máximo impacto, maior complexidade.", 22.0, ["Revisão de equipe e terceirização", "Consolidação de escritório", "Renegociação de todos os contratos"]),
      },
    };
  }
}

export const finService = new FinanceiroService();
