"""Kontrola jakości wyniku — uruchom po całym przebiegu.

Sprawdza: plan.json, komplet PNG per sala, komplet kartek A4, PDF.
Kod wyjścia 1 = coś nie gra (szczegóły na ekranie).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'out')
A4 = os.path.join(OUT, 'a4')
errors, warns = [], []


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def pdf_pages(path):
    """Liczba stron PDF bez zewnętrznych bibliotek (Pillow nie czyta PDF)."""
    with open(path, 'rb') as f:
        data = f.read()
    return len(re.findall(rb'/Type\s*/Page[^s]', data))


def png_size(path):
    """Szerokość/wysokość bez zewnętrznych bibliotek (nagłówek PNG)."""
    with open(path, 'rb') as f:
        head = f.read(26)
    if head[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return int.from_bytes(head[16:20], 'big'), int.from_bytes(head[20:24], 'big')


def main():
    # --- 1. dane źródłowe ---------------------------------------------------
    plan_path = os.path.join(ROOT, 'plan.json')
    if not os.path.exists(plan_path):
        errors.append('brak plan.json — uruchom parse.py')
        return report()
    plan = load(plan_path)
    rows = sum(len(v['rows']) for v in plan.values())
    no_room = sum(1 for v in plan.values() for r in v['rows'] if not r['room'])
    print(f'plan.json: {len(plan)} grup, {rows} zajęć, {no_room} bez sali')
    for key, v in plan.items():
        if not v['rows']:
            errors.append(f'{key}: 0 zajęć (pobierz ponownie / sprawdź kod grupy)')
    if rows == 0:
        errors.append('plan.json jest pusty')

    # --- 2. plany sal -------------------------------------------------------
    shots_path = os.path.join(OUT, 'shots.json')
    if os.path.exists(shots_path):
        shots = load(shots_path)
        missing = [p for p in shots.values() if not os.path.exists(os.path.join(OUT, 'png', p))]
        print(f'plany sal: {len(shots)} plansz, brakuje {len(missing)} PNG')
        if missing:
            errors.append(f'brakuje PNG: {", ".join(missing[:5])}')
        for p in shots.values():
            path = os.path.join(OUT, 'png', p)
            if os.path.exists(path):
                w, _ = png_size(path) or (0, 0)
                if p.endswith('-pn-pt.png') and w < 3000:
                    warns.append(f'{p}: szerokość {w} px — render poniżej 3x?')
    else:
        errors.append('brak out/shots.json — uruchom build_rooms.py')

    # --- 3. kartki A4 -------------------------------------------------------
    sheets_path = os.path.join(A4, 'shots.json')
    if os.path.exists(sheets_path):
        sheets = load(sheets_path)
        missing = [p for p in sheets.values() if not os.path.exists(os.path.join(A4, 'png', p))]
        print(f'kartki A4: {len(sheets)}, brakuje {len(missing)} PNG')
        if missing:
            errors.append(f'brakuje kartek: {", ".join(missing[:5])}')
        for p in sheets.values():
            path = os.path.join(A4, 'png', p)
            if os.path.exists(path):
                w, h = png_size(path) or (0, 0)
                if w <= h:                               # kartka ma być pozioma
                    warns.append(f'{p}: obraz nie jest poziomy ({w}×{h})')
                if w < config.CARDW * 2:                 # < 2x = render za mały
                    warns.append(f'{p}: szerokość {w} px — render poniżej 2x')
    else:
        errors.append('brak out/a4/shots.json — uruchom build_sheets.py')

    # --- 4. PDF -------------------------------------------------------------
    pdf = os.path.join(A4, 'pdf', config.PDF_NAME.format(building=config.BUILDING))
    if os.path.exists(pdf):
        mb = os.path.getsize(pdf) / 1024 / 1024
        print(f'PDF: {os.path.basename(pdf)} ({mb:.1f} MB)')
        pages = pdf_pages(pdf)
        print(f'stron w PDF: {pages}')
        if os.path.exists(sheets_path):
            expected = len(load(sheets_path))
            if pages < expected:
                errors.append(f'PDF ma {pages} stron, a kartek jest {expected} — uruchom to_pdf.py')
        elif pages == 0:
            warns.append('nie udało się policzyć stron PDF')
    else:
        errors.append('brak pliku PDF — uruchom to_pdf.py')
    return report()


def report():
    for w in warns:
        print(f'OSTRZEŻENIE: {w}')
    for e in errors:
        print(f'BŁĄD: {e}')
    if errors:
        print(f'\nWYNIK: {len(errors)} błędów, {len(warns)} ostrzeżeń')
        return 1
    print(f'\nWYNIK: OK ({len(warns)} ostrzeżeń) — pliki gotowe do druku')
    return 0


if __name__ == '__main__':
    sys.exit(main())
