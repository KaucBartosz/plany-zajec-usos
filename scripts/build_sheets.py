"""Sekcje sal  ->  kartki A4 (kilka planów na jednej kartce, legenda tylko raz).

Jak to działa:
1. każda sala × (Pn–Pt, Sb–Nd) to "sekcja" renderowana w tej samej szerokości,
2. `sheets.js measure` mierzy realną wysokość każdej sekcji,
3. sekcje są pakowane zachłannie (w kolejności sal) do limitu `config.BUDGET`,
4. `sheets.js` robi zrzut kartki ze skalowaniem zoom = min(1, 990/wysokość).

Uruchomienie: `python build_sheets.py`, potem `node sheets.js`.
"""
import datetime
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402
from css import load_print_css  # noqa: E402
from build_rooms import (BASE, WEEK, END, DAY_ORDER, merge_slots, merge_ultra,  # noqa: E402
                         box_compact, box_ultra, section_cols, room_slug, esc,
                         FOOT, ULTRA, rooms)

A4 = os.path.join(BASE, 'out', 'a4')
CARDW, TARGETH = config.CARDW, config.TARGETH
BUDGET = config.BUDGET
SEG_GAP = config.SEG_GAP
BUILDING = config.BUILDING

CSS = load_print_css(BASE)

# Kartki są gęstsze niż pojedyncze plany sal — nadpisujemy tylko zmienne.
SHEET_VARS = ('--card-pad:24px 26px 18px;--days-mt:0px;--dhead-fs:13px;'
              '--dhead-pad:6px 2px;--dbody-pad:5px;--gap:5px;--pad:4px 7px;'
              '--fs:11.5px;--fst:12.5px;--fsnt:10.5px;--lh:1.36')

SHEET_HEAD = ("<!DOCTYPE html><html lang='pl'><head><meta charset='utf-8'><style>" + CSS +
              "</style></head><body><div class='card' style='" + SHEET_VARS +
              "' data-target-h='" + str(TARGETH) + "'>"
              f"<div class='kicker'>{config.FACULTY} &middot; {config.SEMESTER}</div>"
              f"<h1>Budynek {BUILDING} — plany sal <span>źródło: USOSweb UKW</span></h1>"
              "{secs}" +
              FOOT.format(date=datetime.date.today().strftime('%d.%m.%Y')) +
              "</div></body></html>")


def is_ultra(room, mode):
    m = re.match(r'^(.+?),\s*bud\.\s*(\d+)$', room)
    return mode == 'sb-nd' and m and m.group(1).strip() in ULTRA


def section(room, entries, days, mode):
    filt = [e for e in entries if e['day'] in days]
    if not filt:
        return None
    if is_ultra(room, mode):
        merged = merge_ultra(filt)
        box = box_ultra
    else:
        merged = merge_slots(filt)
        box = box_compact
    byday = {}
    for m in merged:
        byday.setdefault(m['day'], []).append(m)
    cols, _ = section_cols(byday, box, 3, True)
    part = 'poniedziałek–piątek' if mode == 'pn-pt' else 'sobota–niedziela'
    head = f"<div class='roomhead'>Sala {esc(room)} — {part}</div>"
    return head + "<div class='days'>" + ''.join(cols) + '</div>'


def main():
    if not rooms:
        print(f'Brak zajęć w budynku {BUILDING}.')
        return 1
    os.makedirs(A4, exist_ok=True)
    secs = []  # (klucz, opis, html)
    for room in sorted(rooms):
        s = section(room, rooms[room], WEEK, 'pn-pt')
        if s:
            secs.append((f'{room_slug(room)}-pn-pt', f'Sala {room} pn-pt', s))
        s = section(room, rooms[room], END, 'sb-nd')
        if s:
            secs.append((f'{room_slug(room)}-sb-nd', f'Sala {room} sb-nd', s))
    print('sekcje:', len(secs))

    measure = ("<!DOCTYPE html><html lang='pl'><head><meta charset='utf-8'><style>" + CSS +
               "</style></head><body>" +
               ''.join(f"<div class='msec' data-key='{k}' style='{SHEET_VARS};width:{CARDW}px'>{h}</div>"
                       for k, _, h in secs) + "</body></html>")
    with open(os.path.join(A4, 'measure.html'), 'w', encoding='utf-8') as f:
        f.write(measure)

    node_exe = os.environ.get('PLANER_NODE', 'node')
    subprocess.run([node_exe, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sheets.js'),
                    'measure'], cwd=BASE, check=True)
    with open(os.path.join(A4, 'heights.json'), encoding='utf-8') as f:
        heights = json.load(f)
    for k, t, _ in secs:
        print(f'{round(heights[k]):>4} px  {t}')

    sheets, cur, used = [], [], 0
    for k, t, h in secs:
        hh = heights[k] + SEG_GAP
        if cur and used + hh > BUDGET:
            sheets.append(cur)
            cur, used = [], 0
        cur.append((k, t, h))
        used += hh
    if cur:
        sheets.append(cur)
    print('kartki:', len(sheets), [len(s) for s in sheets])

    names = {}
    for i, sh in enumerate(sheets, 1):
        body = ''.join(h for _, _, h in sh)
        html = SHEET_HEAD.replace('{secs}', body)
        key = f'sheet-{i:02d}'
        with open(os.path.join(A4, f'shot-{key}.html'), 'w', encoding='utf-8') as f:
            f.write(html)
        names[key] = f'a4-bud-{BUILDING}-{i:02d}.png'
    with open(os.path.join(A4, 'shots.json'), 'w', encoding='utf-8') as f:
        json.dump(names, f, indent=1)
    print('pliki:', ', '.join(names.values()))
    return 0


if __name__ == '__main__':
    sys.exit(main())
