import { Router } from "express";
import { despesasLocaisStorage } from "../lib/firestore";

const router = Router();

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

// GET /despesas-locais
router.get("/", async (_req, res) => {
  try {
    const items = await despesasLocaisStorage.all();
    const total = items.reduce((s, d) => s + toFloat(d.valor), 0);
    const total_pago = items.filter((d) => d.status === "pago").reduce((s, d) => s + toFloat(d.valor), 0);
    const total_pendente = items.filter((d) => d.status !== "pago").reduce((s, d) => s + toFloat(d.valor), 0);
    const r = (n: number) => Math.round(n * 100) / 100;
    res.json({ despesas: items, total: r(total), total_pago: r(total_pago), total_pendente: r(total_pendente), quantidade: items.length });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /despesas-locais
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await despesasLocaisStorage.create(req.body));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /despesas-locais/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await despesasLocaisStorage.update(req.params.id, req.body);
    if (!updated) { res.status(404).json({ detail: "Despesa não encontrada" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /despesas-locais/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!await despesasLocaisStorage.delete(req.params.id)) { res.status(404).json({ detail: "Despesa não encontrada" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
