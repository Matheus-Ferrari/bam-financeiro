"""
Funções auxiliares genéricas.
"""

import re
import unicodedata
from typing import Any, List, Optional


def normalize_text(text: str) -> str:
    """Remove acentos e converte para minúsculas para facilitar comparações."""
    if not text:
        return ""
    text = unicodedata.normalize("NFD", str(text))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def find_column(columns: List[str], patterns: List[str]) -> Optional[str]:
    """Localiza o primeiro nome de coluna que corresponde a algum padrão."""
    for col in columns:
        col_norm = normalize_text(col).replace(" ", "_")
        for pattern in patterns:
            if re.search(pattern, col_norm):
                return col
    return None


def safe_float(value: Any, default: float = 0.0) -> float:
    """Conversão segura para float sem lançar exceção."""
    if value is None:
        return default
    try:
        return float(str(value).replace(",", ".").replace(" ", ""))
    except (ValueError, TypeError):
        return default


def chunks(lst: List, n: int):
    """Divide uma lista em pedaços de tamanho n."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]
