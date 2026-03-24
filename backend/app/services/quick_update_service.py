"""
Serviço de interpretação e aplicação de Atualização Rápida.
"""

import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, Optional

from app.services.operacao_service import OperacaoService
from app.services.storage_service import quick_updates_storage


class QuickUpdateService:
    def __init__(self):
        self.ops = OperacaoService()

    def _normalize(self, text: str) -> str:
        norm = unicodedata.normalize("NFD", str(text or "").lower())
        norm = "".join(c for c in norm if unicodedata.category(c) != "Mn")
        return " ".join(norm.split())

    def _extract_value(self, text: str) -> Optional[float]:
        # Suporta "1.200", "1200", "1,200", "1200,50"
        match = re.search(r"(\d{1,3}(?:[\.,]\d{3})*(?:[\.,]\d{1,2})?|\d+)", text)
        if not match:
            return None

        raw = match.group(1).strip()
        if "," in raw and "." in raw:
            if raw.rfind(",") > raw.rfind("."):
                raw = raw.replace(".", "").replace(",", ".")
            else:
                raw = raw.replace(",", "")
        elif "," in raw:
            parts = raw.split(",")
            if len(parts[-1]) <= 2:
                raw = raw.replace(".", "").replace(",", ".")
            else:
                raw = raw.replace(",", "")
        else:
            raw = raw.replace(".", "") if raw.count(".") > 1 else raw

        try:
            return float(raw)
        except Exception:
            return None

    def _extract_cliente(self, text: str) -> Optional[str]:
        patterns = [
            r"cliente\s+([a-z0-9\s]+?)\s+(pagou|ficou|como)",
            r"marcar\s+([a-z0-9\s]+?)\s+como\s+(pago|pendente)",
            r"entrada\s+de\s+[\d\.,]+\s+(?:da|do|de)\s+([a-z0-9\s]+)$",
            r"recebimento\s+de\s+[\d\.,]+\s+(?:da|do|de)\s+([a-z0-9\s]+)$",
            r"pagou\s+[\d\.,]+\s*(?:hoje)?$",
        ]

        txt = self._normalize(text)
        for pattern in patterns:
            m = re.search(pattern, txt)
            if m and m.groups():
                # Regra para "cliente x pagou" captura no grupo 1
                if pattern.endswith("pagou\\s+[\\d\\.,]+\\s*(?:hoje)?$"):
                    prefix = txt.split("pagou", 1)[0].strip()
                    if prefix.startswith("cliente "):
                        return prefix.replace("cliente ", "").strip().title()
                return str(m.group(1)).strip().title()

        if txt.startswith("marcar ") and " como " in txt:
            return txt.replace("marcar ", "").split(" como ")[0].strip().title()

        return None

    def _extract_date(self, text: str) -> str:
        txt = self._normalize(text)
        now = datetime.now()
        if "hoje" in txt:
            return now.isoformat()
        if "ontem" in txt:
            return now.replace(day=max(now.day - 1, 1)).isoformat()

        # formato dd/mm[/aaaa]
        m = re.search(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?", txt)
        if m:
            d = int(m.group(1))
            mo = int(m.group(2))
            y = m.group(3)
            year = int(y) if y else now.year
            if year < 100:
                year += 2000
            try:
                return datetime(year=year, month=mo, day=d).isoformat()
            except Exception:
                return now.isoformat()
        return now.isoformat()

    def parse(self, text: str) -> Dict[str, Any]:
        src = (text or "").strip()
        txt = self._normalize(src)
        value = self._extract_value(src)
        cliente = self._extract_cliente(src)
        parsed_date = self._extract_date(src)

        action_type = "desconhecida"
        status = None
        mov_tipo = None
        descricao = src

        if "atualizar caixa" in txt and "para" in txt:
            action_type = "atualizar_caixa"
            mov_tipo = "ajuste_caixa"
            descricao = "Atualização manual de caixa"
        elif "marcar" in txt and "como pago" in txt:
            action_type = "marcar_cliente_pago"
            status = "pago"
            mov_tipo = "recebimento"
            descricao = "Marcar cliente como pago"
        elif "marcar" in txt and "como pendente" in txt:
            action_type = "marcar_cliente_pendente"
            status = "pendente"
            mov_tipo = "recebimento"
            descricao = "Marcar cliente como pendente"
        elif "pagou" in txt:
            action_type = "adicionar_recebimento"
            status = "pago"
            mov_tipo = "recebimento"
            descricao = "Registrar recebimento de cliente"
        elif "registrar entrada" in txt:
            action_type = "registrar_entrada"
            mov_tipo = "entrada"
            descricao = "Registrar entrada manual"
        elif "registrar saida" in txt or "registrar saída" in txt:
            action_type = "registrar_saida"
            mov_tipo = "saida"
            descricao = "Registrar saída manual"
        elif "adicionar despesa" in txt:
            action_type = "adicionar_despesa"
            mov_tipo = "despesa"
            descricao = "Adicionar despesa manual"
        elif "adicionar recebimento" in txt:
            action_type = "adicionar_recebimento"
            mov_tipo = "recebimento"
            descricao = "Adicionar recebimento manual"

        warnings = []
        if action_type == "desconhecida":
            warnings.append("Não consegui identificar a ação com segurança.")
        if action_type != "marcar_cliente_pendente" and value is None:
            warnings.append("Valor não identificado.")
        if action_type in ["marcar_cliente_pago", "marcar_cliente_pendente", "adicionar_recebimento"] and not cliente:
            warnings.append("Cliente não identificado.")

        return {
            "ok": action_type != "desconhecida",
            "input": src,
            "parsed": {
                "action_type": action_type,
                "cliente": cliente,
                "valor": value,
                "data": parsed_date,
                "status": status,
                "tipo_movimentacao": mov_tipo,
                "descricao": descricao,
            },
            "warnings": warnings,
            "preview": {
                "titulo": "Prévia da atualização",
                "resumo": f"{descricao} | cliente={cliente or '-'} | valor={value if value is not None else '-'}",
            },
        }

    def apply(self, parsed_payload: Dict[str, Any], confirm: bool) -> Dict[str, Any]:
        if not confirm:
            return {
                "ok": False,
                "message": "Confirmação obrigatória para aplicar atualização.",
            }

        parsed = parsed_payload.get("parsed") or parsed_payload
        action = parsed.get("action_type")
        cliente = parsed.get("cliente")
        valor = parsed.get("valor")
        data_mov = parsed.get("data") or datetime.now().isoformat()
        descricao = parsed.get("descricao") or "Atualização rápida"
        status = parsed.get("status")

        resultado = {"ok": True, "action_type": action, "applied": []}

        if action == "atualizar_caixa":
            caixa = self.ops.update_caixa(valor_atual=valor or 0, observacao="Atualização rápida", origem="quick_update")
            resultado["applied"].append({"tipo": "caixa", "registro": caixa})

        elif action in ["marcar_cliente_pago", "marcar_cliente_pendente"]:
            atualizado = self.ops.atualizar_status_cliente(
                cliente_nome=cliente or "",
                status_pagamento="pago" if action == "marcar_cliente_pago" else "pendente",
                valor_recebido=valor,
                data_pagamento=data_mov,
                observacao="Atualização rápida",
            )
            if not atualizado:
                resultado["ok"] = False
                resultado["message"] = "Cliente não encontrado para atualização."
            else:
                resultado["applied"].append({"tipo": "cliente", "registro": atualizado})

        elif action in ["registrar_entrada", "registrar_saida", "adicionar_despesa", "adicionar_recebimento"]:
            tipo = {
                "registrar_entrada": "entrada",
                "registrar_saida": "saida",
                "adicionar_despesa": "despesa",
                "adicionar_recebimento": "recebimento",
            }[action]
            registro = self.ops.registrar_movimentacao(
                {
                    "tipo": tipo,
                    "descricao": descricao,
                    "valor": valor or 0,
                    "data": data_mov,
                    "cliente_relacionado": cliente,
                    "categoria": "operacional",
                    "observacao": "Lançado via atualização rápida",
                },
                origem="quick_update",
            )
            resultado["applied"].append({"tipo": "movimentacao", "registro": registro})

            if action == "adicionar_recebimento" and cliente:
                atualizado = self.ops.atualizar_status_cliente(
                    cliente_nome=cliente,
                    status_pagamento="pago",
                    valor_recebido=valor,
                    data_pagamento=data_mov,
                    observacao="Recebimento via atualização rápida",
                )
                if atualizado:
                    resultado["applied"].append({"tipo": "cliente", "registro": atualizado})

        else:
            resultado["ok"] = False
            resultado["message"] = "Ação não suportada para aplicação."

        quick_updates_storage.create(
            {
                "input": parsed_payload.get("input") or "",
                "parsed": parsed,
                "confirmado": bool(confirm),
                "resultado": resultado,
                "created_at": datetime.now().isoformat(),
            }
        )

        return resultado
