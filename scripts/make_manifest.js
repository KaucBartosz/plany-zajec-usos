'use strict';

/* Generuje podpisany API.json z listy plików kodu. Lista jest jedynym
 * źródłem prawdy o tym, co aktualizator może nadpisać. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { canonicalJson } = require('../aplikacja/src/main/update-core');
const trust = require('../aplikacja/src/main/update-trust');

const ROOT = path.resolve(__dirname, '..');

const MANAGED = [
  'INSTRUKCJA.md',
  'check-changes.cmd',
  'drukuj-grupy-weekend.cmd',
  'drukuj-sale-pon-pt.cmd',
  'package.json',
  'requirements.txt',
  'run-all.cmd',
  'sprawdz-kolizje.cmd',
  'test.cmd',
  'plans/README.md',
  'plans/001-aktualizacja-kodu-z-github.md',
  'uruchamianie/1-sprawdz-wymagania.cmd',
  'uruchamianie/2-skanuj-i-generuj.cmd',
  'scripts/build_rooms.py',
  'scripts/build_sheets.py',
  'scripts/check_conflicts.py',
  'scripts/fetch.py',
  'scripts/fetch_week_pon_pt.py',
  'scripts/make_manifest.js',
  'scripts/make_runall.js',
  'scripts/pipeline.json',
  'scripts/parse.py',
  'scripts/print-additional.js',
  'scripts/sheets.js',
  'scripts/shot_rooms.js',
  'scripts/to_pdf.py',
  'scripts/verify.py',
  'aplikacja/README.md',
  'aplikacja/PLAN.md',
  'aplikacja/package.json',
  'aplikacja/src/main/export-template.js',
  'aplikacja/src/main/export.js',
  'aplikacja/src/main/main.js',
  'aplikacja/src/main/preload.js',
  'aplikacja/src/main/update-core.js',
  'aplikacja/src/main/update.js',
  'aplikacja/src/renderer/app.js',
  'aplikacja/src/renderer/index.html',
  'aplikacja/src/renderer/styles.css',
  'aplikacja/src/shared/data.js',
  'aplikacja/src/shared/filters.js',
  'aplikacja/src/shared/views.js',
  'aplikacja/test/export-template.test.js',
  'aplikacja/test/filters.test.js',
  'aplikacja/test/pipeline.test.js',
  'aplikacja/test/update-core.test.js',
  'aplikacja/test/views.test.js',
  'tests/fixtures/plan-sample.html',
  'tests/test_conflicts.py',
  'tests/test_fetch_changed.py',
  'tests/test_parse.py',
];

// Pliki lokalne: użytkownik może je edytować — aktualizator je pomija.
const LOCAL = [
  'URUCHOM.cmd',
  'scripts/config.py',
  'scripts/groups.py',
  'scripts/print.css',
  'aplikacja/src/main/update-trust.js',
];

function describe(relative, mode) {
  const full = path.join(ROOT, relative);
  if (!fs.existsSync(full)) throw new Error('Brak pliku: ' + relative);
  const text = fs.readFileSync(full, 'utf8');
  return {
    path: relative,
    sha256: crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex'),
    bytes: Buffer.byteLength(text, 'utf8'),
    mode,
  };
}

function main() {
  const files = [
    ...MANAGED.map((item) => describe(item, 'managed')),
    ...LOCAL.map((item) => describe(item, 'local')),
  ].sort((a, b) => a.path.localeCompare(b.path));

  const keyFile = process.env.PLANER_UPDATE_KEY ||
    path.join(os.homedir(), '.planer-update', 'ed25519.key');
  if (!fs.existsSync(keyFile)) {
    throw new Error('Brak klucza prywatnego: ' + keyFile);
  }
  const privateKey = crypto.createPrivateKey(fs.readFileSync(keyFile, 'utf8'));

  const unsigned = {
    schema: 1,
    version: trust.version,
    publishedAt: new Date().toISOString(),
    minRuntime: trust.minRuntime,
    base: trust.fileBaseUrl,
    files,
  };
  const sig = crypto.sign(null, Buffer.from(canonicalJson(unsigned), 'utf8'), privateKey)
    .toString('base64');
  fs.writeFileSync(path.join(ROOT, 'API.json'),
    JSON.stringify({ ...unsigned, sig }, null, 2) + '\n', 'utf8');
  console.log(`API.json: ${MANAGED.length} plików managed, ${LOCAL.length} plików local.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[BLAD] ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { MANAGED, LOCAL };
