"""PDF 요약(S-18)에 넣을 고정 굵기 글꼴 만들기.

디자인 글꼴 SUIT Variable(docs/design/fonts, SIL OFL 1.1)에서 400(Regular)·700(Bold) 굵기만 뽑아
packages/app/src/assets/pdf-fonts/에 TTF로 씀. PDF 라이브러리(pdf-lib)가 가변 글꼴·woff2를 못 넣어서 필요함.
글꼴을 바꾸면 다시 실행: python3 scripts/pdf-fonts.py (fonttools, brotli 필요)
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/design/fonts/SUIT-Variable.woff2'
OUT = ROOT / 'packages/app/src/assets/pdf-fonts'

for weight, style in ((400, 'Regular'), (700, 'Bold')):
    font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': weight}, updateFontNames=False)
    font.flavor = None
    for rec in font['name'].names:
        if rec.nameID in (1, 16):
            rec.string = 'SUIT'
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 4:
            rec.string = f'SUIT {style}'
        elif rec.nameID == 6:
            rec.string = f'SUIT-{style}'
    font.save(OUT / f'SUIT-{style}.ttf')
    print(OUT / f'SUIT-{style}.ttf')
