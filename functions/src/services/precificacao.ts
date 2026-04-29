import { FluxoCaixaService } from "./fluxoCaixa";
import {
  precificacaoClassificacoesStorage,
  precificacaoClientesStorage,
} from "../lib/firestore";

type Area = "TI" | "Marketing" | "Outros" | "Misto";
type TipoCusto = "Salario" | "Ferramenta" | "Licenca" | "Trafego" | "Operacional" | "Outro";
type TipoServico = "Site" | "CRM" | "Trafego" | "SocialMedia" | "Design" | "Automacao" | "Suporte" | "Outro";
type Responsavel = "Ferrari" | "Luan" | "Marketing" | "Outro";

interface ClassificacaoDespesa {
  id?: string;
  lancamento_id: string;
  area?: Area;
  tipo_custo?: TipoCusto;
  observacao?: string;
  incluir_na_precificacao?: boolean;
}

interface ClienteSplit {
  area: Area;
  valor: number;
}

interface ClassificacaoCliente {
  id?: string;
  cliente_key: string;
  nome_exibido?: string;
  grupo?: string;
  area?: Area;
  tipo_servico?: TipoServico;
  responsavel?: Responsavel;
  incluir_no_ticket?: boolean;
  observacao?: string;
  oculto?: boolean;
  splits?: ClienteSplit[];
}

const norm = (s: unknown): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const clienteKey = (nome: unknown): string => norm(nome).replace(/\s+/g, "_");

const toFloat = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

function autoClassificarDespesa(l: Record<string, unknown>): { area: Area; tipo_custo: TipoCusto } {
  const desc = norm(l.descricao);
  const cat = norm(l.categoria);

  const isSalario = cat.includes("salar") || desc.includes("salar");
  if (isSalario) {
    if (desc.includes("ferrari") || desc.includes("luan")) return { area: "TI", tipo_custo: "Salario" };
    if (desc.includes("lucca")) return { area: "Outros", tipo_custo: "Salario" };
    return { area: "Marketing", tipo_custo: "Salario" };
  }

  if (cat.includes("trafego") || cat.includes("ads") || desc.includes("ads") || desc.includes("trafego") || desc.includes("meta") || desc.includes("google ads")) {
    return { area: "Marketing", tipo_custo: "Trafego" };
  }

  if (cat.includes("ferramenta") || cat.includes("software") || cat.includes("saas") || desc.includes("licenc") || desc.includes("assinatura")) {
    return { area: "Outros", tipo_custo: "Ferramenta" };
  }

  if (cat.includes("licenc")) return { area: "Outros", tipo_custo: "Licenca" };

  return { area: "Outros", tipo_custo: "Operacional" };
}

export class PrecificacaoService {
  constructor(private fluxo: FluxoCaixaService) {}

  private async loadDespesaMap(): Promise<Record<string, ClassificacaoDespesa>> {
    const all = await precificacaoClassificacoesStorage.all();
    const map: Record<string, ClassificacaoDespesa> = {};
    for (const c of all as unknown as ClassificacaoDespesa[]) {
      if (c.lancamento_id) map[c.lancamento_id] = c;
    }
    return map;
  }

  private async loadClienteMap(): Promise<Record<string, ClassificacaoCliente>> {
    const all = await precificacaoClientesStorage.all();
    const map: Record<string, ClassificacaoCliente> = {};
    for (const c of all as unknown as ClassificacaoCliente[]) {
      if (c.cliente_key) map[c.cliente_key] = c;
    }
    return map;
  }

  async get(params: { mes?: number; ano?: number }): Promise<Record<string, unknown>> {
    const fluxo = await this.fluxo.getFluxo({ mes: params.mes, ano: params.ano });
    const lancamentos = (fluxo.lancamentos as Record<string, unknown>[]) || [];
    const despesaMap = await this.loadDespesaMap();
    const clienteMap = await this.loadClienteMap();

    // ── Despesas ──────────────────────────────────────────────────────
    const despesasRaw = lancamentos.filter((l) => l.tipo === "saida");
    const despesas = despesasRaw.map((l) => {
      const cls = despesaMap[String(l.id)] || {};
      const auto = autoClassificarDespesa(l);
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
        incluir_na_precificacao: cls.incluir_na_precificacao !== false,
      };
    });

    // ── Receitas (entradas) → buckets por cliente ──────────────────────
    const receitasRaw = lancamentos.filter((l) => l.tipo === "entrada");

    interface Bucket {
      cliente_original: string;
      cliente_key: string;
      valor: number;
      previsto: number;
      status: string;
    }
    const buckets: Record<string, Bucket> = {};
    for (const r of receitasRaw) {
      const nomeOriginal = String(r.cliente || r.descricao || "—");
      const key = clienteKey(nomeOriginal);
      if (!buckets[key]) {
        buckets[key] = {
          cliente_original: nomeOriginal,
          cliente_key: key,
          valor: 0,
          previsto: 0,
          status: String(r.status || ""),
        };
      }
      buckets[key].valor += toFloat(r.valor_realizado) || toFloat(r.valor_previsto);
      buckets[key].previsto += toFloat(r.valor_previsto);
    }

    // Resolver grupo final
    const resolveGrupo = (key: string, depth = 0): string => {
      if (depth > 10) return key;
      const cls = clienteMap[key];
      if (!cls?.grupo || cls.grupo === key) return key;
      return resolveGrupo(cls.grupo, depth + 1);
    };

    interface Consolidado {
      grupo_key: string;
      nome_exibido: string;
      originais: { cliente_original: string; cliente_key: string; valor: number; status: string }[];
      valor: number;
      previsto: number;
      status: string;
      area: Area;
      tipo_servico: string;
      responsavel: string;
      observacao: string;
      incluir_no_ticket: boolean;
      oculto: boolean;
      splits: ClienteSplit[];
    }
    const consolidados: Record<string, Consolidado> = {};
    const ocultos: { cliente_key: string; cliente_original: string; valor: number }[] = [];
    for (const b of Object.values(buckets)) {
      const grupoKey = resolveGrupo(b.cliente_key);
      const clsGrupo = clienteMap[grupoKey] || {};
      const clsOriginal = clienteMap[b.cliente_key] || {};
      // Se o bucket original (não o grupo) está oculto, pular completamente
      if (clsOriginal.oculto === true) {
        ocultos.push({ cliente_key: b.cliente_key, cliente_original: b.cliente_original, valor: round2(b.valor) });
        continue;
      }
      if (!consolidados[grupoKey]) {
        const nomeFallback = buckets[grupoKey]?.cliente_original || b.cliente_original;
        consolidados[grupoKey] = {
          grupo_key: grupoKey,
          nome_exibido: clsGrupo.nome_exibido || nomeFallback,
          originais: [],
          valor: 0,
          previsto: 0,
          status: b.status,
          area: clsGrupo.area || "Outros",
          tipo_servico: clsGrupo.tipo_servico || "",
          responsavel: clsGrupo.responsavel || "",
          observacao: clsGrupo.observacao || "",
          incluir_no_ticket: clsGrupo.incluir_no_ticket !== false,
          oculto: clsGrupo.oculto === true,
          splits: Array.isArray(clsGrupo.splits) ? clsGrupo.splits.filter((s) => s && s.area && Number(s.valor) > 0) : [],
        };
      }
      const c = consolidados[grupoKey];
      c.originais.push({
        cliente_original: b.cliente_original,
        cliente_key: b.cliente_key,
        valor: round2(b.valor),
        status: b.status,
      });
      c.valor += b.valor;
      c.previsto += b.previsto;
    }

    // Remove grupos cujo cliente raiz está oculto (caso o oculto esteja na chave do grupo)
    for (const k of Object.keys(consolidados)) {
      if (consolidados[k].oculto) {
        ocultos.push({ cliente_key: k, cliente_original: consolidados[k].nome_exibido, valor: round2(consolidados[k].valor) });
        delete consolidados[k];
      }
    }

    // ── Cálculos agregados ────────────────────────────────────────────
    const consideradasDespesas = despesas.filter((d) => d.incluir_na_precificacao);
    const custoTotal = consideradasDespesas.reduce((s, d) => s + d.valor, 0);
    const receitaTotal = Object.values(consolidados).reduce((s, c) => s + c.valor, 0);
    const lucro = receitaTotal - custoTotal;
    const margem = receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0;

    const clientesParaTicket = Object.values(consolidados).filter((c) => c.incluir_no_ticket && c.valor > 0);
    const qtdClientes = clientesParaTicket.length;
    const receitaTicket = clientesParaTicket.reduce((s, c) => s + c.valor, 0);
    const ticketMedio = qtdClientes > 0 ? receitaTicket / qtdClientes : 0;
    const custoMedio = qtdClientes > 0 ? custoTotal / qtdClientes : 0;

    // Custo por área
    const areas: Area[] = ["TI", "Marketing", "Outros", "Misto"];
    const custoPorArea: Record<string, number> = {};
    for (const a of areas) custoPorArea[a] = consideradasDespesas.filter((d) => d.area === a).reduce((s, d) => s + d.valor, 0);

    // Receita por área (com suporte a splits)
    const receitaPorArea: Record<string, number> = { TI: 0, Marketing: 0, Outros: 0, Misto: 0 };
    const qtdClientesPorArea: Record<string, number> = { TI: 0, Marketing: 0, Outros: 0, Misto: 0 };
    for (const c of Object.values(consolidados)) {
      if (c.splits && c.splits.length > 0) {
        const somaSplits = c.splits.reduce((s, sp) => s + Number(sp.valor || 0), 0);
        const areasContadas = new Set<string>();
        for (const sp of c.splits) {
          // Se a soma dos splits não bater com o valor recebido, ajusta proporcionalmente
          const v = somaSplits > 0 ? (Number(sp.valor) / somaSplits) * c.valor : 0;
          receitaPorArea[sp.area] = (receitaPorArea[sp.area] || 0) + v;
          areasContadas.add(sp.area);
        }
        // Conta o cliente em cada área que aparece no split
        if (c.valor > 0) {
          for (const a of areasContadas) qtdClientesPorArea[a] = (qtdClientesPorArea[a] || 0) + 1;
        }
      } else {
        receitaPorArea[c.area] = (receitaPorArea[c.area] || 0) + c.valor;
        qtdClientesPorArea[c.area] = (qtdClientesPorArea[c.area] || 0) + (c.valor > 0 ? 1 : 0);
      }
    }

    const resumoPorArea = areas.map((a) => {
      const rec = receitaPorArea[a] || 0;
      let custoArea = custoPorArea[a] || 0;
      // Misto: usa metade dos custos de TI + Marketing como referência
      if (a === "Misto") custoArea = ((custoPorArea.TI || 0) + (custoPorArea.Marketing || 0)) / 2;
      const margemArea = rec - custoArea;
      const margemPct = rec > 0 ? (margemArea / rec) * 100 : 0;
      const qtd = qtdClientesPorArea[a] || 0;
      return {
        area: a,
        receita: round2(rec),
        custo: round2(custoArea),
        margem: round2(margemArea),
        margem_percentual: round2(margemPct),
        ticket_medio: round2(qtd > 0 ? rec / qtd : 0),
        qtd_clientes: qtd,
      };
    });

    // Tabela de clientes
    const clientesTabela = Object.values(consolidados)
      .map((c) => {
        const margemEst = c.valor > 0 ? round2(((c.valor - custoMedio) / c.valor) * 100) : 0;
        return {
          grupo_key: c.grupo_key,
          cliente_key: c.grupo_key,
          nome_exibido: c.nome_exibido,
          cliente_original: c.originais.map((o) => o.cliente_original).join(" + "),
          originais: c.originais,
          valor_recebido: round2(c.valor),
          valor_previsto: round2(c.previsto),
          status: c.status,
          ticket: round2(c.valor),
          participacao: receitaTotal > 0 ? round2((c.valor / receitaTotal) * 100) : 0,
          margem_estimada: margemEst,
          area: c.area,
          tipo_servico: c.tipo_servico,
          responsavel: c.responsavel,
          incluir_no_ticket: c.incluir_no_ticket,
          observacao: c.observacao,
          splits: c.splits.map((s) => ({ area: s.area, valor: round2(Number(s.valor || 0)) })),
        };
      })
      .sort((a, b) => b.valor_recebido - a.valor_recebido);

    // Lista de clientes brutos (para dropdown "Agrupar com")
    const clientesBrutos = Object.values(buckets)
      .map((b) => ({ cliente_key: b.cliente_key, cliente_original: b.cliente_original, valor: round2(b.valor) }))
      .sort((a, b) => a.cliente_original.localeCompare(b.cliente_original));

    // Para gráfico (sem Misto)
    const porArea = (["TI", "Marketing", "Outros"] as Area[]).map((a) => ({ area: a, valor: round2(custoPorArea[a] || 0) }));

    // Custos por tipo — Operacional é separado por área (Op. TI / Op. Marketing / Op. Outros)
    const porTipoMap: Record<string, number> = {};
    for (const d of consideradasDespesas) {
      const key = d.tipo_custo === "Operacional" ? `Op. ${d.area}` : d.tipo_custo;
      porTipoMap[key] = (porTipoMap[key] || 0) + d.valor;
    }
    const tipoOrder = ["Salario", "Ferramenta", "Licenca", "Trafego", "Op. TI", "Op. Marketing", "Op. Outros", "Op. Misto", "Outro"];
    const porTipo = tipoOrder
      .filter((t) => porTipoMap[t] !== undefined)
      .map((t) => ({ tipo: t, valor: round2(porTipoMap[t] || 0) }));
    // Inclui qualquer key extra que não esteja na ordem
    for (const k of Object.keys(porTipoMap)) {
      if (!tipoOrder.includes(k)) porTipo.push({ tipo: k, valor: round2(porTipoMap[k]) });
    }

    return {
      resumo: {
        receita_total: round2(receitaTotal),
        custo_total: round2(custoTotal),
        lucro: round2(lucro),
        ticket_medio: round2(ticketMedio),
        qtd_clientes: qtdClientes,
        custo_medio_cliente: round2(custoMedio),
        margem_percentual: Math.round(margem * 10) / 10,
      },
      por_area: porArea,
      por_tipo: porTipo,
      resumo_por_area: resumoPorArea,
      despesas,
      clientes: clientesTabela,
      clientes_brutos: clientesBrutos,
      clientes_ocultos: ocultos.sort((a, b) => b.valor - a.valor),
    };
  }

  async setClassificacao(data: ClassificacaoDespesa): Promise<Record<string, unknown>> {
    if (!data.lancamento_id) throw new Error("lancamento_id é obrigatório");
    const all = await precificacaoClassificacoesStorage.all();
    const existing = (all as unknown as ClassificacaoDespesa[]).find((c) => c.lancamento_id === data.lancamento_id);
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

  async setClienteClassificacao(data: ClassificacaoCliente): Promise<Record<string, unknown>> {
    if (!data.cliente_key) throw new Error("cliente_key é obrigatório");
    const all = await precificacaoClientesStorage.all();
    const existing = (all as unknown as ClassificacaoCliente[]).find((c) => c.cliente_key === data.cliente_key);
    const payload: Record<string, unknown> = {
      cliente_key: data.cliente_key,
      atualizado_em: new Date().toISOString(),
    };
    if (data.nome_exibido !== undefined) payload.nome_exibido = data.nome_exibido;
    if (data.grupo !== undefined) payload.grupo = data.grupo || null;
    if (data.area !== undefined) payload.area = data.area;
    if (data.tipo_servico !== undefined) payload.tipo_servico = data.tipo_servico;
    if (data.responsavel !== undefined) payload.responsavel = data.responsavel;
    if (data.incluir_no_ticket !== undefined) payload.incluir_no_ticket = data.incluir_no_ticket;
    if (data.observacao !== undefined) payload.observacao = data.observacao;
    if (data.oculto !== undefined) payload.oculto = data.oculto === true;
    if (data.splits !== undefined) {
      payload.splits = Array.isArray(data.splits)
        ? data.splits
            .filter((s) => s && s.area)
            .map((s) => ({ area: s.area, valor: Number(s.valor) || 0 }))
        : [];
    }

    if (existing && existing.id) {
      await precificacaoClientesStorage.update(String(existing.id), { ...existing, ...payload });
    } else {
      await precificacaoClientesStorage.create(payload);
    }
    return { ok: true };
  }
}
