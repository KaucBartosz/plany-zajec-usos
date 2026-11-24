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

echo.
echo [1/8] Pobieranie planow z USOSweb...
python scripts\fetch.py || goto :err
echo [2/8] Parsowanie HTML -^> plan.json...
python scripts\parse.py || goto :err
echo [3/8] Budowa plansz sal...
python scripts\build_rooms.py || goto :err
echo [4/8] Zrzuty PNG pojedynczych sal...
node scripts\shot_rooms.js || goto :err
echo [5/8] Kartki A4 (pomiar + pakowanie)...
python scripts\build_sheets.py || goto :err
echo [6/8] Zrzuty kartek A4...
node scripts\sheets.js || goto :err
echo [7/8] PDF do druku...
python scripts\to_pdf.py || goto :err
echo [8/8] Wydruk grup weekendowych...
node scripts\print-additional.js groups || goto :err

echo.
python scripts\verify.py
echo.
echo Gotowe. PDF: out\a4\pdf\
start "" "out\a4\pdf"
exit /b 0

:err
echo.
echo [BLAD] Przerwano - sprawdz komunikat powyzej.
exit /b 1
