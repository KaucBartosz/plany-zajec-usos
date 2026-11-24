"""Szuka kolizji: sala, prowadzący lub grupa zajęta w tej samej porze.

Reguły, żeby nie zgłaszać fałszywych alarmów:
- przedziały [start, end) — 9:45–12:00 i 12:00–14:00 się nie kolidują,
- 'parz.' i 'niep.' to różne tygodnie, więc się nie kolidują,
- 'inne' / terminy niestandardowe = data nieznana — wpis pomijany,
- plan semestralny nie zawiera dat zjazdów, więc weekendy sprawdza się
  w html/week/plan.json (konkretny tydzień),
- ten sam kod przedmiotu w kilku planach grup to jedne zajęcia, nie kolizja,
- brak godziny w USOS = wpis pomijany (nie wymyślamy danych).

Uruchomienie: python scripts/check_conflicts.py
Wynik: raport na ekranie + out/kolizje.json. Kod 1 = znaleziono kolizje.
"""
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, 'plan.json')
WEEK_PLAN = os.path.join(ROOT, 'html', 'week', 'plan.json')
OUT = os.path.join(ROOT, 'out', 'kolizje.json')
WEEKEND = ('Sobota', 'Niedziela')


def minutes(value):
    match = re.fullmatch(r'(\d{1,2}):(\d{2})', str(value or '').strip())
    if not match:
        return None
    hours, mins = int(match.group(1)), int(match.group(2))
    if hours > 23 or mins > 59:
        return None
    return hours * 60 + mins


def overlaps(a_start, a_end, b_start, b_end):
    """Prawda, gdy dwa przedziały [start,end) nachodzą na siebie."""
    return a_start < b_end and b_start < a_end


def norm(value):
    return ' '.join(str(value or '').split())


def week_signature(row):
    """Których tygodni dotyczy wpis: 'all', 'even', 'odd' lub 'unknown'."""
    note = str(row.get('note') or '')
    event = str(row.get('event') or '')
    if 'inne' in note or 'niestandardowa' in event:
        return 'unknown'
    if 'parz' in note:
        return 'even'
    if 'niep' in note:
        return 'odd'
    return 'all'


def same_week_context(first, second):
    a = first.get('week') if isinstance(first, dict) and 'week' in first else week_signature(first)
    b = second.get('week') if isinstance(second, dict) and 'week' in second else week_signature(second)
    if 'unknown' in (a, b):
        return False
    return a == b or a == 'all' or b == 'all'


def teachers_of(row):
    return [name for name in (norm(part) for part in str(row.get('teacher') or '').split(','))
            if name and name != '—']


def room_map_from(plan):
    """Sala '102' bez budynku dostaje go tylko przy jednoznacznym dopasowaniu."""
    candidates = defaultdict(set)
    for group in (plan or {}).values():
        for row in group.get('rows', []):
            match = re.fullmatch(r'(.+?),\s*bud\.\s*(\d+)', norm(row.get('room')))
            if match:
                candidates[match.group(1).strip()].add(match.group(2))
    return {name: f'{name}, bud. {next(iter(buds))}'
            for name, buds in candidates.items() if len(buds) == 1}


def find_conflicts(plan, source='semester', room_map=None):
    """Zwraca (kolizje, liczba pominiętych wpisów). Czysta funkcja — bez IO."""
    if room_map is None:
        room_map = room_map_from(plan)
    buckets = defaultdict(list)
    skipped = 0
    for group_key, group in (plan or {}).items():
        for index, row in enumerate(group.get('rows', [])):
            start, end = minutes(row.get('start')), minutes(row.get('end'))
            if start is None or end is None or end <= start:
                skipped += 1
                continue
            if source == 'semester' and row.get('day') in WEEKEND:
                skipped += 1
                continue
            if week_signature(row) == 'unknown':
                skipped += 1
                continue
            ident = (group_key, index)
            places = []
            room = norm(row.get('room'))
            if room:
                places.append(('sala', room_map.get(room, room)))
            places.extend(('prowadzący', name) for name in teachers_of(row))
            number = norm(row.get('group'))
            if number:
                places.append(('grupa', f'{group_key} / {number}'))
            for kind, place in places:
                buckets[(kind, place, row.get('day') or '')].append({
                    'kind': kind, 'place': place, 'day': row.get('day') or '',
                    'start': start, 'end': end, 'ident': ident,
                    'course': norm(row.get('course')), 'code': norm(row.get('code')),
                    'group_key': group_key, 'group': number,
                    'week': week_signature(row), 'source': source,
                })

    conflicts, seen = [], set()
    for (kind, place, day), items in buckets.items():
        items.sort(key=lambda item: (item['start'], item['end']))
        for i, first in enumerate(items):
            for second in items[i + 1:]:
                if second['start'] >= first['end']:
                    break
                if first['ident'] == second['ident']:
                    continue
                # ten sam kod w kilku planach grup to jedne zajęcia, nie kolizja
                if first['code'] and first['code'] == second['code']:
                    continue
                if not same_week_context(first, second):
                    continue
                signature = (kind, place, day, source, first['start'], second['start'],
                             first['code'], second['code'])
                if signature in seen:
                    continue
                seen.add(signature)
                conflicts.append({
                    'kind': kind, 'place': place, 'day': day, 'source': source,
                    'start': first['start'], 'end': min(first['end'], second['end']),
                    'a': {k: first[k] for k in ('course', 'code', 'group_key', 'group', 'start', 'end')},
                    'b': {k: second[k] for k in ('course', 'code', 'group_key', 'group', 'start', 'end')},
                })
    return (sorted(conflicts, key=lambda c: (c['source'], c['kind'], c['place'], c['day'], c['start'])),
            skipped)


def clock(minutes_value):
    return f'{minutes_value // 60:02d}:{minutes_value % 60:02d}'


def format_report(conflicts, skipped=0):
    if not conflicts:
        return 'Kolizji nie znaleziono.'
    lines = [f'Znaleziono {len(conflicts)} kolizji:']
    for c in conflicts:
        a, b = c['a'], c['b']
        source = 'bieżący tydzień' if c.get('source') == 'week' else 'semestr'
        lines.append(f"[{source}] {c['kind']} {c['place']} — {c['day']} "
                     f"{clock(c['start'])}–{clock(c['end'])}")
        for item in (a, b):
            label = f"{item['code']} {item['course']}".strip()
            lines.append(f"    {label} ({item['group_key']}"
                         + (f", gr. {item['group']}" if item['group'] else '')
                         + f") {clock(item['start'])}–{clock(item['end'])}")
    if skipped:
        lines.append('')
        lines.append(f'Pominięto {skipped} wpisów: brak godziny, terminy niestandardowe '
                     'albo weekend w planie semestralnym (daty zjazdów nie są w USOS).')
    return '\n'.join(lines)


def main():
    if not os.path.exists(PLAN):
        print('Brak plan.json — uruchom najpierw parse.py.', file=sys.stderr)
        return 2
    with open(PLAN, encoding='utf-8') as f:
        plan = json.load(f)
    room_map = room_map_from(plan)
    conflicts, skipped = find_conflicts(plan, 'semester', room_map)
    week_conflicts, week_skipped = [], 0
    if os.path.exists(WEEK_PLAN):
        with open(WEEK_PLAN, encoding='utf-8') as f:
            week_plan = json.load(f)
        week_conflicts, week_skipped = find_conflicts(week_plan, 'week', room_map)
    conflicts += week_conflicts
    print(format_report(conflicts, skipped + week_skipped))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(conflicts, f, ensure_ascii=False, indent=1)
    print(f'Raport JSON: {OUT}')
    return 1 if conflicts else 0


if __name__ == '__main__':
    sys.exit(main())
