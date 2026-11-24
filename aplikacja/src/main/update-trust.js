'use strict';

/* Korzeń zaufania dla aktualizacji kodu. Zmienia się tylko przy zmianie
 * repozytorium albo klucza podpisującego — nie przy zwykłych wydaniach. */

module.exports = {
  version: '2026.11.24-3',
  // Manifest leży na stabilnej ścieżce — podpis i hashe chronią przed podmianą.
  manifestUrl: 'https://raw.githubusercontent.com/KaucBartosz/plany-zajec-usos/master/API.json',
  // Pliki są pobierane z niezmiennego tagu wydania.
  fileBaseUrl: 'https://raw.githubusercontent.com/KaucBartosz/plany-zajec-usos/v2026.11.24-3/',
  minRuntime: { python: '3.10', node: '18', electron: '37' },
  publicKey: 'MCowBQYDK2VwAyEA7IJFdjhInVXdUEODEDdJyBf+pP73bqNEyrTS/xJysu4=',
};
