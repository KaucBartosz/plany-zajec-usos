'use strict';

/* Domyślny arkusz (aktualizowany) + lokalne nadpisanie (nigdy nie nadpisywane). */
const fs = require('fs');
const path = require('path');

function loadPrintCss(root) {
  return ['print_default.css', 'print.css']
    .map((name) => path.join(root, 'scripts', name))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

module.exports = { loadPrintCss };
