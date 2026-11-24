'use strict';

/* Korzeń zaufania dla aktualizacji kodu. Zmienia się tylko przy zmianie
 * repozytorium albo klucza podpisującego — nie przy zwykłych wydaniach. */

module.exports = {
  // Manifest leży na stabilnej ścieżce — podpis i hashe chronią przed podmianą.
  manifestUrl: 'https://raw.githubusercontent.com/KaucBartosz/plany-zajec-usos/master/API.json',
  minRuntime: { python: '3.10', node: '18', electron: '37' },
  publicKey: 'MCowBQYDK2VwAyEA7IJFdjhInVXdUEODEDdJyBf+pP73bqNEyrTS/xJysu4=',
};
