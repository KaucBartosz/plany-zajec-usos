@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist "%~dp0runtime\_env.cmd" call "%~dp0runtime\_env.cmd"

where python >nul 2>nul || (echo [BLAD] Brak Pythona w PATH. & exit /b 1)
where node >nul 2>nul || (echo [BLAD] Brak Node.js w PATH. & exit /b 1)
if not exist node_modules\playwright (
  echo [BLAD] Brak Playwright. Uruchom najpierw run-all.cmd.
  exit /b 1
)
echo Odswiezam dane z USOSweb...
python scripts\fetch.py || exit /b 1
python scripts\parse.py || exit /b 1
node scripts\print-additional.js groups || exit /b 1
start "" "out\druk\grupy-weekend"
