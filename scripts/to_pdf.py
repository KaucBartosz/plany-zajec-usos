"""Kartki A4 (PNG)  ->  jeden PDF + pojedyncze PDF-y.

Każdy obrazek trafia na osobną stronę A4 w poziomie (300 dpi), skalowany
proporcjonalnie (contain) — nigdy rozciągany.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

try:
    from PIL import Image
except ImportError:
    sys.exit('Brak Pillow. Zainstaluj: python -m pip install -r requirements.txt')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'out', 'a4', 'png')
DST = os.path.join(ROOT, 'out', 'a4', 'pdf')
W, H = config.PDF_W, config.PDF_H


def fit_page(path):
    img = Image.open(path).convert('RGB')
    scale = min(W / img.width, H / img.height)      # contain: bez deformacji
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    page = Image.new('RGB', (W, H), 'white')
    page.paste(img, ((W - img.width) // 2, (H - img.height) // 2))
    return page


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'Brak katalogu {SRC} — najpierw uruchom build_sheets.py i sheets.js')
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
    if not files:
        sys.exit(f'Brak PNG w {SRC} — najpierw uruchom sheets.js')

    os.makedirs(DST, exist_ok=True)
    pages = []
    for fn in files:
        page = fit_page(os.path.join(SRC, fn))
        pages.append(page)
        single = os.path.join(DST, os.path.splitext(fn)[0] + '.pdf')
        page.save(single, 'PDF', resolution=config.PDF_DPI)

    combined = os.path.join(DST, config.PDF_NAME.format(building=config.BUILDING))
    pages[0].save(combined, 'PDF', resolution=config.PDF_DPI,
                  save_all=True, append_images=pages[1:])
    print(f'PDF: {combined}')
    print(f'stron: {len(pages)} | pojedyncze PDF-y: {len(files)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
