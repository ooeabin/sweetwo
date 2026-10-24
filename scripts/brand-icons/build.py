"""앱 아이콘, 심볼, 파비콘, og 이미지를 심볼 형상(geom.py)에서 다시 만듦.

python3 scripts/brand-icons/build.py   (numpy, scipy, pillow 필요)
- 앱 아이콘 계열(app-icon, app-icon-macos, apple-touch, symbol.png, og): 말랑한 무광 3D(render.py)
- 작은 자리(favicon-32/48)와 symbol.svg: 같은 형상의 평면 한 색
형상 값을 바꾸면 docs/design/assets/Brand.md도 같이 고침.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from geom import pieces, svg_paths
from render import render

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
B = os.path.join(ROOT, 'packages/ui/src/assets/brand')
GEO = dict(gap=80, crust_gap=80, crust_t=170)   # 원본 대비 틈 2배, 크러스트 1.4배
BRAND = '#FF6F0F'

def flat(size, frac, ss=8):
    geo = pieces(**GEO)
    allp = [p for k in geo for p in geo[k]]
    xs = [p[0] for p in allp]; ys = [p[1] for p in allp]
    cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    S = size * ss; k = S * frac / max(max(xs) - min(xs), max(ys) - min(ys))
    m = Image.new('L', (S, S), 0); d = ImageDraw.Draw(m)
    for pts in geo.values():
        d.polygon([((x - cx) * k + S / 2, (y - cy) * k + S / 2) for x, y in pts], fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    im = Image.new('RGBA', (size, size), BRAND); im.putalpha(m); return im

def main():
    p = lambda *a: os.path.join(ROOT, *a)
    icon = render(size=1024, frac=0.62, **GEO)
    icon.save(os.path.join(B, 'app-icon.png'), optimize=True)
    icon.save(p('apps/desktop/build/icon.png'), optimize=True)
    icon.resize((180, 180), Image.LANCZOS).save(os.path.join(B, 'apple-touch-icon.png'), optimize=True)
    # Mac: 흰 둥근 사각 판(824px, 그림자 포함)은 기존 파일 그대로, 가운데 심볼만 바꿈
    mac = Image.open(os.path.join(B, 'app-icon-macos.png')).convert('RGBA')
    ImageDraw.Draw(mac).rectangle((200, 180, 830, 850), fill=(255, 255, 255, 255))
    sym = render(size=1024, frac=0.62 * 824 / 1024, bg=None, **GEO)
    mac.alpha_composite(sym); mac.save(os.path.join(B, 'app-icon-macos.png'), optimize=True)
    render(size=512, frac=0.84, bg=None, **GEO).save(os.path.join(B, 'symbol.png'), optimize=True)
    for n in (32, 48):
        f = flat(n, 0.92); f.save(os.path.join(B, f'favicon-{n}.png'), optimize=True)
    flat(32, 0.92).save(p('apps/site/public/favicon-32.png'), optimize=True)
    flat(32, 0.92).save(p('apps/mobile/public/favicon-32.png'), optimize=True)
    # symbol.svg(평면 원본)
    geo = pieces(**GEO)
    allp = [q for k in geo for q in geo[k]]
    x0 = min(q[0] for q in allp); y0 = min(q[1] for q in allp)
    w = max(q[0] for q in allp) - x0; h = max(q[1] for q in allp) - y0; s = max(w, h)
    vb = f'{x0 - (s - w) / 2 - 20:.1f} {y0 - (s - h) / 2 - 20:.1f} {s + 40:.1f} {s + 40:.1f}'
    paths = ''.join(f'<path fill="{BRAND}" d="{d}"/>' for d in svg_paths(**GEO))
    open(os.path.join(B, 'symbol.svg'), 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><title>sweeTwo</title>{paths}</svg>')
    # og: 왼쪽 심볼 자리만 3D 심볼로(워드마크는 그대로)
    og = Image.open(p('apps/site/public/og.png')).convert('RGBA')
    ImageDraw.Draw(og).rectangle((215, 175, 480, 455), fill=(255, 255, 255, 255))
    s3 = render(size=420, frac=0.60, bg=None, **GEO)
    og.alpha_composite(s3, (347 - 210, 315 - 210)); og.convert('RGB').save(p('apps/site/public/og.png'), optimize=True)

if __name__ == '__main__':
    main()
