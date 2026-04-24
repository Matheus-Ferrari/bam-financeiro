import { Router } from "express";
import { comissoesStorage } from "../lib/firestore";

const router = Router();

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

// GET /comissoes
router.get("/", async (_req, res) => {
  try {
    const items = await comissoesStorage.all();
    const total = items.reduce((s, c) => s + toFloat(c.valor), 0);
    const total_pago = items.filter((c) => c.status === "pago").reduce((s, c) => s + toFloat(c.valor), 0);
    const total_pendente = items.filter((c) => c.status !== "pago").reduce((s, c) => s + toFloat(c.valor), 0);
    res.json({ comissoes: items, total: Math.round(total * 100) / 100, total_pago: Math.round(total_pago * 100) / 100, total_pendente: Math.round(total_pendente * 100) / 100, quantidade: items.length });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /comissoes
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await comissoesStorage.create(req.body));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /comissoes/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await comissoesStorage.update(req.params.id, req.body);
    if (!updated) { res.status(404).json({ detail: "Comissão não encontrada" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /comissoes/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!await comissoesStorage.delete(req.params.id)) { res.status(404).json({ detail: "Comissão não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
