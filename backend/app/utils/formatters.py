"""
Utilitários de formatação de valores.
"""

from typing import Optional


def format_currency(value: float, symbol: str = "R$") -> str:
    """Formata float para moeda brasileira: R$ 1.234,56"""
    if value is None:
        return "—"
    formatted = f"{abs(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    sinal = "-" if value < 0 else ""
    return f"{sinal}{symbol} {formatted}"


def format_percent(value: float, decimals: int = 1) -> str:
    """Formata percentual: 32,5%"""
    if value is None:
        return "—"
    return f"{value:.{decimals}f}%".replace(".", ",")


def parse_br_currency(value) -> Optional[float]:
    """Converte string de moeda BR para float. Ex: 'R$ 1.234,56' → 1234.56"""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        v = str(value).strip()
        v = v.replace("R$", "").replace(" ", "")
        v = v.replace(".", "").replace(",", ".")
        return float(v)
    except (ValueError, AttributeError):
        return None
