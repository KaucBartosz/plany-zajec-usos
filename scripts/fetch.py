"""Pobiera plany grup z USOSweb UKW do html/<key>.html.

USOS wymaga przejścia przez CAS (302 tam i z powrotem). Dlatego jedna sesja
z cookie jar-em musi obsłużyć całe przekierowanie — bez ciasteczek serwer
zwraca puste 302.

Dla planów niestacjonarnych zapisywany jest też wariant tygodniowy
do html/week/<key>.html; --check odkłada jego raport osobno.

Użycie:
    python fetch.py              # pobierz wszystkie grupy
    python fetch.py --only SJ-I  # tylko jedna grupa
    python fetch.py --check      # sprawdź zmiany; osobny raport dla planów tygodniowych
    python fetch.py --only-changed  # zapisz tylko pliki, których hash się zmienił
"""
import argparse
import datetime
import hashlib
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from groups import GROUPS, plan_url  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'html')
MANIFEST = os.path.join(HTML, 'manifest.json')
WEEK_HTML = os.path.join(HTML, 'week')
WEEK_MANIFEST = os.path.join(WEEK_HTML, 'manifest.json')
WEEK_CHANGES = os.path.join(WEEK_HTML, 'changes.json')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36')
# Strona planu zawiera ten element; jego brak oznacza nieprawidłową odpowiedź.
MARKER = 'usos-timetable'
MIN_BYTES = 50_000


def make_opener():
    """Sesja HTTP z cookie jar-em — jar musi przeżyć redirecty CAS."""
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    op.addheaders = [('User-Agent', UA), ('Accept-Language', 'pl,en;q=0.8')]
    return op


def download(op, url, tries=3):
    last = None
    for attempt in range(1, tries + 1):
        try:
            with op.open(url, timeout=60) as resp:
                return resp.read().decode('utf-8', 'replace')
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last = exc
            if attempt < tries:
                time.sleep(attempt)
    raise RuntimeError(f'pobieranie nie udało się: {last}')


def validate(html, url, allow_short=False):
    size = len(html.encode('utf-8'))
    if MARKER not in html:
        raise RuntimeError(
            f'pobrano stronę bez planu ({size} bajtów, brak <{MARKER}>). '
            f'Typowa przyczyna: brak cookie jar / wygasła sesja CAS. URL: {url}')
    if size < MIN_BYTES and not allow_short:
        raise RuntimeError(
            f'pobrana strona jest za mała ({size} bajtów, minimum {MIN_BYTES}). URL: {url}')


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


# Strona USOS zawiera tokeny zmieniające się przy każdym wejściu (csrf, callback
# logowania). Nie mają nic wspólnego z planem, więc przed hashowaniem je wycinamy,
# inaczej `--check` zawsze zgłaszałby "ZMIANA".
NOISE = [
    (re.compile(r'csrftoken\s*=\s*"[^"]*"'), 'csrftoken = ""'),
    (re.compile(r'callback=[^&\'"\s]+'), 'callback=TOKEN'),
    (re.compile(r'name="csrf[^"]*"\s+value="[^"]*"'), 'name="csrf" value=""'),
]


def normalize(html):
    for rx, rep in NOISE:
        html = rx.sub(rep, html)
    return html


def load_manifest():
    try:
        with open(MANIFEST, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def load_manifest_at(path):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def save_json(path, value):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=1)


def main():
    ap = argparse.ArgumentParser(description='Pobierz plany grup z USOSweb UKW')
    ap.add_argument('--only', action='append', metavar='KEY',
                    help='tylko wybrane grupy, np. --only SJ-I --only NJ-II')
    ap.add_argument('--check', action='store_true',
                    help='porównaj plany; zapisz osobny raport wariantu tygodniowego')
    ap.add_argument('--only-changed', action='store_true',
                    help='zapisz tylko pliki, których hash się zmienił')
    args = ap.parse_args()
    only_changed = args.only_changed

    targets = GROUPS
    if args.only:
        wanted = {k.lower() for k in args.only}
        targets = [g for g in GROUPS if g['key'].lower() in wanted]
        if not targets:
            sys.exit(f'nieznane klucze: {", ".join(args.only)}')

    os.makedirs(HTML, exist_ok=True)
    all_week_groups = [g for g in GROUPS if g['folder'] == 'niestacjonarne']
    week_targets = [g for g in targets if g['folder'] == 'niestacjonarne']
    manifest = load_manifest()
    week_manifest = load_manifest_at(WEEK_MANIFEST)
    op = make_opener()          # jedna sesja na cały przebieg
    changed, failed = [], []

    for i, g in enumerate(targets, 1):
        url = plan_url(g, 'semester')
        label = f"[{i:2}/{len(targets)}] {g['key']:<22}"
        try:
            html = download(op, url)
            validate(html, url)
        except RuntimeError as exc:
            print(f'{label} BŁĄD  {exc}')
            failed.append(g['key'])
            continue

        digest = sha(normalize(html))
        path = os.path.join(HTML, g['key'] + '.html')
        old = manifest.get(g['key'], {}).get('sha256')
        if old is None and os.path.exists(path):
            with open(path, encoding='utf-8', errors='replace') as f:
                old = sha(normalize(f.read()))
        same = (old == digest)

        if args.check:
            print(f'{label} {"bez zmian" if same else "ZMIANA" if old else "NOWY"}')
            if not same:
                changed.append(g['key'])
            continue

        if only_changed and same:
            print(f'{label} {len(html) // 1024:>5} kB  (bez zmian)')
        else:
            if not same:
                changed.append(g['key'])
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(html)
            print(f'{label} {len(html) // 1024:>5} kB  zapisano')
        manifest[g['key']] = {
            'sha256': digest,
            'bytes': len(html.encode('utf-8')),
            'url': url,
            'fetched': datetime.datetime.now().isoformat(timespec='seconds'),
        }

    week_changed, week_initialized, week_failed = [], [], []
    for i, g in enumerate(week_targets, 1):
        url = plan_url(g, 'week')
        label = f"[tydz. {i:2}/{len(week_targets)}] {g['key']:<22}"
        try:
            html = download(op, url)
            validate(html, url, allow_short=True)
        except RuntimeError as exc:
            print(f'{label} BŁĄD  {exc}')
            failed.append(f'{g["key"]} [week]')
            week_failed.append({'key': g['key'], 'url': url, 'error': str(exc)})
            continue

        digest = sha(normalize(html))
        path = os.path.join(WEEK_HTML, g['key'] + '.html')
        old = week_manifest.get(g['key'], {}).get('sha256')
        if old is None and os.path.exists(path):
            with open(path, encoding='utf-8', errors='replace') as f:
                old = sha(normalize(f.read()))
        same = old == digest

        if args.check:
            status = 'bez zmian' if same else 'ZMIANA' if old else 'ustawiono punkt odniesienia'
            if not re.search(r'<timetable-entry\b', html, re.IGNORECASE):
                status += ' (brak zajęć w tym tygodniu)'
            print(f'{label} {status}')
            if old is None:
                os.makedirs(WEEK_HTML, exist_ok=True)
                with open(path, 'w', encoding='utf-8', newline='\n') as f:
                    f.write(html)
                week_manifest[g['key']] = {
                    'sha256': digest,
                    'bytes': len(html.encode('utf-8')),
                    'url': url,
                    'fetched': datetime.datetime.now().isoformat(timespec='seconds'),
                }
                week_initialized.append(g['key'])
            elif not same:
                week_changed.append({
                    'key': g['key'], 'url': url,
                    'previous_sha256': old, 'sha256': digest,
                })
            continue

        if not only_changed or not same:
            os.makedirs(WEEK_HTML, exist_ok=True)
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(html)
            if not same:
                week_changed.append({
                    'key': g['key'], 'url': url,
                    'previous_sha256': old, 'sha256': digest,
                })
        week_manifest[g['key']] = {
            'sha256': digest,
            'bytes': len(html.encode('utf-8')),
            'url': url,
            'fetched': datetime.datetime.now().isoformat(timespec='seconds'),
        }
        status = '(bez zmian)' if same else 'zapisano'
        if not re.search(r'<timetable-entry\b', html, re.IGNORECASE):
            status += ' (brak zajęć w tym tygodniu)'
        print(f'{label} {len(html) // 1024:>5} kB  {status}')

    if not args.check:
        manifest = {g['key']: manifest[g['key']] for g in GROUPS if g['key'] in manifest}
        save_json(MANIFEST, manifest)
        week_manifest = {g['key']: week_manifest[g['key']]
                         for g in all_week_groups if g['key'] in week_manifest}
        os.makedirs(WEEK_HTML, exist_ok=True)
        save_json(WEEK_MANIFEST, week_manifest)
    elif week_initialized:
        save_json(WEEK_MANIFEST, week_manifest)

    if failed:
        print(f'\nBŁĘDY: {len(failed)} — {", ".join(failed)}')
    if args.check or only_changed:
        checked = datetime.datetime.now().isoformat(timespec='seconds')
        os.makedirs(WEEK_HTML, exist_ok=True)
        save_json(WEEK_CHANGES, {
            'checked': checked,
            'changed': week_changed,
            'semester': changed,
            'baseline_initialized': week_initialized,
            'failed': week_failed,
        })
        if week_changed:
            print(f'Zmiany w wariancie tygodniowym zapisano w {WEEK_CHANGES}')
        if changed:
            print(f'\nZmienione plany: {len(changed)} — {", ".join(changed)}')
        if week_changed:
            print(f'Zmienione plany tygodniowe: {len(week_changed)} — '
                  f'{", ".join(item["key"] for item in week_changed)}')
        if week_initialized:
            print('Ustawiono punkt odniesienia dla wariantu tygodniowego: '
                  f'{", ".join(week_initialized)}')
        if not changed and not week_changed and not failed:
            print(f'\nWszystkie {len(targets)} planów bazowych i '
                  f'{len(week_targets)} wariantów tygodniowych bez zmian.')
        if args.check:
            if changed:
                print('Uruchom `python scripts\\fetch.py`, potem `python scripts\\parse.py` '
                      'i dalsze kroki.')
            elif week_changed:
                print(f'Zmiany wariantu tygodniowego zachowano w {WEEK_CHANGES}; '
                      'plany semestralne nie wymagają przebudowy.')
            if changed or week_changed or failed:
                return 1
    if failed:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
