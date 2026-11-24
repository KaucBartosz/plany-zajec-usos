# Plan 002: Osobne fazy pobierania danych i budowy wydruków

> **Instrukcje dla wykonawcy**: Wykonaj kroki po kolei. Po każdym kroku uruchom
> komendę weryfikacyjną i potwierdź oczekiwany wynik. Jeśli zajdzie któryś z
> warunków „STOP", zatrzymaj się i zgłoś — nie improwizuj. Po zakończeniu
> zaktualizuj wiersz tego planu w `plans/README.md`.
>
> **Sprawdzenie dryfu (wykonaj jako pierwsze)**: repozytorium Git jest dostępne.
> `git diff --stat HEAD -- aplikacja/src/main/main.js aplikacja/src/renderer/app.js aplikacja/src/main/preload.js scripts/fetch.py scripts/fetch_week_pon_pt.py run-all.cmd scripts/make_manifest.js`
> Jeśli któryś z fragmentów w „Stanie obecny" nie zgadza się z kodem — STOP.

## Status

- **Priorytet**: P1
- **Nakład**: L
- **Ryzyko**: MED (zmiana zachowania całego przebiegu i formatu manifestu)
- **Zależy od**: `plans/001-aktualizacja-kodu-z-github.md` (gotowy kanał aktualizacji kodu)
- **Kategoria**: direction
- **Zaplanowano**: 2026-11-24, commit `56f9880`

## Dlaczego to ważne

Jedno kliknięcie „Rozpocznij pobieranie" uruchamia dziś wszystkie 9 kroków,
łącznie z renderowaniem PNG przez Playwright i składaniem PDF. Plany tygodniowe
zmieniają się co tydzień, więc użytkownik płaci za pełną przebudowę wydruków
za każdym razem, gdy chce zobaczyć świeże dane. Istniejący `fetch.py --check`
odpowiada tylko na pytanie „czy się zmieniło" i nie jest dostępny z aplikacji.

Cel: rozdzielić to na dwie fazy. Faza danych pobiera i zapisuje **tylko zmienione**
plany, odświeża `plan.json` i zapisuje raport. Faza wydruków startuje automatycznie
po udanej fazie danych, ale ma własny postęp, własny log i przycisk ponowienia.
Gdy nie ma nowych danych, obie fazy są pomijane.

Decyzje użytkownika (już podjęte, nie zmieniać bez pytania):

1. Wydruki budują się **automatycznie po pobraniu**, ale jako osobna faza z własnym
   postępem i przyciskiem „Ponów wydruki".
2. **Nie** rozdzielamy PNG i PDF na osobne fazy — `to_pdf.py` tylko składa gotowe
   PNG, a `print-additional.js` robi PNG+PDF razem.
3. Przy braku zmian **pomijamy** `parse.py` i całą fazę wydruków.

## Stan obecny

- `aplikacja/src/main/main.js:29-39` — stała `FETCH_STEPS` z 9 wpisami:
  `fetch.py`, `fetch_week_pon_pt.py`, `parse.py`, `build_rooms.py`,
  `shot_rooms.js`, `build_sheets.py`, `sheets.js`, `to_pdf.py`, `verify.py`.
- `aplikacja/src/main/main.js:54-98` — `runFetchStep()`: spawn jednego kroku,
  parsowanie postępu z `[i/n]`, `fetch:done` przy błędzie, przejście do kolejnego
  kroku przy kodzie 0.
- `aplikacja/src/main/main.js:131-143` — `ipcMain.handle('fetch:start')` i
  `fetch:cancel`; jeden `fetchProcess` i flaga `fetchCancelled`.
- `aplikacja/src/main/preload.js:5-13` — `startFetch`, `cancelFetch`,
  `onFetchProgress`, `onFetchDone`.
- `aplikacja/src/renderer/app.js:522-580` — `startFetch()`, `onFetchProgress`,
  `onFetchDone()`; jeden przycisk `#start-fetch`, jeden pasek, jedno okno logu.
- `scripts/fetch.py:116-122` — flagi `--only` i `--check`.
- `scripts/fetch.py:150-172` — liczenie hasha i **zapis każdego pliku HTML**
  niezależnie od tego, czy się zmienił.
- `scripts/fetch.py:244-273` — `--check` zapisuje `html/week/changes.json`
  i zwraca 1 przy zmianach/błędach.
- `scripts/fetch_week_pon_pt.py:56-77` — brak trybu `--check`, zawsze zapisuje
  wszystkie pliki i `plan-pon-pt.json`, parsuje wiersze w locie.
- `scripts/parse.py:136-175` — przebudowuje cały `plan.json` i `html/week/plan.json`.
- `run-all.cmd` — osobna, ręcznie utrzymywana lista kroków.
- `scripts/make_manifest.js` — trzecia lista plików (`MANAGED`, `LOCAL`).

Zasady z `INSTRUKCJA.md:464-475` i `aplikacja/PLAN.md:167-172`: nie wymyślać
danych, UTF-8, nie zmieniać kolejności dni, dane i wydruki to osobne kanały.

## Komendy, których będziesz używał

| Cel | Komenda | Wynik przy sukcesie |
|---|---|---|
| Testy aplikacji | `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js` | `pass N`, `fail 0` |
| Testy Pythona | `runtime\python\python.exe -m unittest discover -s tests -v` | `OK` |
| Sprawdzenie danych | `runtime\python\python.exe scripts\fetch.py --check` | kod 0 lub 1 |
| Pobranie zmian | `runtime\python\python.exe scripts\fetch.py --only-changed` | kod 0, raport zmian |
| Pełny przebieg | `run-all.cmd` | kod 0 |

## Zakres

**W zakresie**:

- `scripts/pipeline.json` (nowy)
- `scripts/make_runall.js` (nowy)
- `scripts/fetch.py`, `scripts/fetch_week_pon_pt.py`
- `scripts/make_manifest.js`
- `aplikacja/src/main/main.js`, `aplikacja/src/main/preload.js`
- `aplikacja/src/renderer/app.js`, `aplikacja/src/renderer/index.html`
- `aplikacja/shared/data.js` (dodanie stanu do `meta`)
- `aplikacja/test/pipeline.test.js` (nowy)
- `tests/test_fetch_changed.py` (nowy)
- `run-all.cmd` (generowany)
- `INSTRUKCJA.md`, `aplikacja/PLAN.md`, `aplikacja/README.md`, `plans/README.md`

**Poza zakresem**:

- `scripts/parse.py`, `scripts/build_rooms.py`, `scripts/build_sheets.py`,
  `scripts/shot_rooms.js`, `scripts/sheets.js`, `scripts/to_pdf.py`,
  `scripts/print-additional.js`, `scripts/verify.py` — logika tych skryptów
  pozostaje bez zmian; zmienia się tylko to, kto i kiedy je woła.
- `runtime\`, `node_modules\`, `plan.json`, `html\`, `out\` — dane i binaria.
- `API.json` — wygeneruj na końcu przez `scripts/make_manifest.js`.

## Kroki

### Krok 1: jedna definicja przebiegu

Utwórz `scripts/pipeline.json`:

```json
{
  "phases": [
    {
      "id": "data",
      "label": "Pobieranie danych",
      "steps": [
        { "label": "Plany semestralne i tydzień (USOS)", "script": "fetch.py", "exe": "python", "args": ["--only-changed"] },
        { "label": "Bieżący tydzień Pon–Pt", "script": "fetch_week_pon_pt.py", "exe": "python", "args": ["--only-changed"] },
        { "label": "Parsowanie danych", "script": "parse.py", "exe": "python", "args": [] }
      ]
    },
    {
      "id": "build",
      "label": "Wydruki",
      "steps": [
        { "label": "Plansze sal", "script": "build_rooms.py", "exe": "python", "args": [] },
        { "label": "PNG sal", "script": "shot_rooms.js", "exe": "node", "args": [] },
        { "label": "Kartki A4", "script": "build_sheets.py", "exe": "python", "args": [] },
        { "label": "PNG kartek A4", "script": "sheets.js", "exe": "node", "args": [] },
        { "label": "PDF do druku", "script": "to_pdf.py", "exe": "python", "args": [] },
        { "label": "Wydruk grup weekendowych", "script": "print-additional.js", "exe": "node", "args": ["groups"] },
        { "label": "Kontrola jakości", "script": "verify.py", "exe": "python", "args": [] }
      ]
    }
  ]
}
```

Utwórz `scripts/make_runall.js`, który z tego pliku generuje `run-all.cmd`
(z zachowaniem `chcp 65001`, `runtime\_env.cmd`, obsługi `:err` i otwarcia
folderu z PDF). Usuń ręcznie utrzymywaną listę kroków z `run-all.cmd`.

**Weryfikacja**:
`runtime\node\node.exe scripts\make_runall.js` → `run-all.cmd` powstaje;
`Select-String -Path run-all.cmd -Pattern 'python |node ' | Measure-Object` →
9 trafień.

### Krok 2: ``--only-changed`` w `fetch.py`

Dodaj flagę `--only-changed`. Zachowanie:

- pobiera i waliduje każdą stronę tak jak dziś (hash nadal liczony z `normalize(html)`),
- gdy hash się **nie** zmienił — nie zapisuje pliku HTML, aktualizuje tylko
  `fetched` w manifestcie, wypisuje `[ bez zmian ]`;
- gdy hash się zmienił — zapisuje plik, aktualizuje manifest, zalicza do `changed`;
- pliki tygodniowe traktuje tak samo; przy braku punktu odniesienia zapisuje
  baseline identycznie jak dziś w `--check`;
- zawsze zapisuje `html/week/changes.json` w formacie zgodnym z obecnym
  (`checked`, `changed`, `baseline_initialized`, `failed`), żeby
  `check-changes.cmd` i testy nie utraciły kontraktu;
- zwraca 1 przy błędzie, 0 przy sukcesie (nawet gdy nic się nie zmieniło —
  informację o braku zmian niesie raport, nie kod wyjścia).

**Weryfikacja**:
`runtime\python\python.exe -m unittest discover -s tests -v` → `OK`,
w tym nowe testy z kroku 3.

### Krok 3: testy `--only-changed`

Utwórz `tests/test_fetch_changed.py` wzorując się na `tests/test_parse.py`
(`unittest`, fixture HTML, tymczasowy katalog). Nie wykonuj żądań sieciowych —
wstrzyknij stub `download()` i `make_opener()`.

Przypadki:

1. pierwsze uruchomienie (brak manifestu) → zapisuje wszystkie pliki i baseline;
2. ponowne uruchomienie bez zmian → żaden plik HTML nie jest nadpisywany,
   `changes.json` ma pustą listę `changed`;
3. zmiana jednej strony → zapisany jest tylko ten plik, `changed` ma jeden wpis;
4. błąd pobrania jednej strony → kod 1, raport ma wpis w `failed`;
5. pliki w `html/week/` bez `<timetable-entry>` są nadal poprawnie oznaczane
   jako „brak zajęć w tym tygodniu".

### Krok 4: ``--only-changed`` w `fetch_week_pon_pt.py`

Dodaj tę samą flagę. Gdy nic się nie zmieniło: nie zapisuj plików HTML ani
`plan-pon-pt.json`, wypisz `[ bez zmian ]`, zwróć 0. Gdy cokolwiek się zmieniło:
zapisz zmienione pliki, przebuduj cały `plan-pon-pt.json` z aktualnych plików
(tak jak dziś) i zaktualizuj manifest. Zwróć 1 tylko przy błędzie pobrania.

**Weryfikacja**: uruchom skrypt dwukrotnie bez zmian w USOS → za drugim razem
żaden plik w `html/week/pon-pt/` nie ma zmienionego `LastWriteTime`.

### Krok 5: fazy w `main.js` i `preload.js`

- `main.js`: wczytaj `scripts/pipeline.json` przez `fs.readFileSync` przy starcie;
  usuń stałą `FETCH_STEPS`.
- `runFetchPhase(sender, phase, index)`: obecna logika `runFetchStep` z tą różnicą,
  że po ostatnim kroku fazy wywołuje `sender.send('fetch:phase', { phase: phase.id,
  label: phase.label, index, total })` i przechodzi do:
  - fazy `build` — automatycznie, gdy faza `data` zakończyła się kodem 0;
  - zakończenia — gdy skończyła się faza `build`.
- `kanal domyślny`: `fetch:start` uruchamia oba fazy. Dodaj
  `ipcMain.handle('fetch:startBuild')` uruchamiający tylko fazę `build`
  (przycisk „Ponów wydruki").
- Zapisz stan w `out/stan.json` po każdej fazie:
  `{ "dataFetchedAt": ISO, "buildFinishedAt": ISO | null,
     "changes": ["NJ-II", ...] }`. Użyj istniejącego `save_json`-owego wzorca
  z Node (`fs.writeFileSync` z `utf8`). Przy braku zmian `dataFetchedAt` pozostaje
  bez zmian, a `changes` jest puste.
- `preload.js`: dodaj `startBuild: () => ipcRenderer.invoke('fetch:startBuild')`
  i `onFetchPhase` dla nowego kanału.

**Weryfikacja**: `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js`
→ wszystkie testy przechodzą (nowy `pipeline.test.js` z krokiem 6).

### Krok 6: test `pipeline.test.js`

Nowy plik w `aplikacja/test/`, wzorzec: `aplikacja/test/views.test.js`.

Przypadki:

1. `pipeline.json` ma dokładnie 2 fazy o id `data` i `build`;
2. faza `data` ma 3 kroki, faza `build` ma 7 kroków i zawiera
   `print-additional.js` z argumentem `groups`;
3. każdy `script` z pipeline jest wymieniony w `MANAGED` z `make_manifest.js`
   (test czyta oba pliki z dysku — chroni przed czwartą listą);
4. każdy krok ma `label`, `exe` ∈ {`python`, `node`} i istniejący plik.

### Krok 7: UI

W `aplikacja/src/renderer/index.html` dodaj przycisk `#ponow-wydruki`
(obok `#odswiez`), domyślnie nieaktywny. W `app.js`:

- `startFetch()` bez zmian wywołuje pełny przebieg;
- nowy handler `#ponow-wydruki` wywołuje `startBuild()`;
- `onFetchPhase` dopisuje do logu nagłówek `== Faza 1/2: Pobieranie danych`
  / `== Faza 2/2: Wydruki` i aktualizuje `#progress-label`;
- po `fetch:done` z kodem 0 przeładuj dane (`load()`) i włącz `#ponow-wydruki`;
- gdy faza `data` zwróci brak zmian — pokaż w logu `Brak nowych danych — wydruki
  nie zostały przebudowane` i nie przechodź do fazy `build`;
- gdy faza `build` zwróci błąd — dane zostają, przycisk „Ponów wydruki" aktywny,
  w logu komunikat o nieaktualnych wydrukach.

W `shared/data.js` dodaj do `meta` odczyt `out/stan.json`
(`dataFetchedAt`, `buildFinishedAt`, `changes`). W `renderResults()` lub nagłówku
statusu pokaż informację, gdy `buildFinishedAt` jest starsze niż `dataFetchedAt`.

**Weryfikacja**: ręcznie — uruchom aplikację, kliknij „Rozpocznij pobieranie",
sprawdź w logu dwa nagłówki faz; potem kliknij „Ponów wydruki" i sprawdź, że
restartują się tylko kroki fazy `build`.

### Krok 8: dokumentacja i manifest

- `INSTRUKCJA.md` §1 i §6 — opisz dwie fazy, tryb `--only-changed`, plik
  `out/stan.json` i przycisk „Ponów wydruki".
- `aplikacja/PLAN.md` i `aplikacja/README.md` — zaktualizuj opis zakładki
  „Pobieranie danych".
- `scripts/make_manifest.js` — dodaj `scripts/pipeline.json` i
  `scripts/make_runall.js` do `MANAGED`.
- Na końcu: `runtime\node\node.exe scripts\make_manifest.js` → `API.json`
  odświeżony.

**Weryfikacja**: podpis manifestu `true`; `plans/README.md` ma wiersz 002 `DONE`.

## Test plan

- Nowe testy: `tests/test_fetch_changed.py` (5 przypadków),
  `aplikacja/test/pipeline.test.js` (4 przypadki).
- Wzorce: `tests/test_parse.py` i `aplikacja/test/views.test.js`.
- Weryfikacja: `runtime\python\python.exe -m unittest discover -s tests -v` → `OK`;
  `cd aplikacja; ..\runtime\node\node.exe --test test\*.test.js` → `fail 0`,
  co najmniej 35 testów.

## Kryteria ukończenia

- [ ] `pipeline.json` jest jedyną listą kroków — `main.js` i `run-all.cmd` czytają
      z niego (bezpośrednio albo przez generator).
- [ ] `fetch.py --only-changed` i `fetch_week_pon_pt.py --only-changed` nie
      nadpisują niezmienionych plików przy drugim uruchomieniu.
- [ ] Przy braku zmian nie są uruchamiane `parse.py` ani faza wydruków.
- [ ] Błąd w fazie danych blokuje fazę wydruków; błąd w fazie wydruków zostawia
      świeże dane i aktywny przycisk „Ponów wydruki".
- [ ] `out/stan.json` zawiera oba znaczniki czasu i listę zmian.
- [ ] Oba zestawy testów przechodzą; podpis `API.json` = `true`.
- [ ] Wiersz planu 002 w `plans/README.md` zmieniony na `DONE`.

## Warunki STOP

- `html/week/changes.json` zmieniłby format — `check-changes.cmd` i istniejące
  testy polegają na obecnym kształcie. Nie zmieniaj go bez osobnej decyzji.
- `fetch.py --check` przestałby działać — to osobny kanał kontroli i musi
  pozostać kompatybilny.
- Wymagana byłaby zmiana logiki `parse.py` albo któregoś skryptu wydruków —
  to poza zakresem.
- `git diff` pokazuje zmiany w plikach spoza zakresu sprzed rozpoczęcia pracy.

## Uwagi na przyszłość

- `fetch.py --check` i nowy `--only-changed` są celowo rozdzielone: pierwszy
  tylko raportuje, drugi stosuje zmiany. Nie łączyć ich w jeden tryb.
- Wczytywanie warunkowe HTTP (ETag/Last-Modified) nie jest w planie — USOS
  nie ma udokumentowanego wsparcia, a hash po stronie klienta jest wiarygodny.
- Status wydruków można później pokazać jako badge w nagłówku zamiast jednego
  zdania w logu.
