"""html/<key>.html  ->  plan.json and html/week/plan.json

Czyta surowy HTML planu (server-rendered, bez JS) i zapisuje jedną płaską
tabelę zajęć: dzień, godziny, przedmiot, typ, grupa, sala, prowadzący, uwagi.
Warianty niestacjonarne z html/week/ zapisuje osobno z datami konkretnego tygodnia.
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from groups import GROUPS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTMLDIR = os.path.join(ROOT, 'html')
OUT = os.path.join(ROOT, 'plan.json')
WEEKDIR = os.path.join(HTMLDIR, 'week')
WEEK_OUT = os.path.join(WEEKDIR, 'plan.json')


class Parser(HTMLParser):
    """Zbiera <timetable-entry> wraz z polami slot="info|dialog-event|dialog-person"."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.day = None
        self.entry = None
        self.slot = None
        self.results = []
        self.title = ''
        self.in_title = False
        self.in_h4 = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'h4':
            self.in_h4 = True
            self.day_buf = ''
        elif tag == 'title':
            self.in_title = True
            self.title_buf = ''
        elif tag == 'timetable-entry':
            self.entry = {
                'day': self.day, 'name': a.get('name', ''), 'code': a.get('name-id', ''),
                'icons': [], 'slots': {},
            }
        elif tag == 'usos-icon' and self.entry is not None:
            self.entry['icons'].append(a.get('icon-url', ''))
        elif tag in ('div', 'span') and self.entry is not None and 'slot' in a:
            self.slot = a['slot']
            self.entry['slots'][self.slot] = self.entry['slots'].get(self.slot, '')
            if self.slot == 'dialog-person' and self.entry['slots'][self.slot]:
                self.entry['slots'][self.slot] += ', '

    def handle_endtag(self, tag):
        if tag == 'h4':
            self.in_h4 = False
            self.day = self.day_buf.strip()
        elif tag == 'title':
            self.in_title = False
            self.title = self.title_buf.strip()
        elif tag == 'timetable-entry':
            if self.entry:
                self.results.append(self.entry)
            self.entry = None
        elif tag in ('div', 'span'):
            self.slot = None

    def handle_data(self, d):
        if self.in_h4:
            self.day_buf += d
        elif self.in_title:
            self.title_buf += d
        elif self.entry is not None and self.slot:
            self.entry['slots'][self.slot] += d


def clean(s):
    return re.sub(r'\s+', ' ', s.replace('\xa0', ' ')).strip()


def parse(path):
    p = Parser()
    with open(path, encoding='utf-8', errors='replace') as f:
        p.feed(f.read())
    rows = []
    for e in p.results:
        info = clean(e['slots'].get('info', ''))
        event = clean(e['slots'].get('dialog-event', ''))
        person = clean(e['slots'].get('dialog-person', ''))
        typ = clean(e['slots'].get('dialog-info', ''))
        m = re.search(r'gr\.?\s*([\d]+)', info)
        grp = m.group(1) if m else ''
        tshort = info.split(',')[0].strip()
        if len(tshort) > 12:          # to nie skrót typu, tylko nazwa — odrzuć
            tshort = ''
        # Sala = ostatni nawias w polu info; może być zagnieżdżony, np. "Aula (17), bud. 001"
        room = ''
        depth = 0
        start_paren = -1
        for i, ch in enumerate(info):
            if ch == '(':
                if depth == 0:
                    start_paren = i
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0 and start_paren >= 0 and i == len(info) - 1:
                    room = info[start_paren + 1:i]
                    break
                if depth == 0:
                    start_paren = -1
        room = clean(room)
        mp = re.search(r'(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})', event)
        start, end = (mp.group(1), mp.group(2)) if mp else ('', '')
        icon = ''
        for u in e['icons']:
            if 'one.svg' in u:        # tydzień nieparzysty
                icon = 'niep.'
            elif 'two.svg' in u:      # tydzień parzysty
                icon = 'parz.'
            elif 'warn.svg' in u:     # terminy niestandardowe
                icon = 'inne'
        rows.append({
            'day': e['day'], 'start': start, 'end': end,
            'course': e['name'], 'code': e['code'],
            'type': tshort, 'group': grp, 'room': room,
            'teacher': person.rstrip(' ,'),
            'event': event, 'note': icon, 'typ_full': typ, 'info': info,
        })
    return {'title': clean(p.title), 'rows': rows}


def main():
    data, total, no_room = {}, 0, 0
    for g in GROUPS:
        path = os.path.join(HTMLDIR, g['key'] + '.html')
        if not os.path.exists(path):
            print(f"{g['key']:<22} BRAK pliku {path} — uruchom fetch.py")
            return 1
        d = parse(path)
        d['label'] = g['label']
        d['folder'] = g['folder']
        data[g['key']] = d
        rows = d['rows']
        total += len(rows)
        no_room += sum(1 for r in rows if not r['room'])
        bad_time = sum(1 for r in rows if not r['start'])
        flag = f'  (bez godzin: {bad_time})' if bad_time else ''
        print(f"{g['key']:<22} {len(rows):>4} zajęć  | {(d['title'] or '?')[:58]}{flag}")

    week_data, week_total = {}, 0
    for g in GROUPS:
        if g['folder'] != 'niestacjonarne':
            continue
        path = os.path.join(WEEKDIR, g['key'] + '.html')
        if not os.path.exists(path):
            print(f"{g['key']:<22} BRAK pliku tygodniowego {path} — uruchom fetch.py")
            return 1
        d = parse(path)
        d['label'] = g['label']
        d['folder'] = g['folder']
        week_data[g['key']] = d
        week_total += len(d['rows'])
        print(f"{g['key']:<22} {len(d['rows']):>4} zajęć w aktualnym tygodniu")

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(WEEK_OUT, 'w', encoding='utf-8') as f:
        json.dump(week_data, f, ensure_ascii=False, indent=1)
    print(f'\nplan.json: {total} zajęć, {no_room} bez sali w USOS')
    print(f'html/week/plan.json: {week_total} zajęć dla {len(week_data)} grup')
    return 0


if __name__ == '__main__':
    sys.exit(main())
