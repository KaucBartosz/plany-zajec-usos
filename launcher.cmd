@echo off
setlocal
chcp 65001 >nul
call "%~dp0runtime\_env.cmd"
cd /d "%PLANER_ROOT%"

if not exist plan.json (
  echo Brak danych. Uruchom aplikacje i uzyj zakladki "Pobieranie danych".
)

if not "%PLANER_NO_UPDATE%"=="1" (
  if exist "%PLANER_ROOT%\runtime\node\node.exe" (
    "%PLANER_ROOT%\runtime\node\node.exe" "%PLANER_ROOT%\aplikacja\src\main\update.js" --auto
  )
)

start "" "%PLANER_ROOT%\aplikacja\node_modules\electron\dist\electron.exe" "%PLANER_ROOT%\aplikacja"
exit /b 0
