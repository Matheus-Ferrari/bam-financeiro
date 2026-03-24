"""
Health Check — verifica se a API está operacional.
"""

from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "sistema": "BAM Financeiro",
        "versao": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }
