# Plany zajęć z USOSweb → PNG per sala + kartki A4 + PDF

Instrukcja dla agenta (i dla człowieka). Opisuje **cały** proces: skąd pobrać dane,
jak je sparsować, jak zbudować plansze sal i kartki A4, jak zrobić PDF do druku
oraz jak sprawdzić, że wynik jest poprawny.

Wszystko jest w tym folderze i działa bez żadnych danych wejściowych poza dostępem
do internetu.

---

## 0. Co powstaje

| Krok | Wynik | Gdzie |
|---|---|---|
| pobranie | 23 pliki HTML planów semestralnych | `html/<klucz>.html` + `html/manifest.json` |
| kontrola niestacjonarnych | 12 wariantów tygodniowych | `html/week/` |
| parsowanie | jedna tabela wszystkich zajęć | `plan.json` |
| plansze sal | 1 PNG na salę × (Pn–Pt, Sb–Nd) — 23 pliki | `out/png/` |
| kartki A4 | kilka planów na jednej kartce A4, legenda raz — 14 plików | `out/a4/png/` |
| druk | 1 PDF, 14 stron A4 poziomo (300 dpi) | `out/a4/pdf/plany-sal-bud-009.pdf` |

Liczby (23 / 14) dotyczą roku 2026/27 i budynku 009 — przy innym budynku będą inne.

Zasady widoczne na wydruku: tylko wybrany budynek, jeden blok = jedna pora w sali,
ten sam prowadzący w tej samej porze scalony w jedną linię, parzyste + nieparzyste
= co tydzień, brak wymyślania danych („—“ gdy USOS nie podaje).

---

## 1. Szybki start

### Wersja przenośna (bez instalacji)

Skopiuj **cały folder projektu** na dowolny komputer z Windows 10/11 (x64)
i uruchom:

```powershell
.\URUCHOM.cmd
```

Folder `runtime\` zawiera przenośny Python 3.12 z Pillow, Node.js 22,
przeglądarkę Chromium dla Playwright oraz bibliotekę Electron. Nie trzeba
instalować Pythona, Node'a, npm ani Chromium. Dane (`plan.json`, `html/`)
i gotowe wydruki (`out/`) są już w folderze, więc aplikacja startuje od razu,
także bez internetu. Internet jest potrzebny tylko do odświeżenia planów
(zakładka „Pobieranie danych" w aplikacji albo `run-all.cmd`) oraz do
aktualizacji kodu.

Pełną kopię folderu trzeba zrobić tylko raz. Przy każdym kolejnym starcie
`URUCHOM.cmd` sprawdza podpisany manifest `API.json` w publicznym
repozytorium i — jeśli jest nowsza wersja — pobiera tylko pliki kodu
(`scripts\`, `aplikacja\src\`, testy i dokumentację, łącznie kilkaset kB),
weryfikuje ich hashe i zamienia je atomowo. Dane (`plan.json`, `html\`,
`out\`) oraz pliki lokalne (`scripts\config.py`, `scripts\groups.py`,
`scripts\print.css`, `URUCHOM.cmd`) nie są nadpisywane. Po aktualizacji
wymagany jest restart aplikacji. Bez internetu aktualizator milczy i start
przebiega normalnie; można go też wyłączyć zmienną `PLANER_NO_UPDATE=1`.

Ręcznie:

```powershell
runtime\node\node.exe aplikacja\src\main\update.js --check       # 0 = brak, 1 = jest, 2 = blad
runtime\node\node.exe aplikacja\src\main\update.js --apply       # wymuszenie
runtime\node\node.exe aplikacja\src\main\update.js --rollback    # powrót do kopii .bak
```

Pozostałe skrypty (`run-all.cmd`, `test.cmd`, `check-changes.cmd`,
`drukuj-*.cmd`, `sprawdz-kolizje.cmd`) same wczytują ustawienia z
`runtime\_env.cmd`, więc działają także bez systemowych runtime'ów.

**Odświeżanie danych i wydruki to dwie fazy.** Lista kroków jest w jednym
pliku, `scripts\pipeline.json`; `run-all.cmd` jest z niego generowany
(`node scripts\make_runall.js`). Kliknięcie „Rozpocznij pobieranie" w aplikacji
uruchamia najpierw fazę danych (`fetch.py --only-changed`,
`fetch_week_pon_pt.py --only-changed`, `parse.py`), a po niej — automatycznie —
fazę wydruków (plansze sal, PNG, kartki A4, PDF, wydruk grup i `verify.py`).
Tryb `--only-changed` pobiera strony z USOS, ale zapisuje tylko te, których
hash się zmienił. Gdy raport `html\week\changes.json` nie pokazuje zmian,
parsowanie i wydruki są pomijane. Fazę wydruków można uruchomić osobno
przyciskiem „Ponów wydruki". Znaczniki czasu obu faz trafiają do
`out\stan.json`, więc pasek statusu pokazuje, kiedy dane były pobrane i czy
wydruki są aktualne. `fetch.py --check` pozostaje osobnym, tylko raportującym
kanałem i nie nadpisuje danych.

### Klasyczne uruchomienie (gdy system ma Python i Node)

```powershell
cd "$env:USERPROFILE\Desktop\PlanyZajec-USOS"
.\run-all.cmd
```

`run-all.cmd` robi wszystko po kolei (pobranie → parse → plansze → kartki → PDF →
kontrola) i otwiera folder z PDF-em. Pierwsze uruchomienie instaluje Playwrighta
i Pillow.

Dodatkowe wydruki, bez zmieniania ani ponownego uruchamiania głównego przebiegu:

```powershell
.\drukuj-sale-pon-pt.cmd      # jedna sala na stronie A4, tylko poniedziałek–piątek
.\drukuj-grupy-weekend.cmd    # grupy z zajęciami w sobotę i niedzielę
```

Do przekazania projektu na inny komputer służą dwa skrypty w `uruchamianie\`:

```powershell
.\uruchamianie\1-sprawdz-wymagania.cmd  # instaluje brakujące pakiety i Chromium
.\uruchamianie\2-skanuj-i-generuj.cmd   # pobiera plany i generuje wszystkie wydruki
```

Skopiuj cały folder projektu, nie sam folder `uruchamianie`. Python 3.10+ i
Node.js 18+ są wymagane. Pierwszy skrypt sprawdza ich obecność; jeśli któregoś
brakuje, instaluje Python 3.12 lub Node.js LTS przez winget. Po tej instalacji
uruchom go ponownie w nowym oknie, aby odświeżyć ścieżki systemowe i doinstalować
pakiety Pythona, Playwright oraz Chromium. Drugi skrypt sam uruchamia ten test
przed pobraniem i generowaniem planów. Jeśli winget nie jest dostępny, doinstaluj
App Installer ze sklepu Microsoft Store.

Dwa dodatkowe wydruki korzystają z danych i planów utworzonych przez `run-all.cmd`.
PDF-y i obrazy PNG zapisują się w osobnych katalogach:
`out\druk\sale-pon-pt\` oraz `out\druk\grupy-weekend\` (obrazy w podkatalogu
`png\`). Wydruk grup zawiera dzień, godziny, numer grupy, przedmiot, salę i imię
z nazwiskiem prowadzącego (z USOS);
pokazuje tylko sobotę i niedzielę z konkretnego tygodnia pobranego przez
`plan_division=week`. Zajęcia tego samego przedmiotu i czasu są łączone, a
przypisania grup do sal widnieją w jednym wpisie. Pojedyncza grupa nie ma
powtarzanego numeru przy sali, a zajęcia odbywające się równolegle są
umieszczane obok siebie, gdy jest na to miejsce. Języki bez sali są pomijane.
Zakres dat jest widoczny w nagłówku obrazu.

Sprawdzenie, czy plany w USOS się zmieniły (nie nadpisuje pobranych planów
semestralnych; zapisuje osobny raport wariantów tygodniowych):

```powershell
.\check-changes.cmd
```

Testy i kontrola kolizji (nie wymagają pobierania danych):

```powershell
.\test.cmd               # testy Python: parser USOS + wykrywanie kolizji
.\sprawdz-kolizje.cmd    # raport kolizji -> out\kolizje.json (kod 1 = są kolizje)
```

Ręczne uruchamianie krok po kroku:

```powershell
python scripts\fetch.py          # 1. HTML
python scripts\parse.py          # 2. plan.json
python scripts\build_rooms.py    # 3. HTML plansz
node   scripts\shot_rooms.js     # 4. PNG sal
python scripts\build_sheets.py   # 5. HTML kartek (mierzy sekcje)
node   scripts\sheets.js         # 6. PNG kartek
python scripts\to_pdf.py         # 7. PDF
python scripts\verify.py         # 8. kontrola

python -m unittest discover -s tests -v   # testy parsera i kolizji
python scripts\check_conflicts.py         # kontrola kolizji (opcjonalnie)
```

---

## 2. Wymagania

- Windows + PowerShell (cmd też wystarczy), Python 3.10+, Node.js 18+.
- Python: `Pillow` (`python -m pip install -r requirements.txt`).
- Node: `playwright` (`npm install`, potem raz na maszynę `npx playwright install chromium`).
- Dostęp do `usosweb.ukw.edu.pl` (bez logowania).

Sprawdzenie środowiska:

```powershell
python -c "import PIL; print(PIL.__version__)"
node -e "require('playwright'); console.log('playwright ok')"
```

---

## 3. Struktura folderu

```
PlanyZajec-USOS\
  INSTRUKCJA.md        ← ten plik
  URUCHOM.cmd          ← start w wersji przenośnej (bez instalacji)
  runtime\             ← przenośny Python, Node, Chromium, _env.cmd
  run-all.cmd          ← pełny przebieg
  check-changes.cmd    ← czy plany się zmieniły
  test.cmd             ← testy Python (parser + kolizje)
  sprawdz-kolizje.cmd  ← raport kolizji
  requirements.txt     ← Pillow
  package.json         ← Playwright
  scripts\
    groups.py          ← KODY GRUP (grupa_kod, cykl) + URL-e stron wydziału
    config.py          ← budynek, semestr, sale „ultra”, parametry A4/PDF
    print.css          ← JEDEN styl wszystkich wydruków (sal, kartek, eksportu)
    fetch.py           ← pobieranie HTML (cookie jar, manifest, --check)
    parse.py           ← HTML → plan.json
    check_conflicts.py ← kolizje sal / prowadzących / grup
    build_rooms.py     ← plan.json → HTML plansz sal
    shot_rooms.js      ← HTML → PNG (Playwright, 3x)
    build_sheets.py    ← sekcje → kartki A4 (pomiar + pakowanie)
    sheets.js          ← pomiar sekcji + PNG kartek
    to_pdf.py          ← PNG → PDF A4 landscape 300 dpi
    verify.py          ← kontrola kompletności i jakości
  tests\               ← testy unittest + fixture HTML parsera
  html\                ← pobrane strony semestralne (tworzone automatycznie)
    week\              ← warianty tygodniowe planów niestacjonarnych + raport zmian
  out\
    png\               ← plansze pojedynczych sal
    a4\png\            ← kartki A4
    a4\pdf\            ← PDF-y
    kolizje.json       ← raport kolizji
```

Skrypty zakładają, że leżą w `scripts\` — katalogiem roboczym jest folder nadrzędny
(`html/`, `plan.json`, `out/` powstają obok `scripts\`).

---

## 4. Krok 1 — źródło danych

Plany są **publiczne**, ale wejście na stronę planu przechodzi przez CAS
(`cas.ukw.edu.pl`) i wraca przekierowaniem. Dlatego **jedna sesja HTTP z cookie
jar-em** musi obsłużyć całe przekierowanie. Bez ciasteczek serwer zwraca puste 302.

### 4.1 Wzór adresu planu grupy

```
https://usosweb.ukw.edu.pl/kontroler.php?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow&grupa_kod=<KOD>&cdyd_kod=<CYKL>
```

- `<KOD>` — np. `SJ-Ps-11`, `NJ-Ps-K-5` (jedna grupa = jeden rok + specjalność),
- `<CYKL>` — `2026Z` dla studiów stacjonarnych (semestr zimowy 2026/27),
  `2026` dla niestacjonarnych (cykl całoroczny).

### 4.2 Skąd wziąć aktualne kody

Strony wydziału listują linki do planów; w każdym linku siedzi `grupa_kod` i `cdyd_kod`:

- stacjonarne: <https://psychologia.ukw.edu.pl/jednostka/wydzial_psychologii_/stacjonarne_psychologia>
- niestacjonarne: <https://psychologia.ukw.edu.pl/jednostka/wydzial_psychologii_/niestacjonarne_psychologia>

Tabela kodów jest w `scripts\groups.py` (23 pozycje: 11 stacjonarnych + 12 niestacjonarnych).
Przy nowym roku akademickim **najpierw** zaktualizuj tam `grupa`/`cykl`, potem pobieraj.

### 4.3 Pobranie ręczne (do debugowania)

Odpowiednik tego, co robi `fetch.py` — curl musi mieć jar (`-c` + `-b`):

```powershell
curl.exe -s -L --max-redirs 10 -c jar.txt -b jar.txt -A "Mozilla/5.0" `
  "https://usosweb.ukw.edu.pl/kontroler.php?_action=katalog2/przedmioty/pokazPlanGrupyPrzedmiotow&grupa_kod=SJ-Ps-11&cdyd_kod=2026Z&plan_division=semester" `
  -o html\SJ-I.html
```

### 4.4 Pobranie skryptem

```powershell
python scripts\fetch.py                 # wszystkie grupy
python scripts\fetch.py --only SJ-I     # jedna grupa
python scripts\fetch.py --check         # porównanie; zapisuje raport week/changes.json
```

`fetch.py`:

- używa **jednej** sesji z cookie jar-em na cały przebieg (warunek działania CAS),
- ponawia próbę 3× przy błędzie sieci,
- **waliduje** plany semestralne: ≥ 50 kB i znacznik `usos-timetable`,
- dla wariantu tygodniowego wymaga znacznika `usos-timetable`, ale nie minimalnego
  rozmiaru 50 kB — krótsze plany, także te bez zajęć w danym tygodniu, są
  poprawnie zapisywane i oznaczane w logu jako „brak zajęć w tym tygodniu”,
- pobiera plany z `plan_division=semester` do `html/` oraz dodatkowo plany
  niestacjonarne z `plan_division=week` do `html/week/`,
- zapisuje osobne manifesty dla wariantu semestralnego i tygodniowego;
  `--check` porównuje oba, a zmiany wariantu tygodniowego zapisuje w
  `html/week/changes.json` bez nadpisywania jego punktu odniesienia. Przy
  pierwszym sprawdzeniu wariantu tygodniowego zapisuje jego punkt odniesienia.

Pierwsze `--check` tworzy punkt odniesienia dla wariantów tygodniowych, jeśli
jeszcze go nie ma. Późniejsze różnice dla tych planów znajdziesz w
`html/week/changes.json`.

**Kryterium zaliczenia kroku:** pliki semestralne mają ≥ 50 kB; wszystkie
odpowiedzi semestralne i tygodniowe zawierają `usos-timetable`. Plany tygodniowe
mogą być krótsze, również gdy nie mają żadnych zajęć; `fetch.py` kończy się
kodem 0, jeśli pozostałe plany pobrano poprawnie.

---

## 5. Krok 2 — parsowanie

```powershell
python scripts\parse.py
```

Wyniki:

- `plan.json` — pełne plany semestralne (`klucz_grupy → {title, label, folder, rows[]}`),
- `html/week/plan.json` — aktualny tydzień dla grup niestacjonarnych.

Każdy wiersz zawiera:

```
day, start, end, course, code, type, group, room, teacher, event, note, typ_full, info
```

Dane w USOS są renderowane po stronie serwera (żadnego JS nie trzeba uruchamiać).
Anatomia strony, na której opiera się parser:

| Element HTML | Znaczenie |
|---|---|
| `<usos-timetable>` | cały plan |
| `<h4>Poniedziałek</h4>` | nagłówek dnia (dotyczy kolejnych wpisów) |
| `<timetable-entry name name-id>` | jedno zajęcie (przedmiot + kod) |
| `slot="info"` | `TYP, gr. N (SALA)`; typ = tekst przed pierwszym przecinkiem; sala = **ostatni** nawias (może być zagnieżdżony, np. `Aula Atrium (17), bud. 001`) |
| `slot="dialog-event"` | `każdy poniedziałek, 9:45 - 12:00` — źródło godzin; `wielokrotnie … (niestandardowa częstotliwość)` = terminy niestandardowe |
| `slot="dialog-person"` | prowadzący (może być kilku) |
| `<usos-icon icon-url="…/one.svg">` | tydzień nieparzysty |
| `<usos-icon icon-url="…/two.svg">` | tydzień parzysty |
| `<usos-icon icon-url="…/warn.svg">` | terminy niestandardowe |

Uwagi:

- brak nawiasów w `slot="info"` = **USOS nie podaje sali** (seminaria, ćwiczenia,
  konwersatoria) — takie wpisy są liczone i pomijane w planach sal,
- nie „naprawiaj” brakujących danych: brak godziny/sali/prowadzącego zostaje pusty
  (na wydruku `—`).

**Kryterium zaliczenia:** `plan.json` istnieje, każda z 23 grup ma ≥ 1 zajęcie,
a skrypt wypisuje liczbę zajęć bez sali (dla 2026/27 było 185).

---

## 6. Krok 3 — plansze pojedynczych sal

```powershell
python scripts\build_rooms.py   # plan.json → out\shot-*.html + out\shots.json
node   scripts\shot_rooms.js    # HTML → out\png\*.png (3x)
```

### 6.1 Filtrowanie sal

- brane są tylko sale kończące się na `bud. <config.BUILDING>` (domyślnie `009`),
- sala bez budynku („102”) dostaje budynek tylko wtedy, gdy w danych jest
  **dokładnie jeden** wariant `"102, bud. XXX"` — inaczej zostaje bez budynku
  i wypada z planu,
- wpisy bez sali są zliczane (`wpisy bez sali: N`) i pomijane.

### 6.2 Scalanie (najważniejsza reguła)

1. Klucz bloku: `(dzień, start, end)`.
2. W obrębie bloku linie szczegółów grupują się po `(prowadzący, typ, uwagi)`;
   numery grup i tagi (`S·III`, `N·IV-klin`) są sumowane i sortowane.
3. `parz.` + `nieparz.` w jednym bloku → pokazywane jako **co tydzień** (bez adnotacji).
4. Uwagi jednomyślne zostają, mieszane zostają przy swoich liniach.
5. Nakładające się zajęcia: najpierw osobne „lane” (2 dla Pn–Pt, 3 dla Sb–Nd),
   przy większej liczbie — jedno pod drugim.

### 6.3 Dwa warianty

| Wariant | Karta | Bloki | Zastosowanie |
|---|---|---|---|
| `pn-pt` | 1400 px, A4 poziomo | pełne (typ, grupa, tag, prowadzący, uwagi) | dni robocze |
| `sb-nd` | 990 px, A4 pionowo | zwarte, jedna linia na wpis | weekendy |

Dodatkowo sale z `config.ULTRA_ROOMS` (301, 302, 405, 406, 407) w wariancie `sb-nd`
dostają wersję **ultra**: tylko `godzina` + `prowadzący`, bez typów, grup i legendy
(adnotacja o terminach zjazdów jest raz w nagłówku). To jedyny sposób, by gęste
weekendy zmieściły się na jednej kartce.

### 6.4 Wygląd

- typ zajęć = kolor lewej krawędzi: WYK niebieski, LAB zielony, KON pomarańczowy,
  SEM fioletowy, PRZ szary,
- `S·` = stacjonarne, `N·` = niestacjonarne,
- przerwa > 90 min między blokami = kropkowany separator.

**Kryterium zaliczenia:** liczba PNG = liczba kluczy w `out/shots.json`; log nie
zawiera `WARN low zoom`; wizualnie sprawdzony najgęstszy dzień (bloki się nie
nachodzą, tekst nie wychodzi za ramki).

---

## 7. Krok 4 — kartki A4 z kilkoma planami

```powershell
python scripts\build_sheets.py  # sekcje + measure.html + pomiar + pakowanie
node   scripts\sheets.js        # PNG kartek (zoom-to-fit)
```

Jak działa pakowanie:

1. Każda sala × wariant (`pn-pt`, `sb-nd`) to **sekcja** o wspólnej szerokości
   `config.CARDW` (1400 px).
2. `node scripts/sheets.js measure` mierzy realną wysokość każdej sekcji
   (`out/a4/heights.json`) — nie trzeba nic szacować.
3. Sekcje (w kolejności: sala rosnąco, najpierw Pn–Pt) są pakowane zachłannie do
   limitu `config.BUDGET` (950 px). Tytuł kartki i legenda zajmują resztę z 990 px.
4. Każda kartka jest zrzutem `.card` ze `zoom = min(1, 990 / wysokość)`.
   `zoom < 0.7` = kartka przeładowana → trzeba zmniejszyć `BUDGET`.
5. Legenda jest **raz na kartkę** (stopka), a każda sekcja ma własny pasek
   `Sala <nr>, bud. 009 — poniedziałek–piątek|sobota–niedziela`.

Efekt dla 2026/27: 23 sekcje → 14 kartek (małe sale po 2–3 na kartce, duże
301/302/405/406 osobno).

**Kryterium zaliczenia:** każda sekcja z kroku 3 występuje na dokładnie jednej
kartce; każda kartka ma dokładnie jedną legendę; `zoom ≥ 0.7`; proporcja obrazu
≈ 1.41 (A4 poziomo).

---

## 8. Krok 5 — PDF do druku

```powershell
python scripts\to_pdf.py
```

- strona: A4 **poziomo** @ 300 dpi = 3508 × 2480 px,
- obrazek jest skalowany „contain” (maksymalnie duży, proporcje zachowane, nigdy
  rozciągany; gdzie trzeba zostają białe marginesy),
- powstaje **jeden** PDF ze wszystkimi stronami + po jednym PDF-ie na kartkę.

**Kryterium zaliczenia:** liczba stron PDF = liczba kartek PNG; wydruk w 100%
mieści się na A4.

---

## 9. Krok 6 — kontrola

```powershell
python scripts\verify.py
```

Sprawdza: obecność i niepustość `plan.json`, komplet PNG sal, komplet kartek,
proporcje A4, minimalną szerokość renderu, liczbę stron PDF. Kod wyjścia 1 = problem.

Ręczna lista kontrolna przed oddaniem plików:

- [ ] 23 pliki HTML > 50 kB, każdy z `usos-timetable`
- [ ] `plan.json` — każda grupa ma zajęcia, znana liczba wpisów bez sali
- [ ] PNG sal: po jednym `pn-pt` i `sb-nd` dla każdej sali z zajęciami
- [ ] brak `WARN low zoom` w logach
- [ ] kartki A4: jedna legenda, czytelny druk (podgląd 1–2 kartek)
- [ ] PDF: 14 stron, A4 poziomo, otwiera się bez błędów
- [ ] polskie znaki poprawne (ą, ć, ę, ł, ń, ó, ś, ź, ż)

### Kontrola kolizji

`python scripts\check_conflicts.py` szuka zajęć w tej samej porze dla tej samej sali,
prowadzącego lub numeru grupy. Nie myli przy tym:

- `parz.` z `niep.` (różne tygodnie),
- terminów niestandardowych (data nieznana — wpis pomijany),
- weekendów z planu semestralnego (daty zjazdów nie są w USOS) — te sprawdza
  w `html/week/plan.json`, czyli w konkretnym tygodniu,
- tego samego kodu przedmiotu w kilku planach grup (jedne zajęcia, nie kolizja).

Wynik trafia na ekran i do `out\kolizje.json`. Kod wyjścia 1 oznacza, że kolizje
są — skrypt nie jest częścią `run-all.cmd`, żeby nie przerywać wydruku.

---

## 10. Co i gdzie się edytuje

| Chcę zmienić | Plik | Co |
|---|---|---|
| inny budynek | `scripts/config.py` | `BUILDING = '009'` |
| semestr / wydział w nagłówku | `scripts/config.py` | `SEMESTER`, `FACULTY` |
| które sale mają wersję ultra | `scripts/config.py` | `ULTRA_ROOMS` |
| które sale bez legendy | `scripts/config.py` | `NO_FOOT_ROOMS` |
| gęstość kartek A4 | `scripts/config.py` | `BUDGET` (mniej = luźniej, więcej kartek) |
| rozmiar kartki | `scripts/config.py` | `CARDW`, `TARGETH` |
| nowy rok / kody grup | `scripts/groups.py` | `grupa`, `cykl`, `key`, `label` |
| kolory typów, fonty, padding | `scripts/print.css` | wspólny styl sal, kartek i eksportu (zmienne nadpisują generatory) |
| układ bloków (lane, odstępy) | `scripts/build_rooms.py` | `section_cols()` |
| wygląd kartki A4 | `scripts/build_sheets.py` | `CSS`, `SHEET_HEAD` |
| jakość renderu | `scripts/shot_rooms.js`, `scripts/sheets.js` | `deviceScaleFactor` (3 = 3x) |
| format PDF | `scripts/to_pdf.py` + `config.py` | `PDF_W`, `PDF_H`, `PDF_DPI` |
| listę kroków pobierania i wydruków | `scripts/pipeline.json` | fazy `data` i `build`; `run-all.cmd` generuje `make_runall.js` |
| listę plików aktualizowanych z GitHub | `scripts/make_manifest.js` | `MANAGED`, `LOCAL` (hash + podpis trafiają do `API.json`) |
| adres repo i klucz publiczny | `aplikacja/src/main/update-trust.js` | `manifestUrl`, `publicKey` (klucz prywatny poza repo) |
| wyłączenie autoaktualizacji | zmienna `PLANER_NO_UPDATE=1` | aktualizator nie jest wywoływany |

Po zmianie w `config.py`/`groups.py` wystarczy powtórzyć kroki 3–7 (nie trzeba
pobierać HTML od nowa, o ile dane się nie zmieniły).

### Nowy rok akademicki — lista rzeczy do zrobienia

1. Odwiedź strony wydziału (pkt 4.2), wypisz nowe `grupa_kod` i `cdyd_kod`.
2. Zaktualizuj `scripts/groups.py` (klucze `key` = nazwy plików HTML).
3. `python scripts\fetch.py` → sprawdź, czy wszystkie 23 pliki przeszły walidację.
4. `python scripts\parse.py` → sprawdź liczby zajęć na grupę.
5. `python scripts\build_rooms.py` → sprawdź listę sal i „wpisy bez sali”.
6. Jeśli pojawiły się nowe bardzo gęste sale weekendowe — dopisz je do
   `ULTRA_ROOMS` i `NO_FOOT_ROOMS`.
7. Dokończ kroki 4–7 i przejdź listę kontrolną z pkt 9.

---

## 11. Reguły niezmienne

- **Nie wymyślaj danych.** Brak sali/godziny/prowadzącego w USOS = puste / `—`.
- **Jeden blok = jedna pora w jednej sali.** Nie rozbijaj scalonych grup.
- **Nie duplikuj planów** — każda sekcja trafia na dokładnie jedną kartkę.
- **Legenda raz na kartkę**, nie przy każdej sali.
- **UTF-8 wszędzie** (pliki, `<meta charset>`, JSON `ensure_ascii=False`) —
  polskie znaki muszą przetrwać.
- **Nie zmieniaj kolejności dni** (`Poniedziałek … Niedziela`, `DAY_ORDER`).
- **Nie zgaduj budynku** — sala bez budynku dostaje go tylko przy jednoznacznym
  dopasowaniu.

---

## 12. Rozwiązywanie problemów

| Objaw | Przyczyna | Rozwiązanie |
|---|---|---|
| plik HTML ma 0–2 kB | brak cookie jar / wygasła sesja CAS | usuń `html\manifest.json` i pobierz ponownie (`fetch.py`) |
| `pobrano stronę bez planu` | strona błędu USOS albo zmieniony kod grupy | sprawdź `grupa_kod` na stronie wydziału |
| `Brak Playwright` | niezainstalowane zależności | `npm install`, potem `npx playwright install chromium` |
| `Brak Pillow` | brak pakietu | `python -m pip install -r requirements.txt` |
| puste/za krótkie PNG | brak `node_modules` w folderze | uruchamiaj z folderu projektu (tam jest `package.json`) |
| `WARN low zoom` | za dużo treści na kartce | zmniejsz `BUDGET` w `config.py` (np. 850) |
| nachodzące bloki | zbyt wiele równoległych zajęć | zwiększ `lane_max` w `build_rooms.py` lub zostaw (spada do układu pionowego) |
| „krzaczki” w konsoli | strona kodowa terminala | pliki są UTF-8; sprawdzaj podglądem, nie `echo` |
| inny budynek = 0 sal | `BUILDING` nie pasuje do danych | sprawdź, jakie `bud. XXX` występują w `plan.json` |

---

## 13. Gdzie są gotowe pliki

```
out\png\                          plany pojedynczych sal (PNG, 3x)
out\a4\png\                       kartki A4 (PNG, 3x)
out\a4\pdf\plany-sal-bud-009.pdf  PDF do druku (A4 poziomo, 300 dpi)
out\a4\pdf\a4-bud-009-XX.pdf      pojedyncze kartki jako PDF
out\druk\sale-pon-pt\             PDF i osobne PNG planów sal Pn–Pt
out\druk\grupy-weekend\           PDF i osobne PNG planów grup weekendowych
html\week\changes.json            ostatni raport zmian planów niestacjonarnych
```

Druk: otwórz PDF i wybierz „Rzeczywisty rozmiar” / 100% (strony są już A4).
