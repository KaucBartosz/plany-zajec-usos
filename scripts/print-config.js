'use strict';

/* Czyta domyślną konfigurację wydruku i lokalne nadpisanie (ostatnie
 * wystąpienie stałej wygrywa). Działa bez Electrona — łatwo to przetestować. */

const fs = require('fs');
const path = require('path');

function loadConfig(dir) {
  const text = ['config_default.py', 'config.py']
    .map((name) => path.join(dir, name))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  const lastMatch = (regex) => {
    const matches = [...text.matchAll(regex)];
    return matches.length ? matches[matches.length - 1] : null;
  };
  const value = (name) =>
    lastMatch(new RegExp(`^${name}\\s*=\\s*['"]([^'"]+)['"]`, 'gm'))?.[1] || '';
  return {
    building: value('BUILDING'),
    faculty: value('FACULTY'),
    semester: value('SEMESTER'),
    cardWidth: Number(lastMatch(/^CARDW\s*=\s*(\d+)/gm)?.[1] || 1400),
  };
}

module.exports = { loadConfig };
