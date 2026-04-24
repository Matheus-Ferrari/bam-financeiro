import { Router } from "express";
import { cortesStorage } from "../lib/firestore";

const router = Router();

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

// GET /cortes
router.get("/", async (_req, res) => {
  try {
    const items = await cortesStorage.all();
    const ativos = items.filter((c) => c.status === "ativo");
    const total = items.length;
    const economia_ativa = ativos.reduce((s, c) => s + toFloat(c.valor), 0);
    const r = Math.round;
    res.json({
      cortes: items,
      resumo: {
        total,
        ativos: ativos.length,
        economia_total_potencial: r(items.reduce((s, c) => s + toFloat(c.valor), 0) * 100) / 100,
        economia_ativa: r(economia_ativa * 100) / 100,
        impacto_3m: r(economia_ativa * 3 * 100) / 100,
        impacto_6m: r(economia_ativa * 6 * 100) / 100,
        impacto_12m: r(economia_ativa * 12 * 100) / 100,
      },
    });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /cortes
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await cortesStorage.create(req.body));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /cortes/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await cortesStorage.update(req.params.id, req.body);
    if (!updated) { res.status(404).json({ detail: "Corte não encontrado" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /cortes/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!await cortesStorage.delete(req.params.id)) { res.status(404).json({ detail: "Corte não encontrado" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
