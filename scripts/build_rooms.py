"""plan.json  ->  HTML jednego planu na salę, potem PNG (przez shot_rooms.js).

Reguły:
- jeden blok = jedna pora w jednej sali,
- ten sam prowadzący + ta sama pora = jedna linia (grupy/roczniki scalone),
- parzyste + nieparzyste w jednym bloku = co tydzień.

Uruchomienie: `python build_rooms.py`, potem `node shot_rooms.js`.
"""
import datetime
import json
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = ROOT
CARD_DIR = os.path.join(BASE, 'out')
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'print.css'),
          encoding='utf-8') as f:
    SHARED_CSS = f.read()

with open(os.path.join(BASE, 'plan.json'), encoding='utf-8') as f:
    data = json.load(f)

DAY_ORDER = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
WEEK = DAY_ORDER[:5]
END = DAY_ORDER[5:]
PXM = 1.1                      # px na minutę (minimalna wysokość bloku Pn–Pt)

BUILDING = config.BUILDING
ULTRA = config.ULTRA_ROOMS
NO_FOOT = config.NO_FOOT_ROOMS

# Sale bez budynku w USOS ("102") dostają go, jeśli jednoznacznie wynika z innych wpisów.
with_bud = {}
for v in data.values():
    for r in v['rows']:
        if r['room']:
            m = re.match(r'^(.+?),\s*bud\.\s*(\d+)$', r['room'])
            if m:
                with_bud.setdefault(m.group(1).strip(), set()).add(m.group(2))


def norm_room(room):
    if not room or ',' in room:
        return room
    buds = with_bud.get(room.strip(), set())
    return f"{room.strip()}, bud. {next(iter(buds))}" if len(buds) == 1 else room


def short_tag(key):
    mode = 'S' if key.startswith('SJ') else 'N'
    rest = key.split('-', 1)[1]
    rest = (rest.replace('wspomaganie', 'wsp').replace('kliniczna', 'klin')
                .replace('spoleczna', 'społ').replace('zdrowia', 'zdr')
                .replace('biznesu', 'biz'))
    return f'{mode}·{rest}'


rooms, skipped = {}, 0
for key, v in data.items():
    for r in v['rows']:
        room = norm_room(r['room'])
        if not room or not room.endswith(f'bud. {BUILDING}'):
            if not room:
                skipped += 1
            continue
        rooms.setdefault(room, []).append(dict(r, tag=short_tag(key)))


def tmin(s):
    h, m = s.split(':')
    return int(h) * 60 + int(m)


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def entry_note(e):
    n = []
    if 'niep' in e['note']:
        n.append('nieparz.')
    elif 'parz' in e['note']:
        n.append('parz.')
    if 'niestandardowa' in e['event']:
        n.append('niestandardowo')
    elif e['note'] == 'inne':
        n.append('inne terminy')
    return n


def merge_slots(entries):
    """Grupuje wpisy po (dzień, start, end); zwraca bloki z liniami szczegółów."""
    slots = {}
    order = []
    for e in entries:
        k = (e['day'], e['start'], e['end'])
        if k not in slots:
            slots[k] = []
            order.append(k)
        slots[k].append(e)
    merged = []
    for k in order:
        es = slots[k]
        par = set()
        for e in es:
            for n in entry_note(e):
                if n in ('parz.', 'nieparz.'):
                    par.add(n)
        cancel_par = par == {'parz.', 'nieparz.'}   # oba tygodnie = co tydzień
        subs = {}
        sorder = []
        for e in es:
            nt = [n for n in entry_note(e)
                  if not (cancel_par and n in ('parz.', 'nieparz.'))]
            sk = (' '.join((e['teacher'] or '').split()), e['type'], tuple(nt))
            if sk not in subs:
                subs[sk] = {'teacher': e['teacher'], 'type': e['type'],
                            'note': nt, 'groups': [], 'tags': []}
                sorder.append(sk)
            if e['group'] and e['group'] not in subs[sk]['groups']:
                subs[sk]['groups'].append(e['group'])
            if e['tag'] not in subs[sk]['tags']:
                subs[sk]['tags'].append(e['tag'])
        lines = []
        for sk in sorder:
            s = subs[sk]
            gs = sorted(s['groups'], key=lambda g: (len(g), g))
            lines.append((s['type'], gs, s['tags'], s['teacher'], s['note']))
        merged.append({'day': es[0]['day'], 'start': es[0]['start'], 'end': es[0]['end'],
                       'type': es[0]['type'], 'lines': lines})
    return merged


def merge_ultra(entries):
    """Wersja weekendowa: jeden blok na (dzień, pora), tylko prowadzący."""
    slots = {}
    order = []
    for e in entries:
        k = (e['day'], e['start'], e['end'])
        if k not in slots:
            slots[k] = []
            order.append(k)
        slots[k].append(e)
    merged = []
    for k in order:
        teachers = []
        for e in slots[k]:
            t = ' '.join((e['teacher'] or '').split()) or '—'
            if t not in teachers:
                teachers.append(t)
        merged.append({'day': k[0], 'start': k[1], 'end': k[2], 'teachers': teachers})
    return merged


def box_ultra(m):
    inner = [f'<div class="t">{m["start"]}–{m["end"]}</div>']
    for t in m['teachers']:
        inner.append(f'<div class="who">{esc(t)}</div>')
    return f'<div class="ev plain">{"".join(inner)}</div>'


def box_roomy(m):
    inner = [f'<div class="t">{m["start"]}–{m["end"]}</div>']
    for typ, groups, tags, teacher, note in m['lines']:
        g = f' · gr. {", ".join(groups)}' if groups else ''
        inner.append(f'<div class="ln"><b>{esc(typ)}</b>{g} · {esc(", ".join(tags))}</div>')
        inner.append(f'<div class="who">{esc(teacher) if teacher else "—"}</div>')
        if note:
            inner.append(f'<div class="nt">{"; ".join(note)}</div>')
    return f'<div class="ev acc-{esc(m["type"])}">{"".join(inner)}</div>'


def box_compact(m):
    inner = [f'<div class="t">{m["start"]}–{m["end"]}</div>']
    for typ, groups, tags, teacher, note in m['lines']:
        g = f' gr. {", ".join(groups)}' if groups else ''
        nt = f' <span class="nt">({"; ".join(note)})</span>' if note else ''
        inner.append(
            f'<div class="sub"><b>{esc(typ)}{g}</b> · {esc(", ".join(tags))} — '
            f'{esc(teacher) if teacher else "—"}{nt}</div>')
    return f'<div class="ev acc-{esc(m["type"])}">{"".join(inner)}</div>'


T = """<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><style>
{css}
</style></head><body><div class="card" style="{vars}" data-target-h="{targeth}">
<div class="kicker">{faculty} &middot; {semester} &middot; {part}</div>
<h1>Sala {room} <span>{sub}</span></h1>
<div class="days">{cols}</div>
{foot}
</div></body></html>"""

FOOT = """<div class="foot"><span><b>Legenda:</b> S = stacjonarne, N = niestacjonarne;
<span class="sw" style="background:#1d4ed8;margin-left:0"></span>WYK
<span class="sw" style="background:#15803d"></span>LAB
<span class="sw" style="background:#c2410c"></span>KON
<span class="sw" style="background:#7e22ce"></span>SEM
<span class="sw" style="background:#475569"></span>PRZ.
Jeden blok = jedna pora w sali (grupy/tygodnie połączone; parz.+nieparz. = co tydzień).
Weekendy N zależą od terminu zjazdu.</span>
<span>{date}</span></div>"""


def room_slug(room):
    m = re.match(r'^(.+?),\s*bud\.\s*(\d+)$', room)
    nm = unicodedata.normalize('NFKD', m.group(1)).encode('ascii', 'ignore').decode()
    return f"bud-{m.group(2)}_sala-{re.sub(r'[^A-Za-z0-9]+', '-', nm).strip('-')}"


def section_cols(byday, box, lane_max, compact):
    """HTML kolumn dni dla jednej sekcji (sali). Zwraca (kolumny, dni)."""
    days = sorted(byday, key=DAY_ORDER.index)
    cols = []
    for d in days:
        boxes = [(tmin(m['start']), tmin(m['end']), m) for m in byday[d]]
        boxes.sort(key=lambda b: (b[0], b[1]))
        # klastry = zajęcia nachodzące na siebie w czasie
        clusters = []
        cur, cur_end = [], -1
        for s, e2, m in boxes:
            if cur and s >= cur_end:
                clusters.append(cur)
                cur = []
            cur.append((s, e2, m))
            cur_end = max(cur_end, e2)
        if cur:
            clusters.append(cur)
        parts, prev_end = [], None
        for cl in clusters:
            if prev_end is not None and cl[0][0] - prev_end > 90:
                parts.append('<div class="gap"></div>')
            lanes = []
            for s, e2, m in cl:
                li = 0
                while li < len(lanes) and not all(o[1] <= s for o in lanes[li]):
                    li += 1
                if li == len(lanes):
                    lanes.append([])
                lanes[li].append((s, e2, m))
            if len(lanes) <= lane_max:
                row = ['<div class="row">']
                for lane in lanes:
                    sub = []
                    for s, e2, m in lane:
                        mh = max(int((e2 - s) * PXM), 40) if not compact else 0
                        sub.append(f'<div style="min-height:{mh}px">{box(m)}</div>')
                    row.append(f'<div class="lane">{"".join(sub)}</div>')
                row.append('</div>')
                parts.append(''.join(row))
            else:
                # zbyt wiele równoległych zajęć — układaj jedno pod drugim
                for s, e2, m in cl:
                    mh = max(int((e2 - s) * PXM), 40) if not compact else 0
                    parts.append(f'<div style="min-height:{mh}px">{box(m)}</div>')
            prev_end = max(e2 for _, e2, _ in cl)
        cols.append(f'<div class="daycol"><div class="dhead">{d}</div>'
                    f'<div class="dbody">{"".join(parts)}</div></div>')
    return cols, days


def build(room, entries, days, mode, footer=True):
    """mode: 'pn-pt' (przestronne bloki, A4 poziomo) lub 'sb-nd' (zwarte, A4 pionowo)."""
    m = re.match(r'^(.+?),\s*bud\.\s*(\d+)$', room)
    ultra = mode == 'sb-nd' and m and m.group(1).strip() in ULTRA
    compact = (mode == 'sb-nd')
    box = box_ultra if ultra else (box_compact if compact else box_roomy)
    lane_max = 3 if compact else 2
    if ultra:
        merged = merge_ultra([e for e in entries if e['day'] in days])
    else:
        merged = merge_slots([e for e in entries if e['day'] in days])
    if not merged:
        return None
    byday = {}
    for m in merged:
        byday.setdefault(m['day'], []).append(m)
    cardw = 990 if compact else config.CARDW
    targeth = round(cardw * 1.4142) if compact else round(cardw / 1.4142)
    cols, days = section_cols(byday, box, lane_max, compact)
    variables = (f'--cardw:{cardw}px;--gap:5px;--pad:4px 7px;'
                 f'--fs:11.5px;--fst:12.5px;--fsnt:10.5px') if compact else ''
    html = T.format(css=SHARED_CSS, vars=variables, targeth=targeth,
                    faculty=config.FACULTY, semester=config.SEMESTER,
                    part='poniedziałek–piątek' if not compact else 'sobota–niedziela',
                    room=esc(room), cols=''.join(cols),
                    sub=('plan zajęć · studia niestacjonarne · '
                         'zajęcia w wybranych terminach zjazdów (szczegóły: USOSweb UKW)'
                         if ultra else 'plan zajęć · źródło: USOSweb UKW'),
                    foot=FOOT.format(date=datetime.date.today().strftime('%d.%m.%Y'))
                    if footer else '')
    fn = f'plan-sali-2026-27-{room_slug(room)}-{mode}.png'
    key = f'room-{room_slug(room)}-{mode}'
    os.makedirs(CARD_DIR, exist_ok=True)
    with open(os.path.join(CARD_DIR, 'shot-' + key + '.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    return key, fn


def main():
    print(f'budynek {BUILDING}: {len(rooms)} sal | wpisy bez sali: {skipped}')
    if not rooms:
        print(f'Brak zajęć w budynku {BUILDING} — sprawdź config.BUILDING i plan.json.')
        return 1
    names = {}
    for room in sorted(rooms):
        r = build(room, rooms[room], WEEK, 'pn-pt')
        if r:
            names[r[0]] = r[1]
        m = re.match(r'^(.+?),\s*bud\.\s*(\d+)$', room)
        nofoot = m and m.group(1).strip() in NO_FOOT
        r = build(room, rooms[room], END, 'sb-nd', footer=not nofoot)
        if r:
            names[r[0]] = r[1]
    with open(os.path.join(CARD_DIR, 'shots.json'), 'w', encoding='utf-8') as f:
        json.dump(names, f, indent=1)
    print(f'zbudowano {len(names)} plansz -> out/shot-*.html')
    return 0


if __name__ == '__main__':
    sys.exit(main())
