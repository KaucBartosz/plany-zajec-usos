'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUpdater, canonicalJson } = require('../src/main/update-core');

function hash(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function signedManifest(files, overrides = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const unsigned = {
    schema: 1,
    version: '2026.11.24',
    publishedAt: '2026-11-24T10:00:00Z',
    minRuntime: { python: '3.10', node: '18' },
    base: 'https://example.invalid/v1/',
    files,
    ...overrides,
  };
  const sig = crypto.sign(null, Buffer.from(canonicalJson(unsigned), 'utf8'), privateKey)
    .toString('base64');
  return { text: JSON.stringify({ ...unsigned, sig }), publicKey, privateKey };
}

function fileEntry(relative, text, mode = 'managed') {
  return { path: relative, sha256: hash(text), bytes: Buffer.byteLength(text, 'utf8'), mode };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'planer-update-'));
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
    write: (relative, text) => {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text, 'utf8');
    },
    read: (relative) => fs.readFileSync(path.join(root, relative), 'utf8'),
  };
}

function updaterFor(root, publicKey, responses, calls = []) {
  return createUpdater({
    root,
    publicKey,
    manifestUrl: 'https://example.invalid/v1/API.json',
    fetchText: async (url) => {
      calls.push(url);
      if (!(url in responses)) throw new Error('HTTP 404');
      return responses[url];
    },
  });
}

const MANIFEST_URL = 'https://example.invalid/v1/API.json';

test('poprawny manifest pobiera pliki, tworzy .bak i zapisuje wersję', async () => {
  const f = fixture();
  try {
    f.write('scripts/a.py', 'stara wersja\n');
    const entry = fileEntry('scripts/a.py', 'nowa wersja\n');
    const signed = signedManifest([entry]);
    const updater = updaterFor(f.root, signed.publicKey, {
      [MANIFEST_URL]: signed.text,
      'https://example.invalid/v1/scripts/a.py': 'nowa wersja\n',
    });

    assert.deepEqual((await updater.check()).available, true);
    const result = await updater.apply();
    assert.equal(result.ok, true);
    assert.equal(result.count, 1);
    assert.equal(f.read('scripts/a.py'), 'nowa wersja\n');
    assert.equal(f.read('scripts/a.py.bak'), 'stara wersja\n');
    assert.equal(f.read('.update-version'), '2026.11.24');
  } finally {
    f.cleanup();
  }
});

test('zły podpis manifestu nic nie zmienia', async () => {
  const f = fixture();
  try {
    f.write('scripts/a.py', 'oryginał\n');
    const entry = fileEntry('scripts/a.py', 'nowa wersja\n');
    const signed = signedManifest([entry]);
    const broken = JSON.parse(signed.text);
    broken.sig = Buffer.from('podmieniony podpis').toString('base64');
    const updater = updaterFor(f.root, signed.publicKey, { [MANIFEST_URL]: JSON.stringify(broken) });

    const check = await updater.check();
    assert.equal(check.available, false);
    assert.equal(check.critical, true);
    await assert.rejects(() => updater.apply(), /podpis/);
    assert.equal(f.read('scripts/a.py'), 'oryginał\n');
  } finally {
    f.cleanup();
  }
});

test('zły hash jednego pliku nie zamienia żadnego', async () => {
  const f = fixture();
  try {
    f.write('scripts/a.py', 'A0\n');
    f.write('scripts/b.py', 'B0\n');
    const signed = signedManifest([
      fileEntry('scripts/a.py', 'A1\n'),
      fileEntry('scripts/b.py', 'B1\n'),
    ]);
    const updater = updaterFor(f.root, signed.publicKey, {
      [MANIFEST_URL]: signed.text,
      'https://example.invalid/v1/scripts/a.py': 'A1\n',
      'https://example.invalid/v1/scripts/b.py': 'ZLA TRESC\n',
    });

    const result = await updater.apply();
    assert.equal(result.ok, false);
    assert.match(result.error, /hash/);
    assert.equal(f.read('scripts/a.py'), 'A0\n');
    assert.equal(f.read('scripts/b.py'), 'B0\n');
    assert.equal(fs.existsSync(path.join(f.root, 'scripts/a.py.bak')), false);
  } finally {
    f.cleanup();
  }
});

test('ścieżka wychodząca poza projekt jest odrzucana', async () => {
  const f = fixture();
  try {
    f.write('plan.json', '{"dane":"uzytkownika"}');
    const signed = signedManifest([fileEntry('../plan.json', 'podmienione')]);
    const updater = updaterFor(f.root, signed.publicKey, { [MANIFEST_URL]: signed.text });

    await assert.rejects(() => updater.apply(), /Niebezpieczna/);
    assert.equal(f.read('plan.json'), '{"dane":"uzytkownika"}');
  } finally {
    f.cleanup();
  }
});

test('plik local nie jest pobierany ani nadpisywany', async () => {
  const f = fixture();
  try {
    f.write('scripts/a.py', 'A0\n');
    f.write('scripts/config.py', 'BUILDING = "001"\n');
    const signed = signedManifest([
      fileEntry('scripts/a.py', 'A1\n'),
      fileEntry('scripts/config.py', 'BUILDING = "009"\n', 'local'),
    ]);
    const calls = [];
    const updater = updaterFor(f.root, signed.publicKey, {
      [MANIFEST_URL]: signed.text,
      'https://example.invalid/v1/scripts/a.py': 'A1\n',
    }, calls);

    const result = await updater.apply();
    assert.equal(result.ok, true);
    assert.equal(f.read('scripts/a.py'), 'A1\n');
    assert.equal(f.read('scripts/config.py'), 'BUILDING = "001"\n');
    assert.equal(calls.some((url) => url.includes('config.py')), false);
  } finally {
    f.cleanup();
  }
});

test('klucz publiczny w formacie base64 jest akceptowany', async () => {
  const f = fixture();
  try {
    const signed = signedManifest([fileEntry('scripts/a.py', 'A1\n')]);
    const base64 = signed.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const updater = updaterFor(f.root, base64, { [MANIFEST_URL]: signed.text });

    const check = await updater.check();
    assert.equal(check.available, true);
    assert.equal(check.version, '2026.11.24');
  } finally {
    f.cleanup();
  }
});

test('brak sieci daje unavailable zamiast wyjątku', async () => {
  const f = fixture();
  try {
    const updater = updaterFor(f.root, 'klucz', {});
    const result = await updater.check();
    assert.equal(result.available, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.critical, false);
    assert.match(result.reason, /HTTP/);
  } finally {
    f.cleanup();
  }
});

test('rollback przywraca poprzednią wersję', async () => {
  const f = fixture();
  try {
    f.write('scripts/a.py', 'pierwsza\n');
    const first = signedManifest([fileEntry('scripts/a.py', 'pierwsza\n')]);
    const updater1 = updaterFor(f.root, first.publicKey, {
      [MANIFEST_URL]: first.text,
      'https://example.invalid/v1/scripts/a.py': 'pierwsza\n',
    });
    await updater1.apply();

    const second = signedManifest([fileEntry('scripts/a.py', 'druga\n')]);
    const updater2 = updaterFor(f.root, second.publicKey, {
      [MANIFEST_URL]: second.text,
      'https://example.invalid/v1/scripts/a.py': 'druga\n',
    });
    await updater2.apply();
    assert.equal(f.read('scripts/a.py'), 'druga\n');

    const result = updater2.rollback();
    assert.equal(result.ok, true);
    assert.equal(f.read('scripts/a.py'), 'pierwsza\n');
  } finally {
    f.cleanup();
  }
});
