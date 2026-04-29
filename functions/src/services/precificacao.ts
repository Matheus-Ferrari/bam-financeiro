import { FluxoCaixaService } from "./fluxoCaixa";
import { precificacaoClassificacoesStorage } from "../lib/firestore";

type Area = "TI" | "Marketing" | "Outros";
type TipoCusto = "Salario" | "Ferramenta" | "Licenca" | "Trafego" | "Operacional" | "Outro";

interface Classificacao {
  id?: string;
  lancamento_id: string;
  area?: Area;
  tipo_custo?: TipoCusto;
  observacao?: string;
  incluir_na_precificacao?: boolean;
}

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const toFloat = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// Classificação automática (default) — usuário pode sobrescrever
function autoClassificar(l: Record<string, unknown>): { area: Area; tipo_custo: TipoCusto } {
  const desc = norm(l.descricao);
  const cat = norm(l.categoria);

  // Salários: Ferrari/Luan = TI, demais = Marketing, exceto Lucca = Outros
  const isSalario = cat.includes("salar") || desc.includes("salar");
  if (isSalario) {
    if (desc.includes("ferrari") || desc.includes("luan")) return { area: "TI", tipo_custo: "Salario" };
    if (desc.includes("lucca")) return { area: "Outros", tipo_custo: "Salario" };
    return { area: "Marketing", tipo_custo: "Salario" };
  }

  // Tráfego/Ads
  if (cat.includes("trafego") || cat.includes("ads") || desc.includes("ads") || desc.includes("trafego") || desc.includes("meta") || desc.includes("google ads")) {
    return { area: "Marketing", tipo_custo: "Trafego" };
  }

  // Ferramentas/Licenças (heurística simples)
  if (cat.includes("ferramenta") || cat.includes("software") || cat.includes("saas") || desc.includes("licenc") || desc.includes("assinatura")) {
    return { area: "Outros", tipo_custo: "Ferramenta" };
  }

  if (cat.includes("licenc")) return { area: "Outros", tipo_custo: "Licenca" };

  return { area: "Outros", tipo_custo: "Operacional" };
}

export class PrecificacaoService {
  constructor(private fluxo: FluxoCaixaService) {}

  private async loadClassMap(): Promise<Record<string, Classificacao>> {
    const all = await precificacaoClassificacoesStorage.all();
    const map: Record<string, Classificacao> = {};
    for (const c of all as unknown as Classificacao[]) {
      if (c.lancamento_id) map[c.lancamento_id] = c;
    }
    return map;
  }

  async get(params: { mes?: number; ano?: number }): Promise<Record<string, unknown>> {
    const fluxo = await this.fluxo.getFluxo({ mes: params.mes, ano: params.ano });
    const lancamentos = (fluxo.lancamentos as Record<string, unknown>[]) || [];
    const classMap = await this.loadClassMap();

    // Despesas (saídas) → custos operacionais
    const despesasRaw = lancamentos.filter((l) => l.tipo === "saida");
    const despesas = despesasRaw.map((l) => {
      const cls = classMap[String(l.id)] || {};
      const auto = autoClassificar(l);
      const incluir = cls.incluir_na_precificacao !== false; // default true
      return {
        id: l.id,
        data_competencia: l.data_competencia,
        descricao: l.descricao,
        categoria: l.categoria,
        valor_previsto: toFloat(l.valor_previsto),
        valor_realizado: toFloat(l.valor_realizado),
        valor: toFloat(l.valor_realizado) || toFloat(l.valor_previsto),
        origem: l.origem,
        fonte: l.fonte,
        status: l.status,
        area: cls.area || auto.area,
        tipo_custo: cls.tipo_custo || auto.tipo_custo,
        observacao: cls.observacao || "",
        incluir_na_precificacao: incluir,
      };
    });

    // Receitas (entradas) → ticket / receita
    const receitasRaw = lancamentos.filter((l) => l.tipo === "entrada");
    const receitas = receitasRaw.map((l) => ({
      id: l.id,
      data_competencia: l.data_competencia,
      descricao: l.descricao,
      cliente: l.cliente || l.descricao,
      categoria: l.categoria,
      valor_previsto: toFloat(l.valor_previsto),
      valor_realizado: toFloat(l.valor_realizado),
      valor: toFloat(l.valor_realizado) || toFloat(l.valor_previsto),
      status: l.status,
      fonte: l.fonte,
    }));

    // Cálculos
    const consideradas = despesas.filter((d) => d.incluir_na_precificacao);
    const custoTotal = consideradas.reduce((s, d) => s + d.valor, 0);
    const receitaTotal = receitas.reduce((s, r) => s + r.valor, 0);
    const lucro = receitaTotal - custoTotal;
    const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0;

    // Clientes ativos no mês = clientes únicos com algum valor recebido OU previsto
    const clientesMap: Record<string, { cliente: string; valor: number; previsto: number; status: string }> = {};
    for (const r of receitas) {
      const key = String(r.cliente || r.descricao || "—");
      if (!clientesMap[key]) clientesMap[key] = { cliente: key, valor: 0, previsto: 0, status: String(r.status || "") };
      clientesMap[key].valor += r.valor;
      clientesMap[key].previsto += r.valor_previsto;
    }
    const clientes = Object.values(clientesMap).filter((c) => c.valor > 0 || c.previsto > 0);
    const qtdClientes = clientes.length;
    const ticketMedio = qtdClientes > 0 ? receitaTotal / qtdClientes : 0;
    const custoMedio = qtdClientes > 0 ? custoTotal / qtdClientes : 0;

    // Distribuição por área
    const areas = ["TI", "Marketing", "Outros"] as const;
    const porArea = areas.map((a) => ({
      area: a,
      valor: consideradas.filter((d) => d.area === a).reduce((s, d) => s + d.valor, 0),
    }));

    // Distribuição por tipo
    const tipos = ["Salario", "Ferramenta", "Licenca", "Trafego", "Operacional", "Outro"] as const;
    const porTipo = tipos.map((t) => ({
      tipo: t,
      valor: consideradas.filter((d) => d.tipo_custo === t).reduce((s, d) => s + d.valor, 0),
    }));

    // Tabela de clientes enriquecida
    const clientesTabela = clientes
      .map((c) => ({
        cliente: c.cliente,
        valor_recebido: Math.round(c.valor * 100) / 100,
        valor_previsto: Math.round(c.previsto * 100) / 100,
        status: c.status,
        ticket: Math.round(c.valor * 100) / 100,
        participacao: receitaTotal > 0 ? Math.round((c.valor / receitaTotal) * 1000) / 10 : 0,
        margem_estimada: c.valor > 0 ? Math.round(((c.valor - custoMedio) / c.valor) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.valor_recebido - a.valor_recebido);

    return {
      resumo: {
        receita_total: Math.round(receitaTotal * 100) / 100,
        custo_total: Math.round(custoTotal * 100) / 100,
        lucro: Math.round(lucro * 100) / 100,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        qtd_clientes: qtdClientes,
        custo_medio_cliente: Math.round(custoMedio * 100) / 100,
        margem_percentual: Math.round(margem * 10) / 10,
      },
      por_area: porArea,
      por_tipo: porTipo,
      despesas,
      receitas,
      clientes: clientesTabela,
    };
  }

  async setClassificacao(data: Classificacao): Promise<Record<string, unknown>> {
    if (!data.lancamento_id) throw new Error("lancamento_id é obrigatório");
    const all = await precificacaoClassificacoesStorage.all();
    const existing = (all as unknown as Classificacao[]).find((c) => c.lancamento_id === data.lancamento_id);
    const payload: Record<string, unknown> = {
      lancamento_id: data.lancamento_id,
      atualizado_em: new Date().toISOString(),
    };
    if (data.area !== undefined) payload.area = data.area;
    if (data.tipo_custo !== undefined) payload.tipo_custo = data.tipo_custo;
    if (data.observacao !== undefined) payload.observacao = data.observacao;
    if (data.incluir_na_precificacao !== undefined) payload.incluir_na_precificacao = data.incluir_na_precificacao;

    if (existing && existing.id) {
      await precificacaoClassificacoesStorage.update(String(existing.id), { ...existing, ...payload });
    } else {
      await precificacaoClassificacoesStorage.create(payload);
    }
    return { ok: true };
  }
}
