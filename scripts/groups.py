"""Kody grup USOS (Wydział Psychologii UKW) + adresy stron wydziału.

Sprawdzenie aktualnych kodów:
- stacjonarne:   https://psychologia.ukw.edu.pl/jednostka/wydzial_psychologii_/stacjonarne_psychologia
- niestacjonarne: https://psychologia.ukw.edu.pl/jednostka/wydzial_psychologii_/niestacjonarne_psychologia

`key`   – nazwa pliku HTML (html/<key>.html) i klucz w plan.json
`label` – opis roku/specjalności pokazywany w raportach
`grupa` – parametr grupa_kod
`cykl`  – parametr cdyd_kod (2026Z = semestr zimowy 2026/27, 2026 = cały rok)
"""

USOS = 'https://usosweb.ukw.edu.pl/kontroler.php'
PLAN_ACTION = 'katalog2/przedmioty/pokazPlanGrupyPrzedmiotow'

GROUPS = [
    # --- studia stacjonarne -------------------------------------------------
    dict(key='SJ-I', label='I rok', folder='stacjonarne', grupa='SJ-Ps-11', cykl='2026Z'),
    dict(key='SJ-II', label='II rok', folder='stacjonarne', grupa='SJ-Ps-23', cykl='2026Z'),
    dict(key='SJ-III', label='III rok', folder='stacjonarne', grupa='SJ-Ps-35', cykl='2026Z'),
    dict(key='SJ-IV-kliniczna', label='IV rok - kliniczna', folder='stacjonarne', grupa='SJ-Ps-K-47', cykl='2026Z'),
    dict(key='SJ-IV-wspomaganie', label='IV rok - wspomaganie rozwoju', folder='stacjonarne', grupa='SJ-Ps-W-47', cykl='2026Z'),
    dict(key='SJ-IV-spoleczna', label='IV rok - spoleczna', folder='stacjonarne', grupa='SJ-Ps-S-47', cykl='2026Z'),
    dict(key='SJ-IV-zdrowia', label='IV rok - zdrowia', folder='stacjonarne', grupa='SJ-Ps-Z-47', cykl='2026Z'),
    dict(key='SJ-V-spoleczna', label='V rok - spoleczna', folder='stacjonarne', grupa='SJ-Ps-S-59', cykl='2026Z'),
    dict(key='SJ-V-kliniczna', label='V rok - kliniczna', folder='stacjonarne', grupa='SJ-Ps-K-59', cykl='2026Z'),
    dict(key='SJ-V-wspomaganie', label='V rok - wspomaganie rozwoju', folder='stacjonarne', grupa='SJ-Ps-W-59', cykl='2026Z'),
    dict(key='SJ-V-zdrowia', label='V rok - zdrowia', folder='stacjonarne', grupa='SJ-Ps-Z-59', cykl='2026Z'),
    # --- studia niestacjonarne ---------------------------------------------
    dict(key='NJ-I', label='I rok', folder='niestacjonarne', grupa='NJ-Ps-1', cykl='2026'),
    dict(key='NJ-II', label='II rok', folder='niestacjonarne', grupa='NJ-Ps-2', cykl='2026'),
    dict(key='NJ-III', label='III rok', folder='niestacjonarne', grupa='NJ-Ps-3', cykl='2026'),
    dict(key='NJ-IV-kliniczna', label='IV rok - kliniczna', folder='niestacjonarne', grupa='NJ-Ps-K-4', cykl='2026'),
    dict(key='NJ-IV-wspomaganie', label='IV rok - wspomaganie rozwoju', folder='niestacjonarne', grupa='NJ-Ps-W-4', cykl='2026'),
    dict(key='NJ-IV-zdrowia', label='IV rok - zdrowia', folder='niestacjonarne', grupa='NJ-Ps-Z-4', cykl='2026'),
    dict(key='NJ-IV-spoleczna', label='IV rok - spoleczna', folder='niestacjonarne', grupa='NJ-Ps-S-4', cykl='2026'),
    dict(key='NJ-V-kliniczna', label='V rok - kliniczna', folder='niestacjonarne', grupa='NJ-Ps-K-5', cykl='2026'),
    dict(key='NJ-V-wspomaganie', label='V rok - wspomaganie rozwoju', folder='niestacjonarne', grupa='NJ-Ps-W-5', cykl='2026'),
    dict(key='NJ-V-zdrowia', label='V rok - zdrowia', folder='niestacjonarne', grupa='NJ-Ps-Z-5', cykl='2026'),
    dict(key='NJ-V-biznesu', label='V rok - biznesu', folder='niestacjonarne', grupa='NJ-Ps-B-5', cykl='2026'),
    dict(key='NJ-V-spoleczna', label='V rok - spoleczna', folder='niestacjonarne', grupa='NJ-Ps-S-5', cykl='2026'),
]


def plan_url(g, division='semester'):
    """Publiczny adres wybranego wariantu planu grupy (bez logowania)."""
    return (f"{USOS}?_action={PLAN_ACTION}"
            f"&grupa_kod={g['grupa']}&cdyd_kod={g['cykl']}"
            f"&plan_division={division}")
