'use strict';

/* Czysta reguła zapisu stanu faz. Przy braku zmian nie aktualizujemy
 * dataFetchedAt — inaczej UI pokazałby "wydruki nieaktualne" mimo że nic
 * się nie zmieniło. */

function phaseStatusPatch(phaseId, changes, now) {
  if (phaseId === 'data') {
    return changes.length ? { dataFetchedAt: now, changes } : { changes: [] };
  }
  if (phaseId === 'build') return { buildFinishedAt: now };
  return {};
}

module.exports = { phaseStatusPatch };
