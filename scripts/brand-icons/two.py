"""앱 아이콘 ‘Two’(2026-11-06): 브랜드 오렌지 바탕 + 흰 워드마크 ‘Two’(logo-cherry.svg 뒤 세 글자). 파이 차트 앱 아이콘을 바꿈.

python3 scripts/brand-icons/two.py   (pillow, node + playwright 필요)
만드는 것: symbol.png(512, 둥근 사각 앱 아이콘, 모서리 투명)와 symbol.svg(같은 그림 벡터), og.png(공유 이미지), app-icon.png, apple-touch-icon.png, favicon-32/48.png(디자인 시스템 Brand),
iOS AppIcon, Android 런처(적응형 전경 + 바탕 색, 예전 방식 정사각·원형), 사이트·모바일 파비콘.
글자 크기는 아래 FRAC(캔버스 폭 대비 Two 폭). 바꾸면 docs/spec/04-brand.md ‘앱 아이콘’도 같이 고침.
"""
import os, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
B = os.path.join(ROOT, 'packages/ui/src/assets/brand')
BRAND = (0xFF, 0x77, 0x16, 255)
FRAC = 0.74          # 정사각 앱 아이콘 안 Two 폭
FG_FRAC = 0.48       # Android 적응형 전경(108dp 캔버스, 안전 영역 66dp 원) 안 Two 폭
MASTER = os.path.join(HERE, 'two-master.png')
WORDMARK = os.path.join(HERE, 'wordmark-master.png')

def p(*a): return os.path.join(ROOT, *a)

def two(width):
    m = Image.open(MASTER).convert('RGBA')
    m = m.crop(m.getbbox())
    h = round(m.height * width / m.width)
    return m.resize((round(width), h), Image.LANCZOS)

def tile(size, frac=FRAC, bg=BRAND, radius=0):
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    plate = Image.new('RGBA', (size, size), bg)
    if radius:
        mk = Image.new('L', (size, size), 0); ImageDraw.Draw(mk).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
        c.paste(plate, (0, 0), mk)
    else:
        c = plate
    t = two(size * frac)
    c.alpha_composite(t, ((size - t.width) // 2, (size - t.height) // 2 + round(size * 0.01)))
    return c

def main():
    if not os.path.exists(MASTER) or not os.path.exists(WORDMARK) or '--render' in sys.argv:
        subprocess.run(['node', os.path.join(HERE, 'render-two.cjs'), MASTER, '--wordmark', WORDMARK], check=True, cwd=p('apps/mobile'))
    icon = tile(1024).convert('RGB')
    icon.save(os.path.join(B, 'app-icon.png'), optimize=True)
    icon.save(p('apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), optimize=True)
    icon.resize((180, 180), Image.LANCZOS).save(os.path.join(B, 'apple-touch-icon.png'), optimize=True)
    # 파비콘: 둥근 사각, 글자 비율은 앱 아이콘과 같게(2026-11-06)
    for n in (32, 48):
        f = tile(n * 8, radius=n * 8 // 5).resize((n, n), Image.LANCZOS)
        f.save(os.path.join(B, f'favicon-{n}.png'), optimize=True)
    for q in ('apps/site/public/favicon-32.png', 'apps/mobile/public/favicon-32.png'):
        Image.open(os.path.join(B, 'favicon-32.png')).save(p(q), optimize=True)
    # Android
    res = p('apps/mobile/android/app/src/main/res')
    for d, s in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        n = round(48 * s); big = n * 8
        tile(big, radius=round(big * 0.18)).resize((n, n), Image.LANCZOS).save(f'{res}/mipmap-{d}/ic_launcher.png', optimize=True)
        rnd = Image.new('RGBA', (big, big), (0, 0, 0, 0)); mk = Image.new('L', (big, big), 0); ImageDraw.Draw(mk).ellipse((0, 0, big - 1, big - 1), fill=255)
        rnd.paste(tile(big, frac=0.66), (0, 0), mk); rnd.resize((n, n), Image.LANCZOS).save(f'{res}/mipmap-{d}/ic_launcher_round.png', optimize=True)
        fg = round(108 * s); fgc = Image.new('RGBA', (fg * 4, fg * 4), (0, 0, 0, 0)); t = two(fg * 4 * FG_FRAC)
        fgc.alpha_composite(t, ((fg * 4 - t.width) // 2, (fg * 4 - t.height) // 2 + fg * 4 // 100))
        fgc.resize((fg, fg), Image.LANCZOS).save(f'{res}/mipmap-{d}/ic_launcher_foreground.png', optimize=True)
    open(f'{res}/values/ic_launcher_background.xml', 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <!-- 앱 아이콘 바탕: 브랜드 오렌지(2026-11-06 ‘Two’ 아이콘) -->\n    <color name="ic_launcher_background">#FF7716</color>\n</resources>\n')

def symbol_svg():
    # 둥근 사각(모서리 22.5%) 오렌지 + 흰 Two(워드마크 path 그대로). viewBox 1024
    import re
    src = open(p('packages/ui/src/assets/brand/logo-cherry.svg')).read()
    paths = re.findall(r'<path d="([^"]+)"', src)[4:7]
    m = Image.open(MASTER); bw, bh = m.crop(m.getbbox()).size
    vb = (3150, -1500, 2850, 1620)   # render-two.cjs와 같은 범위
    w = 1024 * FRAC; k = w / vb[2] * (Image.open(MASTER).width / bw)  # 글자 실제 폭이 FRAC가 되게
    gw = vb[2] * k; gh = vb[3] * k
    x = (1024 - gw) / 2; y = (1024 - gh) / 2 + 10
    g = ''.join(f'<path d="{d}"/>' for d in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><title>sweeTwo</title>'
            f'<rect width="1024" height="1024" rx="230" fill="#FF7716"/>'
            f'<g transform="translate({x:.1f} {y:.1f}) scale({k:.5f}) translate({-vb[0]} {-vb[1]})" fill="#fff" stroke="#fff" stroke-width="18" stroke-linejoin="round">{g}</g></svg>')

def extras():
    tile(512, radius=115).save(os.path.join(B, 'symbol.png'), optimize=True)
    open(os.path.join(B, 'symbol.svg'), 'w').write(symbol_svg())
    # 공유 이미지 1200×630: 흰 바탕, 왼쪽 앱 아이콘(둥근 사각 260) + 오른쪽 워드마크
    og = Image.new('RGBA', (1200, 630), (255, 255, 255, 255))
    ic = tile(260 * 4, radius=230 * 4 * 260 // 1024).resize((260, 260), Image.LANCZOS)
    wm = Image.open(WORDMARK).convert('RGBA'); wm = wm.crop(wm.getbbox())
    wh = 118; wm = wm.resize((round(wm.width * wh / wm.height), wh), Image.LANCZOS)
    gap = 56; total = 260 + gap + wm.width; x0 = (1200 - total) // 2
    og.alpha_composite(ic, (x0, (630 - 260) // 2)); og.alpha_composite(wm, (x0 + 260 + gap, (630 - wh) // 2 + 6))
    og.convert('RGB').save(p('apps/site/public/og.png'), optimize=True)

if __name__ == '__main__':
    main()
    extras()
