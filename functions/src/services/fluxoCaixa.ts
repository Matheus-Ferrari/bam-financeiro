/**
 * fluxoCaixa.ts — FluxoCaixaService
 * Equivalent to Python fluxo_caixa_service.py
 */

import {
  caixaStorage,
  clientesStorage,
  conciliacaoStorage,
  movimentacoesStorage,
  statusOverridesStorage,
  fechamentoStorage,
} from "../lib/firestore";
import { FinanceiroService, ReceitaDoc, DespesaDoc } from "./financeiro";
import * as calendar from "../lib/calendar";

const MES_NOME_NUM: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4,
  maio: 5, junho: 6, julho: 7, agosto: 8,
  setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const FIXAS_KEYWORDS = ["salario", "beneficio", "fixo", "fixas", "administrativo", "licenca", "ferramenta", "infraestrutura"];
const STATUS_CONCILIACAO = new Set(["conciliado", "pendente", "divergente"]);

function norm(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function clean(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s.toLowerCase() === "nan" ? "" : s;
}

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

function mesNum(nome: string): number {
  return MES_NOME_NUM[norm(nome)] || 0;
}

function mesToIso(nome: string, ano: number): string | null {
  const num = mesNum(nome);
  return num ? `${ano}-${String(num).padStart(2, "0")}-01` : null;
}

function origemDespesa(categoria: string): string {
  const words = norm(categoria).split(" ");
  return words.some((w) => FIXAS_KEYWORDS.some((k) => w.includes(k))) ? "despesa_fixa" : "despesa_variavel";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function caixaAtualSync(registros: Record<string, unknown>[]): number {
  const sorted = [...registros].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  return sorted.length ? toFloat(sorted[0].valor_atual) : 0;
}

export class FluxoCaixaService {
  constructor(private fin: FinanceiroService) {}

  private async concMap(): Promise<Record<string, Record<string, unknown>>> {
    const all = await conciliacaoStorage.all();
    const map: Record<string, Record<string, unknown>> = {};
    for (const r of all) {
      const lid = String(r.lancamento_id || "");
      if (lid) map[lid] = r;
    }
    return map;
  }

  private async statusMap(): Promise<Record<string, Record<string, unknown>>> {
    const all = await statusOverridesStorage.all();
    const map: Record<string, Record<string, unknown>> = {};
    for (const r of all) {
      const lid = String(r.lancamento_id || "");
      if (lid) map[lid] = r;
    }
    return map;
  }

  private async buildReceitas(cm: Record<string, Record<string, unknown>>, sm: Record<string, Record<string, unknown>>): Promise<Record<string, unknown>[]> {
    const docs = await this.fin.loadReceitas();
    const ano = new Date().getFullYear();
    return docs.map((row: ReceitaDoc, i: number) => {
      const mesNome = clean(row["Mês"]);
      const dataComp = mesToIso(mesNome, ano);
      if (!dataComp) return null;
      const statusRaw = clean(row["Status"]).toUpperCase();
      let status = statusRaw === "PAGO" ? "recebido" : "previsto";
      const valorPrev = toFloat(row["Valor Previsto"]);
      const lid = `rec_${i + 1}`;
      const conc = cm[lid] || {};
      const ov = sm[lid] || {};
      if (ov.status) status = String(ov.status);
      const valorReal = ov.valor_realizado != null ? toFloat(ov.valor_realizado) : status === "recebido" ? valorPrev : 0;
      return {
        id: lid, data_competencia: dataComp, data_vencimento: dataComp,
        data_pagamento: status === "recebido" ? dataComp : null,
        descricao: clean(row["Descrição"]) || clean(row["Serviço"]) || "Receita",
        cliente: clean(row["Cliente"]), categoria: clean(row["Serviço"]) || "Receita",
        subcategoria: "", tipo: "entrada",
        valor_previsto: round2(valorPrev), valor_realizado: round2(valorReal),
        status, recorrente: true, origem: "cliente_mensal",
        forma_pagamento: clean(row["Pagamento"]), conta_financeira: "conta_principal",
        conciliado: conc.status_conciliacao === "conciliado",
        status_conciliacao: conc.status_conciliacao || "pendente",
        observacao: conc.observacao || "", fonte: "excel",
      };
    }).filter(Boolean) as Record<string, unknown>[];
  }

  private async buildDespesas(cm: Record<string, Record<string, unknown>>, sm: Record<string, Record<string, unknown>>): Promise<Record<string, unknown>[]> {
    const docs = await this.fin.loadDespesas();
    const ano = new Date().getFullYear();
    return docs.map((row: DespesaDoc, i: number) => {
      const mesNome = clean(row["Mês"]);
      const dataComp = mesToIso(mesNome, ano);
      if (!dataComp) return null;
      const statusRaw = clean(row["Status"]).toUpperCase();
      let status = statusRaw === "PAGO" ? "pago" : "previsto";
      const valor = toFloat(row["Valor"]);
      const categoria = clean(row["Categoria"]) || "Despesa";
      const lid = `dep_${i + 1}`;
      const conc = cm[lid] || {};
      const ov = sm[lid] || {};
      if (ov.status) status = String(ov.status);
      const valorReal = ov.valor_realizado != null ? toFloat(ov.valor_realizado) : status === "pago" ? valor : 0;
      return {
        id: lid, data_competencia: dataComp, data_vencimento: dataComp,
        data_pagamento: status === "pago" ? dataComp : null,
        descricao: clean(row["Despesa"]) || categoria,
        cliente: "", categoria, subcategoria: "", tipo: "saida",
        valor_previsto: round2(valor), valor_realizado: round2(valorReal),
        status, recorrente: false, origem: origemDespesa(categoria),
        forma_pagamento: "", conta_financeira: "conta_principal",
        conciliado: conc.status_conciliacao === "conciliado",
        status_conciliacao: conc.status_conciliacao || "pendente",
        observacao: conc.observacao || "", fonte: "excel",
      };
    }).filter(Boolean) as Record<string, unknown>[];
  }

  // ── Fechamento como fonte de verdade ──────────────────────────────────

  private async loadFechamentoMap(): Promise<Record<string, Record<string, unknown>>> {
    const all = await fechamentoStorage.all();
    const map: Record<string, Record<string, unknown>> = {};
    for (const f of all) {
      const comp = String(f.competencia || "").slice(0, 7);
      if (comp) map[comp] = f as Record<string, unknown>;
    }
    return map;
  }

  /**
   * Converte fechamento.despesas_previstas + novos_gastos para o formato
   * unificado de lançamentos do Fluxo de Caixa.
   * Usado quando há fechamento para a competência, substituindo base_despesas.
   */
  private buildDespesasFromFechamento(
    fech: Record<string, unknown>,
    competencia: string,
    cm: Record<string, Record<string, unknown>>
  ): Record<string, unknown>[] {
    const despPrev = (fech.despesas_previstas as Record<string, unknown>[]) || [];
    const novosGastos = (fech.novos_gastos as Record<string, unknown>[]) || [];
    const todos = [...despPrev, ...novosGastos];
    const [ano, mes] = competencia.split("-");
    const dataComp = `${ano}-${mes}-01`;

    return todos.map((item, i) => {
      const statusRaw = String(item.status || "previsto").toLowerCase();
      const isPago = statusRaw === "pago";
      const valor = toFloat(item.valor);
      const venc = item.vencimento ? String(item.vencimento).slice(0, 10) : dataComp;
      const lid = `fech_${competencia}_${i + 1}`;
      const conc = cm[lid] || {};
      return {
        id: lid,
        data_competencia: dataComp,
        data_vencimento: venc,
        data_pagamento: isPago ? venc : null,
        descricao: String(item.descricao || item.nome || `Despesa ${i + 1}`),
        cliente: "",
        categoria: String(item.categoria || "Despesa"),
        subcategoria: "",
        tipo: "saida",
        valor_previsto: round2(valor),
        valor_realizado: round2(isPago ? valor : 0),
        status: isPago ? "pago" : "previsto",
        recorrente: false,
        // Preserva 'origem' explícita do item (ex: 'cartao') caso definida; senão infere pela categoria
        // Também respeita o flag 'cartao: true' salvo pelo frontend
        origem: item.cartao ? "cartao" : (String(item.origem || "") || origemDespesa(String(item.categoria || ""))),
        forma_pagamento: "",
        conta_financeira: "conta_principal",
        conciliado: (conc as any).status_conciliacao === "conciliado",
        status_conciliacao: (conc as any).status_conciliacao || "pendente",
        observacao: String(item.observacao || ""),
        fonte: "fechamento",
      };
    });
  }

  /**
   * Constrói a lista de despesas para o Fluxo de Caixa priorizando o
   * fechamento do mês quando disponível, com fallback para base_despesas.
   */
  private async buildDespesasComFechamento(
    cm: Record<string, Record<string, unknown>>,
    sm: Record<string, Record<string, unknown>>,
    fechMap: Record<string, Record<string, unknown>>
  ): Promise<Record<string, unknown>[]> {
    const baseDespesas = await this.buildDespesas(cm, sm);
    const result: Record<string, unknown>[] = [];
    const fechMonths = new Set<string>();

    for (const [comp, fech] of Object.entries(fechMap)) {
      const items = (fech.despesas_previstas as Record<string, unknown>[]) || [];
      if (items.length > 0) {
        fechMonths.add(comp);
        result.push(...this.buildDespesasFromFechamento(fech, comp, cm));
      }
    }
    // Meses sem fechamento: usa base_despesas normalmente
    for (const d of baseDespesas) {
      if (!fechMonths.has(String(d.data_competencia || "").slice(0, 7))) {
        result.push(d);
      }
    }
    return result;
  }

  private async buildManuais(cm: Record<string, Record<string, unknown>>, sm: Record<string, Record<string, unknown>>): Promise<Record<string, unknown>[]> {
    const movs = await movimentacoesStorage.all();
    return movs
      .filter((m) => m.tipo !== "ajuste_caixa")
      .map((m) => {
        const lid = `mov_${m.id || ""}`;
        const conc = cm[lid] || {};
        const ov = sm[lid] || {};
        const tipoRaw = String(m.tipo || "").toLowerCase();
        let tipo: string, statusDerived: string;
        if (["entrada", "recebimento"].includes(tipoRaw)) { tipo = "entrada"; statusDerived = "recebido"; }
        else if (["saida", "despesa", "pagamento"].includes(tipoRaw)) { tipo = "saida"; statusDerived = "pago"; }
        else { tipo = tipoRaw; statusDerived = "previsto"; }
        const dataStr = String(ov.data_competencia || m.data_competencia || m.data || "").slice(0, 10);
        // status: override de statusOverridesStorage > documento movimentacoes > derivado do tipo
        const status = ov.status ? String(ov.status) : (m.status ? String(m.status) : statusDerived);
        const valorPrev = toFloat(ov.valor_previsto ?? m.valor_previsto ?? m.valor);
        const valorReal = ov.valor_realizado != null
          ? toFloat(ov.valor_realizado)
          : toFloat(m.valor_realizado ?? (status === "recebido" || status === "pago" ? valorPrev : 0));
        return {
          id: lid, data_competencia: dataStr, data_vencimento: dataStr,
          data_pagamento: (status === "recebido" || status === "pago") ? dataStr : null,
          descricao: String(ov.descricao || m.descricao || "Lançamento manual"),
          cliente: String(ov.cliente || m.cliente || m.cliente_relacionado || ""),
          categoria: String(ov.categoria || m.categoria || "manual"), subcategoria: "",
          tipo: String(ov.tipo || tipo),
          valor_previsto: round2(valorPrev), valor_realizado: round2(valorReal),
          status, recorrente: false, origem: String(ov.origem || m.origem || "ajuste_manual"),
          forma_pagamento: "", conta_financeira: "conta_principal",
          conciliado: conc.status_conciliacao === "conciliado",
          status_conciliacao: conc.status_conciliacao || "pendente",
          observacao: m.observacao || conc.observacao || "", fonte: "manual",
        };
      });
  }

  private async buildClientes(cm: Record<string, Record<string, unknown>>, sm: Record<string, Record<string, unknown>>, mes?: number, ano?: number, fechMap?: Record<string, Record<string, unknown>>): Promise<Record<string, unknown>[]> {
    const hoje = new Date();
    const mesRef = mes ?? hoje.getMonth() + 1;
    const anoRef = ano ?? hoje.getFullYear();
    const competencia = `${anoRef}-${String(mesRef).padStart(2, "0")}`;
    const clientes = await clientesStorage.all();

    const base = clientes
      .filter((c) => c.status === "ativo")
      .map((c) => {
        const valor = toFloat(c.valor_previsto || c.valor_mensal || 0);
        if (valor <= 0) return null;
        const dia = Math.min(parseInt(String(c.dia_pagamento || "1")), calendar.daysInMonth(anoRef, mesRef));
        const dataComp = `${anoRef}-${String(mesRef).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        const statusPgto = String(c.status_pagamento || "pendente").toLowerCase();
        let status = statusPgto === "pago" ? "recebido" : statusPgto === "atrasado" ? "vencido" : "previsto";

        // Meses futuros nunca podem estar recebidos automaticamente —
        // o campo status_pagamento do cliente reflete o pagamento atual,
        // não pagamentos que ainda não ocorreram.
        const hoje = new Date();
        const isFuturo = anoRef > hoje.getFullYear() ||
          (anoRef === hoje.getFullYear() && mesRef > hoje.getMonth() + 1);
        if (isFuturo && status !== "previsto") status = "previsto";

        const lid = `cli_${c.id}_${anoRef}${String(mesRef).padStart(2, "0")}`;
        const conc = cm[lid] || {};
        const ov = sm[lid] || {};
        // Override manual do usuário sempre prevalece (mesmo em meses futuros)
        if (ov.status) status = String(ov.status);
        const valorReal = ov.valor_realizado != null ? toFloat(ov.valor_realizado) : status === "recebido" ? toFloat(c.valor_recebido || valor) : 0;
        const valPrev = toFloat(ov.valor_previsto || valor);

        return {
          id: lid,
          data_competencia: ov.data_competencia || dataComp,
          data_vencimento: dataComp,
          data_pagamento: status === "recebido" ? c.data_pagamento || null : null,
          descricao: ov.descricao || c.nome || "Cliente",
          cliente: ov.cliente || c.nome || "",
          categoria: ov.categoria || "Mensalidade",
          subcategoria: "", tipo: ov.tipo || "entrada",
          valor_previsto: round2(valPrev), valor_realizado: round2(valorReal),
          status, recorrente: true, origem: ov.origem || "cliente_mensal",
          forma_pagamento: "", conta_financeira: "conta_principal",
          conciliado: conc.status_conciliacao === "conciliado",
          status_conciliacao: conc.status_conciliacao || "pendente",
          observacao: conc.observacao || "", fonte: "cliente",
        };
      }).filter(Boolean) as Record<string, unknown>[];

    // Include manual clients from fechamento.clientes_extras (not in Firestore clientes)
    const fech = fechMap ? fechMap[competencia] : null;
    const extras = (fech?.clientes_extras as Record<string, unknown>[]) || [];
    const existingIds = new Set(base.map((l) => String(l.cliente || "")));
    const extrasLanc = extras
      .filter((ex) => !existingIds.has(String(ex.nome || "")))
      .map((ex, i) => {
        const valor = toFloat(ex.valor_previsto || ex.valor_mensal || ex.valor || 0);
        const isPago = String(ex.status_pagamento || "pendente").toLowerCase() === "pago";
        const dataComp = `${anoRef}-${String(mesRef).padStart(2, "0")}-01`;
        const lid = `fech_cli_${competencia}_${i + 1}`;
        const conc = cm[lid] || {};
        return {
          id: lid,
          data_competencia: dataComp,
          data_vencimento: dataComp,
          data_pagamento: isPago ? (ex.data_pagamento || null) : null,
          descricao: String(ex.nome || `Cliente extra ${i + 1}`),
          cliente: String(ex.nome || ""),
          categoria: "Mensalidade",
          subcategoria: "", tipo: "entrada",
          valor_previsto: round2(valor),
          valor_realizado: round2(isPago ? toFloat(ex.valor_recebido || valor) : 0),
          status: isPago ? "recebido" : "previsto",
          recorrente: false, origem: "cliente_mensal",
          forma_pagamento: "", conta_financeira: "conta_principal",
          conciliado: (conc as any).status_conciliacao === "conciliado",
          status_conciliacao: (conc as any).status_conciliacao || "pendente",
          observacao: String(ex.observacao_pagamento || ""), fonte: "cliente_extra",
        };
      });

    return [...base, ...extrasLanc];
  }

  private applyFieldOverrides(todos: Record<string, unknown>[], sm: Record<string, Record<string, unknown>>): Record<string, unknown>[] {
    const fields = ["data_competencia", "descricao", "cliente", "categoria", "tipo", "origem", "valor_previsto"];
    return todos.map((l) => {
      if (l.fonte === "cliente") return l;
      const ov = sm[l.id as string] || {};
      if (!Object.keys(ov).length) return l;
      const updated = { ...l };
      for (const f of fields) if (ov[f] != null) updated[f] = ov[f];
      // Aplicar status e valor_realizado do override (crítico para fech_ e rec_ entries)
      if (ov.status != null) {
        updated.status = ov.status;
        const isPago = ov.status === "pago" || ov.status === "recebido";
        if (ov.valor_realizado != null) {
          updated.valor_realizado = toFloat(ov.valor_realizado);
        } else if (isPago && toFloat(updated.valor_realizado) === 0) {
          updated.valor_realizado = toFloat(updated.valor_previsto);
        }
        // Preencher data_pagamento quando status = pago/recebido
        if (isPago && !updated.data_pagamento) {
          updated.data_pagamento = String(ov.atualizado_em || updated.data_vencimento || updated.data_competencia || "").slice(0, 10) || null;
        }
        if (!isPago) {
          updated.data_pagamento = null;
          updated.valor_realizado = 0;
        }
      } else if (ov.valor_realizado != null) {
        updated.valor_realizado = toFloat(ov.valor_realizado);
      }
      return updated;
    });
  }

  async getFluxo(params: { mes?: number; ano?: number; tipo?: string; status?: string; cliente?: string; categoria?: string }): Promise<Record<string, unknown>> {
    const { mes, ano, tipo, status, cliente, categoria } = params;
    const anoRef = ano || new Date().getFullYear();
    const [cm, sm, fechMap] = await Promise.all([this.concMap(), this.statusMap(), this.loadFechamentoMap()]);

    // Se não há mês específico, constrói clientes para todos os 12 meses do ano
    let cliLanc: Record<string, unknown>[];
    if (mes) {
      cliLanc = await this.buildClientes(cm, sm, mes, anoRef, fechMap);
    } else {
      const arrays = await Promise.all(
        Array.from({ length: 12 }, (_, i) => this.buildClientes(cm, sm, i + 1, anoRef, fechMap))
      );
      cliLanc = arrays.flat();
    }

    const despesasLanc = await this.buildDespesasComFechamento(cm, sm, fechMap);
    const excelLanc = [...await this.buildReceitas(cm, sm), ...despesasLanc, ...await this.buildManuais(cm, sm)];

    const cliMonths = new Set(cliLanc.filter((l) => l.cliente).map((l) => `${norm(String(l.cliente))}|${String(l.data_competencia || "").slice(0, 7)}`));
    const deduped = excelLanc.filter((l) => !(String(l.id || "").startsWith("rec_") && l.cliente && cliMonths.has(`${norm(String(l.cliente))}|${String(l.data_competencia || "").slice(0, 7)}`)));
    let todos = this.applyFieldOverrides([...deduped, ...cliLanc], sm);

    if (mes) todos = todos.filter((l) => String(l.data_competencia || "").startsWith(`${anoRef}-${String(mes).padStart(2, "0")}`));
    else if (ano) todos = todos.filter((l) => String(l.data_competencia || "").startsWith(String(anoRef)));
    if (tipo && ["entrada", "saida"].includes(tipo)) todos = todos.filter((l) => l.tipo === tipo);
    if (status) todos = todos.filter((l) => String(l.status || "").toLowerCase() === status.toLowerCase());
    if (cliente) { const q = cliente.toLowerCase(); todos = todos.filter((l) => String(l.cliente || "").toLowerCase().includes(q)); }
    if (categoria) { const q = categoria.toLowerCase(); todos = todos.filter((l) => String(l.categoria || "").toLowerCase().includes(q)); }
    todos.sort((a, b) => String(a.data_competencia || "").localeCompare(String(b.data_competencia || "")));

    const entPrev = todos.filter((l) => l.tipo === "entrada").reduce((s, l) => s + toFloat(l.valor_previsto), 0);
    const entReal = todos.filter((l) => l.tipo === "entrada").reduce((s, l) => s + toFloat(l.valor_realizado), 0);
    const saiPrev = todos.filter((l) => l.tipo === "saida").reduce((s, l) => s + toFloat(l.valor_previsto), 0);
    const saiReal = todos.filter((l) => l.tipo === "saida").reduce((s, l) => s + toFloat(l.valor_realizado), 0);

    const caixaRegs = await caixaStorage.all();
    const saldoIni = caixaAtualSync(caixaRegs);
    const conciliados = todos.filter((l) => l.conciliado).length;

    return {
      saldo_inicial: round2(saldoIni),
      total_entradas_previsto: round2(entPrev), total_entradas_realizado: round2(entReal),
      total_saidas_previsto: round2(saiPrev), total_saidas_realizado: round2(saiReal),
      saldo_final_previsto: round2(saldoIni + entPrev - saiPrev),
      saldo_final_realizado: round2(saldoIni + entReal - saiReal),
      divergencia: round2(saldoIni + entReal - saiReal - (saldoIni + entPrev - saiPrev)),
      total_conciliados: conciliados, total_pendentes_conciliacao: todos.length - conciliados,
      total_lancamentos: todos.length, lancamentos: todos,
    };
  }

  async getConciliacao(mes?: number, ano?: number): Promise<Record<string, unknown>> {
    const anoRef = ano || new Date().getFullYear();
    const [cm, sm, fechMap] = await Promise.all([this.concMap(), this.statusMap(), this.loadFechamentoMap()]);

    // Se não há mês específico, constrói clientes para todos os 12 meses do ano
    let cliLanc: Record<string, unknown>[];
    if (mes) {
      cliLanc = await this.buildClientes(cm, sm, mes, anoRef, fechMap);
    } else {
      const arrays = await Promise.all(
        Array.from({ length: 12 }, (_, i) => this.buildClientes(cm, sm, i + 1, anoRef, fechMap))
      );
      cliLanc = arrays.flat();
    }

    const despesasLanc = await this.buildDespesasComFechamento(cm, sm, fechMap);
    const excelLanc = [...await this.buildReceitas(cm, sm), ...despesasLanc, ...await this.buildManuais(cm, sm)];
    const cliMonths = new Set(cliLanc.filter((l) => l.cliente).map((l) => `${norm(String(l.cliente))}|${String(l.data_competencia || "").slice(0, 7)}`));
    const deduped = excelLanc.filter((l) => !(String(l.id || "").startsWith("rec_") && l.cliente && cliMonths.has(`${norm(String(l.cliente))}|${String(l.data_competencia || "").slice(0, 7)}`)));
    let todos = this.applyFieldOverrides([...deduped, ...cliLanc], sm);

    if (mes) todos = todos.filter((l) => String(l.data_competencia || "").startsWith(`${anoRef}-${String(mes).padStart(2, "0")}`));

    const conciliados = todos.filter((l) => l.status_conciliacao === "conciliado");
    const pendentes = todos.filter((l) => l.status_conciliacao === "pendente");
    const divergentes = todos.filter((l) => l.status_conciliacao === "divergente");
    const total = todos.length;

    return {
      total_lancamentos: total,
      total_conciliado: conciliados.length, total_pendente: pendentes.length, total_divergente: divergentes.length,
      percentual_conciliado: total > 0 ? Math.round(conciliados.length / total * 100 * 10) / 10 : 0,
      valor_conciliado: round2(conciliados.reduce((s, l) => s + toFloat(l.valor_previsto), 0)),
      valor_pendente: round2(pendentes.reduce((s, l) => s + toFloat(l.valor_previsto), 0)),
      valor_divergente: round2(divergentes.reduce((s, l) => s + toFloat(l.valor_previsto), 0)),
      lancamentos: todos,
    };
  }

  async marcarConciliacao(lancamentoId: string, statusConciliacao: string, observacao = "", valorExtrato?: number): Promise<Record<string, unknown>> {
    if (!STATUS_CONCILIACAO.has(statusConciliacao)) throw new Error(`status_conciliacao deve ser um de ${[...STATUS_CONCILIACAO].join(", ")}`);
    const cm = await this.concMap();
    const existing = cm[lancamentoId];
    const payload: Record<string, unknown> = { lancamento_id: lancamentoId, status_conciliacao: statusConciliacao, observacao, data_conciliacao: new Date().toISOString() };
    if (valorExtrato != null) payload.valor_extrato = valorExtrato;
    if (existing) await conciliacaoStorage.update(String(existing.id), payload);
    else await conciliacaoStorage.create(payload);
    return { ok: true, lancamento_id: lancamentoId, status: statusConciliacao };
  }

  async updateStatus(lancamentoId: string, status: string, valorRealizado?: number): Promise<Record<string, unknown>> {
    const sm = await this.statusMap();
    const existing = sm[lancamentoId];
    const payload: Record<string, unknown> = { lancamento_id: lancamentoId, status, atualizado_em: new Date().toISOString() };
    if (valorRealizado != null) payload.valor_realizado = valorRealizado;
    if (existing) await statusOverridesStorage.update(String(existing.id), payload);
    else await statusOverridesStorage.create(payload);
    return { ok: true, lancamento_id: lancamentoId, status };
  }

  async updateLancamento(params: { lancamento_id: string; data_competencia?: string; descricao?: string; cliente?: string; categoria?: string; tipo?: string; valor_previsto?: number; valor_realizado?: number; status?: string; origem?: string }): Promise<Record<string, unknown>> {
    let { status, valor_realizado, tipo } = params;
    const tipoRef = tipo || "entrada";
    if (valor_realizado != null) {
      if (valor_realizado > 0 && (!status || status === "previsto")) status = tipoRef === "entrada" ? "recebido" : "pago";
      else if (valor_realizado === 0 && ["recebido", "pago"].includes(status || "")) status = "previsto";
    }
    const sm = await this.statusMap();
    const existing = sm[params.lancamento_id];
    const payload: Record<string, unknown> = { lancamento_id: params.lancamento_id, atualizado_em: new Date().toISOString() };
    for (const [k, v] of Object.entries({ ...params, status })) if (v != null && k !== "lancamento_id") payload[k] = v;
    if (existing) {
      await statusOverridesStorage.update(String(existing.id), { ...existing, ...payload, id: String(existing.id) });
    } else {
      await statusOverridesStorage.create(payload);
    }
    return { ok: true, lancamento_id: params.lancamento_id };
  }

  async createManual(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      ...data,
      fonte: "manual",
      tipo: data.tipo || "entrada",
      status: data.status || "previsto",
      status_conciliacao: "pendente",
      origem: data.origem || "ajuste_manual",
      valor_previsto: parseFloat(String(data.valor_previsto ?? "0")) || 0,
      valor_realizado: parseFloat(String(data.valor_realizado ?? "0")) || 0,
      criado_em: new Date().toISOString(),
    };
    return await movimentacoesStorage.create(payload);
  }

  private async cleanOverridesForId(lancamentoId: string): Promise<void> {
    const [soAll, concAll] = await Promise.all([
      statusOverridesStorage.all(),
      conciliacaoStorage.all(),
    ]);
    await Promise.all([
      ...soAll.filter((r) => String(r.lancamento_id || "") === lancamentoId)
        .map((r) => statusOverridesStorage.delete(String(r.id))),
      ...concAll.filter((r) => String(r.lancamento_id || "") === lancamentoId)
        .map((r) => conciliacaoStorage.delete(String(r.id))),
    ]);
  }

  async deleteManual(id: string): Promise<Record<string, unknown>> {
    // Handle fechamento-based entries: fech_{competencia}_{1-based-index}
    if (id.startsWith("fech_")) {
      // ID format: fech_2026-04_15
      const withoutPrefix = id.slice(5); // "2026-04_15"
      const lastUnderscore = withoutPrefix.lastIndexOf("_");
      if (lastUnderscore === -1) throw new Error("ID de fechamento inválido: " + id);
      const competencia = withoutPrefix.slice(0, lastUnderscore); // "2026-04"
      const oneBasedIdx = parseInt(withoutPrefix.slice(lastUnderscore + 1), 10);
      if (isNaN(oneBasedIdx) || oneBasedIdx < 1) throw new Error("Índice inválido no ID: " + id);
      const zeroIdx = oneBasedIdx - 1;

      const all = await fechamentoStorage.all();
      const fech = all.find((f) => String(f.competencia || "").startsWith(competencia));
      if (!fech) throw new Error("Fechamento não encontrado para competência: " + competencia);

      // Ensure we have a valid Firestore document id
      const fechFirestoreId = String(fech.id || "");
      if (!fechFirestoreId) throw new Error("Fechamento encontrado mas sem ID válido no Firestore para competência: " + competencia);

      const despPrev = ((fech.despesas_previstas as Record<string, unknown>[]) || []);
      const novosGastos = ((fech.novos_gastos as Record<string, unknown>[]) || []);
      const totalItems = despPrev.length + novosGastos.length;

      if (zeroIdx < despPrev.length) {
        // Item is in despesas_previstas
        const newDespPrev = despPrev.filter((_, i) => i !== zeroIdx);
        await fechamentoStorage.update(fechFirestoreId, { despesas_previstas: newDespPrev });
      } else {
        // Item is in novos_gastos
        const novosIdx = zeroIdx - despPrev.length;
        const newNovos = novosGastos.filter((_, i) => i !== novosIdx);
        await fechamentoStorage.update(fechFirestoreId, { novos_gastos: newNovos });
      }

      // Clean up overrides for the deleted item AND for all shifted items
      // (since fech_ IDs are index-based, items after the deleted one shift down)
      const cleanupIds: string[] = [];
      for (let i = oneBasedIdx; i <= totalItems; i++) {
        cleanupIds.push(`fech_${competencia}_${i}`);
      }
      await Promise.all(cleanupIds.map((lid) => this.cleanOverridesForId(lid)));

      return { ok: true, id };
    }

    // buildManuais prefixes ids with "mov_"; strip it to get the real Firestore doc id
    const rawId = id.startsWith("mov_") ? id.slice(4) : id;
    const movs = await movimentacoesStorage.all();
    const mov = movs.find((m) => String(m.id) === rawId);
    if (!mov) throw new Error("Lançamento não encontrado ou não é manual");
    await Promise.all([
      movimentacoesStorage.delete(rawId),
      this.cleanOverridesForId(id),
    ]);
    return { ok: true, id };
  }
}
