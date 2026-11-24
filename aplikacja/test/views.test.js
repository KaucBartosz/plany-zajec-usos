'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const views = require('../src/shared/views');

function entry(overrides) {
  return {
    day: 'Poniedziałek', start: '9:45', end: '12:00', course: 'Test',
    type: 'WYK', group: '1', room: '102, bud. 009', teacher: 'Jan Kowalski',
    groupKey: 'SJ-I', groupLabel: 'I rok', year: 'I', studyType: 'stacjonarne',
    source: 'semester', ...overrides,
  };
}

test('karty grup grupują po groupKey i dni w kolejności kalendarza', () => {
  const groups = views.groupEntriesByGroup([
    entry({ groupKey: 'SJ-II', groupLabel: 'II rok', year: 'II', day: 'Poniedziałek' }),
    entry({ day: 'Sobota', course: 'Zajęcia weekendowe' }),
    entry({ day: 'Wtorek', course: 'Wtorkowe' }),
  ]);

  assert.deepEqual(groups.map((group) => group.key), ['SJ-I', 'SJ-II']);
  assert.equal(groups[0].label, 'I rok');
  assert.equal(groups[0].studyType, 'stacjonarne');
  assert.deepEqual(groups[0].days.map((day) => day.day), ['Wtorek', 'Sobota']);
  assert.equal(groups[0].days[0].rows[0][0].course, 'Wtorkowe');
});

test('plan grupy łączy salę i grupy w jednym wpisie oraz zbiera prowadzących', () => {
  const groups = views.groupEntriesByGroup([
    entry({ group: '1', room: '301, bud. 009', teacher: 'Jan Kowalski', course: 'Psychometria' }),
    entry({ group: '2', room: '301, bud. 009', teacher: 'Julia Banach', course: 'Psychometria' }),
    entry({ group: '3', room: '205, bud. 009', teacher: 'Jan Kowalski', course: 'Psychometria' }),
  ]);

  assert.equal(groups[0].yearGroupCount, 3);
  const event = groups[0].days[0].rows[0][0];
  assert.deepEqual(event.teachers, ['Jan Kowalski', 'Julia Banach']);
  assert.deepEqual(event.locations.map((loc) => [loc.room, loc.groups]), [
    ['301, bud. 009', ['1', '2']], ['205, bud. 009', ['3']],
  ]);
});

test('karta grupy przenosi częstotliwość, uwagi i info jako osobne pola', () => {
  const groups = views.groupEntriesByGroup([
    entry({
      event: 'każdy poniedziałek, 9:45 - 12:00',
      note: 'parz.',
      info: 'WYK, gr. 1 (301, bud. 009)',
    }),
  ]);
  const event = groups[0].days[0].rows[0][0];
  assert.equal(event.event, 'każdy poniedziałek, 9:45 - 12:00');
  assert.equal(event.note, 'parz.');
  assert.equal(event.info, 'WYK, gr. 1 (301, bud. 009)');
});

test('zajęcia nachodzące na siebie trafiają do jednego wiersza równoległego', () => {
  const groups = views.groupEntriesByGroup([
    entry({ start: '9:45', end: '11:15', group: '1', course: 'Psychometria' }),
    entry({ start: '9:45', end: '11:15', group: '2', course: 'Metody badań' }),
    entry({ start: '11:30', end: '13:00', group: '1', course: 'Później' }),
  ]);

  const rows = groups[0].days[0].rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 2);
  assert.deepEqual(rows[0].map((e) => e.course), ['Psychometria', 'Metody badań']);
  assert.equal(rows[1].length, 1);
});

test('ten sam przedmiot i pora z kilku specjalności dają w widoku jeden wpis z tagami', () => {
  const shared = {
    day: 'Sobota', start: '11:15', end: '12:45', course: 'Neuropsychologia',
    type: 'WYK', group: '1', room: '2', teacher: 'Anna Rasmus',
    year: 'IV', studyType: 'niestacjonarne', source: 'week',
  };
  const groups = views.groupEntriesByGroup([
    entry({ ...shared, groupKey: 'NJ-IV-kliniczna', groupLabel: 'IV rok - kliniczna' }),
    entry({ ...shared, groupKey: 'NJ-IV-wspomaganie', groupLabel: 'IV rok - wspomaganie' }),
    entry({ ...shared, groupKey: 'NJ-IV-zdrowia', groupLabel: 'IV rok - zdrowia' }),
    entry({ ...shared, groupKey: 'NJ-IV-spoleczna', groupLabel: 'IV rok - spoleczna' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'NJ-IV');
  assert.equal(groups[0].days[0].rows.length, 1);
  assert.equal(groups[0].days[0].rows[0].length, 1);
  const event = groups[0].days[0].rows[0][0];
  assert.equal(event.course, 'Neuropsychologia');
  assert.deepEqual(event.tags, ['N·IV-klin', 'N·IV-społ', 'N·IV-wsp', 'N·IV-zdr']);
});

test('eksport zachowuje osobny plan dla każdej specjalności', () => {
  const shared = {
    day: 'Sobota', start: '11:15', end: '12:45', course: 'Neuropsychologia',
    group: '1', room: '2', year: 'IV', studyType: 'niestacjonarne', source: 'week',
  };
  const plans = views.groupEntriesByPlan([
    entry({ ...shared, groupKey: 'NJ-IV-kliniczna', groupLabel: 'IV rok - kliniczna' }),
    entry({ ...shared, groupKey: 'NJ-IV-wspomaganie', groupLabel: 'IV rok - wspomaganie' }),
  ]);

  assert.deepEqual(plans.map((plan) => plan.key), ['NJ-IV-kliniczna', 'NJ-IV-wspomaganie']);
  assert.deepEqual(plans.map((plan) => plan.label), ['IV rok - kliniczna', 'IV rok - wspomaganie']);
  assert.deepEqual(plans[0].days[0].rows[0][0].tags, []);
});

test('formatWeekRange czyta zakres z tytułu planu tygodniowego', () => {
  assert.equal(views.formatWeekRange('Plan 2026-11-16 - 2026-11-22'), '16.11–22.11.2026');
  assert.equal(views.formatWeekRange(''), '');
});

test('plansza sali grupuje po sali, brak sali na końcu', () => {
  const rooms = views.groupEntriesByRoom([
    entry({ room: '' }),
    entry({ room: '301, bud. 009', day: 'Sobota' }),
    entry({ room: '102, bud. 009' }),
  ]);

  assert.deepEqual(rooms.map((room) => room.key), ['102, bud. 009', '301, bud. 009', '']);
  assert.equal(rooms[2].label, 'Brak sali (—)');
  assert.deepEqual(rooms[0].days.map((day) => day.day), ['Poniedziałek']);
});

test('puste wejście daje pustą listę widoków', () => {
  assert.deepEqual(views.groupEntriesByGroup([]), []);
  assert.deepEqual(views.groupEntriesByRoom([]), []);
});

test('mergeEntries łączy zajęcia w jednej porze i sumuje grupy', () => {
  const blocks = views.mergeEntries([
    entry({ group: '1', groupKey: 'SJ-I', course: 'Wykład A', code: 'A', teacher: 'Jan Kowalski' }),
    entry({ group: '2', groupKey: 'SJ-II', course: 'Wykład B', code: 'B', teacher: 'Jan Kowalski' }),
    entry({ group: '3', groupKey: 'NJ-I', course: 'Inny przedmiot', code: 'C', teacher: 'Anna Nowak' }),
    entry({ start: '12:00', end: '13:30', course: 'Później', code: 'D' }),
  ]);

  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].start, '9:45');
  assert.equal(blocks[0].lines.length, 2);
  assert.equal(blocks[0].lines[0].teacher, 'Jan Kowalski');
  assert.deepEqual(blocks[0].lines[0].groups, ['1', '2']);
  assert.deepEqual(blocks[0].lines[0].tags, ['S·I', 'S·II']);
  assert.deepEqual(blocks[0].lines[0].codes, ['A', 'B']);
  assert.deepEqual(blocks[0].groupKeys.sort(), ['NJ-I', 'SJ-I', 'SJ-II']);
  assert.equal(blocks[1].start, '12:00');
});

test('parz. i nieparz. w jednym bloku oznaczają co tydzień', () => {
  const blocks = views.mergeEntries([
    entry({ note: 'parz.', group: '1', groupKey: 'SJ-I' }),
    entry({ note: 'niep.', group: '2', groupKey: 'SJ-II' }),
  ]);

  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].lines[0].note, []);
  assert.deepEqual(blocks[0].lines[0].groups, ['1', '2']);
});

test('plansza sali zwraca już scalone bloki', () => {
  const rooms = views.groupEntriesByRoom([
    entry({ room: '301, bud. 009', group: '1', groupKey: 'SJ-I', teacher: 'Jan Kowalski' }),
    entry({ room: '301, bud. 009', group: '2', groupKey: 'SJ-II', teacher: 'Jan Kowalski' }),
  ]);

  assert.equal(rooms[0].days[0].entries.length, 1);
  assert.equal(rooms[0].days[0].entries[0].merged, true);
  assert.deepEqual(rooms[0].days[0].entries[0].lines[0].groups, ['1', '2']);
});

test('sala bez budynku łączy się z jednoznacznym wariantem z budynkiem', () => {
  const rooms = views.groupEntriesByRoom([
    entry({ room: '302', group: '1', groupKey: 'SJ-I' }),
    entry({ room: '302, bud. 009', group: '2', groupKey: 'SJ-II' }),
  ]);

  assert.deepEqual(rooms.map((room) => room.key), ['302, bud. 009']);
  assert.equal(rooms[0].days[0].entries.length, 1);
  assert.equal(rooms[0].days[0].entries[0].room, '302, bud. 009');
});
