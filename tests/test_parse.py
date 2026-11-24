"""Regresja parsera USOS: jeden mały fixture wyłapuje zmianę znaczników.

Uruchomienie z folderu głównego: python -m unittest discover -s tests -v
"""
import glob
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
from parse import clean, parse  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
ROW_KEYS = {
    'day', 'start', 'end', 'course', 'code', 'type', 'group',
    'room', 'teacher', 'event', 'note', 'typ_full', 'info',
}


class ParseFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = parse(os.path.join(FIXTURES, 'plan-sample.html'))

    def test_title_and_row_count(self):
        self.assertEqual(self.result['title'], 'Plan grupy SJ-I — fixture testowy')
        self.assertEqual(len(self.result['rows']), 3)

    def test_full_entry(self):
        row = self.result['rows'][0]
        self.assertEqual(row['day'], 'Poniedziałek')
        self.assertEqual(row['start'], '9:45')
        self.assertEqual(row['end'], '12:00')
        self.assertEqual(row['course'], 'Psychologia poznawcza')
        self.assertEqual(row['code'], 'PSY-001')
        self.assertEqual(row['type'], 'WYK')
        self.assertEqual(row['group'], '1')
        self.assertEqual(row['typ_full'], 'Wykład')
        self.assertEqual(set(row), ROW_KEYS)

    def test_nested_room_is_last_parenthesis(self):
        row = self.result['rows'][0]
        self.assertEqual(row['room'], 'Aula Atrium (17), bud. 009')

    def test_two_teachers_are_joined(self):
        row = self.result['rows'][0]
        self.assertEqual(row['teacher'], 'Jan Kowalski, Anna Nowak')

    def test_missing_data_is_not_invented(self):
        row = self.result['rows'][1]
        self.assertEqual(row['room'], '')
        self.assertEqual(row['start'], '')
        self.assertEqual(row['end'], '')
        self.assertEqual(row['note'], 'inne')

    def test_parity_icons(self):
        self.assertEqual(self.result['rows'][0]['note'], 'niep.')
        self.assertEqual(self.result['rows'][2]['note'], 'parz.')

    def test_en_dash_in_time(self):
        row = self.result['rows'][2]
        self.assertEqual((row['start'], row['end']), ('15:00', '17:30'))

    def test_clean_collapses_whitespace_and_nbsp(self):
        self.assertEqual(clean('  WYK,\xa0  gr.\t1  '), 'WYK, gr. 1')


class RealDataShapeTests(unittest.TestCase):
    """Gdy html/ jest pobrane: sprawdza kształt wierszy, nie konkretne liczby."""

    def test_all_groups_have_expected_shape(self):
        files = sorted(glob.glob(os.path.join(ROOT, 'html', '*.html')))
        if not files:
            self.skipTest('Brak html/*.html — uruchom najpierw fetch.py')
        for path in files:
            with self.subTest(path=os.path.basename(path)):
                result = parse(path)
                self.assertTrue(result['rows'], f'{path}: brak wierszy')
                for row in result['rows']:
                    self.assertEqual(set(row), ROW_KEYS)
                    self.assertTrue(row['day'], f'{path}: wiersz bez dnia')


if __name__ == '__main__':
    unittest.main()
