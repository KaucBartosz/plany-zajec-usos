"""Pobiera plany grup stacjonarnych na bieżący tydzień (poniedziałek–piątek).

Wynik trafia do osobnych plików: html/week/pon-pt/<klucz>.html, manifest.json
oraz html/week/plan-pon-pt.json. Nie nadpisuje wariantu niestacjonarnych
(html/week/plan.json), więc istniejące wydruki weekendowe zostają nietknięte.

Użycie:
    python scripts/fetch_week_pon_pt.py
    python scripts/fetch_week_pon_pt.py --only-changed  # tylko zmienione pliki
"""
import argparse
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch import download, make_opener, normalize, save_json, sha, validate  # noqa: E402
from groups import GROUPS, plan_url  # noqa: E402
from parse import parse  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, 'html', 'week', 'pon-pt')
MANIFEST = os.path.join(OUTDIR, 'manifest.json')
PLAN_OUT = os.path.join(ROOT, 'html', 'week', 'plan-pon-pt.json')
DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek']


def main():
    ap = argparse.ArgumentParser(description='Pobierz plany stacjonarnych na bieżący tydzień')
    ap.add_argument('--only-changed', action='store_true',
                    help='zapisz tylko pliki, których hash się zmienił')
    args = ap.parse_args()
    only_changed = args.only_changed

    targets = [g for g in GROUPS if g['folder'] == 'stacjonarne']
    os.makedirs(OUTDIR, exist_ok=True)

    manifest = {}
    if os.path.exists(MANIFEST):
        try:
            with open(MANIFEST, encoding='utf-8') as f:
                manifest = json.load(f)
        except (OSError, json.JSONDecodeError):
            manifest = {}

    opener = make_opener()
    data = {}
    total = 0
    failed = []
    any_changed = False

    for i, group in enumerate(targets, 1):
        url = plan_url(group, 'week')
        prefix = f'[{i}/{len(targets)}] {group["key"]:<22}'
        print(f'{prefix} pobieranie...', flush=True)
        try:
            html = download(opener, url)
            validate(html, url, allow_short=True)
        except RuntimeError as exc:
            print(f'{prefix} BŁĄD {exc}', flush=True)
            failed.append(group['key'])
            continue

        path = os.path.join(OUTDIR, group['key'] + '.html')
        digest = sha(normalize(html))
        old = manifest.get(group['key'], {}).get('sha256')
        if old is None and os.path.exists(path):
            with open(path, encoding='utf-8', errors='replace') as f:
                old = sha(normalize(f.read()))
        same = old == digest
        if not (only_changed and same):
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(html)
            manifest[group['key']] = {
                'sha256': digest,
                'bytes': len(html.encode('utf-8')),
                'url': url,
                'fetched': datetime.datetime.now().isoformat(timespec='seconds'),
            }
            any_changed = True

        parsed = parse(path)
        rows = [row for row in parsed['rows'] if row['day'] in DAYS]
        parsed['rows'] = rows
        parsed['label'] = group['label']
        parsed['folder'] = group['folder']
        data[group['key']] = parsed
        total += len(rows)
        print(f'{prefix} {len(rows):>3} zajęć Pon–Pt'
              f'{" (bez zmian)" if same else ""}', flush=True)

    if only_changed and not any_changed:
        print('\nBrak nowych danych — plan-pon-pt.json bez zmian.', flush=True)
        return 1 if failed else 0

    save_json(PLAN_OUT, data)
    manifest = {g['key']: manifest[g['key']] for g in targets if g['key'] in manifest}
    save_json(MANIFEST, manifest)
    print(f'\nGotowe: {PLAN_OUT} — {total} zajęć dla {len(data)} grup (Pon–Pt).', flush=True)
    if failed:
        print(f'BŁĘDY: {len(failed)} — {", ".join(failed)}', flush=True)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
