@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist "%~dp0runtime\_env.cmd" call "%~dp0runtime\_env.cmd"

where python >nul 2>nul || (echo [BLAD] Brak Pythona w PATH. & exit /b 1)
where node   >nul 2>nul || (echo [BLAD] Brak Node.js w PATH. & exit /b 1)

if not exist node_modules\playwright (
  echo Instaluje Playwright ^(tylko pierwszy raz^)...
  call npm install --no-audit --no-fund || goto :err
  call npx playwright install chromium || goto :err
)
python -c "import PIL" 2>nul || (
  echo Instaluje Pillow...
  python -m pip install -r requirements.txt || goto :err
)

echo [1/10] Plany semestralne i tydzień (USOS)
python scripts\fetch.py --only-changed || goto :err
echo [2/10] Bieżący tydzień Pon–Pt
python scripts\fetch_week_pon_pt.py --only-changed || goto :err
echo [3/10] Parsowanie danych
python scripts\parse.py || goto :err
echo [4/10] Plansze sal
python scripts\build_rooms.py || goto :err
echo [5/10] PNG sal
node scripts\shot_rooms.js || goto :err
echo [6/10] Kartki A4
python scripts\build_sheets.py || goto :err
echo [7/10] PNG kartek A4
node scripts\sheets.js || goto :err
echo [8/10] PDF do druku
python scripts\to_pdf.py || goto :err
echo [9/10] Wydruk grup weekendowych
node scripts\print-additional.js groups || goto :err
echo [10/10] Kontrola jakości
python scripts\verify.py || goto :err

echo.
echo Gotowe. PDF: out\a4\pdf\
start "" "out\a4\pdf"
exit /b 0

:err
echo.
echo [BLAD] Przerwano - sprawdz komunikat powyzej.
exit /b 1
