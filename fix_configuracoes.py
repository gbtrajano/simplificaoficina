import re

with open("src/pages/Configuracoes.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the corrupted classNames
corrupted_btn = """className={
elative inline-flex h-6 w-11 items-center rounded-full transition-colors }"""

corrupted_span = """className={inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform }"""

content = content.replace('onClick={() => setPix({ ...pix, enabled: !pix.enabled })}\n                className={\nelative inline-flex h-6 w-11 items-center rounded-full transition-colors }', 'onClick={() => setPix({ ...pix, enabled: !pix.enabled })}\n                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${pix.enabled ? "bg-brand-500" : "bg-ink-200"}`}')

content = content.replace('onClick={() => setCard({ ...card, enabled: !card.enabled })}\n                className={\nelative inline-flex h-6 w-11 items-center rounded-full transition-colors }', 'onClick={() => setCard({ ...card, enabled: !card.enabled })}\n                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${card.enabled ? "bg-brand-500" : "bg-ink-200"}`}')

content = content.replace('<span className={inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform } />', '<span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pix.enabled ? "translate-x-6" : "translate-x-1"}`} />', 1)

content = content.replace('<span className={inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform } />', '<span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${card.enabled ? "translate-x-6" : "translate-x-1"}`} />', 1)

with open("src/pages/Configuracoes.tsx", "w", encoding="utf-8") as f:
    f.write(content)
