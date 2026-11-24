"""Lokalne nadpisania katalogu grup.

Domyślna lista (`GROUPS`, `USOS`, `PLAN_ACTION`, `plan_url`) jest w
`groups_default.py` i podlega aktualizacjom. Ten plik pozostaje lokalny —
możesz tu np. usunąć niepotrzebne grupy:

    GROUPS = [g for g in GROUPS if not g['key'].startswith('SJ-V')]
"""
from groups_default import *  # noqa: F401,F403
