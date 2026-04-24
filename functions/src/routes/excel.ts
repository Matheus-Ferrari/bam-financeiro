import { Router } from "express";
import { baseReceitasStorage, baseDespesasStorage } from "../lib/firestore";

const router = Router();

// GET /excel/sheets
router.get("/sheets", async (_req, res) => {
  try {
    const [receitas, despesas] = await Promise.all([
      baseReceitasStorage.all(), baseDespesasStorage.all(),
    ]);
    res.json({
      fonte: "firestore",
      sheets: [
        { nome: "Receitas", registros: receitas.length, colecao: "base_receitas" },
        { nome: "Despesas", registros: despesas.length, colecao: "base_despesas" },
      ],
      total_registros: receitas.length + despesas.length,
    });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
