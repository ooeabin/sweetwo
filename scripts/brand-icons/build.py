"""앱 아이콘, 심볼, 파비콘, og 이미지를 심볼 형상(geom.py)에서 다시 만듦.

python3 scripts/brand-icons/build.py   (numpy, scipy, pillow 필요)
- 앱 아이콘 계열(app-icon, app-icon-macos, apple-touch, symbol.png, og): Blender로 렌더링한 말랑 점토 3D(blender_scene.py).
  3D 원본은 한 번만 렌더링(약 5분)하고 3d-master.png로 둠. 형상이나 재질을 바꿨으면 --render로 다시.
- 파비콘(favicon-32/48)도 3D 원본을 줄임. symbol.svg만 같은 형상의 평면 한 색
형상 값을 바꾸면 docs/design/assets/Brand.md도 같이 고침.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from geom import pieces, svg_paths

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
B = os.path.join(ROOT, 'packages/ui/src/assets/brand')
GEO = dict(gap=80, crust_gap=80, crust_t=170)   # 원본 대비 틈 2배, 크러스트 1.4배
BRAND = '#FF7716'

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

MASTER = os.path.join(os.path.dirname(__file__), '3d-master.png')   # 심볼 폭 = 캔버스의 62%, 투명 바탕
MASTER_FRAC = 0.62
ICON_FRAC = 0.72   # 앱 아이콘 안 심볼 폭(Android 적응형 전경은 안전 영역 때문에 따로 62%)

def sym3d(size, frac):
    """3D 원본을 심볼 폭이 size*frac가 되게 줄여 size×size 투명 캔버스 가운데에"""
    m = Image.open(MASTER).convert('RGBA')
    n = round(m.width * size * frac / (m.width * MASTER_FRAC))
    r = m.resize((n, n), Image.LANCZOS)
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if n <= size: c.alpha_composite(r, ((size - n) // 2, (size - n) // 2))
    else: o = (n - size) // 2; c.alpha_composite(r.crop((o, o, o + size, o + size)))
    return c

def on_white(im):
    w = Image.new('RGBA', im.size, (255, 255, 255, 255)); w.alpha_composite(im); return w.convert('RGB')

def main():
    p = lambda *a: os.path.join(ROOT, *a)
    if '--render' in sys.argv or not os.path.exists(MASTER):
        import subprocess
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'blender_scene.py'), MASTER], check=True)
    icon = on_white(sym3d(1024, ICON_FRAC))
    icon.save(os.path.join(B, 'app-icon.png'), optimize=True)
    icon.save(p('apps/desktop/build/icon.png'), optimize=True)
    icon.resize((180, 180), Image.LANCZOS).save(os.path.join(B, 'apple-touch-icon.png'), optimize=True)
    # Mac: 흰 둥근 사각 판(824px, 그림자 포함)은 기존 파일 그대로, 가운데 심볼만 바꿈
    mac = Image.open(os.path.join(B, 'app-icon-macos.png')).convert('RGBA')
    ImageDraw.Draw(mac).rectangle((200, 180, 830, 850), fill=(255, 255, 255, 255))
    sym = sym3d(1024, ICON_FRAC * 824 / 1024)
    mac.alpha_composite(sym); mac.save(os.path.join(B, 'app-icon-macos.png'), optimize=True)
    sym3d(512, 0.84).save(os.path.join(B, 'symbol.png'), optimize=True)
    for n in (32, 48):
        # 파비콘도 3D 원본을 줄여 씀(평면 한 색은 앱 아이콘보다 짙어 보여서)
        f = sym3d(n * 8, 0.92).resize((n, n), Image.LANCZOS); f.save(os.path.join(B, f'favicon-{n}.png'), optimize=True)
    for q in ('apps/site/public/favicon-32.png', 'apps/mobile/public/favicon-32.png'):
        Image.open(os.path.join(B, 'favicon-32.png')).save(p(q), optimize=True)
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
    ImageDraw.Draw(og).rectangle((190, 150, 505, 500), fill=(255, 255, 255, 255))
    s3 = sym3d(420, 0.60)
    og.alpha_composite(s3, (347 - 210, 315 - 210)); og.convert('RGB').save(p('apps/site/public/og.png'), optimize=True)

if __name__ == '__main__':
    main()
