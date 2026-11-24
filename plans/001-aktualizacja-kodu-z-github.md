# Plan 001: Aplikacja aktualizuje swój kod z publicznego repozytorium GitHub

> **Instrukcje dla wykonawcy**: Wykonaj kroki po kolei. Po każdym kroku uruchom
> komendę weryfikacyjną i potwierdź oczekiwany wynik. Jeśli zajdzie któryś z
> warunków „STOP", zatrzymaj się i zgłoś — nie improwizuj. Po zakończeniu
> zaktualizuj wiersz tego planu w `plans/README.md`.
>
> **Sprawdzenie dryfu (wykonaj jako pierwsze)**: folder projektu **nie jest**
> repozytorium Git, więc nie ma SHA do porównania. Zamiast tego sprawdź, czy
> pliki z listy „Zakres" są w stanie opisanym poniżej:
> `Get-FileHash -Algorithm SHA256 aplikacja\src\main\main.js,aplikacja\src\shared\data.js,URUCHOM.cmd,scripts\config.py`
> Jeśli któryś z fragmentów w „Stanie obecny" nie zgadza się z kodem — STOP.

## Status

- **Priorytet**: P1
- **Nakład**: L
- **Ryzyko**: MED (zdalne wykonanie kodu — ryzyko dostaje się do aktualizatora)
- **Zależy od**: brak
- **Kategoria**: direction
- **Zaplanowano**: 2026-11-24, `commit N/A — katalog nie jest repozytorium Git`

## Dlaczego to ważne

`URUCHOM.cmd` zakłada, że na każdym urządzeniu jest pełna kopia folderu.
Ta kopia waży około 760 MB (`runtime\` 422 MB, `aplikacja\node_modules` 323 MB),
podczas gdy pliki, które realnie się zmieniają (`scripts\` i `aplikacja\src\`),
ważą około 0,3 MB. Bez mechanizmu aktualizacji każda poprawka wymaga
przekopiowania całego bundle'u na wszystkie urządzenia.

Cel: przy starcie aplikacji pobrać z jednego podpisanego manifestu listę plików
kodu, zweryfikować ich hashe, atomowo zamienić pliki lokalne i wymagać restartu.
Dane użytkownika (`plan.json`, `html\`, `out\`) i pliki konfiguracyjne
(`config.py`, `groups.py`) nie mogą być nadpisywane.

## Stan obecny

Pliki i ich rola:

- `URUCHOM.cmd` — launcher; sprawdza `plan.json`, potem uruchamia Electrona.
- `aplikacja/src/main/main.js` — proces główny Electrona; `FETCH_STEPS` to
  stała lista 9 skryptów (wiersze 29–39); `bundled()` i `childEnv()` (14–27)
  wybierają przenośne runtime'y.
- `aplikacja/src/main/preload.js` — jedyny most IPC do renderera (13 linii).
- `aplikacja/src/shared/data.js:43-44` — `DATA_ROOT = path.resolve(__dirname, '..', '..', '..')`;
  dane są czytane z katalogu nadrzędnego względem `main.js`.
- `scripts/config.py:1-28` — plik edytowalny przez użytkownika (`BUILDING`,
  `FACULTY`, `SEMESTER`, `ULTRA_ROOMS`, `BUDGET`).
- `scripts/groups.py:16-42` — kody grup, też edytowalne.
- `aplikacja/package.json` — `npm test` = `node --test test/*.test.js`.
- `aplikacja/test/views.test.js` i `aplikacja/test/export-template.test.js`
  — wzorzec testów: `node:test`, `node:assert/strict`, UMD-moduły z `src/shared`.

Fragmenty, które muszą się zgadzać:

```cmd
REM URUCHOM.cmd
if not exist plan.json (
  echo Pierwsze uruchomienie: pobieranie i generowanie planow...
  call "%PLANER_ROOT%\run-all.cmd" || goto :err
)
start "" "%PLANER_ROOT%\aplikacja\node_modules\electron\dist\electron.exe" "%PLANER_ROOT%\aplikacja"
```

```js
// aplikacja/src/main/main.js:29-39
const FETCH_STEPS = [
  { label: 'Plany semestralne i tydzień (USOS)', script: 'fetch.py', exe: 'python' },
  { label: 'Bieżący tydzień Pon–Pt', script: 'fetch_week_pon_pt.py', exe: 'python' },
  { label: 'Parsowanie danych', script: 'parse.py', exe: 'python' },
  { label: 'Plansze sal', script: 'build_rooms.py', exe: 'python' },
  { label: 'PNG sal', script: 'shot_rooms.js', exe: 'node' },
  { label: 'Kartki A4', script: 'build_sheets.py', exe: 'python' },
  { label: 'PNG kartek A4', script: 'sheets.js', exe: 'node' },
  { label: 'PDF do druku', script: 'to_pdf.py', exe: 'python' },
  { label: 'Kontrola jakości', script: 'verify.py', exe: 'python' },
];
```

Zasady niezmienne z `INSTRUKCJA.md:464-475` i `aplikacja/PLAN.md:167-172`:
UTF-8 wszędzie, nie wymyślać danych, nie duplikować planów, nie zmieniać
kolejności dni. `INSTRUKCJA.md:433-446` wyraźnie wskazuje `config.py`,
`groups.py` i `print.css` jako pliki do lokalnej edycji — aktualizator musi je
traktować jako `local`.

## Komendy, których będziesz używał

| Cel | Komenda | Wynik przy sukcesie |
|---|---|---|
| Testy aplikacji | `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js` | `pass N`, `fail 0` |
| Testy Pythona | `runtime\python\python.exe -m unittest discover -s tests -v` | `OK`, 0 błędów |
| Sprawdzenie manifestu | `runtime\node\node.exe aplikacja\src\main\update.js --check` | kod 0 (brak aktualizacji) lub 1 (jest aktualizacja) |
| Wymuszenie aktualizacji | `runtime\node\node.exe aplikacja\src\main\update.js --apply` | kod 0, komunikat o restarcie |
| Wycofanie | `runtime\node\node.exe aplikacja\src\main\update.js --rollback` | kod 0 |

Wszystkie komendy wykonuj z katalogu głównego projektu (`PlanyZajec-USOS`),
chyba że zapisano inaczej. Używaj runtime'u z `runtime\`, nie systemowego.

## Zakres

**W zakresie** (jedyna dozwolona zmiana plików):

- `API.json` (nowy, generowany)

### Kroki 2–7 (wykonawca)

- `aplikacja/src/main/update-trust.js` (nowy)
- `aplikacja/src/main/update-core.js` (nowy)
- `aplikacja/src/main/update.js` (nowy)
- `aplikacja/test/update-core.test.js` (nowy)
- `scripts/make_manifest.js` (nowy)
- `URUCHOM.cmd`
- `INSTRUKCJA.md`, `aplikacja/README.md`

**Poza zakresem** (nie dotykać, nawet jeśli wygląda na powiązane):

- `runtime\`, `node_modules\`, `aplikacja\node_modules\` — 745 MB binariów;
  aktualizacja kodu nie może ich zmieniać.
- `plan.json`, `html\`, `out\`, `html\week\` — dane użytkownika i wyniki.
- `scripts\config.py`, `scripts\groups.py`, `scripts\print.css` — edytowalne
  lokalnie; mają w manifeście `mode: "local"` i nigdy nie są nadpisywane.
- `aplikacja/src/main/main.js` i `preload.js` — aktualizator działa jako
  osobny proces przed startem Electrona, więc nie modyfikuje działającego
  procesu. W tej wersji nie dodajemy przycisku aktualizacji do UI.
- `fetch:start` / `FETCH_STEPS` — to odświeżanie danych z USOS, inny kanał.
- `git init`, komity, push — wykonawca nie wykonuje ich sam; krok 1 jest
  zleceniem dla operatora (szczegóły poniżej).

## Model zaufania (nie zmieniać bez przemyślenia)

- Klucz publiczny Ed25519 jest wpisany na stałe w `update-trust.js`.
  Klucz prywatny lives poza repozytorium, w
  `%USERPROFILE%\.planer-update\ed25519.key` — nigdy nie trafia do repozytorium,
  manifestu ani logów.
- `API.json` jest podpisany: pole `sig` to base64 podpisu Ed25519 nad
  kanoniczną reprezentacją reszty dokumentu (`JSON.stringify` obiektu bez
  pola `sig`, klucze w ustalonej kolejności). Weryfikacja używa wyłącznie
  wbudowanego `node:crypto`.
- Adres manifestu jest przypisany do **tagu wersji**, nigdy do gałęzi `main`:
  `https://raw.githubusercontent.com/<OWNER>/<REPO>/v2026.11.24/API.json`.
  Tag jest niezmienny.
- Hashe `sha256` poszczególnych plików w manifestcie chronią przed
  podmianą pliku na serwerze. Podpis chroni przed podmianą manifestu.
- Repozytorium jest publiczne — oznacza to, że kod jest jawny, ale bez
  klucza prywatnego nikt nie może wydać fałszywej aktualizacji.

Szkic `API.json` (jedyny plik „API", zgodnie z propozycją użytkownika):

```json
{
  "schema": 1,
  "version": "2026.11.24",
  "publishedAt": "2026-11-24T10:00:00Z",
  "minRuntime": { "python": "3.10", "node": "18", "electron": "37" },
  "base": "https://raw.githubusercontent.com/<OWNER>/<REPO>/v2026.11.24/",
  "files": [
    { "path": "scripts/parse.py", "sha256": "...", "bytes": 6560, "mode": "managed" },
    { "path": "aplikacja/src/shared/views.js", "sha256": "...", "bytes": 11220, "mode": "managed" },
    { "path": "scripts/config.py", "sha256": "...", "bytes": 1316, "mode": "local" }
  ],
  "sig": "<base64 Ed25519>"
}
```

`mode`: `managed` (można nadpisać), `local` (nigdy nie nadpisywać, nawet
jeśli hash się różni — użytkownik mógł edytować plik), `data` (nigdy nie
pobrać — używany tylko do jawnego wykluczenia).

## Kroki

### Krok 1 (operator, nie wykonawca): utwórz puste publiczne repozytorium

Masz pozwolenie na repozytorium publiczne, ale w tym środowisku nie ma `gh`
ani repozytorium Git — wykonawca nie instaluje narzędzi i nie robi `git init`.
Operator wykonuje (bez `--source`, bo kod powstanie w krokach 2–7):

```powershell
gh repo create plany-zajec-usos --public
```

**Weryfikacja**: `gh repo view plany-zajec-usos --json visibility,url` →
`{"url":"https://github.com/<OWNER>/plany-zajec-usos","visibility":"PUBLIC"}`.
Zapisz `<OWNER>` i użyty tag w `update-trust.js` (krok 4). Publikacja kodu
następuje w kroku 8. Jeśli `gh` nie jest zainstalowany albo nie jest
zalogowany — STOP, zgłoś operatorowi.

### Krok 2: dodaj czysty rdzeń aktualizatora

Utwórz `aplikacja/src/main/update-core.js` jako moduł bez zależności od
Electrona i bez bezpośredniego `https`. Eksportuj
`createUpdater({ root, fetchText, now, log })` z metodami:

- `check()` — pobiera i weryfikuje manifest, zwraca
  `{ available: boolean, version, changes, reason }`.
- `apply()` — pobiera wszystkie pliki `managed`, weryfikuje `sha256` i `bytes`,
  układa w katalogu tymczasowym `.update-new\`, po czym atomowo zamienia.
- `rollback()` — przywraca pliki z kopii `.bak`.

Wymagane zachowania:

- Walidacja schematu: `schema === 1`, `version` niepusty, `files` tablica,
  każdy wpis ma `path`, `sha256` (64 hex), `bytes` (liczba), `mode`.
- Weryfikacja podpisu manifestu przed jakimkolwiek pobieraniem plików.
- Ścieżka: `const target = path.resolve(root, rel)`; odrzuć wpis, jeśli
  `rel` jest bezwzględny, zawiera `..` albo `target` nie zaczyna się od
  `root + path.sep`.
- `mode: "local"` i `"data"` — pomijanie z logiem `pomijam (local)`.
- Zamiana pliku: `rename(target, target + '.bak')`, potem
  `rename(staged, target)`. Przy błędzie w dowolnym pliku przywróć wszystkie
  `.bak` i zwróć `{ ok: false, error }`.
- Po zamianie pozostaw `.bak` — to jedyny mechanizm wycofania (folder nie
  ma Git).
- UTF-8: `fetchText` zwraca string, zapis `fs.writeFileSync(target, text, 'utf8')`.

**Weryfikacja**: krok 3 (testy jednostkowe na fixture'ach).

### Krok 3: testy rdzenia bez sieci

Utwórz `aplikacja/test/update-core.test.js` w stylu
`aplikacja/test/views.test.js` (`node:test`, `node:assert/strict`). Wstrzykuj
`fetchText(url)` zwracający dane z pamięci — żadnych żądań sieciowych.

Przypadki do pokrycia:

1. poprawny manifest + poprawne hashe → `apply()` zwraca `ok: true`, plik
   na dysku ma nową treść, istnieje `.bak`;
2. zły podpis manifestu → `apply()` nic nie zmienia, `ok: false`;
3. zły `sha256` jednego pliku → żaden plik nie zostaje zamieniony (atomowość);
4. ścieżka `../../plan.json` → wpis odrzucony, `plan.json` niezmieniony;
5. `mode: "local"` → plik nietknięty mimo różnego hasha;
6. `fetchText` rzuca błąd (offline) → `check()` zwraca
   `{ available: false, reason: 'offline' }`, bez wyjątku;
7. `rollback()` przywraca poprzednią treść.

**Weryfikacja**: `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js`
→ wszystkie testy przechodzą, w tym 7 nowych.

### Krok 4: CLI i zaufanie

Utwórz `aplikacja/src/main/update-trust.js`:

```js
module.exports = {
  manifestUrl: 'https://raw.githubusercontent.com/<OWNER>/<REPO>/v2026.11.24/API.json',
  publicKey: '<PUBLIC_KEY_BASE64>',
};
```

Wygeneruj parę kluczy raz (operator, lokalnie, klucz prywatny poza repo):

```powershell
runtime\node\node.exe -e "const {generateKeyPairSync}=require('crypto');const {publicKey,privateKey}=generateKeyPairSync('ed25519');require('fs').mkdirSync(process.env.USERPROFILE+'\\.planer-update',{recursive:true});require('fs').writeFileSync(process.env.USERPROFILE+'\\.planer-update\\ed25519.key',privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});console.log(publicKey.export({type:'spki',format:'pem'}).replace(/-----(BEGIN|END)[^-]+-----|\s/g,''))"
```

Wklej wynik (klucz **publiczny**) do `publicKey`. Klucza prywatnego nie wklejaj
ani do planu, ani do repozytorium, ani do logu.

Utwórz `aplikacja/src/main/update.js` — cienką powłokę CLI:

- używa wbudowanego `https.get` do pobrania `manifestUrl`, z 10-sekundowym
  timeoutem i jednym ponowieniem;
- przekazuje `fetchText` do `createUpdater({ root, ... })`;
- flagi: `--check`, `--apply`, `--rollback`, `--auto`;
- kody wyjścia: `0` = OK/brak zmian, `1` = dostępna aktualizacja (tylko
  `--check`), `2` = błąd krytyczny;
- `--auto` przy braku internetu wychodzi kodem `0` z komunikatem
  `offline — pomijam aktualizację`;
- po `--apply` wypisuje `Zaktualizowano do wersji X. Uruchom aplikację ponownie.`

**Weryfikacja**:
`runtime\node\node.exe aplikacja\src\main\update.js --check` → kod 0 lub 1,
żadnego `MODULE_NOT_FOUND`, żadnego stack trace przy braku sieci.

### Krok 5: generator manifestu

Utwórz `scripts/make_manifest.js`:

- ma jawny `ALLOW` (pliki `managed`) i `LOCAL` (`config.py`, `groups.py`,
  `print.css`) — lista jest jedynym źródłem prawdy o tym, co aktualizujemy;
- czyta pliki UTF-8 z katalogu głównego, liczy `sha256` i `bytes`;
- pobiera klucz prywatny z `%USERPROFILE%\.planer-update\ed25519.key`,
  podpisuje kanoniczny JSON i zapisuje `API.json` z pola `sig`;
- wypisuje `API.json: N plików managed, M plików local`.

**Weryfikacja**:
`runtime\node\node.exe scripts\make_manifest.js` → `API.json` powstaje,
`runtime\node\node.exe -e "JSON.parse(require('fs').readFileSync('API.json','utf8'));console.log('ok')"`
→ `ok`.

Upewnij się, że `API.json` wymienione w manifeście pliki faktycznie są
w repozytorium z kroku 1 — manifest nie może wskazywać na pliki
z `out\`, `html\` ani `runtime\`.

### Krok 6: powiązanie z launcherem

W `URUCHOM.cmd`, między sprawdzeniem `plan.json` a `start "" ...electron.exe`,
dodaj:

```cmd
if not "%PLANER_NO_UPDATE%"=="1" (
  "%PLANER_ROOT%\runtime\node\node.exe" "%PLANER_ROOT%\aplikacja\src\main\update.js" --auto
)
```

Zachowaj dotychczasowy `chcp 65001`, `call runtime\_env.cmd` i obsługę `:err`.
Przy aktualizacji komunikat o restarcie musi być widoczny przed startem
Electrona.

**Weryfikacja**: uruchom `URUCHOM.cmd` przy braku sieci (np. odłącz internet)
→ aplikacja startuje normalnie, log zawiera `offline — pomijam aktualizację`,
kod wyjścia 0. Ustaw `PLANER_NO_UPDATE=1` → żaden komunikat aktualizatora.

### Krok 7: dokumentacja

- `INSTRUKCJA.md` — dodaj do §1 akapit: pierwsze uruchomienie wymaga pełnej
  kopii folderu, kolejne aktualizują tylko kod przez `API.json`; dodaj do §10
  wiersz o `scripts/make_manifest.js` i `PLANER_NO_UPDATE=1`.
- `aplikacja/README.md` — opisz `--check`, `--apply`, `--rollback`, restart
  oraz to, że `config.py`/`groups.py` pozostają lokalne.

**Weryfikacja**: `Select-String -Path INSTRUKCJA.md,aplikacja\README.md -Pattern 'API.json|PLANER_NO_UPDATE|--rollback'`
→ trafienia w obu plikach.

### Krok 8 (operator, nie wykonawca): opublikuj kod i tag wersji

Dopiero po krokach 2–7 i po przejściu wszystkich testów. Wykonawca nie robi
tego sam. Operator wykonuje z katalogu głównego projektu:

```powershell
runtime\node\node.exe scripts\make_manifest.js
git init
git add .gitignore API.json scripts/ aplikacja/src/ aplikacja/package.json aplikacja/README.md aplikacja/PLAN.md package.json INSTRUKCJA.md plans/
git commit -m "Add signed self-update manifest and updater"
git remote add origin https://github.com/<OWNER>/plany-zajec-usos.git
git push -u origin HEAD
git tag v2026.11.24
git push origin v2026.11.24
```

Tag musi być identyczny z tagiem w `update-trust.js` i w polu `base`
manifestu. Klucz prywatny (`%USERPROFILE%\.planer-update\ed25519.key`)
nie może zostać dodany — sprawdź `git status` przed commitem.

**Weryfikacja**:
`gh api repos/<OWNER>/plany-zajec-usos/contents/API.json?ref=v2026.11.24 --jq .name`
→ `API.json`, oraz
`runtime\node\node.exe aplikacja\src\main\update.js --check` → kod 0 lub 1.

## Plan testów

- Nowy plik: `aplikacja/test/update-core.test.js`, 7 przypadków z kroku 3.
- Wzorzec strukturalny: `aplikacja/test/views.test.js` i
  `aplikacja/test/export-template.test.js` — `node:test`, asercje
  `node:assert/strict`, moduły UMD/CommonJS, polskie nazwy testów.
- Testy nie mogą wykonywać żądań sieciowych — `fetchText` jest wstrzykiwany.
- Weryfikacja końcowa:
  `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js` → `fail 0`,
  łącznie co najmniej 29 testów (22 obecne + 7 nowych).

## Kryteria ukończenia

Wszystkie poniższe muszą być prawdziwe:

- [ ] Repozytorium publiczne istnieje, `API.json` jest w nim dostępne przez
      `raw.githubusercontent.com` pod tagiem z `update-trust.js` (krok 8).
- [ ] `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js` → `fail 0`,
      co najmniej 29 testów.
- [ ] `runtime\python\python.exe -m unittest discover -s tests -v` → `OK`.
- [ ] `API.json` nie zawiera ścieżek do `runtime\`, `node_modules\`, `out\`,
      `html\` ani `plan.json`.
- [ ] `scripts/config.py`, `scripts/groups.py`, `scripts/print.css` mają
      `mode: "local"` i nie są nadpisywane przez `--apply`.
- [ ] Po `--apply` istnieją pliki `.bak`, a `--rollback` przywraca treść.
- [ ] `URUCHOM.cmd` startuje aplikację przy braku sieci i z
      `PLANER_NO_UPDATE=1`.
- [ ] Żaden klucz prywatny ani token nie występuje w repozytorium, manifeście
      ani logach (tylko klucz publiczny w `update-trust.js`).
- [ ] Wiersz planu w `plans/README.md` zmieniony na `DONE`.

## Warunki STOP

Zatrzymaj się i zgłoś, jeśli:

- `API.json` z repozytorium nie przechodzi weryfikacji podpisu — nie
  wyłączaj weryfikacji „na czas testów".
- Manifest zawiera ścieżkę poza katalog projektu albo `mode: "data"` dla
  pliku, który aktualizator i tak chce pobrać.
- `gh` albo `git` nie jest dostępne w kroku 1 — to zadanie operatora.
- Któryś z fragmentów w „Stanie obecny" nie zgadza się z kodem (dryf).
- Wymagana byłaby zmiana `main.js`, `preload.js`, danych lub runtime'u —
  to poza zakresem tej wersji.

## Uwagi na przyszłość

- Dodanie przycisku aktualizacji w UI wymaga nowego kanału IPC w
  `preload.js` i `ipcMain.handle` w `main.js` — osobny plan, nie ten.
- Buforowanie ETag/`If-None-Match` i pobieranie listy zmian przez GitHub
  Release to optymalizacja, nie warunek działania: manifest waży kilka kB,
  a aktualizacja jest uruchamiana raz przy starcie.
- Aktualizacja `runtime\` lub `node_modules\` wymagałaby osobnego kanału
  (pełny bundle z Release) i jest świadomie odłożona.
- Jeśli kiedykolwiek zmieni się klucz podpisujący, trzeba wydać nowy
  `update-trust.js` — to jedyny przypadek, gdy ponowne skopiowanie jest
  nieuniknione.
