"""앱 아이콘 ‘Two’(2026-11-06): 브랜드 오렌지 바탕 + 흰 워드마크 ‘Two’(logo-cherry.svg 뒤 세 글자). 파이 차트 앱 아이콘을 바꿈.

python3 scripts/brand-icons/two.py   (pillow, node + playwright 필요)
만드는 것: app-icon.png, apple-touch-icon.png, app-icon-macos.png, favicon-32/48.png(디자인 시스템 Brand),
데스크톱 build/icon.png와 트레이, iOS AppIcon, Android 런처(적응형 전경 + 바탕 색, 예전 방식 정사각·원형), 사이트·모바일 파비콘.
글자 크기는 아래 FRAC(캔버스 폭 대비 Two 폭). 바꾸면 docs/spec/04-brand.md ‘앱 아이콘’도 같이 고침.
"""
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
B = os.path.join(ROOT, 'packages/ui/src/assets/brand')
BRAND = (0xFF, 0x77, 0x16, 255)
FRAC = 0.74          # 정사각 앱 아이콘 안 Two 폭
FG_FRAC = 0.48       # Android 적응형 전경(108dp 캔버스, 안전 영역 66dp 원) 안 Two 폭
MASTER = os.path.join(HERE, 'two-master.png')

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
    if not os.path.exists(MASTER) or '--render' in sys.argv:
        subprocess.run(['node', os.path.join(HERE, 'render-two.cjs'), MASTER], check=True, cwd=p('apps/mobile'))
    icon = tile(1024).convert('RGB')
    icon.save(os.path.join(B, 'app-icon.png'), optimize=True)
    icon.save(p('apps/desktop/build/icon.png'), optimize=True)
    icon.save(p('apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'), optimize=True)
    icon.resize((180, 180), Image.LANCZOS).save(os.path.join(B, 'apple-touch-icon.png'), optimize=True)
    # macOS: 1024 캔버스에 824 둥근 사각(모서리 185) + 그림자
    mac = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    sh = Image.new('L', (1024, 1024), 0); ImageDraw.Draw(sh).rounded_rectangle((100, 112, 924, 936), radius=185, fill=90)
    shadow = Image.new('RGBA', (1024, 1024), (0, 0, 0, 255)); shadow.putalpha(sh.filter(ImageFilter.GaussianBlur(16)))
    mac.alpha_composite(shadow)
    mac.alpha_composite(tile(824, radius=185), (100, 100))
    mac.save(os.path.join(B, 'app-icon-macos.png'), optimize=True)
    # 파비콘: 둥근 사각(작은 크기라 글자를 조금 크게)
    for n in (32, 48):
        f = tile(n * 8, frac=0.80, radius=n * 8 // 5).resize((n, n), Image.LANCZOS)
        f.save(os.path.join(B, f'favicon-{n}.png'), optimize=True)
    for q in ('apps/site/public/favicon-32.png', 'apps/mobile/public/favicon-32.png'):
        Image.open(os.path.join(B, 'favicon-32.png')).save(p(q), optimize=True)
    # 데스크톱 트레이 32px(16으로 줄여 씀)
    tile(256, frac=0.80, radius=56).resize((32, 32), Image.LANCZOS).save(p('apps/desktop/resources/tray.png'), optimize=True)
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

if __name__ == '__main__':
    main()
