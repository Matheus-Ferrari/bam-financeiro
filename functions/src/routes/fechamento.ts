import { Router } from "express";
import { fechamentoStorage, clientesStorage, comissoesStorage } from "../lib/firestore";

const router = Router();

function toFloat(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildResumo(fech: Record<string, unknown>, competencia: string, clientes: Record<string, unknown>[], comissoes: Record<string, unknown>[]): Record<string, unknown> {
  const ativo = clientes.filter((c) => c.status === "ativo");

  // Fonte única: status_pagamento === "pago" (igual ao Fechamento do Mês no frontend)
  const pagos    = ativo.filter((c) => c.status_pagamento === "pago");
  const pendentes = ativo.filter((c) => c.status_pagamento !== "pago");

  const receitaConfirmada = pagos.reduce((s, c) => s + toFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto), 0);
  const receitaPendente = pendentes.reduce((s, c) => s + toFloat(c.valor_previsto || c.valor_mensal), 0);

  const despPrev = ((fech.despesas_previstas as Record<string, unknown>[]) || []);
  const reducoes = ((fech.reducoes as Record<string, unknown>[]) || []);
  const novosGastos = ((fech.novos_gastos as Record<string, unknown>[]) || []);
  const comissoesMes = comissoes.filter((c) => String(c.competencia || "").startsWith(competencia));

  const despConfirmada = despPrev.filter((d) => d.status === "pago").reduce((s, d) => s + toFloat(d.valor), 0);
  const despPrevista = despPrev.filter((d) => d.status !== "pago").reduce((s, d) => s + toFloat(d.valor), 0);
  const totalReducoes = reducoes.filter((r) => r.status === "aprovado").reduce((s, r) => s + toFloat(r.valor), 0);
  const totalNovosGastos = novosGastos.reduce((s, g) => s + toFloat(g.valor), 0);
  const totalComissoes = comissoesMes.reduce((s, c) => s + toFloat(c.valor), 0);

  const totalReceita = receitaConfirmada + receitaPendente;
  const totalDespesa = despConfirmada + despPrevista + totalNovosGastos - totalReducoes;

  const saldoProjetado = receitaConfirmada - despConfirmada - totalComissoes;
  const saldoOtimista = totalReceita - despConfirmada - totalComissoes;
  const saldoPessimista = receitaConfirmada - totalDespesa - totalComissoes;

  return {
    receita_confirmada: round2(receitaConfirmada), receita_pendente: round2(receitaPendente),
    total_receita: round2(totalReceita),
    despesa_confirmada: round2(despConfirmada), despesa_prevista: round2(despPrevista),
    novos_gastos: round2(totalNovosGastos), reducoes: round2(totalReducoes),
    total_despesa: round2(totalDespesa),
    total_comissoes: round2(totalComissoes),
    saldo_projetado: round2(saldoProjetado),
    cenario_otimista: round2(saldoOtimista),
    cenario_pessimista: round2(saldoPessimista),
    clientes_pagos: pagos.length, clientes_pendentes: pendentes.length,
  };
}

// GET /fechamento
router.get("/", async (_req, res) => {
  try {
    res.json(await fechamentoStorage.all());
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// GET /fechamento/:competencia
router.get("/:competencia", async (req, res) => {
  try {
    const competencia = req.params.competencia;
    const [items, clientes, todasComissoes] = await Promise.all([
      fechamentoStorage.all(), clientesStorage.all(), comissoesStorage.all(),
    ]);
    let fech = items.find((f) => String(f.competencia || "").startsWith(competencia));
    if (!fech) {
      fech = { id: "", competencia, despesas_previstas: [], reducoes: [], novos_gastos: [], anotacoes: { decisoes: "", proximos_passos: "", pendencias: "", observacoes: "" } };
    }

    const resumo = buildResumo(fech as Record<string, unknown>, competencia, clientes, todasComissoes);

    const ativo = clientes.filter((c) => c.status === "ativo");
    // Mesma lógica do buildResumo: fonte única via status_pagamento
    const pagosArr = ativo.filter((c) => c.status_pagamento === "pago");
    const pagosIds = new Set(pagosArr.map((c) => c.id));
    const comissoesMes = todasComissoes.filter((c) => String(c.competencia || "").startsWith(competencia));

    // clientes_extras ficam SEPARADOS — não misturar com clientes_pendentes para evitar duplicata no frontend
    const clientesExtras = (fech as Record<string, unknown>).clientes_extras as Record<string, unknown>[] | undefined ?? [];

    res.json({
      fechamento: fech, resumo,
      clientes_pagos: pagosArr,
      clientes_pendentes: ativo.filter((c) => !pagosIds.has(c.id)),
      clientes_extras: clientesExtras,
      comissoes_mes: comissoesMes,
    });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// POST /fechamento
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    const competencia = body.competencia;
    const items = await fechamentoStorage.all();
    const existing = items.find((f) => String(f.competencia || "") === competencia);
    if (existing) {
      const updated = await fechamentoStorage.update(String(existing.id), body);
      res.json(updated);
    } else {
      res.json(await fechamentoStorage.create(body));
    }
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// PUT /fechamento/:id
router.put("/:id", async (req, res) => {
  try {
    const payload = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v != null));
    const updated = await fechamentoStorage.update(req.params.id, payload);
    if (!updated) { res.status(404).json({ detail: "Fechamento não encontrado" }); return; }
    res.json(updated);
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

// DELETE /fechamento/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!await fechamentoStorage.delete(req.params.id)) { res.status(404).json({ detail: "Fechamento não encontrado" }); return; }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ detail: String(e) });
  }
});

export default router;
