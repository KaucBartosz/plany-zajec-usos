'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const filters = require('../src/shared/filters');
const { loadAll } = require('../src/shared/data');

function entry(overrides) {
  return {
    day: 'Poniedziałek', start: '9:45', end: '12:00', course: 'Test', code: 'T-1',
    type: 'WYK', group: '1', room: '102, bud. 009', teacher: 'Jan Kowalski',
    year: 'I', groupKey: 'SJ-I', source: 'semester', note: '', ...overrides,
  };
}

test('parseGroupKey rozpoznaje typ, rok i specjalność', () => {
  assert.deepEqual(filters.parseGroupKey('SJ-I'), {
    key: 'SJ-I', studyType: 'stacjonarne', year: 'I', speciality: '', label: 'I rok',
  });
  const parsed = filters.parseGroupKey('NJ-V-biznesu');
  assert.equal(parsed.studyType, 'niestacjonarne');
  assert.equal(parsed.year, 'V');
  assert.equal(parsed.speciality, 'biznesu');
});

test('filtr prowadzącego działa przy wielu nazwiskach w jednym polu', () => {
  const rows = [
    entry({ teacher: 'Jan Kowalski, Anna Nowak' }),
    entry({ teacher: 'Piotr Zieliński' }),
  ];
  const result = filters.filterEntries(rows, { teachers: ['Anna Nowak'] });
  assert.equal(result.length, 1);
  assert.equal(result[0].teacher, 'Jan Kowalski, Anna Nowak');
});

test('rocznik, grupa i typ łączą się koniunkcją', () => {
  const rows = [
    entry({ year: 'I', groupKey: 'SJ-I', group: '1', type: 'WYK' }),
    entry({ year: 'II', groupKey: 'SJ-II', group: '1', type: 'WYK' }),
    entry({ year: 'I', groupKey: 'SJ-I', group: '2', type: 'LAB' }),
  ];
  const result = filters.filterEntries(rows, {
    years: ['I'], groupKeys: ['SJ-I'], groupNumbers: ['1'], types: ['WYK'],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'WYK');
});

test('weekend i źródło tygodnia ograniczają wyniki', () => {
  const rows = [
    entry({ day: 'Sobota', source: 'semester' }),
    entry({ day: 'Niedziela', source: 'week' }),
    entry({ day: 'Poniedziałek', source: 'week' }),
  ];
  const semester = filters.filterEntries(rows);
  assert.equal(semester.length, 1);
  const weekend = filters.filterEntries(rows, { weekendOnly: true });
  assert.equal(weekend.length, 1);
  assert.equal(weekend[0].source, 'semester');
  const week = filters.filterEntries(rows, { source: 'week' });
  assert.equal(week.length, 2);
  const weekWeekend = filters.filterEntries(rows, { source: 'week', weekendOnly: true });
  assert.equal(weekWeekend.length, 1);
  assert.equal(weekWeekend[0].day, 'Niedziela');
});

test('collectOptions zwraca unikalne wartości, dni w kolejności kalendarza', () => {
  const options = filters.collectOptions([
    entry({ teacher: 'A, B', day: 'Niedziela', type: 'LAB', year: 'II' }),
    entry({ teacher: 'B', day: 'Poniedziałek', type: 'WYK', year: 'I' }),
  ]);
  assert.deepEqual(options.teachers, ['A', 'B']);
  assert.deepEqual(options.days, ['Poniedziałek', 'Niedziela']);
  assert.deepEqual(options.years, ['I', 'II']);
});

test('sortEntries porządkuje dni i godziny', () => {
  const sorted = filters.sortEntries([
    entry({ day: 'Środa', start: '8:00' }),
    entry({ day: 'Poniedziałek', start: '12:00' }),
    entry({ day: 'Poniedziałek', start: '9:00' }),
  ]);
  assert.deepEqual(sorted.map((row) => [row.day, row.start]), [
    ['Poniedziałek', '9:00'], ['Poniedziałek', '12:00'], ['Środa', '8:00'],
  ]);
});

test('smoke test na realnym plan.json', () => {
  const root = path.resolve(__dirname, '..', '..');
  const data = loadAll(root);
  assert.ok(data.meta.semesterCount > 0);

  const firstTeacher = filters.collectOptions(data.entries).teachers[0];
  const result = filters.filterEntries(data.entries, { teachers: [firstTeacher] });
  assert.ok(result.length > 0);
  for (const row of result) {
    assert.ok(String(row.teacher).split(',').some((name) => name.trim() === firstTeacher));
  }

  const weekend = filters.filterEntries(data.entries, { source: 'week', weekendOnly: true });
  for (const row of weekend) {
    assert.ok(filters.WEEKEND.includes(row.day));
    assert.equal(row.source, 'week');
  }

  if (data.meta.weekPonPtCount > 0) {
    const weekRows = filters.filterEntries(data.entries, { source: 'week' });
    assert.ok(weekRows.some((row) => row.day === 'Poniedziałek'));
  }
});
