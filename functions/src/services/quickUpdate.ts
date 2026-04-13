/**
 * quickUpdate.ts — QuickUpdateService
 * Equivalent to Python quick_update_service.py
 */

import { quickUpdatesStorage } from "../lib/firestore";
import { OperacaoService } from "./operacao";

function normText(text: string): string {
  return (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function extractValue(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)/);
  if (!match) return null;
  let raw = match[1].trim();
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    const parts = raw.split(",");
    raw = parts[parts.length - 1].length <= 2 ? raw.replace(".", "").replace(",", ".") : raw.replace(",", "");
  } else {
    raw = (raw.match(/\./g) || []).length > 1 ? raw.replace(/\./g, "") : raw;
  }
  const n = parseFloat(raw);
  return isFinite(n) ? n : null;
}

function extractCliente(text: string): string | null {
  const txt = normText(text);
  const patterns = [
    /cliente\s+([a-z0-9\s]+?)\s+(?:pagou|ficou|como)/,
    /marcar\s+([a-z0-9\s]+?)\s+como\s+(?:pago|pendente)/,
    /entrada\s+de\s+[\d.,]+\s+(?:da|do|de)\s+([a-z0-9\s]+)$/,
    /recebimento\s+de\s+[\d.,]+\s+(?:da|do|de)\s+([a-z0-9\s]+)$/,
  ];
  for (const p of patterns) {
    const m = txt.match(p);
    if (m && m[1]) return m[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (txt.startsWith("marcar ") && txt.includes(" como ")) {
    return txt.replace("marcar ", "").split(" como ")[0].trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

function extractDate(text: string): string {
  const txt = normText(text);
  const now = new Date();
  if (txt.includes("hoje")) return now.toISOString();
  if (txt.includes("ontem")) { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString(); }
  const m = txt.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    try { return new Date(year, mo - 1, day).toISOString(); } catch { return now.toISOString(); }
  }
  return now.toISOString();
}

export class QuickUpdateService {
  constructor(private ops: OperacaoService) {}

  parse(text: string): Record<string, unknown> {
    const src = (text || "").trim();
    const txt = normText(src);
    const value = extractValue(src);
    const cliente = extractCliente(src);
    const parsedDate = extractDate(src);

    let actionType = "desconhecida";
    let status: string | null = null;
    let movTipo: string | null = null;
    let descricao = src;

    if (txt.includes("atualizar caixa") && txt.includes("para")) { actionType = "atualizar_caixa"; movTipo = "ajuste_caixa"; descricao = "Atualização manual de caixa"; }
    else if (txt.includes("marcar") && txt.includes("como pago")) { actionType = "marcar_cliente_pago"; status = "pago"; movTipo = "recebimento"; descricao = "Marcar cliente como pago"; }
    else if (txt.includes("marcar") && txt.includes("como pendente")) { actionType = "marcar_cliente_pendente"; status = "pendente"; movTipo = "recebimento"; descricao = "Marcar cliente como pendente"; }
    else if (txt.includes("pagou")) { actionType = "adicionar_recebimento"; status = "pago"; movTipo = "recebimento"; descricao = "Registrar recebimento de cliente"; }
    else if (txt.includes("registrar entrada")) { actionType = "registrar_entrada"; movTipo = "entrada"; descricao = "Registrar entrada manual"; }
    else if (txt.includes("registrar saida") || txt.includes("registrar saída")) { actionType = "registrar_saida"; movTipo = "saida"; descricao = "Registrar saída manual"; }
    else if (txt.includes("adicionar despesa")) { actionType = "adicionar_despesa"; movTipo = "despesa"; descricao = "Adicionar despesa manual"; }
    else if (txt.includes("adicionar recebimento")) { actionType = "adicionar_recebimento"; movTipo = "recebimento"; descricao = "Adicionar recebimento manual"; }

    const warnings: string[] = [];
    if (actionType === "desconhecida") warnings.push("Não consegui identificar a ação com segurança.");
    if (actionType !== "marcar_cliente_pendente" && value == null) warnings.push("Valor não identificado.");
    if (["marcar_cliente_pago", "marcar_cliente_pendente", "adicionar_recebimento"].includes(actionType) && !cliente) warnings.push("Cliente não identificado.");

    return {
      ok: actionType !== "desconhecida", input: src,
      parsed: { action_type: actionType, cliente, valor: value, data: parsedDate, status, tipo_movimentacao: movTipo, descricao },
      warnings,
      preview: { titulo: "Prévia da atualização", resumo: `${descricao} | cliente=${cliente || "-"} | valor=${value ?? "-"}` },
    };
  }

  async apply(parsedPayload: Record<string, unknown>, confirm: boolean): Promise<Record<string, unknown>> {
    if (!confirm) return { ok: false, message: "Confirmação obrigatória para aplicar atualização." };

    const parsed = (parsedPayload.parsed || parsedPayload) as Record<string, unknown>;
    const action = String(parsed.action_type || "");
    const cliente = String(parsed.cliente || "");
    const valor = parsed.valor != null ? parseFloat(String(parsed.valor)) : 0;
    const dataMov = String(parsed.data || new Date().toISOString());
    const descricao = String(parsed.descricao || "Atualização rápida");

    const resultado: Record<string, unknown> = { ok: true, action_type: action, applied: [] };
    const applied = resultado.applied as Record<string, unknown>[];

    if (action === "atualizar_caixa") {
      const caixa = await this.ops.updateCaixa(valor, "Atualização rápida", "quick_update");
      applied.push({ tipo: "caixa", registro: caixa });
    } else if (["marcar_cliente_pago", "marcar_cliente_pendente"].includes(action)) {
      const atualizado = await this.ops.atualizarStatusCliente(
        cliente, action === "marcar_cliente_pago" ? "pago" : "pendente", valor > 0 ? valor : undefined, dataMov, "Atualização rápida",
      );
      if (!atualizado) { resultado.ok = false; resultado.message = "Cliente não encontrado para atualização."; }
      else applied.push({ tipo: "cliente", registro: atualizado });
    } else if (["registrar_entrada", "registrar_saida", "adicionar_despesa", "adicionar_recebimento"].includes(action)) {
      const tipoMap: Record<string, string> = { registrar_entrada: "entrada", registrar_saida: "saida", adicionar_despesa: "despesa", adicionar_recebimento: "recebimento" };
      const registro = await this.ops.registrarMovimentacao({ tipo: tipoMap[action], descricao, valor, data: dataMov, cliente_relacionado: cliente || null, categoria: "operacional", observacao: "Lançado via atualização rápida" }, "quick_update");
      applied.push({ tipo: "movimentacao", registro });
      if (action === "adicionar_recebimento" && cliente) {
        const atualizado = await this.ops.atualizarStatusCliente(cliente, "pago", valor > 0 ? valor : undefined, dataMov, "Recebimento via atualização rápida");
        if (atualizado) applied.push({ tipo: "cliente", registro: atualizado });
      }
    } else {
      resultado.ok = false; resultado.message = "Ação não suportada para aplicação.";
    }

    await quickUpdatesStorage.create({ input: parsedPayload.input || "", parsed, confirmado: !!confirm, resultado, created_at: new Date().toISOString() });
    return resultado;
  }
}
