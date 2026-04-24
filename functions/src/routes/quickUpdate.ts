import { Router } from "express";
import { OperacaoService } from "../services/operacao";
import { QuickUpdateService } from "../services/quickUpdate";
import { finService } from "../services/financeiro";
import { quickUpdatesStorage } from "../lib/firestore";

const router = Router();
const opService = new OperacaoService(finService);
const quService = new QuickUpdateService(opService);

// POST /quick-update/parse
router.post("/parse", async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) { res.status(400).json({ detail: "Campo 'texto' é obrigatório" }); return; }
    res.json(quService.parse(String(texto)));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /quick-update/apply
router.post("/apply", async (req, res) => {
  try {
    const { parsed, confirm } = req.body;
    if (!parsed) { res.status(400).json({ detail: "Campo 'parsed' é obrigatório" }); return; }
    res.json(await quService.apply(parsed, confirm ?? false));
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// GET /quick-update/history
router.get("/history", async (_req, res) => {
  try {
    const history = await quickUpdatesStorage.all();
    const sorted = [...history].sort((a, b) => {
      const ta = String((a as Record<string, unknown>).timestamp ?? "");
      const tb = String((b as Record<string, unknown>).timestamp ?? "");
      return tb.localeCompare(ta);
    });
    res.json({ history: sorted.slice(0, 50) });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
