'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml } = require('../src/main/export-template');
const { mergeEntries } = require('../src/shared/views');

const visible = ['day', 'time', 'course', 'type', 'group', 'room', 'teacher'];

test('eksport rysuje jeden scalony blok z kilkoma liniami', () => {
  const blocks = mergeEntries([
    { day: 'Poniedziałek', start: '9:45', end: '12:00', course: 'Wykład A', code: 'A',
      type: 'WYK', group: '1', groupKey: 'SJ-I', room: '301, bud. 009', teacher: 'Jan Kowalski' },
    { day: 'Poniedziałek', start: '9:45', end: '12:00', course: 'Wykład B', code: 'B',
      type: 'WYK', group: '2', groupKey: 'SJ-II', room: '301, bud. 009', teacher: 'Jan Kowalski' },
  ]);
  const html = buildHtml({
    kicker: 'Test',
    visible,
    sections: [{ title: 'Sala 301', days: [{ day: 'Poniedziałek', events: blocks }] }],
  }, '.screen-event{ border-color: red; }');

  assert.equal((html.match(/<article class="screen-event/g) || []).length, 1);
  assert.ok(html.includes('9:45–12:00'));
  assert.ok(html.includes('gr. 1, 2'));
  assert.ok(html.includes('S·I · S·II'));
  assert.ok(html.includes('Jan Kowalski'));
  assert.ok(html.includes('border-color: red'));
});

test('eksport grup rysuje równoległe zajęcia z separatorem |', () => {
  const event = (course, group, room, teacher) => ({
    day: 'Sobota', start: '9:45', end: '11:15', course, type: 'LAB',
    teachers: [teacher], locations: [{ room, groups: [group] }],
  });
  const html = buildHtml({
    view: 'groups',
    kicker: 'Wydział Psychologii UKW · semestr zimowy 2026/2027',
    visible: ['time', 'course', 'group', 'room', 'teacher', 'type'],
    sections: [{
      title: 'Grupa N-III', subtitle: 'III rok', week: '16.11–22.11.2026', yearGroupCount: 3,
      days: [{ day: 'Sobota', events: [
        [event('Psychometria', '1', '205, bud. 009', 'Żaneta Zaczek')],
        [event('Psychometria', '1', '205, bud. 009', 'Żaneta Zaczek'),
          event('Metody badań osobowości', '2', '301, bud. 009', 'Julia Banach')],
      ] }],
    }],
  }, 'body{color:#000}');

  assert.ok(html.includes('tydzień 16.11–22.11.2026'));
  assert.equal((html.match(/parallel-event/g) || []).length, 1);
  assert.ok(html.includes('class="assignment-separator">|</span>'));
  assert.ok(html.includes('gr. 1 — <b>205, bud. 009</b>'));
  assert.ok(html.includes('Julia Banach'));
});

test('zwykły (niescalony) wpis nadal działa', () => {
  const html = buildHtml({
    visible,
    sections: [{ title: 'Plan', days: [{ day: 'Wtorek', events: [
      { day: 'Wtorek', start: '8:00', end: '9:30', course: 'Test', type: 'LAB',
        group: '1', room: '102', teacher: 'Anna Nowak' },
    ] }] }],
  }, '');

  assert.ok(html.includes('class="course">Test'));
  assert.ok(html.includes('8:00–9:30'));
});
