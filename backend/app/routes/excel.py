"""
Rota /excel — expõe informações sobre o arquivo Excel carregado.
"""

from fastapi import APIRouter, HTTPException
from app.services.excel_service import ExcelService

router = APIRouter()
_excel = ExcelService()


@router.get("/sheets")
def list_sheets():
    """Lista todas as abas detectadas no arquivo Excel."""
    try:
        info = _excel.get_sheets_info()
        return {
            "status": "ok",
            "arquivo": info["arquivo"],
            "carregado": info["carregado"],
            "abas": info["abas"],
            "total_abas": len(info["abas"]),
            "mapeamento": info["mapeamento"],
            "usando_mock": info["usando_mock"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
