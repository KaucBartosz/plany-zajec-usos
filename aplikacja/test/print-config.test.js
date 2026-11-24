'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require(path.resolve(__dirname, '../../scripts/print-config.js'));

function fixture(local) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-config-'));
  fs.writeFileSync(path.join(dir, 'config_default.py'),
    "BUILDING = '009'\nFACULTY = 'Wydzial'\nSEMESTER = 'zima'\nCARDW = 1400\n", 'utf8');
  if (local) fs.writeFileSync(path.join(dir, 'config.py'), local, 'utf8');
  return dir;
}

test('bez nadpisania obowiązują wartości domyślne', () => {
  const config = loadConfig(fixture(null));
  assert.equal(config.building, '009');
  assert.equal(config.faculty, 'Wydzial');
  assert.equal(config.cardWidth, 1400);
});

test('lokalne nadpisanie wygrywa z domyślnym', () => {
  const dir = fixture("BUILDING = '001'\nSEMESTER = 'lato'\n");
  const config = loadConfig(dir);
  assert.equal(config.building, '001');
  assert.equal(config.semester, 'lato');
  assert.equal(config.faculty, 'Wydzial');
});
