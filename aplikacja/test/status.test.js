'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { phaseStatusPatch } = require('../src/shared/status');

test('faza danych ze zmianami aktualizuje znacznik pobrania', () => {
  const patch = phaseStatusPatch('data', ['NJ-II'], '2026-11-24T12:00:00Z');
  assert.deepEqual(patch, {
    dataFetchedAt: '2026-11-24T12:00:00Z', changes: ['NJ-II'],
  });
});

test('faza danych bez zmian nie psuje znacznika pobrania', () => {
  assert.deepEqual(phaseStatusPatch('data', [], '2026-11-24T12:00:00Z'), { changes: [] });
});

test('faza wydruków aktualizuje tylko swój znacznik', () => {
  assert.deepEqual(phaseStatusPatch('build', [], '2026-11-24T13:00:00Z'), {
    buildFinishedAt: '2026-11-24T13:00:00Z',
  });
});
