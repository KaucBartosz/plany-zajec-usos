# Planer zajęć USOS — folder projektowy

Tu jest zaprojektowana i rozpoczęta aplikacja desktopowa (Electron) do przeglądania
planu zajęć z filtrami: prowadzący, rok, grupa, bieżący tydzień, weekend i widoczność pól.

## Co czytać

1. [`PLAN.md`](PLAN.md) — projekt: dane, filtry, architektura, UI, etapy, decyzje do domknięcia.
2. [`src/shared/filters.js`](src/shared/filters.js) — silnik filtrów (działa, ma testy).
3. [`src/shared/data.js`](src/shared/data.js) — wczytanie `plan.json` i `html/week/plan.json`.
4. [`src/renderer/`](src/renderer/) — minimalny UI (tabela z filtrami).
5. [`src/main/`](src/main/) — powłoka Electron (main + preload).

## Uruchomienie

### Bez instalacji (wersja przenośna)

Z folderu głównego projektu uruchom `URUCHOM.cmd`. Folder `runtime\` zawiera
przenośnego Pythona, Node'a i Chromium, więc na docelowym komputerze nie trzeba
nic instalować. Dane i wydruki są już w folderze — aplikacja otwiera się od razu.

### Aktualizacje kodu

Wersja przenośna jest kopiowana na urządzenie tylko raz. `URUCHOM.cmd`
wywołuje przed startem Electrona aktualizator, który czyta podpisany
`API.json` z publicznego repozytorium, sprawdza `sha256` każdego pliku i
atomowo zamienia tylko pliki kodu. Dane i pliki lokalne (`config.py`,
`groups.py`, `print.css`, `URUCHOM.cmd`) pozostają nietknięte. Po zmianie
pliki `.bak` pozwalają wrócić do poprzedniej wersji.

```powershell
runtime\node\node.exe aplikacja\src\main\update.js --check
runtime\node\node.exe aplikacja\src\main\update.js --apply
runtime\node\node.exe aplikacja\src\main\update.js --rollback
```

`--auto` (używany przez launcher) przy braku internetu kończy się komunikatem
`offline — pomijam aktualizację`. `PLANER_NO_UPDATE=1` wyłącza sprawdzanie.

### Gdy Python i Node są zainstalowane w systemie

Aplikacja korzysta z danych już wygenerowanych w folderze nadrzędnym (`plan.json`,
`html/week/plan.json`). Najpierw `run-all.cmd` w głównym folderze, potem:

```powershell
cd aplikacja
npm install
npm start
```

Testy silnika filtrów (bez Electrona, bez instalacji):

```powershell
cd aplikacja
node --test test\*.test.js
```

## Gdy Electron nie startuje

Błąd `Electron failed to install correctly` oznacza brak `node_modules/electron/dist/electron.exe`
i `path.txt` — postinstall nie dokończył pobrania. Uruchom z folderu `aplikacja`:

```powershell
.\napraw-electron.ps1
```

Skrypt pobiera (jeśli trzeba) i rozpakowuje binarium z cache `%LOCALAPPDATA%\electron\Cache`,
potem zapisuje `path.txt`. `npm start` można potem uruchomić normalnie.

## Eksport do PDF/PNG

Przycisk „Eksport PDF/PNG" w prawym górnym rogu otwiera okno eksportu.
Można w nim zaznaczyć, które dni / grupy / sale wyeksportować (domyślnie
wszystkie), wybrać format (PDF, PNG albo oba) oraz opcje PDF:

- „wszystkie plany w jednym pliku PDF" (domyślnie włączone) — po odznaczeniu
  powstaje osobny PDF na każdy zaznaczony plan,
- „więcej niż jeden plan na kartkę" — sekcje są pakowane na stronę, jeśli
  zmieszczą się rozmiarem.

Wyniki trafiają do `out/eksport/`: `plan-<widok>-<data>.pdf` (lub `-NN.pdf`)
oraz `plan-<widok>-<data>-NN.png` w 3x. Wszystkie wydruki — plansze sal,
kartki A4 i eksport z aplikacji — korzystają z jednego arkusza
`scripts/print.css` (nagłówek, kolumny dni, kolory typów). Przycisk „Otwórz
folder" otwiera katalog z wynikami.

## Pobieranie danych

Zakładka „Pobieranie danych" uruchamia pełny przebieg: `fetch.py`,
`fetch_week_pon_pt.py`, `parse.py`, `build_rooms.py`, `shot_rooms.js`,
`build_sheets.py`, `sheets.js`, `to_pdf.py` i `verify.py`. Dzięki temu po
odświeżeniu gotowy PDF w `out/a4/pdf/` jest aktualny, a nie sprzed zmian
w USOS. Log i pasek postępu pokazują bieżący krok; dane w zakładce „Plan"
ładują się ponownie po zakończeniu.

Ręcznie, bez aplikacji, pobranie planu na bieżący tydzień (Pon–Pt)
dla grup stacjonarnych:

```powershell
python scripts\fetch_week_pon_pt.py     # z folderu głównego projektu
# albo: aplikacja\pobierz-tydzien-pn-pt.cmd
```

Wynik: `html/week/pon-pt/*.html` i `html/week/plan-pon-pt.json`.
Pliki niestacjonarnych (`html/week/plan.json`) nie są nadpisywane.

## Status

- Działa: wczytanie danych, filtry, widoczność pól, trzy widoki (tabela,
  karty grup, plansza sali), pełne pobieranie z USOS z zakładką postępu,
  eksport PDF/PNG, zapis ustawień w `localStorage`, testy.
- „Plansza sali" i eksport tego widoku scalają zajęcia w jednej porze w jeden
  blok — tak samo jak plansze sal z `run-all.cmd`. Tabela zostaje surowa.
- „Karty grup" mają układ z wydruku weekendowego
  (`out\druk\grupy-weekend\png\N-III.png`): zajęcia w tej samej porze są w jednym
  bloku, równoległe rozdziela `|`, przy sali widać numery grup, a w nagłówku
  zakres tygodnia. Specjalności jednego rocznika są w widoku połączone, więc
  wspólny przedmiot (np. Neuropsychologia w NJ IV) pojawia się raz z tagami
  specjalności. Eksport i wydruk tego widoku zachowują osobny plan dla każdej
  specjalności.
- Domyślny widok to „Karty grup". Filtry, widok, widoczne kolumny i opcje
  eksportu są przywracane przy starcie (jeśli poprzednia sesja zapisała inny
  widok, obowiązuje zapisany). Wyczyszczenie filtrów czy zmiana źródła też jest
  zapisywana. „Wyczyść filtry" jest na górze kolumny filtrów.
- Wybór trybu SJ/NJ albo rocznika zawęża listę „Grupa planu" tylko do
  pasujących grup; wcześniej zaznaczone grupy, które przestały pasować, są
  usuwane.
- W zakładce „Pobieranie danych" przycisk „Przerwij pobieranie" zatrzymuje
  bieżący krok bez czekania do końca całego przebiegu.
