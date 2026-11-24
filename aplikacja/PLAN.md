# Planer zajęć USOS — projekt aplikacji desktopowej

## 1. Cel

Aplikacja desktopowa, w której użytkownik zaznacza kryteria i od razu dostaje plan
zajęć spełniający te kryteria. Nie generuje danych od zera — korzysta z tego, co
już pobiera i parsuje istniejący projekt (`plan.json`, `html/week/plan.json`).

Kryteria z zadania: prowadzący, rocznik, grupa, bieżący tydzień, bieżący weekend
oraz wybór, które informacje mają być widoczne.

## 2. Źródła danych

| Plik | Co zawiera | Użycie w aplikacji |
|---|---|---|
| `plan.json` | pełny plan semestralny, klucz = grupa planu (`SJ-I`, `NJ-IV-kliniczna`, …) | widok domyślny |
| `html/week/plan.json` | plan aktualnego tygodnia dla grup niestacjonarnych (Sob–Nie) | przełącznik „ten tydzień” |
| `html/week/plan-pon-pt.json` | plan aktualnego tygodnia dla grup stacjonarnych (Pon–Pt) | ten sam przełącznik, dane sumowane z powyższym |

Pojedynczy wiersz (`rows[]`):

```
day, start, end, course, code, type, group, room, teacher, event, note, typ_full, info
```

Własności wyprowadzane podczas wczytania: `groupKey`, `groupLabel`, `year`,
`studyType`, `speciality`, `source` (`semester` | `week`), `id`.

`parseGroupKey` rozpoznaje `SJ`/`NJ` jako typ studiów, cyfrę rzymską jako rok,
opcjonalny człon po myślniku jako specjalność. Przykład: `SJ-IV-kliniczna` →
stacjonarne, `IV rok`, `kliniczna`.

## 3. Model filtrowania

Wszystkie kryteria łączą się koniunkcją (AND). Puste zestawienie = „bez ograniczenia”.

| Kryterium | Pole w danych | Logika |
|---|---|---|
| prowadzący | `teacher` | wybrane nazwisko musi wystąpić w dowolnym miejscu pola (pole może mieć kilku prowadzących po przecinku) |
| rocznik | `year` | dokładne dopasowanie do wybranych (`I`…`V`) |
| grupa planu | `groupKey` | dokładne dopasowanie (`SJ-I`, `NJ-V-biznesu`, …) |
| numer grupy | `group` | dokładne dopasowanie (`1`, `2`, `3`, …) |
| dzień | `day` | dokładne dopasowanie do `Poniedziałek`…`Niedziela` |
| typ zajęć | `type` | `WYK`, `LAB`, `KON`, `SEM`, `PRZ` |
| ten tydzień | `source` | gdy włączone, brane są tylko wpisy z `html/week/plan.json` |
| ten weekend | `day` | dodatkowo ogranicza do `Sobota` + `Niedziela` |
| wyszukiwarka | `course`, `teacher`, `room`, `code`, `note` | dowolny fragment tekstu |

Uwaga: „ten tydzień” i „ten weekend” można łączyć — wtedy dostajemy weekend
z aktualnego tygodnia (dokładnie to, co robi `drukuj-grupy-weekend.cmd`).

Sortowanie wyników: dzień (stała kolejność `Poniedziałek → Niedziela`), godzina
początku, godzina końca, przedmiot.

## 4. Widoczność pól

Użytkownik włącza/wyłącza kolumny. Domyślnie widoczne: dzień, godzina, przedmiot,
typ, grupa, sala, prowadzący. Domyślnie ukryte: kod, częstotliwość (`event`),
uwagi (`note`), surowe `info`.

Klucze pól: `day`, `time`, `course`, `code`, `type`, `group`, `room`, `teacher`,
`event`, `note`, `info`. `time` jest polem wirtualnym (`start–end`).

## 5. Architektura

```
aplikacja/
  PLAN.md, README.md, package.json, .gitignore
  src/
    shared/
      filters.js     czyste funkcje: parseGroupKey, filterEntries, sortEntries,
                     collectOptions (UMD: działa w Node i w rendererze)
      views.js       grupowanie do widoków: po groupKey i po sali (UMD)
      data.js        fs + JSON → spłaszczone wpisy (tylko Node)
    main/
      main.js        BrowserWindow + ipcMain.handle('data:load')
      preload.js     contextBridge: window.planerApi.loadData()
    renderer/
      index.html     szkielet okna
      app.js         stan, filtry, render trzech widoków
      styles.css     style
  test/
    filters.test.js node:test — jednostkowe + smoke test na realnym plan.json
    views.test.js   node:test — grupowanie po grupach i salach
```

Przepływ: `main` ładuje dane z dysku przez IPC → `renderer` trzyma je w pamięci
i stosuje czyste funkcje z `filters.js` przy każdej zmianie filtra. Dzięki temu
przełączanie filtrów nie wymaga ponownego czytania plików ani IPC.

`contextIsolation: true`, `nodeIntegration: false` — renderer nie ma dostępu do
`fs`, tylko do jednej jawnie wystawionej metody.

Ścieżka danych liczona jest z `__dirname` main.js: `aplikacja/src/main` → trzy
poziomy w górę = folder główny projektu. Wymaga uruchomienia `run-all.cmd` przed
pierwszym startem aplikacji.

## 6. UI

- Lewy panel: „Wyczyść filtry" na górze, potem zwijane sekcje `<details>`
  (prowadzący, rok, grupa planu, numer grupy, dzień, typ, widoczne kolumny)
  z licznikiem zaznaczeń w nagłówku. Lista „Grupa planu" jest zawężana przez
  tryb studiów i zaznaczone roczniki; zmiana tych filtrów odrzuca grupy, które
  przestały pasować, i odświeża tylko tę sekcję (bez utraty scrolla panelu).
  Stan rozwinięcia jest pamiętany przy przeładowaniu filtrów; domyślnie otwarty
  jest tylko „Zakres”. Jest też przełącznik źródła (semestr / ten tydzień),
  „tylko weekend”, pole wyszukiwania i „Wyczyść”. Zmiana źródła czyści
  pozostałe filtry, żeby nie zostały niewidoczne zaznaczenia.
- Prawy panel: licznik wyników i przełącznik trzech widoków (domyślnie „Karty grup"):
  - **Tabela** — sekcje według dni, kolumny zgodne z wybraną widocznością
    (wpisy surowe, bez scalania),
  - **Karty grup** — w widoku specjalności jednego rocznika łączą się w jedną
    kartę (np. `NJ-IV`), żeby ten sam przedmiot w tej samej porze pokazać raz;
    wpis ma tagi wszystkich specjalności. W eksporcie i wydruku każda
    specjalność dostaje osobny plan (`views.js → groupEntriesByPlan`). Układ
    i dane są wzięte z wydruku `grupy-weekend` (`N-III.png`): zajęcia o tym
    samym `(dzień, godzina, przedmiot)` są łączone w jeden wpis z przypisaniem
    sal → numery grup, a zajęcia nachodzące na siebie idą w jednym bloku jako
    wiersze równoległe z separatorem `|`. Kicker pokazuje zakres tygodnia,
    gdy źródło to `html/week/plan.json`,
  - **Plansza sali** — jedna karta na salę, w środku kolumny dni; zajęcia w tej
    samej porze są **scalane w jeden blok** tak samo jak w `build_rooms.py`
    (`src/shared/views.js → mergeEntries`): linie grupują się po
    (prowadzący, typ, uwagi), numery grup i tagi są sumowane, `parz.` + `niep.`
    daje „co tydzień". Sala bez budynku dostaje go tylko przy jednoznacznym
    dopasowaniu. Blok ma plakietki ze wszystkimi kluczami grup planu.
- Sekcje wyników (dzień w tabeli, grupa planu, sala) są zwijane `<details>` —
  domyślnie otwarte, stan zwinięcia pamiętany przy zmianie filtrów i widoku.
- Widoczność pól działa we wszystkich trzech widokach (w kartach dzień jest
  nagłówkiem kolumny, więc nie powtarza się w każdym wpisie). Brak sali trafia
  na końcu planszy jako „Brak sali (—)” — zgodnie z regułą „nie wymyślaj danych".
- Góra: zakładki „Plan" i „Pobieranie danych", status danych i przycisk
  „Odśwież" (ponowny `data:load`).
- Eksport: przycisk „Eksport PDF/PNG" w prawym górnym rogu otwiera okno z
  listą sekcji do zaznaczenia (dzień / grupa / sala), wyborem formatu
  (PDF / PNG / oba) i opcjami PDF: jeden plik dla wszystkich planów oraz
  pakowanie wielu planów na jedną kartkę. `src/main/export.js` buduje HTML
  szablonem z `export-template.js`, który wczytuje wspólny arkusz
  `scripts/print.css` (ten sam co dla plansz sal i kartek A4),
  robi PNG w 3x i PDF A4 landscape z `preferCSSPageSize`. Sekcje są skalowane
  `transform` do szerokości strony (A4 z 10 mm marginesem ≈ 1047×718 px),
  z minimalną skalą 0.5; grupowanie do stron robi `makeGroups`. Wynik ląduje
  w `out/eksport/`, renderer pokazuje liczbę plików i przycisk otwarcia folderu.
- Zakładka „Pobieranie danych": przycisk startu, pasek postępu (animacja
  nieokreślona do pierwszego wpisu, potem procent z `[i/n]` w logu), bieżący
  krok i log na żywo. Przycisk „Przerwij pobieranie" wywołuje `fetch:cancel`,
  który zabija bieżący proces potomny i wysyła `fetch:done` z `cancelled: true`.
  Main proces uruchamia jako procesy potomne fazy z `scripts/pipeline.json`:
  faza `data` (`fetch.py --only-changed`, `fetch_week_pon_pt.py --only-changed`,
  `parse.py`) oraz faza `build` (`build_rooms.py`, `shot_rooms.js`,
  `build_sheets.py`, `sheets.js`, `to_pdf.py`, `print-additional.js groups`,
  `verify.py`). Faza `build` startuje automatycznie po `data`, gdy raport
  `html/week/changes.json` pokazuje zmiany; przycisk „Ponów wydruki" uruchamia
  tylko `build`. IPC `fetch:phase` i `fetch:done` niosą numer fazy, listę zmian
  oraz znacznik `noChanges`. Stan obu faz zapisywany jest w `out/stan.json`,
  a `data.js` wczytuje go do `meta`. Po zakończeniu renderer przeładowuje dane.
  Anulowanie: zamknięcie okna
  zabija bieżący proces potomny. Jeśli istnieje `runtime\`, procesy używają
  wbudowanych `python.exe`/`node.exe`, a `PLAYWRIGHT_BROWSERS_PATH` i
  `PLANER_NODE` wskazują na ten folder — wersja przenośna nie wymaga
  systemowych runtime'ów.

## 7. Etapy wdrożenia

1. ✅ Silnik filtrów + testy → `node --test test/*.test.js` przechodzi.
2. ✅ Wczytanie danych z dysku przez IPC → okno pokazuje liczby wpisów w statusie.
3. ✅ Panel filtrów i widoczności → zaznaczenie zmienia licznik i tabelę.
4. ✅ Widoki „karty grup” i „plansza sali” → przełącznik trybu, wspólny zestaw filtrów.
5. ✅ Eksport PDF/PNG → z poziomu aplikacji, z tym samym stylem co główne
   wydruki (`scripts/print.css`). ✅ Zapisywanie ustawień w `localStorage`.
6. ✅ Aktualizacja danych z USOS z poziomu aplikacji → osobna zakładka z paskiem
   postępu, wywołanie `fetch.py`, `fetch_week_pon_pt.py` i `parse.py`, potem
   odświeżenie widoku.

## 8. Reguły niezmienne (z `INSTRUKCJA.md`)

- Nie wymyślać danych: brak sali/godziny/prowadzącego zostaje `—`.
- Nie zmieniać kolejności dni.
- UTF-8 w plikach i w interfejsie (polskie znaki).
- Jeden wpis = jedno zajęcie z USOS; scalanie robią istniejące skrypty, nie UI.

## 9. Decyzje do domknięcia przed finalnym UI

1. „Grupa” ma oznaczać grupę planu (`SJ-IV-kliniczna`) czy numer grupy zajęciowej
   (`1`, `2`, `3`)? Szkielet udostępnia oba pola naraz; do wyboru po testach z użytkownikiem.
2. „Ten tydzień" czyta cache (`html/week/plan.json` + `plan-pon-pt.json`),
   a odświeżanie robi zakładka „Pobieranie danych" — bez mieszania tych dwóch
   operacji w widoku planu.
3. ✅ Filtry, widok, kolumny i opcje eksportu zapisują się w `localStorage`
   pod kluczem `planer-ustawienia-v1`. Wczytanie waliduje typy i odrzuca
   nieznane wartości.
4. Eksport zrealizowany przez ten sam pipeline co oryginał (HTML → Playwright →
   PNG 3x + PDF A4 landscape), z szablonem w stylu `print-additional.js`.
   Renderer wysyła przefiltrowane wpisy do main procesu przez IPC.
