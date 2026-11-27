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

Aplikacja korzysta z danych w folderze nadrzędnym (`plan.json`,
`html/week/plan.json`). Jeśli jeszcze ich nie ma, uruchom aplikację i użyj
zakładki „Pobieranie danych". W konsoli tylko start:

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

## Wydruki do wybranego miejsca

W prawym górnym rogu, obok „Eksport PDF/PNG”, są dwa przyciski:
„Wydrukuj plan weekendowy” i „Wydrukuj plan semestralny sal”. Uruchamiają te
same skrypty co faza wydruków (`scripts/print-additional.js`), ale przed
startem pytania o folder i nazwę pliku. Powstaje PDF odpowiednio z osobną
kartką dla każdej grupy i specjalności (tydzień) albo z planami sal Pon–Pt.

## Pobieranie danych

Zakładka „Pobieranie danych" ma dwie fazy zdefiniowane w
`scripts\pipeline.json`. Faza „Pobieranie danych" używa `fetch.py
--only-changed`, `fetch_week_pon_pt.py --only-changed` i `parse.py` — zapisuje
tylko pliki HTML, których hash się zmienił. Faza „Wydruki" startuje automatycznie
po udanej fazie danych i buduje plansze sal, PNG, kartki A4, PDF, wydruk grup i
kontrolę jakości. Gdy nie ma nowych danych, obie fazy są pomijane. Przycisk
„Ponów wydruki" uruchamia samą fazę wydruków, np. po jej wcześniejszym błędzie.

Log i pasek postępu pokazują numer fazy i bieżący krok. Znaczniki czasu
znajdują się w `out\stan.json`; pasek statusu informuje, gdy wydruki są starsze
niż dane. Dane w zakładce „Plan" ładują się ponownie po zakończeniu.

Plan na bieżący tydzień (Pon–Pt) dla grup stacjonarnych pobiera faza danych
w aplikacji. Wynik trafia do `html/week/pon-pt/` i `html/week/plan-pon-pt.json`.
Pliki niestacjonarnych (`html/week/plan.json`) nie są nadpisywane.

## Status

- Działa: wczytanie danych, filtry, widoczność pól, trzy widoki (tabela,
  karty grup, plansza sali), pełne pobieranie z USOS z zakładką postępu,
  eksport PDF/PNG, zapis ustawień w `localStorage`, testy.
- „Plansza sali" i eksport tego widoku scalają zajęcia w jednej porze w jeden
  blok — tak samo jak plansze sal generowane przez aplikację. Tabela zostaje surowa.
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
