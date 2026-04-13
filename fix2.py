f = r"c:\Users\Meneleu\Desktop\Bam-FINANCEIRO\frontend\src\pages\FechamentoMes.jsx"
with open(f, "r", encoding="utf-8") as fp:
    text = fp.read()

# CP1252 0x80-0x9F range: correct Unicode codepoints
extra = [
    ("\u00c3\u0192", "\u00c3"),  # Ãƒ -> Ã  (0x83=U+0192 in CP1252)
    ("\u00c3\u201a", "\u00c2"),  # Ã‚ -> Â  (0x82=U+201A)
    ("\u00c3\u2021", "\u00c7"),  # Ã‡ -> Ç  (0x87=U+2021)
    ("\u00c3\u0160", "\u00ca"),  # ÃŠ -> Ê  (0x8A=U+0160)
    ("\u00c3\u2030", "\u00c9"),  # Ã‰ -> É  (0x89=U+2030)
    ("\u00c3\u201c", "\u00d3"),  # Ã" -> Ó  (0x93=U+201C)
    ("\u00c3\u201d", "\u00d4"),  # Ã" -> Ô  (0x94=U+201D)
    ("\u00c3\u0161", "\u00da"),  # Ãš -> Ú  (0x9A=U+0161)
    ("\u00c3\u203a", "\u00db"),  # Ã› -> Û  (0x9B=U+203A)
    ("\u00c3\u0178", "\u00df"),  # ÃŸ -> ß  (0x9F=U+0178)
    # Box drawing chars in JSX comments (not visible but clean up anyway)
    ("\u00e2\u201d\u20ac", "\u2500"),  # â"€ -> ─
    ("\u00e2\u201d\u201a", "\u2502"),  # â"‚ -> │
    ("\u00e2\u201d\u201c", "\u250c"),  # â"Œ -> ┌
    ("\u00e2\u201d\u2018", "\u2514"),  # â"" -> └
    ("\u00e2\u201d\u2022", "\u2015"),  # â"• -> ―
    # warning emoji â š -> ⚠
    ("\u00e2\u009a\u00a0", "\u26a0"),
    ("\u00e2\u009a\u00a1", "\u26a1"),
]
for old, new in extra:
    text = text.replace(old, new)

with open(f, "w", encoding="utf-8", newline="\n") as fp:
    fp.write(text)

remaining = sum(1 for line in text.splitlines() if "\u00c3\u0192" in line or "MÃŠS" in line or "NÃ" in line or "\u00c2\u0081" in line)
good = ["Ã§" not in text, "Ãµ" not in text, "Ã©" not in text, "â\u20ac\u201d" not in text]
print("Done! Capital-char fixes applied.")
print("Remaining issues:", sum(1 for line in text.splitlines() if any(x in line for x in ["\u00c3\u0192","MÃŠS","NÃƒ","CabeÃ"])))
