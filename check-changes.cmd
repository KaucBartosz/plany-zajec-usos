@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist "%~dp0runtime\_env.cmd" call "%~dp0runtime\_env.cmd"

echo Sprawdzam, czy plany w USOSweb roznia sie od pobranych...
echo.
python scripts\fetch.py --check
if errorlevel 1 (
  echo.
  echo SA ZMIANY / BLEDY - sprawdz raport html\week\changes.json.
  echo Zmiany planow semestralnych: uruchom run-all.cmd, aby przebudowac plany.
  exit /b 1
)
echo.
echo Wszystkie plany aktualne - nic nie trzeba robic.
exit /b 0
