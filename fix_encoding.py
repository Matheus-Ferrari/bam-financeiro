import sys

f = r"c:\Users\Meneleu\Desktop\Bam-FINANCEIRO\frontend\src\pages\FechamentoMes.jsx"

with open(f, "r", encoding="utf-8") as fp:
    text = fp.read()

# Comprehensive mojibake fix: these are chars that got double-encoded
# (UTF-8 bytes read as CP1252 then stored back as UTF-8)
replacements = [
    # 2-byte sequences (Latin-1 chars U+00C0-U+00FF)
    ("\u00c3\u00a7", "\u00e7"),  # Ã§ -> ç
    ("\u00c3\u00a3", "\u00e3"),  # Ã£ -> ã
    ("\u00c3\u00b5", "\u00f5"),  # Ãµ -> õ
    ("\u00c3\u00a9", "\u00e9"),  # Ã© -> é
    ("\u00c3\u00a1", "\u00e1"),  # Ã¡ -> á
    ("\u00c3\u00ad", "\u00ed"),  # Ã­ -> í
    ("\u00c3\u00b3", "\u00f3"),  # Ã³ -> ó
    ("\u00c3\u00ba", "\u00fa"),  # Ãº -> ú
    ("\u00c3\u00a0", "\u00e0"),  # Ã  -> à
    ("\u00c3\u0087", "\u00c7"),  # Ã‡ -> Ç
    ("\u00c3\u0089", "\u00c9"),  # Ã‰ -> É
    ("\u00c3\u0081", "\u00c1"),  # Ã? -> Á
    ("\u00c3\u0093", "\u00d3"),  # Ã" -> Ó
    ("\u00c3\u009a", "\u00da"),  # Ãš -> Ú
    ("\u00c3\u0094", "\u00d4"),  # Ã" -> Ô
    ("\u00c3\u00a2", "\u00e2"),  # Ã¢ -> â
    ("\u00c3\u00aa", "\u00ea"),  # Ãª -> ê
    ("\u00c3\u00ae", "\u00ee"),  # Ã® -> î
    ("\u00c3\u00b4", "\u00f4"),  # Ã´ -> ô
    ("\u00c3\u00bb", "\u00fb"),  # Ã» -> û
    ("\u00c3\u00b9", "\u00f9"),  # Ã¹ -> ù
    ("\u00c3\u0086", "\u00c6"),  # Ã† -> Æ
    ("\u00c3\u009f", "\u00df"),  # ÃŸ -> ß
    # Â patterns (U+00C2 as first byte)
    ("\u00c2\u00b0", "\u00b0"),  # Â° -> °
    ("\u00c2\u00b7", "\u00b7"),  # Â· -> ·
    ("\u00c2\u00a0", " "),        # Â  -> (regular space, was &nbsp;)
    ("\u00c2\u00bd", "\u00bd"),  # Â½ -> ½
    ("\u00c2\u00bc", "\u00bc"),  # Â¼ -> ¼
    # 3-byte sequences (CP1252 special chars U+0080-U+009F)
    # em dash — U+2014: E2 80 94 -> CP1252: â(E2) €(80=U+20AC) "(94=U+201D)
    ("\u00e2\u20ac\u201d", "\u2014"),   # â€" -> —
    # en dash – U+2013: E2 80 93 -> â€"  (93=U+201C)
    ("\u00e2\u20ac\u201c", "\u2013"),   # â€" -> –
    # ellipsis … U+2026: E2 80 A6 -> â€¦ (A6=U+00A6)
    ("\u00e2\u20ac\u00a6", "\u2026"),   # â€¦ -> …
    # left single ' U+2018: E2 80 98 -> â€˜ (98=U+02DC tilde)
    ("\u00e2\u20ac\u02dc", "\u2018"),   # â€˜ -> '
    # right single ' U+2019: E2 80 99 -> â€™ (99=U+2122 trademark)
    ("\u00e2\u20ac\u2122", "\u2019"),   # â€™ -> '
    # left double " U+201C: E2 80 9C -> â€œ (9C=U+0153)
    ("\u00e2\u20ac\u0153", "\u201c"),   # â€œ -> "
    # right double " U+201D: E2 80 9D -> â€ (9D undefined, skip)
    # bullet • U+2022: E2 80 A2 -> â€¢ (A2=U+00A2 cent)
    ("\u00e2\u20ac\u00a2", "\u2022"),   # â€¢ -> •
    # arrow right → U+2192: E2 86 92 -> â†' (86=U+2020†, 92=U+2019')
    ("\u00e2\u2020\u2019", "\u2192"),   # â†' -> →
    # nbsp &nbsp; U+00A0 as 2-byte: C2 A0 -> already handled above
]

for old, new in replacements:
    text = text.replace(old, new)

# Also strip any remaining garbled emoji (appear as high surrogates encoded weirdly)
import re
text = re.sub(r'[\ufffd]', '', text)  # remove replacement chars

# Fix broken template literals in Comissoes section (backticks consumed by PS)
text = text.replace(
    "style={{ background: ${k.color}10, border: 1px solid 20 }}>",
    "style={{ background: `${k.color}10`, border: `1px solid ${k.color}20` }}>"
)

with open(f, "w", encoding="utf-8", newline="\n") as fp:
    fp.write(text)

print("Done!")
# Count remaining garbled
remaining = sum(1 for line in text.splitlines() if "Ã" in line or "â€" in line)
print(f"Remaining garbled lines: {remaining}")
