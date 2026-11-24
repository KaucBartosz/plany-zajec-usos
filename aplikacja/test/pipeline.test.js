'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const pipeline = JSON.parse(fs.readFileSync(path.join(root, 'scripts/pipeline.json'), 'utf8'));
const { MANAGED, LOCAL } = require(path.join(root, 'scripts/make_manifest.js'));
const steps = pipeline.phases.flatMap((phase) => phase.steps);

test('przebieg ma dwie fazy: dane i wydruki', () => {
  assert.deepEqual(pipeline.phases.map((phase) => phase.id), ['data', 'build']);
  assert.deepEqual(pipeline.phases.map((phase) => phase.label),
    ['Pobieranie danych', 'Wydruki']);
});

test('faza danych pobiera i parsuje, faza wydruków buduje PDF', () => {
  assert.equal(pipeline.phases[0].steps.length, 3);
  assert.equal(pipeline.phases[1].steps.length, 7);
  const weekend = pipeline.phases[1].steps.find((step) => step.script === 'print-additional.js');
  assert.deepEqual(weekend.args, ['groups']);
});

test('każdy skrypt z przebiegu jest w manifeście aktualizacji', () => {
  for (const step of steps) {
    assert.ok(MANAGED.includes('scripts/' + step.script),
      'brak w MANAGED: scripts/' + step.script);
    assert.ok(!LOCAL.includes('scripts/' + step.script),
      'krok przebiegu nie może być plikiem local: ' + step.script);
  }
});

test('każdy krok ma opis, egzekutor i istniejący plik', () => {
  for (const step of steps) {
    assert.ok(step.label, 'brak etykiety kroku');
    assert.ok(['python', 'node'].includes(step.exe), 'zły exe: ' + step.exe);
    assert.ok(fs.existsSync(path.join(root, 'scripts', step.script)),
      'brak pliku: ' + step.script);
  }
});
