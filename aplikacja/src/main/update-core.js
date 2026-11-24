'use strict';

/* Czysty rdzeń aktualizatora: zero Electrona, zero https. Wszystkie wejścia
 * (manifest, pliki, czas, log) są wstrzykiwane — dzięki temu testy działają
 * bez sieci i bez dotykania katalogu projektu. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODES = new Set(['managed', 'local', 'data']);

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const parts = Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonicalJson(value[key]));
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

function asPublicKey(key) {
  if (typeof key !== 'string' || key.includes('-----BEGIN')) return key;
  const body = key.replace(/\s/g, '').replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
  return '-----BEGIN PUBLIC KEY-----\n' + body + '\n-----END PUBLIC KEY-----\n';
}

function validate(manifest) {
  if (manifest.schema !== 1) throw new Error('Nieobsługiwany schemat manifestu');
  if (typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error('Brak wersji w manifeście');
  }
  if (typeof manifest.base !== 'string' || !/^https:\/\//.test(manifest.base)) {
    throw new Error('Nieprawidłowy adres bazowy manifestu');
  }
  if (!Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('Manifest nie zawiera plików');
  }
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || !file.path || path.isAbsolute(file.path) ||
        file.path.includes('\\') || file.path.split('/').includes('..')) {
      throw new Error('Niebezpieczna ścieżka w manifeście: ' + file.path);
    }
    if (typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      throw new Error('Nieprawidłowy hash pliku: ' + file.path);
    }
    if (!Number.isInteger(file.bytes) || file.bytes < 0) {
      throw new Error('Nieprawidłowy rozmiar pliku: ' + file.path);
    }
    if (!MODES.has(file.mode)) throw new Error('Nieznany tryb pliku: ' + file.path);
  }
}

function parseManifest(text, publicKey) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('Nieprawidłowy JSON manifestu: ' + error.message);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Manifest nie jest obiektem');
  }
  const { sig, ...unsigned } = data;
  if (typeof sig !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(sig)) {
    throw new Error('Brak podpisu manifestu');
  }
  let valid = false;
  try {
    valid = crypto.verify(null, Buffer.from(canonicalJson(unsigned), 'utf8'),
      asPublicKey(publicKey), Buffer.from(sig, 'base64'));
  } catch {
    valid = false;
  }
  if (!valid) throw new Error('Nieprawidłowy podpis manifestu');
  validate(unsigned);
  return unsigned;
}

function targetPath(root, relative) {
  if (path.isAbsolute(relative) || relative.includes('\\') ||
      relative.split('/').includes('..')) {
    throw new Error('Niebezpieczna ścieżka: ' + relative);
  }
  const target = path.resolve(root, relative);
  const prefix = path.resolve(root) + path.sep;
  if (!target.startsWith(prefix)) throw new Error('Poza katalog projektu: ' + relative);
  return target;
}

function createUpdater(options) {
  const { root, fetchText, publicKey, manifestUrl, log = () => {} } = options;
  const versionFile = path.join(root, '.update-version');
  const appliedFile = path.join(root, '.update-applied.json');
  const stagedDir = path.join(root, '.update-new');

  function installedVersion() {
    try {
      return fs.readFileSync(versionFile, 'utf8').trim() || null;
    } catch {
      return null;
    }
  }

  async function loadVerified() {
    const text = await fetchText(manifestUrl);
    return parseManifest(text, publicKey);
  }

  async function check() {
    try {
      const manifest = await loadVerified();
      const installed = installedVersion();
      return {
        available: installed !== manifest.version,
        version: manifest.version,
        installed,
        changes: manifest.changelog || [],
      };
    } catch (error) {
      const network = /HTTP|timeout|ENOTFOUND|ECONNRESET|EAI_AGAIN|offline/i.test(error.message);
      return {
        available: false,
        version: null,
        unavailable: network,
        critical: !network,
        reason: error.message,
      };
    }
  }

  async function apply() {
    const manifest = await loadVerified();
    const staged = [];
    const swapped = [];
    fs.rmSync(stagedDir, { recursive: true, force: true });
    fs.mkdirSync(stagedDir, { recursive: true });

    try {
      for (const file of manifest.files.filter((item) => item.mode === 'managed')) {
        const target = targetPath(root, file.path);
        if (!fs.existsSync(target)) throw new Error('Brak pliku lokalnego: ' + file.path);
        const url = new URL(file.path, manifest.base).toString();
        const text = await fetchText(url);
        const buffer = Buffer.from(text, 'utf8');
        if (crypto.createHash('sha256').update(buffer).digest('hex') !== file.sha256) {
          throw new Error('Nieprawidłowy hash: ' + file.path);
        }
        if (buffer.length !== file.bytes) {
          throw new Error('Nieprawidłowy rozmiar: ' + file.path);
        }
        const destination = path.join(stagedDir, file.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, text, 'utf8');
        staged.push({ target, destination });
      }
      for (const file of manifest.files.filter((item) => item.mode !== 'managed')) {
        log('pomijam (' + file.mode + '): ' + file.path);
      }

      for (const { target, destination } of staged) {
        const backup = target + '.bak';
        fs.rmSync(backup, { force: true });
        fs.renameSync(target, backup);
        swapped.push(target);
        fs.renameSync(destination, target);
      }

      const previous = installedVersion();
      if (previous) fs.writeFileSync(versionFile + '.bak', previous, 'utf8');
      fs.writeFileSync(appliedFile, JSON.stringify(manifest, null, 1), 'utf8');
      fs.writeFileSync(versionFile, manifest.version, 'utf8');
      fs.rmSync(stagedDir, { recursive: true, force: true });
      return { ok: true, version: manifest.version, count: staged.length };
    } catch (error) {
      for (const target of swapped.reverse()) {
        const backup = target + '.bak';
        if (fs.existsSync(backup)) {
          fs.rmSync(target, { force: true });
          fs.renameSync(backup, target);
        }
      }
      fs.rmSync(stagedDir, { recursive: true, force: true });
      return { ok: false, error: error.message };
    }
  }

  function rollback() {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(appliedFile, 'utf8'));
    } catch {
      return { ok: false, error: 'Brak zapisanego manifestu — nie ma co wycofać' };
    }
    const restored = [];
    try {
      for (const file of manifest.files.filter((item) => item.mode === 'managed')) {
        const target = targetPath(root, file.path);
        const backup = target + '.bak';
        if (!fs.existsSync(backup)) continue;
        fs.rmSync(target, { force: true });
        fs.renameSync(backup, target);
        restored.push(file.path);
      }
      const versionBackup = versionFile + '.bak';
      if (fs.existsSync(versionBackup)) fs.renameSync(versionBackup, versionFile);
      else fs.rmSync(versionFile, { force: true });
      return { ok: true, count: restored.length };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  return { check, apply, rollback };
}

module.exports = { createUpdater, canonicalJson, parseManifest, targetPath };
