"""
StorageService — persistência simples em JSON para clientes e cortes.
Arquitetura pronta para migração futura para PostgreSQL / SQLite.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"


class JsonStorage:
    """Armazenamento CRUD genérico baseado em arquivo JSON."""

    def __init__(self, filename: str):
        self._path = DATA_DIR / filename
        self._ensure_file()

    def _ensure_file(self) -> None:
        if not self._path.exists():
            self._path.write_text("[]", encoding="utf-8")

    def _read(self) -> List[Dict]:
        try:
            return json.loads(self._path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _write(self, data: List[Dict]) -> None:
        self._path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    def all(self) -> List[Dict]:
        return self._read()

    def get(self, id: str) -> Optional[Dict]:
        return next(
            (item for item in self._read() if str(item.get("id")) == str(id)), None
        )

    def create(self, data: Dict) -> Dict:
        items = self._read()
        item = {
            **data,
            "id": str(uuid.uuid4()),
            "criado_em": datetime.now().isoformat(),
        }
        items.append(item)
        self._write(items)
        return item

    def update(self, id: str, data: Dict) -> Optional[Dict]:
        items = self._read()
        for i, item in enumerate(items):
            if str(item.get("id")) == str(id):
                items[i] = {
                    **item,
                    **data,
                    "id": str(id),
                    "atualizado_em": datetime.now().isoformat(),
                }
                self._write(items)
                return items[i]
        return None

    def delete(self, id: str) -> bool:
        items = self._read()
        new_items = [item for item in items if str(item.get("id")) != str(id)]
        if len(new_items) < len(items):
            self._write(new_items)
            return True
        return False


# Singletons — um por entidade
clientes_storage = JsonStorage("clientes.json")
cortes_storage   = JsonStorage("cortes.json")
quick_updates_storage = JsonStorage("quick_updates.json")
movimentacoes_storage = JsonStorage("movimentacoes.json")
caixa_storage = JsonStorage("caixa.json")
projetos_adicionais_storage = JsonStorage("projetos_adicionais.json")
comissoes_storage = JsonStorage("comissoes.json")
despesas_locais_storage = JsonStorage("despesas_locais.json")
conciliacao_storage       = JsonStorage("conciliacao.json")
status_overrides_storage  = JsonStorage("status_overrides.json")
fechamento_storage        = JsonStorage("fechamento.json")
