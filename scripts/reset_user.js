const admin  = require("../functions/node_modules/firebase-admin");
const crypto = require("crypto");
const path   = require("path");

const serviceAccount = require(path.join(__dirname, "..", "bam-financeiro-key.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  const email    = "financeiro@bamassessoria.com";
  const password = "bam8080";

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");

  // Apagar usuário antigo se existir
  const snap = await db.collection("usuarios").where("email", "==", email).get();
  for (const doc of snap.docs) await doc.ref.delete();
  if (!snap.empty) console.log(`🗑  Removido usuário antigo (${snap.size} doc).`);

  // Criar novo
  await db.collection("usuarios").add({
    email,
    nome:       "BAM Financeiro",
    role:       "admin",
    ativo:      true,
    salt,
    senha_hash: hash,
    criado_em:  new Date().toISOString(),
  });

  console.log(`✅ Usuário criado: ${email} / ${password}`);
  process.exit(0);
}

run().catch(e => { console.error("❌", e); process.exit(1); });
