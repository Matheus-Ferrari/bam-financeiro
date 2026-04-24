import { Router } from "express";
import { clientesStorage, fechamentoStorage } from "../lib/firestore";

const router = Router();

// GET /clientes?competencia=
router.get("/", async (req, res) => {
  try {
    const competencia = String(req.query.competencia || "").trim();
    const clientes = await clientesStorage.all();
    const fechamentos = await fechamentoStorage.all();

    // Sync clientes with current month closing if competencia is provided
    const syncedClientes = competencia
      ? await syncClientesComFechamento(clientes, fechamentos, competencia)
      : clientes;

    const ativos = syncedClientes.filter((c) => c.status === "ativo");
    const inativos = syncedClientes.filter((c) => c.status !== "ativo");
    const pagos = ativos.filter((c) => c.status_pagamento === "pago");
    const pendentes = ativos.filter((c) => c.status_pagamento !== "pago");
    const receitaPrevista = ativos.reduce((s, c) => s + parseFloat(String(c.valor_previsto || c.valor_mensal || 0)), 0);
    const receitaRecebida = ativos.filter((c) => c.status_pagamento === "pago").reduce((s, c) => s + parseFloat(String(c.valor_recebido || 0)), 0);

    res.json({
      clientes: syncedClientes,
      total: syncedClientes.length,
      ativos: ativos.length,
      inativos: inativos.length,
      pagos: pagos.length,
      pendentes: pendentes.length,
      receita_prevista: Math.round(receitaPrevista * 100) / 100,
      receita_recebida: Math.round(receitaRecebida * 100) / 100,
    });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /clientes
router.post("/", async (req, res) => {
  try {
    const created = await clientesStorage.create(req.body);
    res.json(created);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /clientes/:id
router.put("/:id", async (req, res) => {
  try {
    const payload = { ...req.body };
    const updated = await clientesStorage.update(req.params.id, payload);
    if (!updated) { res.status(404).json({ detail: "Cliente não encontrado" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /clientes/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await clientesStorage.delete(req.params.id);
    if (!deleted) { res.status(404).json({ detail: "Cliente não encontrado" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// ── Helper: sync payment status from fechamento ──────────────────────────

async function syncClientesComFechamento(
  clientes: Record<string, unknown>[],
  fechamentos: Record<string, unknown>[],
  competencia: string,
): Promise<Record<string, unknown>[]> {
  const fech = fechamentos.find((f) => String(f.competencia || "").startsWith(competencia));
  if (!fech) return clientes;

  // Build set of paid client IDs from fechamento
  const clientesAtivos = clientes.filter((c) => c.status === "ativo");
  const pagosMes = clientesAtivos.filter(
    (c) => String(c.data_pagamento || "").startsWith(competencia) && parseFloat(String(c.valor_recebido || 0)) > 0,
  );
  const pagosStatus = clientesAtivos.filter(
    (c) => c.status_pagamento === "pago" && parseFloat(String(c.valor_recebido || 0)) > 0 && !String(c.data_pagamento || "").startsWith(competencia),
  );
  const pagosIds = new Set([...pagosMes, ...pagosStatus].map((c) => c.id));

  return clientes.map((c) => {
    if (c.status !== "ativo") return c;
    return { ...c, _sincronizado: true, _competencia: competencia, _pago_mes: pagosIds.has(c.id) };
  });
}

export default router;
