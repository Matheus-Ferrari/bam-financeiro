"""
import_excel_to_firestore.py
───────────────────────────
Script de migração inicial único (one-shot): lê o arquivo Excel de dados
históricos e importa receitas e despesas para o Firestore.

Idempotente: usa um campo ``legacy_key`` (hash SHA-256 dos campos
identificadores) para evitar duplicatas em execuções repetidas.

Pré-requisitos:
  pip install openpyxl pandas

Como usar (a partir de backend/):
  python scripts/import_excel_to_firestore.py [--excel CAMINHO] [--company COMPANY_ID]

  Argumentos opcionais:
    --excel   caminho para o .xlsx  (padrão: ../data/Financeiro_BAM_Fase1_BI.xlsx)
    --company company_id no Firestore (padrão: valor de FIREBASE_COMPANY_ID)
    --dry-run apenas mostra o que faria, sem gravar no Firestore

Estrutura esperada do Excel:
  Aba "Base Receitas" — colunas: Mês, Serviço, Cliente, Descrição, Valor Previsto, Status, Pagamento
  Aba "Base Despesas" — colunas: Mês, Categoria, Despesa, Valor, Status, Pagamento

Mapeamento para Firestore:
  receitas: mes, servico, cliente, descricao, valor_previsto, status, pagamento, legacy_key
  despesas: mes, categoria, descricao, valor,   status, pagamento, legacy_key
"""

import argparse
import hashlib
import logging
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── Bootstrap do ambiente Python ──────────────────────────────────────────
ROOT     = Path(__file__).resolve().parents[1]   # backend/
DATA_DIR = ROOT.parent / "data"
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("import_excel")

# ── Constantes ────────────────────────────────────────────────────────────
DEFAULT_EXCEL = DATA_DIR / "Financeiro_BAM_Fase1_BI.xlsx"
SHEET_RECEITAS = "Base Receitas"
SHEET_DESPESAS = "Base Despesas"


# ── Helpers ───────────────────────────────────────────────────────────────

def _normalize_col(col: Any) -> str:
    """Converte nome de coluna Excel para snake_case sem acentos."""
    col = str(col).strip().lower()
    col = unicodedata.normalize("NFD", col)
    col = "".join(c for c in col if unicodedata.category(c) != "Mn")
    col = re.sub(r"[\s\-/\\()]+", "_", col)
    col = re.sub(r"[^a-z0-9_]", "", col)
    return col.strip("_") or "col"


def _safe_str(val: Any) -> str:
    """Converte valor para string limpa, tratando NaN como string vazia."""
    if val is None:
        return ""
    try:
        import math
        if math.isnan(float(val)):
            return ""
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return "" if s.lower() == "nan" else s


def _safe_float(val: Any) -> float:
    """Converte valor para float, retornando 0.0 em caso de erro."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _legacy_key(*parts: str) -> str:
    """Hash SHA-256 dos campos identificadores — usado como chave de upsert."""
    raw = "|".join(p.strip().lower() for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _load_sheet(excel_path: Path, sheet_name: str) -> Optional[Any]:
    """Lê uma aba do Excel e normaliza os nomes das colunas."""
    try:
        import pandas as pd
        df = pd.read_excel(excel_path, sheet_name=sheet_name, engine="openpyxl")
        df = df.dropna(how="all")
        df.columns = [_normalize_col(c) for c in df.columns]
        logger.info("  %-18s: %d linhas lidas.", sheet_name, len(df))
        return df
    except Exception as exc:
        logger.error("Erro ao ler aba '%s': %s", sheet_name, exc)
        return None


# ── Transformadores ───────────────────────────────────────────────────────

def _row_to_receita(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Transforma uma linha (dict com colunas normalizadas) em um doc de receita.

    Mapeamento:
      mes           ← mes
      servico       ← servico
      cliente       ← cliente
      descricao     ← descricao
      valor_previsto← valor_previsto
      status        ← status
      pagamento     ← pagamento
    """
    mes            = _safe_str(row.get("mes", ""))
    servico        = _safe_str(row.get("servico", ""))
    cliente        = _safe_str(row.get("cliente", ""))
    descricao      = _safe_str(row.get("descricao", ""))
    valor_previsto = _safe_float(row.get("valor_previsto", 0))
    status_raw     = _safe_str(row.get("status", ""))
    pagamento      = _safe_str(row.get("pagamento", ""))

    # Normaliza status (PAGO ou Pendente)
    status = "Recebido" if status_raw.upper() == "PAGO" else "Pendente"

    # Descarta linhas completamente em branco
    if not mes and not cliente and valor_previsto == 0:
        return None

    key = _legacy_key(mes, cliente, descricao, str(valor_previsto), servico)
    return {
        "mes":            mes,
        "servico":        servico,
        "cliente":        cliente,
        "descricao":      descricao,
        "valor_previsto": valor_previsto,
        "status":         status,
        "pagamento":      pagamento,
        "origem":         "receita_fixa",
        "legacy_key":     key,
    }


def _row_to_despesa(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Transforma uma linha (dict com colunas normalizadas) em um doc de despesa.

    Mapeamento:
      mes       ← mes
      categoria ← categoria
      descricao ← despesa  (coluna "Despesa" no Excel → campo "descricao" no Firestore)
      valor     ← valor
      status    ← status
      pagamento ← pagamento
    """
    mes       = _safe_str(row.get("mes", ""))
    categoria = _safe_str(row.get("categoria", ""))
    descricao = _safe_str(row.get("despesa", "") or row.get("descricao", ""))
    valor     = _safe_float(row.get("valor", 0))
    status    = _safe_str(row.get("status", "Pendente")) or "Pendente"
    pagamento = _safe_str(row.get("pagamento", ""))

    # Descarta linhas completamente em branco
    if not mes and not categoria and valor == 0:
        return None

    key = _legacy_key(mes, categoria, descricao, str(valor))
    return {
        "mes":        mes,
        "categoria":  categoria,
        "descricao":  descricao,
        "valor":      valor,
        "status":     status,
        "pagamento":  pagamento,
        "legacy_key": key,
    }


# ── Importação ────────────────────────────────────────────────────────────

def _import_collection(
    repo,
    records: List[Dict[str, Any]],
    dry_run: bool,
) -> Tuple[int, int, int]:
    """
    Importa uma lista de registros para um repositório Firestore.

    Retorna (criados, atualizados, ignorados).
    """
    criados = atualizados = ignorados = 0

    for rec in records:
        legacy_key = rec.get("legacy_key", "")
        if not legacy_key:
            ignorados += 1
            continue

        if dry_run:
            logger.info("  [dry-run] upsert legacy_key=%s  mes=%s", legacy_key[:8], rec.get("mes"))
            criados += 1
            continue

        existing = repo.find_by("legacy_key", legacy_key)
        if existing:
            repo.update(str(existing[0]["id"]), rec)
            atualizados += 1
        else:
            repo.create(rec)
            criados += 1

    return criados, atualizados, ignorados


def run(excel_path: Path, company_id: str, dry_run: bool) -> None:
    """Executa a importação completa do Excel para o Firestore."""
    import pandas as pd  # importado aqui para dar erro claro se não instalado

    if not excel_path.exists():
        logger.error(
            "Arquivo Excel não encontrado: %s\n"
            "  → Forneça o caminho correto via --excel CAMINHO",
            excel_path,
        )
        sys.exit(1)

    logger.info("═" * 60)
    logger.info("Importação Excel → Firestore")
    logger.info("  Excel   : %s", excel_path)
    logger.info("  Empresa : %s", company_id)
    logger.info("  Dry-run : %s", dry_run)
    logger.info("═" * 60)

    # ── Inicializa Firebase ───────────────────────────────────────────
    from app.firebase_app import get_db, COMPANY_ID as DEFAULT_COMPANY
    if not dry_run:
        get_db()  # valida credenciais cedo

    from app.repositories.base import FirestoreRepository
    receitas_repo = FirestoreRepository("receitas", company_id)
    despesas_repo = FirestoreRepository("despesas", company_id)

    # ── Receitas ──────────────────────────────────────────────────────
    logger.info("")
    logger.info("── Aba \"%s\" ──", SHEET_RECEITAS)
    df_r = _load_sheet(excel_path, SHEET_RECEITAS)
    if df_r is not None:
        records_r = [r for r in (
            _row_to_receita(row) for row in df_r.to_dict(orient="records")
        ) if r is not None]
        logger.info("  %d registros válidos encontrados.", len(records_r))
        c, u, i = _import_collection(receitas_repo, records_r, dry_run)
        logger.info("  Receitas → criados: %d | atualizados: %d | ignorados: %d", c, u, i)
    else:
        logger.warning("  Aba '%s' não encontrada — pulando receitas.", SHEET_RECEITAS)

    # ── Despesas ──────────────────────────────────────────────────────
    logger.info("")
    logger.info("── Aba \"%s\" ──", SHEET_DESPESAS)
    df_d = _load_sheet(excel_path, SHEET_DESPESAS)
    if df_d is not None:
        records_d = [r for r in (
            _row_to_despesa(row) for row in df_d.to_dict(orient="records")
        ) if r is not None]
        logger.info("  %d registros válidos encontrados.", len(records_d))
        c, u, i = _import_collection(despesas_repo, records_d, dry_run)
        logger.info("  Despesas → criados: %d | atualizados: %d | ignorados: %d", c, u, i)
    else:
        logger.warning("  Aba '%s' não encontrada — pulando despesas.", SHEET_DESPESAS)

    logger.info("")
    logger.info("═" * 60)
    logger.info("Importação %s.", "simulada (dry-run)" if dry_run else "concluída")
    logger.info("═" * 60)


# ── Entrada principal ─────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Importa receitas e despesas do Excel para o Firestore (idempotente)."
    )
    parser.add_argument(
        "--excel",
        default=str(DEFAULT_EXCEL),
        help=f"Caminho para o .xlsx  (padrão: {DEFAULT_EXCEL})",
    )
    parser.add_argument(
        "--company",
        default=None,
        help="company_id no Firestore (padrão: FIREBASE_COMPANY_ID do .env)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula a importação sem gravar no Firestore.",
    )
    args = parser.parse_args()

    # company_id: argumento CLI > env var > "bam"
    import os
    company = args.company or os.getenv("FIREBASE_COMPANY_ID", "bam")

    run(
        excel_path=Path(args.excel),
        company_id=company,
        dry_run=args.dry_run,
    )
