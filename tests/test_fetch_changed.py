"""Tryb --only-changed pobierania: zapisujemy tylko zmienione pliki HTML.

Testy nie używają sieci — download() i make_opener() są podmienione w module
fetch. Uruchomienie: python -m unittest discover -s tests -v
"""
import json
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'scripts'))
import fetch  # noqa: E402
import fetch_week_pon_pt as week_fetch  # noqa: E402

GROUPS = [
    {'key': 'SJ-I', 'label': 'I rok', 'folder': 'stacjonarne', 'grupa': 'SJ-Ps-11', 'cykl': '2026Z'},
    {'key': 'NJ-II', 'label': 'II rok', 'folder': 'niestacjonarne', 'grupa': 'NJ-Ps-2', 'cykl': '2026'},
]


def page(body):
    return '<usos-timetable>' + body + '</usos-timetable>' + ('x' * 100)


class OnlyChangedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = self.temp.name
        fetch.HTML = os.path.join(base, 'html')
        fetch.MANIFEST = os.path.join(fetch.HTML, 'manifest.json')
        fetch.WEEK_HTML = os.path.join(fetch.HTML, 'week')
        fetch.WEEK_MANIFEST = os.path.join(fetch.WEEK_HTML, 'manifest.json')
        fetch.WEEK_CHANGES = os.path.join(fetch.WEEK_HTML, 'changes.json')
        fetch.GROUPS = GROUPS
        fetch.validate = lambda *args, **kwargs: None
        fetch.make_opener = lambda: object()
        self.pages = {}
        fetch.download = lambda op, url, tries=3: self.pages[url]
        self.urls = {}
        for group in GROUPS:
            divisions = ['semester', 'week'] if group['folder'] == 'niestacjonarne' else ['semester']
            for division in divisions:
                self.urls[(group['key'], division)] = fetch.plan_url(group, division)
        for url in self.urls.values():
            self.pages[url] = page('strona v1')
        self.semester = self.urls[('SJ-I', 'semester')]
        self.week = self.urls[('NJ-II', 'week')]
        self.pages[self.semester] = page('semestr v1')
        self.pages[self.week] = page('tydzien v1')
        self.argv = sys.argv

    def tearDown(self):
        sys.argv = self.argv

    def run_fetch(self):
        sys.argv = ['fetch.py', '--only-changed']
        return fetch.main()

    def report(self):
        with open(fetch.WEEK_CHANGES, encoding='utf-8') as f:
            return json.load(f)

    def test_first_run_writes_all_files_and_baseline(self):
        self.assertEqual(self.run_fetch(), 0)
        self.assertTrue(os.path.exists(os.path.join(fetch.HTML, 'SJ-I.html')))
        self.assertTrue(os.path.exists(os.path.join(fetch.WEEK_HTML, 'NJ-II.html')))
        self.assertTrue(os.path.exists(fetch.WEEK_MANIFEST))
        self.assertIn('baseline_initialized', self.report())

    def test_second_run_does_not_overwrite_unchanged_files(self):
        self.run_fetch()
        paths = [os.path.join(fetch.HTML, 'SJ-I.html'),
                 os.path.join(fetch.WEEK_HTML, 'NJ-II.html')]
        for path in paths:
            os.utime(path, (1, 1))
        self.assertEqual(self.run_fetch(), 0)
        for path in paths:
            self.assertEqual(os.path.getmtime(path), 1)
        self.assertEqual(self.report()['changed'], [])
        self.assertEqual(self.report()['semester'], [])

    def test_one_changed_page_writes_only_that_file(self):
        self.run_fetch()
        semester = os.path.join(fetch.HTML, 'SJ-I.html')
        week = os.path.join(fetch.WEEK_HTML, 'NJ-II.html')
        os.utime(semester, (1, 1))
        os.utime(week, (1, 1))
        self.pages[self.semester] = page('semestr v2')
        self.assertEqual(self.run_fetch(), 0)
        self.assertNotEqual(os.path.getmtime(semester), 1)
        self.assertEqual(os.path.getmtime(week), 1)
        self.assertEqual(self.report()['semester'], ['SJ-I'])

    def test_failed_download_returns_one_and_is_reported(self):
        def broken(op, url, tries=3):
            if url == self.week:
                raise RuntimeError('pobieranie nie udalo sie')
            return self.pages[url]
        fetch.download = broken
        self.assertEqual(self.run_fetch(), 1)
        self.assertEqual(len(self.report()['failed']), 1)

    def test_week_page_without_entries_is_accepted(self):
        self.pages[self.week] = '<usos-timetable>brak zajec</usos-timetable>'
        self.assertEqual(self.run_fetch(), 0)
        self.assertTrue(os.path.exists(os.path.join(fetch.WEEK_HTML, 'NJ-II.html')))


class WeekPonPtOnlyChangedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = self.temp.name
        week_fetch.OUTDIR = os.path.join(base, 'pon-pt')
        week_fetch.MANIFEST = os.path.join(week_fetch.OUTDIR, 'manifest.json')
        week_fetch.PLAN_OUT = os.path.join(base, 'plan-pon-pt.json')
        week_fetch.GROUPS = [GROUPS[0]]
        week_fetch.make_opener = lambda: object()
        week_fetch.validate = lambda *args, **kwargs: None
        week_fetch.parse = lambda path: {'rows': [{'day': 'Poniedziałek'}]}
        self.content = page('tydzien pon pt')
        week_fetch.download = lambda op, url, tries=3: self.content
        self.argv = sys.argv

    def tearDown(self):
        sys.argv = self.argv

    def run_fetch(self):
        sys.argv = ['fetch_week_pon_pt.py', '--only-changed']
        return week_fetch.main()

    def test_second_run_does_not_overwrite_files(self):
        self.assertEqual(self.run_fetch(), 0)
        html = os.path.join(week_fetch.OUTDIR, 'SJ-I.html')
        for path in (html, week_fetch.PLAN_OUT):
            os.utime(path, (1, 1))
        self.assertEqual(self.run_fetch(), 0)
        for path in (html, week_fetch.PLAN_OUT):
            self.assertEqual(os.path.getmtime(path), 1)

    def test_changed_page_rewrites_plan(self):
        self.run_fetch()
        html = os.path.join(week_fetch.OUTDIR, 'SJ-I.html')
        os.utime(html, (1, 1))
        os.utime(week_fetch.PLAN_OUT, (1, 1))
        self.content = page('tydzien pon pt v2')
        self.assertEqual(self.run_fetch(), 0)
        self.assertNotEqual(os.path.getmtime(html), 1)
        self.assertNotEqual(os.path.getmtime(week_fetch.PLAN_OUT), 1)


if __name__ == '__main__':
    unittest.main()
