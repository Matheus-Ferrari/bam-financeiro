"""
ExcelService — carrega e interpreta o arquivo Excel da BAM.
Robusto: funções de fallback garantem operação mesmo sem o arquivo perfeito.
"""

import re
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

# Localização do arquivo Excel
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
EXCEL_FILE = DATA_DIR / "Financeiro_BAM_Fase1_BI.xlsx"

# Palavras-chave para mapear abas por nome
SHEET_KEYWORDS: Dict[str, List[str]] = {
    "base":      ["base", "financeiro", "lancamento", "dado", "data", "geral"],
    "resumo":    ["resumo", "summary", "mensal", "consolidado", "visao"],
    "receitas":  ["receita", "faturamento", "entrada", "revenue", "recebimento"],
    "despesas":  ["despesa", "gasto", "custo", "saida", "expense", "pagamento"],
    "projecoes": ["projecao", "forecast", "cenario", "projetado"],
    "cenarios":  ["cenario", "scenario", "corte", "reducao"],
}


class ExcelService:
    def __init__(self):
        self._workbook: Optional[pd.ExcelFile] = None
        self._load_workbook()

    # ------------------------------------------------------------------
    # Carregamento
    # ------------------------------------------------------------------

    def _load_workbook(self) -> None:
        """Tenta abrir o arquivo Excel; registra aviso se não encontrado."""
        try:
            if EXCEL_FILE.exists():
                self._workbook = pd.ExcelFile(EXCEL_FILE, engine="openpyxl")
                logger.info("Excel carregado: %s", EXCEL_FILE)
            else:
                logger.warning("Arquivo não encontrado: %s — usando dados mock.", EXCEL_FILE)
                self._workbook = None
        except Exception as exc:
            logger.error("Erro ao carregar Excel: %s", exc)
            self._workbook = None

    def is_loaded(self) -> bool:
        return self._workbook is not None

    # ------------------------------------------------------------------
    # Listagem de abas
    # ------------------------------------------------------------------

    def get_sheet_names(self) -> List[str]:
        if self._workbook:
            return list(self._workbook.sheet_names)
        return []

    def _find_sheet(self, group: str) -> Optional[str]:
        """Retorna o nome da aba que melhor corresponde ao grupo informado."""
        if not self._workbook:
            return None
        keywords = SHEET_KEYWORDS.get(group, [])
        for sheet in self._workbook.sheet_names:
            normalized = _normalize_str(sheet)
            for kw in keywords:
                if kw in normalized:
                    return sheet
        return None

    # ------------------------------------------------------------------
    # Leitura de DataFrames
    # ------------------------------------------------------------------

    def read_sheet(self, sheet_name: str) -> Optional[pd.DataFrame]:
        """Lê uma aba e retorna DataFrame normalizado."""
        if not self._workbook or sheet_name not in self._workbook.sheet_names:
            return None
        try:
            df = pd.read_excel(self._workbook, sheet_name=sheet_name, engine="openpyxl")
            df = df.dropna(how="all").dropna(axis=1, how="all")
            df.columns = [_normalize_col(c) for c in df.columns]
            return df
        except Exception as exc:
            logger.error("Erro ao ler aba '%s': %s", sheet_name, exc)
            return None

    def get_dataframe_for(self, group: str) -> Optional[pd.DataFrame]:
        """Retorna o DataFrame da aba identificada para o grupo."""
        sheet = self._find_sheet(group)
        if sheet:
            return self.read_sheet(sheet)
        return None

    # ------------------------------------------------------------------
    # Leitura direta das abas de dados
    # ------------------------------------------------------------------

    def get_base_receitas(self) -> Optional[pd.DataFrame]:
        """Lê a aba 'Base Receitas' diretamente do disco (sempre atualizado)."""
        if not EXCEL_FILE.exists():
            return None
        try:
            df = pd.read_excel(EXCEL_FILE, sheet_name="Base Receitas", engine="openpyxl")
            return df.dropna(how="all")
        except Exception as exc:
            logger.error("Erro ao ler 'Base Receitas': %s", exc)
            return None

    def get_base_despesas(self) -> Optional[pd.DataFrame]:
        """Lê a aba 'Base Despesas' diretamente do disco (sempre atualizado)."""
        if not EXCEL_FILE.exists():
            return None
        try:
            df = pd.read_excel(EXCEL_FILE, sheet_name="Base Despesas", engine="openpyxl")
            return df.dropna(how="all")
        except Exception as exc:
            logger.error("Erro ao ler 'Base Despesas': %s", exc)
            return None

    # ------------------------------------------------------------------
    # Info pública
    # ------------------------------------------------------------------

    def get_sheets_info(self) -> Dict[str, Any]:
        names = self.get_sheet_names()
        mapeamento = {}
        for group in SHEET_KEYWORDS:
            found = self._find_sheet(group)
            if found:
                mapeamento[group] = found
        return {
            "arquivo": str(EXCEL_FILE),
            "carregado": self.is_loaded(),
            "abas": names,
            "mapeamento": mapeamento,
            "usando_mock": not self.is_loaded(),
        }


# ------------------------------------------------------------------
# Helpers internos
# ------------------------------------------------------------------

def _normalize_str(text: str) -> str:
    """Remove acentos, espaços e converte para minúsculas."""
    import unicodedata
    text = unicodedata.normalize("NFD", str(text).lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[\s_\-]", "", text)


def _normalize_col(col: Any) -> str:
    """Normaliza nome de coluna para snake_case sem acentos."""
    col = str(col).strip().lower()
    import unicodedata
    col = unicodedata.normalize("NFD", col)
    col = "".join(c for c in col if unicodedata.category(c) != "Mn")
    col = re.sub(r"[\s\-/\\()]+", "_", col)
    col = re.sub(r"[^a-z0-9_]", "", col)
    return col.strip("_") or "col"
