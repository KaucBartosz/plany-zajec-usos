# Implementation Plans

Wygenerowano przez skill `improve` 2026-11-24. Wykonuj w kolejności poniżej,
chyba że zależności mówią inaczej. Każdy wykonawca: przeczytaj plan cały,
przestrzegaj warunków STOP i zaktualizuj swój wiersz po zakończeniu.

## Kolejność i status

| Plan | Tytuł | Priorytet | Nakład | Zależy od | Status |
|------|-------|-----------|--------|-----------|--------|
| 001  | Aplikacja aktualizuje swój kod z publicznego repozytorium GitHub | P1 | L | — | BLOCKED (kod gotowy; krok 8 — publikacja repo i tagu — po stronie operatora) |
| 002  | Osobne fazy pobierania danych i budowy wydruków | P1 | L | 001 | DONE |

Statusy: TODO | IN PROGRESS | DONE | BLOCKED (powód w jednym wierszu) |
REJECTED (powód w jednym wierszu).

## Uwagi o zależnościach

- Kroki 1 i 8 planu 001 są zadaniami operatora: w tym środowisku nie ma `gh`
  ani repozytorium Git, więc wykonawca nie może utworzyć repozytorium ani
  wypchnąć kodu. Krok 1 tworzy puste repo, krok 8 publikuje kod i tag dopiero
  po zakończeniu kroków 2–7.
- Reszta kroków nie zależy od sieci — testy używają wstrzykniętego
  `fetchText` i działają na fixture'ach.

## Rozważone i odrzucone

- **Pełny bundle z GitHub Release jako jedyny kanał**: odrzucony na razie —
  waży ~760 MB i aktualizuje też binaria, których poprawki kodu nie dotyczą.
  Zachowany jako kierunek 3 na przypadek zmiany `minRuntime`.
- **Aktualizacja w działającym procesie Electrona**: odrzucona — `main.js`
  i `preload.js` są już załadowane, co daje mixed state; aktualizator działa
  jako osobny proces wywołany z `URUCHOM.cmd`.
- **Manifest z samymi linkami (bez podpisu i hashy)**: odrzucony — daje
  zdalne wykonanie kodu bez kontroli nad tym, co trafia na urządzenia.
