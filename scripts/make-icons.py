"""Generates all app icons (PWA + Android launcher) from code - no binary sources needed.
Design: glowing cyan diamond (System window) with a rising chevron (level up) on deep navy."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BG = (4, 6, 13, 255)
CYAN = (76, 201, 255, 255)
LIGHT = (190, 240, 255, 255)


def emblem(size, scale=1.0, bg=True):
    s = size * 4
    img = Image.new('RGBA', (s, s), BG if bg else (0, 0, 0, 0))
    if bg:
        halo = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(halo).ellipse([s * 0.1, s * 0.1, s * 0.9, s * 0.9], fill=(40, 110, 200, 110))
        img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(s * 0.12)))
    c, r = s / 2, s * 0.34 * scale
    w = max(4, int(s * 0.035 * scale))
    diamond = [(c, c - r), (c + r, c), (c, c + r), (c - r, c)]
    k = r * 0.42
    chev1 = [(c - k, c + k * 0.35), (c, c - k * 0.45), (c + k, c + k * 0.35)]
    chev2 = [(c - k * 0.7, c + k * 0.95), (c, c + k * 0.2), (c + k * 0.7, c + k * 0.95)]

    glow = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.polygon(diamond, outline=CYAN, width=w * 3)
    g.line(chev1, fill=CYAN, width=w * 3, joint='curve')
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s * 0.03)))

    d = ImageDraw.Draw(img)
    d.polygon(diamond, outline=LIGHT, width=w)
    d.line(chev1, fill=LIGHT, width=int(w * 1.3), joint='curve')
    d.line(chev2, fill=CYAN, width=w, joint='curve')
    return img.resize((size, size), Image.LANCZOS)


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


icons = ROOT / 'src' / 'icons'
save(emblem(192), icons / 'icon-192.png')
save(emblem(512), icons / 'icon-512.png')
save(emblem(512, scale=0.72), icons / 'maskable-512.png')
save(emblem(180), icons / 'apple-touch-icon.png')
save(emblem(1024), ROOT / 'docs' / 'store' / 'icon-1024.png')
save(emblem(512), ROOT / 'docs' / 'store' / 'play-icon-512.png')

# Android launcher icons (legacy + adaptive foreground) if the native project exists.
res = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
if res.exists():
    dens = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for name, px in dens.items():
        save(emblem(px), res / f'mipmap-{name}' / 'ic_launcher.png')
        save(emblem(px), res / f'mipmap-{name}' / 'ic_launcher_round.png')
        fg = int(px * 108 / 48)
        save(emblem(fg, scale=0.62, bg=False), res / f'mipmap-{name}' / 'ic_launcher_foreground.png')
    # Splash screens (pre-Android 12 full-screen image): emblem centred on navy.
    from PIL import Image as _I
    for f in res.glob('drawable*/splash.png'):
        w, hgt = _I.open(f).size
        canvas = _I.new('RGBA', (w, hgt), BG)
        e = emblem(int(min(w, hgt) * 0.42), bg=False)
        canvas.alpha_composite(e, ((w - e.width) // 2, (hgt - e.height) // 2))
        canvas.convert('RGB').save(f)
    # Status-bar notification icon: white glyph on transparent (Android tints it).
    for name, px in {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}.items():
        s4 = px * 4
        img = Image.new('RGBA', (s4, s4), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        c, r, w = s4 / 2, s4 * 0.44, max(3, int(s4 * 0.09))
        d.polygon([(c, c - r), (c + r, c), (c, c + r), (c - r, c)], outline=(255, 255, 255, 255), width=w)
        k = r * 0.45
        d.line([(c - k, c + k * 0.4), (c, c - k * 0.5), (c + k, c + k * 0.4)], fill=(255, 255, 255, 255), width=w, joint='curve')
        save(img.resize((px, px), Image.LANCZOS), res / f'drawable-{name}' / 'ic_stat_awaken.png')
    print('android icons written')
print('icons written')
