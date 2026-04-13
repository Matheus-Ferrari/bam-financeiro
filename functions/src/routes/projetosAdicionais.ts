import { Router } from "express";
import { projetosAdicionaisStorage } from "../lib/firestore";

const router = Router();

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

// GET /projetos-adicionais
router.get("/", async (_req, res) => {
  try {
    const items = await projetosAdicionaisStorage.all();
    const pagos = items.filter((p) => p.status === "pago");
    const pendentes = items.filter((p) => p.status !== "pago");
    const total = items.reduce((s, p) => s + toFloat(p.valor), 0);
    const total_pago = pagos.reduce((s, p) => s + toFloat(p.valor), 0);
    const total_pendente = pendentes.reduce((s, p) => s + toFloat(p.valor), 0);
    const r = (n: number) => Math.round(n * 100) / 100;
    res.json({
      projetos: items,
      total: r(total), total_pago: r(total_pago), total_pendente: r(total_pendente),
      quantidade: items.length, pagos: pagos.length, pendentes: pendentes.length,
    });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /projetos-adicionais
router.post("/", async (req, res) => {
  try {
    res.status(201).json(await projetosAdicionaisStorage.create(req.body));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /projetos-adicionais/:id
router.put("/:id", async (req, res) => {
  try {
    const updated = await projetosAdicionaisStorage.update(req.params.id, req.body);
    if (!updated) { res.status(404).json({ detail: "Projeto não encontrado" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /projetos-adicionais/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!await projetosAdicionaisStorage.delete(req.params.id)) { res.status(404).json({ detail: "Projeto não encontrado" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
