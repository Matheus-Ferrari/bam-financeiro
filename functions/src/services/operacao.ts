/**
 * operacao.ts — OperacaoService
 * Equivalent to Python operacao_service.py
 */

import {
  caixaStorage,
  clientesStorage,
  movimentacoesStorage,
  quickUpdatesStorage,
} from "../lib/firestore";
import { FinanceiroService } from "./financeiro";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mesLabelRef(d: Date): string {
  return `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
}

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeStatus(v: unknown): string {
  const raw = String(v || "").trim().toLowerCase();
  if (raw.includes("pago") || raw.includes("recebido") || raw.includes("quitado")) return "pago";
  return "pendente";
}

function isSameMonth(dateStr: unknown, ref: Date): boolean {
  if (!dateStr) return false;
  try {
    const dt = new Date(String(dateStr));
    return dt.getMonth() === ref.getMonth() && dt.getFullYear() === ref.getFullYear();
  } catch { return false; }
}

export class OperacaoService {
  constructor(private fin: FinanceiroService) {}

  async getCaixa(): Promise<Record<string, unknown>> {
    const registros = await caixaStorage.all();
    if (!registros.length) return { caixa_atual: 0, caixa_anterior: 0, atualizado_em: null, historico: [] };

    const ordenados = [...registros].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
    const atual = ordenados[0];
    const anterior = ordenados[1] || null;
    return {
      caixa_atual: toFloat(atual.valor_atual),
      caixa_anterior: anterior ? toFloat(anterior.valor_atual) : toFloat(atual.valor_anterior),
      atualizado_em: atual.data,
      historico: ordenados.slice(0, 30),
    };
  }

  async updateCaixa(valorAtual: number, observacao = "", origem = "manual"): Promise<Record<string, unknown>> {
    const caixaInfo = await this.getCaixa();
    const valorAnterior = toFloat(caixaInfo.caixa_atual);
    const payload = {
      valor_anterior: round2(valorAnterior),
      valor_atual: round2(valorAtual),
      delta: round2(valorAtual - valorAnterior),
      observacao, origem,
      data: new Date().toISOString(),
    };
    const registro = await caixaStorage.create(payload);
    await movimentacoesStorage.create({
      tipo: "ajuste_caixa",
      descricao: "Ajuste manual de caixa",
      valor: round2(valorAtual),
      data: new Date().toISOString(),
      cliente_relacionado: null,
      categoria: "caixa",
      observacao,
      caixa_anterior: round2(valorAnterior),
      caixa_atual: round2(valorAtual),
      origem,
    });
    return registro;
  }

  private async findCliente(nome: unknown): Promise<Record<string, unknown> | null> {
    if (!nome) return null;
    const q = String(nome).trim().toLowerCase();
    if (!q) return null;
    const clientes = await clientesStorage.all();
    return clientes.find((c) => String(c.nome || "").trim().toLowerCase() === q)
      || clientes.find((c) => String(c.nome || "").trim().toLowerCase().includes(q))
      || null;
  }

  async atualizarStatusCliente(
    clienteNome: string,
    statusPagamento: string,
    valorRecebido?: number,
    dataPagamento?: string,
    observacao?: string,
  ): Promise<Record<string, unknown> | null> {
    const cliente = await this.findCliente(clienteNome);
    if (!cliente) return null;

    const hoje = new Date();
    const pago = statusPagamento.trim().toLowerCase() === "pago";
    const payload: Record<string, unknown> = {
      status_pagamento: pago ? "pago" : "pendente",
      mes_referencia_pagamento: mesLabelRef(hoje),
    };

    if (pago) {
      payload.data_pagamento = dataPagamento || new Date().toISOString();
      if (valorRecebido != null) {
        payload.valor_recebido = round2(valorRecebido);
      } else if (!cliente.valor_recebido || toFloat(cliente.valor_recebido) === 0) {
        payload.valor_recebido = round2(toFloat(cliente.valor_previsto || cliente.valor_mensal || 0));
      }
    } else {
      payload.data_pagamento = null;
      if (valorRecebido != null) payload.valor_recebido = round2(valorRecebido);
    }

    if (observacao) payload.observacao_pagamento = observacao;
    return clientesStorage.update(String(cliente.id), payload);
  }

  async registrarMovimentacao(data: Record<string, unknown>, origem = "manual"): Promise<Record<string, unknown>> {
    return movimentacoesStorage.create({
      tipo: data.tipo,
      descricao: data.descricao || "Movimentação manual",
      valor: round2(toFloat(data.valor)),
      data: data.data || new Date().toISOString(),
      cliente_relacionado: data.cliente_relacionado,
      categoria: data.categoria,
      observacao: data.observacao,
      origem,
    });
  }

  async getOperacaoMes(): Promise<Record<string, unknown>> {
    const ref = new Date();
    const mesLabel = mesLabelRef(ref);
    const hojeIso = ref.toISOString().slice(0, 10);

    const [recData, despData, clientes, movs] = await Promise.all([
      this.fin.getReceitas(),
      this.fin.getDespesas(),
      clientesStorage.all(),
      movimentacoesStorage.all(),
    ]);

    const recLanc = (recData.lancamentos as Record<string, unknown>[]) || [];
    const depLanc = (despData.lancamentos as Record<string, unknown>[]) || [];

    const receitasMes = recLanc.filter((r) => String(r.mes) === mesLabel);
    const despesasMes = depLanc.filter((d) => String(d.mes) === mesLabel);

    let totalPrevReceit = receitasMes.reduce((s, r) => s + toFloat(r.valor), 0);
    let totalRecebido = receitasMes.filter((r) => normalizeStatus(r.status) === "pago").reduce((s, r) => s + toFloat(r.valor), 0);
    let totalPrevDesp = despesasMes.reduce((s, d) => s + toFloat(d.valor), 0);
    let totalPago = despesasMes.filter((d) => normalizeStatus(d.status) === "pago").reduce((s, d) => s + toFloat(d.valor), 0);

    const movsMes = movs.filter((m) => isSameMonth(m.data, ref));
    const entradasManuais = movsMes.filter((m) => ["entrada", "recebimento"].includes(String(m.tipo))).reduce((s, m) => s + toFloat(m.valor), 0);
    const saidasManuais = movsMes.filter((m) => ["saida", "despesa"].includes(String(m.tipo))).reduce((s, m) => s + toFloat(m.valor), 0);

    totalPrevReceit += entradasManuais;
    totalRecebido += entradasManuais;
    totalPrevDesp += saidasManuais;
    totalPago += saidasManuais;

    const pagosMes = clientes.filter((c) => String(c.status_pagamento || "").toLowerCase() === "pago");
    const pendentesMes = clientes.filter((c) => String(c.status_pagamento || "pendente").toLowerCase() !== "pago");
    const pagouHoje = clientes.filter((c) => String(c.status_pagamento || "").toLowerCase() === "pago" && String(c.data_pagamento || "").startsWith(hojeIso));
    const faltamPagar = [...pendentesMes].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

    const caixaInfo = await this.getCaixa();
    const caixaAtual = toFloat(caixaInfo.caixa_atual);
    const pendReceber = Math.max(totalPrevReceit - totalRecebido, 0);
    const pendPagar = Math.max(totalPrevDesp - totalPago, 0);
    const saldoProjetado = caixaAtual + pendReceber - pendPagar;

    const ultimosRegistros = (await quickUpdatesStorage.all())
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 20);

    return {
      mes_referencia: mesLabel,
      caixa_atual: round2(caixaAtual),
      total_previsto_receitas_mes: round2(totalPrevReceit),
      total_recebido_mes: round2(totalRecebido),
      total_pendente_recebimento: round2(pendReceber),
      total_previsto_despesas_mes: round2(totalPrevDesp),
      total_pago_mes: round2(totalPago),
      total_pendente_pagamento: round2(pendPagar),
      saldo_projetado_mes: round2(saldoProjetado),
      clientes_pagos: pagosMes,
      clientes_pendentes: pendentesMes,
      quem_pagou_hoje: pagouHoje,
      quem_falta_pagar: faltamPagar,
      despesas_previstas_mes: [...despesasMes].sort((a, b) => toFloat(b.valor) - toFloat(a.valor)),
      despesas_pagas_mes: despesasMes.filter((d) => normalizeStatus(d.status) === "pago"),
      movimentacoes_recentes: [...movs].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 20),
      ultimos_registros_manuais: ultimosRegistros,
    };
  }
}
