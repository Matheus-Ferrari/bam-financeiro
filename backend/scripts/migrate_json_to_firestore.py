"""
migrate_json_to_firestore.py
────────────────────────────
Script de migração única: lê os arquivos JSON do diretório /data e popula
o Firestore na coleção companies/{COMPANY_ID}/...

Como usar:
  1. Configure o .env com FIREBASE_CREDENTIALS_PATH, FIREBASE_PROJECT_ID e FIREBASE_COMPANY_ID
  2. Execute a partir do diretório backend/:
       python scripts/migrate_json_to_firestore.py

Entidades migradas:
  clientes, cortes, projetos_adicionais, comissoes, despesas_locais,
  movimentacoes, caixa, quick_updates, conciliacao, status_overrides

NOTA: receitas e despesas que eram lidas do Excel NÃO são migradas por este
script. Para importar dados do Excel, use docs/SETUP_FIREBASE.md §6.
"""

import json
import sys
from pathlib import Path

# ── Bootstrap do ambiente ─────────────────────────────────────────────────
ROOT     = Path(__file__).resolve().parents[1]          # backend/
DATA_DIR = ROOT.parent / "data"
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from app.firebase_app import get_db, COMPANY_ID

# ── Mapeamento arquivo → coleção ──────────────────────────────────────────
COLLECTIONS = {
    "clientes.json":           "clientes",
    "cortes.json":             "cortes",
    "projetos_adicionais.json":"projetos_adicionais",
    "comissoes.json":          "comissoes",
    "despesas_locais.json":    "despesas_locais",
    "movimentacoes.json":      "movimentacoes",
    "caixa.json":              "caixa",
    "quick_updates.json":      "quick_updates",
    "conciliacao.json":        "conciliacao",
    "status_overrides.json":   "status_overrides",
}


def migrate():
    db   = get_db()
    base = db.collection("companies").document(COMPANY_ID)
    print(f"[migração] empresa = {COMPANY_ID}")

    # Garante que o documento da empresa existe
    if not base.get().exists:
        base.set({"companyId": COMPANY_ID, "nome": COMPANY_ID, "criadoEm": _now()})
        print(f"  → documento companies/{COMPANY_ID} criado")

    for filename, collection in COLLECTIONS.items():
        path = DATA_DIR / filename
        if not path.exists():
            print(f"  [skip] {filename} não encontrado")
            continue

        items = json.loads(path.read_text(encoding="utf-8"))
        if not items:
            print(f"  [skip] {filename} está vazio")
            continue

        coll_ref = base.collection(collection)
        batch    = db.batch()
        count    = 0
        for item in items:
            doc_id = str(item.get("id") or _gen_id())
            data   = {k: v for k, v in item.items() if k != "id"}
            batch.set(coll_ref.document(doc_id), data)
            count += 1
            # Firestore aceita até 500 operações por batch
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
        print(f"  [ok] {filename} → companies/{COMPANY_ID}/{collection} ({count} docs)")

    print("[migração] concluída ✓")


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _gen_id() -> str:
    import uuid
    return str(uuid.uuid4())


if __name__ == "__main__":
    migrate()
