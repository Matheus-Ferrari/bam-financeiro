/**
 * seed_abril2026.js
 * Executa: node scripts/seed_abril2026.js
 * Popula o Firestore com os dados corretos de Abril/2026.
 */

const admin = require("../functions/node_modules/firebase-admin");
const path  = require("path");

const serviceAccount = require(path.join(__dirname, "..", "bam-financeiro-key.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── 17 clientes ativos de Abril/2026 ─────────────────────────────────────
const CLIENTES = [
  { id: "cl-0001-fernet",                   nome: "Fernet",                      status: "ativo", tipo: "recorrente", valor_mensal: 1200,  valor_previsto: 1200,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "Recebimento padrão dia 25",                                                                             cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0002-hygge-games-internacional", nome: "Hygge Games Internacional",   status: "ativo", tipo: "recorrente", valor_mensal: 2500,  valor_previsto: 2500,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "Invoice — pagamento via transferência internacional (converter dolar, preço do dia)",          cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "email" },
  { id: "cl-0003-redoma-energia",            nome: "Redoma Energia",              status: "ativo", tipo: "recorrente", valor_mensal: 1350,  valor_previsto: 1350,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "Recebimento padrão dia 25",                                                                             cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0004-adrifer",                   nome: "Adrifer",                     status: "ativo", tipo: "recorrente", valor_mensal: 1900,  valor_previsto: 1900,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "Recebimento padrão dia 25",                                                                             cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0005-hygge-games",               nome: "Hygge Games",                 status: "ativo", tipo: "recorrente", valor_mensal: 1863,  valor_previsto: 1863,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 28, data_pagamento: null, observacao_pagamento: "Jan recebido R$1.963,63 + Fev recebido R$1.862,64. Março (dia 28) ainda não chegou.",               cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0006-agencia-cma",               nome: "Agência CMA",                 status: "ativo", tipo: "recorrente", valor_mensal: 3500,  valor_previsto: 3500,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 30, data_pagamento: null, observacao_pagamento: "DESTRINCHAR OS CLIENTES QUE TEMOS DA CMA",                                                             cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0007-cemiterio-cantareira",      nome: "Cemitério da Cantareira",     status: "ativo", tipo: "recorrente", valor_mensal: 2750,  valor_previsto: 2750,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 30, data_pagamento: null, observacao_pagamento: "Responsável: Edu (com comissão). Recebimento dia 30.",                                               cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0008-planet-korea",              nome: "Planet Korea",                status: "ativo", tipo: "recorrente", valor_mensal: 0,     valor_previsto: 0,     valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: null, data_pagamento: null, observacao_pagamento: "Tem projeto adicional: LP R$10.000 (pendente).",                                                   cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0009-hyggegames-brasil",         nome: "Hyggegames brasil",           status: "ativo", tipo: "manual",     valor_mensal: 3000,  valor_previsto: 3000,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 28, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0010-engenheiro-murilo-mardon",  nome: "Engenheiro Murilo e mardon",  status: "ativo", tipo: "manual",     valor_mensal: 1000,  valor_previsto: 1000,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0011-prompt",                    nome: "Prompt",                      status: "ativo", tipo: "manual",     valor_mensal: 800,   valor_previsto: 800,   valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 5,  data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "cobrado",    cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0012-atlas",                     nome: "Atlas",                       status: "ativo", tipo: "manual",     valor_mensal: 1200,  valor_previsto: 1200,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 25, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0013-promanage",                 nome: "Promanage",                   status: "ativo", tipo: "manual",     valor_mensal: 750,   valor_previsto: 750,   valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 5,  data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0014-electrotec",                nome: "Electrotec",                  status: "ativo", tipo: "manual",     valor_mensal: 2750,  valor_previsto: 2750,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 6,  data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0015-granitos-moredo",           nome: "Granitos Moredo",             status: "ativo", tipo: "manual",     valor_mensal: 2500,  valor_previsto: 2500,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 10, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0016-kontainers",                nome: "Kontainers",                  status: "ativo", tipo: "manual",     valor_mensal: 1500,  valor_previsto: 1500,  valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 12, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
  { id: "cl-0017-freeport",                  nome: "Freeport",                    status: "ativo", tipo: "manual",     valor_mensal: 600,   valor_previsto: 600,   valor_recebido: 0, status_pagamento: "pendente", dia_pagamento: 16, data_pagamento: null, observacao_pagamento: "",                                                                                                     cobranca_status: "sem_cobrar", cobranca_obs: "", forma_contato: "whatsapp" },
];

// ── Clientes atrasados (meses anteriores) — salvos no fechamento de Abril ─
const CLIENTES_EXTRAS_ABRIL = [
  { id: "atraso-hygee-nacional",           nome: "Hygee nacional",              valor_mensal: 3000, status_pagamento: "pendente", origem: "atraso", dia_pagamento: null },
  { id: "atraso-engenheiro-murilo-mardon", nome: "Engenheiro Murilo e mardon",  valor_mensal: 2000, status_pagamento: "pendente", origem: "atraso", dia_pagamento: null },
  { id: "atraso-atlas",                    nome: "Atlas",                       valor_mensal: 1200, status_pagamento: "pendente", origem: "atraso", dia_pagamento: null },
];

async function run() {
  console.log("🚀 Iniciando seed de clientes para Abril/2026...\n");

  // 1. Apagar clientes existentes
  const existing = await db.collection("clientes").listDocuments();
  if (existing.length) {
    const batch = db.batch();
    existing.forEach((d) => batch.delete(d));
    await batch.commit();
    console.log(`🗑  Removidos ${existing.length} clientes antigos.`);
  }

  // 2. Criar os 17 clientes corretos
  const batch = db.batch();
  for (const c of CLIENTES) {
    const ref = db.collection("clientes").doc(c.id);
    batch.set(ref, { ...c, criado_em: new Date().toISOString() });
  }
  await batch.commit();
  console.log(`✅ ${CLIENTES.length} clientes criados.`);

  // 3. Atualizar fechamento de Abril com clientes atrasados
  const fechamentos = await db.collection("fechamento").where("competencia", ">=", "2026-04").where("competencia", "<", "2026-05").get();

  let fechId = null;
  if (!fechamentos.empty) {
    fechId = fechamentos.docs[0].id;
    await db.collection("fechamento").doc(fechId).update({ clientes_extras: CLIENTES_EXTRAS_ABRIL });
    console.log(`✅ clientes_extras salvos no fechamento existente (${fechId}).`);
  } else {
    const ref = db.collection("fechamento").doc();
    await ref.set({
      competencia: "2026-04",
      despesas_previstas: [],
      reducoes: [],
      novos_gastos: [],
      anotacoes: { decisoes: "", proximos_passos: "", pendencias: "", observacoes: "" },
      clientes_extras: CLIENTES_EXTRAS_ABRIL,
      criado_em: new Date().toISOString(),
    });
    console.log(`✅ Fechamento 2026-04 criado com clientes_extras (id: ${ref.id}).`);
  }

  console.log("\n✅ Seed concluído!");
  process.exit(0);
}

run().catch((e) => { console.error("❌ Erro:", e); process.exit(1); });
