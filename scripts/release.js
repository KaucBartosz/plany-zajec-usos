'use strict';

/* Przygotowuje wydanie: podbija wersję, odnawia podpisany API.json,
 * sprawdza testy i — z --apply — robi commit, push, tag i push tagu.
 * Bez --apply kończy się na lokalnych plikach i wypisuje komendy git. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseManifest } = require('../aplikacja/src/main/update-core');

const root = path.resolve(__dirname, '..');
const trustPath = path.join(root, 'aplikacja/src/main/update-trust.js');
const versionPath = path.join(root, 'aplikacja/src/main/app-version.json');
const manifestPath = path.join(root, 'API.json');
const apply = process.argv.includes('--apply');

function nextVersion(current) {
  const base = current.replace(/-\d+$/, '');
  const match = /-(\d+)$/.exec(current);
  return `${base}-${match ? Number(match[1]) + 1 : 1}`;
}

function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

function main() {
  const current = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;
  if (!current) throw new Error('Nie mogę odczytać wersji z app-version.json');
  const version = nextVersion(current);
  fs.writeFileSync(versionPath, JSON.stringify({ version }, null, 2) + '\n', 'utf8');

  console.log(run(process.execPath, ['scripts/make_manifest.js'], root).trim());

  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'),
    require(trustPath).publicKey);
  if (manifest.version !== version) throw new Error('Wersja w API.json nie zgadza się z app-version.json');
  console.log(`Podpis manifestu poprawny: ${manifest.version}, plików: ${manifest.files.length}`);

  const appDir = path.join(root, 'aplikacja');
  const tests = fs.readdirSync(path.join(appDir, 'test'))
    .filter((file) => file.endsWith('.test.js')).map((file) => path.join('test', file));
  console.log(run(process.execPath, ['--test', ...tests], appDir)
    .trim().split('\n').filter((line) => /^# (tests|pass|fail)/.test(line)).join('\n'));

  const python = path.join(root, 'runtime/python/python.exe');
  if (fs.existsSync(python)) {
    const output = run(python, ['-m', 'unittest', 'discover', '-s', 'tests'], root);
    console.log(output.trim().split('\n').slice(-2).join('\n'));
  }

  const git = [
    ['add', '-A'],
    ['commit', '-m', `Release ${version}`],
    ['push'],
    ['tag', `v${version}`],
    ['push', 'origin', `v${version}`],
  ];
  if (apply) {
    for (const args of git) {
      execFileSync('git', args, { cwd: root, stdio: 'inherit' });
    }
    console.log(`Wydanie ${version} opublikowane.`);
  } else {
    console.log('Komendy do publikacji (uruchom z --apply, aby wykonać):');
    for (const args of git) console.log('  git ' + args.join(' '));
  }
}

try {
  main();
} catch (error) {
  console.error('[BLAD] ' + error.message);
  process.exitCode = 1;
}
