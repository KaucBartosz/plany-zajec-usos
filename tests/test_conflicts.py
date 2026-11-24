"""Testy wykrywania kolizji — czyste funkcje z scripts/check_conflicts.py."""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from check_conflicts import (find_conflicts, format_report, minutes,  # noqa: E402
                             overlaps, room_map_from)


def row(**kwargs):
    base = {
        'day': 'Poniedziałek', 'start': '9:45', 'end': '12:00',
        'course': 'Przedmiot', 'code': 'KOD-1', 'type': 'WYK', 'group': '1',
        'room': '301, bud. 009', 'teacher': 'Jan Kowalski',
    }
    base.update(kwargs)
    return base


def plan(*rows, group_key='SJ-I'):
    return {group_key: {'rows': list(rows)}}


class HelpersTests(unittest.TestCase):
    def test_minutes(self):
        self.assertEqual(minutes('9:45'), 585)
        self.assertEqual(minutes('14:05'), 845)
        self.assertIsNone(minutes(''))
        self.assertIsNone(minutes('25:00'))

    def test_overlaps_is_half_open(self):
        self.assertTrue(overlaps(585, 720, 660, 840))
        self.assertTrue(overlaps(585, 720, 600, 610))
        self.assertFalse(overlaps(585, 720, 720, 840))
        self.assertFalse(overlaps(585, 720, 840, 900))

    def test_bare_room_gets_unique_building(self):
        data = plan(row(room='301, bud. 009'), row(room='302, bud. 009'),
                    row(room='303, bud. 001'))
        self.assertEqual(room_map_from(data), {
            '301': '301, bud. 009', '302': '302, bud. 009', '303': '303, bud. 001',
        })


class ConflictTests(unittest.TestCase):
    def test_same_room_overlap(self):
        found, _ = find_conflicts(plan(
            row(code='A'),
            row(code='B', start='11:00', end='13:00', group='2', teacher='Anna Nowak'),
        ))
        self.assertEqual([c['kind'] for c in found], ['sala'])
        self.assertEqual(found[0]['place'], '301, bud. 009')
        self.assertEqual(found[0]['end'], 720)

    def test_back_to_back_is_not_a_conflict(self):
        found, _ = find_conflicts(plan(
            row(code='A'), row(code='B', start='12:00', end='14:00', group='2'),
        ))
        self.assertEqual(found, [])

    def test_same_teacher_different_rooms(self):
        found, _ = find_conflicts(plan(
            row(code='A'),
            row(code='B', room='302, bud. 009', group='2', start='10:00', end='11:00'),
        ))
        self.assertEqual([c['kind'] for c in found], ['prowadzący'])
        self.assertEqual(found[0]['place'], 'Jan Kowalski')

    def test_teacher_split_by_comma(self):
        found, _ = find_conflicts(plan(
            row(code='A', teacher='Jan Kowalski, Anna Nowak'),
            row(code='B', room='302, bud. 009', group='2', teacher='Anna Nowak'),
        ))
        self.assertEqual([c['place'] for c in found], ['Anna Nowak'])

    def test_same_group_number_in_two_rooms(self):
        found, _ = find_conflicts(plan(
            row(code='A'),
            row(code='B', room='302, bud. 009', teacher='Anna Nowak'),
        ))
        self.assertEqual([c['kind'] for c in found], ['grupa'])
        self.assertEqual(found[0]['place'], 'SJ-I / 1')

    def test_missing_time_is_skipped(self):
        found, _ = find_conflicts(plan(row(code='A'), row(code='B', start='', end='')))
        self.assertEqual(found, [])

    def test_bare_room_number_is_matched(self):
        found, _ = find_conflicts(plan(
            row(code='A', room='301'),
            row(code='B', room='301, bud. 009', group='2', teacher='Anna Nowak'),
        ))
        self.assertEqual([c['kind'] for c in found], ['sala'])

    def test_report_lists_both_sides(self):
        found, _ = find_conflicts(plan(
            row(code='A'), row(code='B', start='11:00', group='2', teacher='Anna Nowak'),
        ))
        report = format_report(found)
        self.assertIn('sala 301, bud. 009', report)
        self.assertIn('A Przedmiot', report)
        self.assertIn('B Przedmiot', report)
        self.assertIn('09:45', report)


    def test_parz_and_niep_are_different_weeks(self):
        found, _ = find_conflicts(plan(
            row(code='A', note='parz.'),
            row(code='B', note='niep.', group='2', teacher='Anna Nowak'),
        ))
        self.assertEqual(found, [])

    def test_unknown_custom_dates_are_skipped(self):
        found, skipped = find_conflicts(plan(
            row(code='A', note='inne'),
            row(code='B', start='11:00', group='2', teacher='Anna Nowak'),
        ))
        self.assertEqual(found, [])
        self.assertEqual(skipped, 1)

    def test_weekend_skipped_in_semester_but_checked_for_week(self):
        data = plan(
            row(code='A', day='Sobota'),
            row(code='B', day='Sobota', start='11:00', group='1', teacher='Anna Nowak'),
        )
        found, skipped = find_conflicts(data)
        self.assertEqual(found, [])
        self.assertEqual(skipped, 2)
        week_found, _ = find_conflicts(data, source='week')
        self.assertIn('sala', [c['kind'] for c in week_found])

    def test_same_code_in_two_group_plans_is_not_a_conflict(self):
        data = plan(row(code='SAME'), group_key='SJ-I')
        data['SJ-II'] = {'rows': [row(code='SAME', group='2', teacher='Anna Nowak')]}
        found, _ = find_conflicts(data)
        self.assertEqual(found, [])


if __name__ == '__main__':
    unittest.main()
