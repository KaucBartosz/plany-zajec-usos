'use strict';

/* CLI aktualizatora. Uruchamiany z URUCHOM.cmd przed startem Electrona,
 * więc żaden plik aplikacji nie jest w tym momencie załadowany do pamięci. */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { createUpdater } = require('./update-core');
const trust = require('./update-trust');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function once(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'planer-zajec-usos-updater' },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        once(new URL(response.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        const error = new Error('HTTP ' + response.statusCode);
        error.code = 'HTTP';
        reject(error);
        return;
      }
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => resolve(text));
    });
    request.setTimeout(10000, () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

async function fetchText(url) {
  try {
    return await once(url);
  } catch (error) {
    return once(url);
  }
}

async function main() {
  const flag = process.argv[2] || '--auto';
  if (!['--check', '--apply', '--auto', '--rollback'].includes(flag)) {
    console.error('[BLAD] Użycie: update.js --check|--apply|--auto|--rollback');
    process.exit(2);
  }

  const updater = createUpdater({
    root: ROOT,
    fetchText,
    publicKey: trust.publicKey,
    manifestUrl: trust.manifestUrl,
    localVersion: trust.version,
    log: (message) => console.log(message),
  });

  if (flag === '--rollback') {
    const result = updater.rollback();
    console.log(result.ok
      ? `Przywrócono ${result.count} plików z kopii .bak. Uruchom aplikację ponownie.`
      : `[BLAD] ${result.error}`);
    process.exit(result.ok ? 0 : 2);
  }

  const check = await updater.check();
  if (flag === '--check') {
    if (check.critical) {
      console.error(`[BLAD] ${check.reason}`);
      process.exit(2);
    }
    if (!check.available) {
      console.log(check.unavailable
        ? `offline — pomijam aktualizację (${check.reason})`
        : 'Brak aktualizacji.');
      process.exit(0);
    }
    console.log(`Dostępna wersja ${check.version} (aktualna: ${check.installed || 'brak'}).`);
    process.exit(1);
  }

  if (!check.available) {
    console.log(check.unavailable
      ? `offline — pomijam aktualizację (${check.reason})`
      : 'Brak aktualizacji.');
    process.exit(0);
  }
  if (check.critical) {
    console.error(`[BLAD] ${check.reason}`);
    process.exit(2);
  }

  const result = await updater.apply();
  if (!result.ok) {
    console.error(`[BLAD] Aktualizacja nieudana: ${result.error}. Poprzednie pliki przywrócone.`);
    process.exit(flag === '--auto' ? 0 : 2);
  }
  console.log(`Zaktualizowano do wersji ${result.version} (${result.count} plików). Uruchom aplikację ponownie.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`[BLAD] ${error.message}`);
  process.exit(2);
});
