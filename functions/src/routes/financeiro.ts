import { Router } from "express";
import { finService } from "../services/financeiro";
import { SaudeService } from "../services/saude";
import { OperacaoService } from "../services/operacao";
import { FluxoCaixaService } from "../services/fluxoCaixa";
import { PrecificacaoService } from "../services/precificacao";
import { baseReceitasStorage, baseDespesasStorage } from "../lib/firestore";

const router = Router();
const saudeService = new SaudeService(finService);
const opService = new OperacaoService(finService);
const fluxoService = new FluxoCaixaService(finService);
const precificacaoService = new PrecificacaoService(fluxoService);

// ── Dados de base (Excel/Firestore) ──────────────────────────────────────

// GET /financeiro/resumo
router.get("/resumo", async (_req, res) => {
  try { res.json(await finService.getResumoMensal()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/kpis
router.get("/kpis", async (_req, res) => {
  try { res.json(await finService.getKpis()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/receitas
router.get("/receitas", async (_req, res) => {
  try { res.json(await finService.getReceitas()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/despesas
router.get("/despesas", async (_req, res) => {
  try { res.json(await finService.getDespesas()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/projecoes?crescimento_pct=&novos_clientes_crm=&meses=
router.get("/projecoes", async (req, res) => {
  try {
    const crescimento = parseFloat(String(req.query.crescimento_pct ?? "10")) || 10;
    const novos = parseInt(String(req.query.novos_clientes_crm ?? "10"), 10) || 10;
    const meses = parseInt(String(req.query.meses ?? "6"), 10) || 6;
    res.json(await finService.getProjecoes(crescimento, novos, meses));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/cenarios
router.get("/cenarios", async (_req, res) => {
  try { res.json(await finService.getCenariosCorte()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/alertas
router.get("/alertas", async (_req, res) => {
  try { res.json(await finService.getAlertas()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// ── Saúde Financeira ───────────────────────────────────────────────────

// GET /financeiro/saude
router.get("/saude", async (_req, res) => {
  try { res.json(await saudeService.getSaude()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/insights
router.get("/insights", async (_req, res) => {
  try { res.json(await saudeService.getInsights()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// ── Operação ───────────────────────────────────────────────────────────

// GET /financeiro/operacao-mes
router.get("/operacao-mes", async (_req, res) => {
  try { res.json(await opService.getOperacaoMes()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/caixa
router.get("/caixa", async (_req, res) => {
  try { res.json(await opService.getCaixa()); }
  catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/caixa
router.post("/caixa", async (req, res) => {
  try {
    const { valor_atual, observacao, origem } = req.body;
    res.json(await opService.updateCaixa(parseFloat(valor_atual ?? "0") || 0, observacao ?? "", origem ?? "manual"));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// ── Fluxo de Caixa ─────────────────────────────────────────────────────

// GET /financeiro/fluxo-caixa?mes=&ano=&tipo=&status=&cliente=&categoria=
router.get("/fluxo-caixa", async (req, res) => {
  try {
    const q = req.query;
    res.json(await fluxoService.getFluxo({
      mes: q.mes ? parseInt(String(q.mes), 10) : undefined,
      ano: q.ano ? parseInt(String(q.ano), 10) : undefined,
      tipo: q.tipo ? String(q.tipo) : undefined,
      status: q.status ? String(q.status) : undefined,
      cliente: q.cliente ? String(q.cliente) : undefined,
      categoria: q.categoria ? String(q.categoria) : undefined,
    }));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// GET /financeiro/conciliacao?mes=&ano=
router.get("/conciliacao", async (req, res) => {
  try {
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : undefined;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : undefined;
    res.json(await fluxoService.getConciliacao(mes, ano));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/conciliacao/marcar
router.post("/conciliacao/marcar", async (req, res) => {
  try {
    const { lancamento_id, status, status_conciliacao, observacao, valor_extrato } = req.body;
    // Accept both `status_conciliacao` (frontend) and `status` (legacy)
    const statusFinal = status_conciliacao || status;
    res.json(await fluxoService.marcarConciliacao(String(lancamento_id), String(statusFinal), observacao ?? "", valor_extrato));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/lancamento/status
router.post("/lancamento/status", async (req, res) => {
  try {
    const { lancamento_id, status, valor_realizado } = req.body;
    res.json(await fluxoService.updateStatus(String(lancamento_id), String(status), valor_realizado));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/lancamento/update
router.post("/lancamento/update", async (req, res) => {
  try {
    res.json(await fluxoService.updateLancamento(req.body));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/lancamento/create
router.post("/lancamento/create", async (req, res) => {
  try {
    res.json(await fluxoService.createManual(req.body));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// DELETE /financeiro/lancamento/:id
router.delete("/lancamento/:id", async (req, res) => {
  try {
    res.json(await fluxoService.deleteManual(req.params.id));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// ── Precificação ──────────────────────────────────────────────────────

// GET /financeiro/precificacao?mes=&ano=
router.get("/precificacao", async (req, res) => {
  try {
    const { mes, ano } = req.query;
    res.json(await precificacaoService.get({
      mes: mes ? parseInt(String(mes)) : undefined,
      ano: ano ? parseInt(String(ano)) : undefined,
    }));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/precificacao/classificar
router.post("/precificacao/classificar", async (req, res) => {
  try {
    res.json(await precificacaoService.setClassificacao(req.body));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// POST /financeiro/precificacao/cliente
router.post("/precificacao/cliente", async (req, res) => {
  try {
    res.json(await precificacaoService.setClienteClassificacao(req.body));
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// ── Edição de base de dados (antigo Excel) ────────────────────────────

// PUT /financeiro/despesas/:id
router.put("/despesas/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    // Try by _idx first, then by Firestore ID
    const docs = await baseDespesasStorage.all();
    const byIdx = docs.find((d) => String((d as Record<string, unknown>)["_idx"]) === id);
    const target = byIdx ?? docs.find((d) => String((d as Record<string, unknown>)["id"]) === id);
    if (!target) { res.status(404).json({ detail: "Despesa não encontrada" }); return; }
    const updated = await baseDespesasStorage.update(String((target as Record<string, unknown>)["id"]), body);
    finService.invalidateCache();
    res.json(updated);
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

// PUT /financeiro/receitas/:id
router.put("/receitas/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body;
    const docs = await baseReceitasStorage.all();
    const byIdx = docs.find((d) => String((d as Record<string, unknown>)["_idx"]) === id);
    const target = byIdx ?? docs.find((d) => String((d as Record<string, unknown>)["id"]) === id);
    if (!target) { res.status(404).json({ detail: "Receita não encontrada" }); return; }
    const updated = await baseReceitasStorage.update(String((target as Record<string, unknown>)["id"]), body);
    finService.invalidateCache();
    res.json(updated);
  } catch (e: unknown) { res.status(500).json({ detail: String(e) }); }
});

export default router;
