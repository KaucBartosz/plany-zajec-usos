"""Ustawienia całego procesu.

To jedyne miejsce, w którym zmieniasz budynek, semestr i wygląd arkuszy.
Kody grup (grupa_kod / cykl) są w `groups.py`.
"""

# --- Co generujemy -----------------------------------------------------------
BUILDING = '009'                       # numer budynku; sale spoza niego są pomijane
FACULTY = 'Wydział Psychologii UKW'
SEMESTER = 'semestr zimowy 2026/2027'

# --- Wygląd --------------------------------------------------------------
# Sale, dla których arkusz Sb–Nd pokazuje TYLKO prowadzącego i godzinę
# (bez typów, grup, legendy) — używane, gdy w weekendy jest bardzo gęsto.
ULTRA_ROOMS = {'301', '302', '405', '406', '407'}
# Sale, których arkusz Sb–Nd nie dostaje legendy (stopka).
NO_FOOT_ROOMS = {'301', '302', '405', '406', '407'}

# --- Kartki A4 (landscape) -------------------------------------------------
CARDW = 1400        # szerokość kartki w px CSS
TARGETH = 990       # docelowa wysokość = A4 landscape
BUDGET = 950        # ile px wolno zużyć na sekcje (reszta: tytuł + legenda)
SEG_GAP = 16        # odstęp między sekcjami przy pakowaniu

# --- PDF -------------------------------------------------------------------
PDF_W, PDF_H = 3508, 2480   # A4 landscape @ 300 dpi
PDF_DPI = 300.0
PDF_NAME = 'plany-sal-bud-{building}.pdf'
