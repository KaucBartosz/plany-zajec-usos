@echo off
setlocal
chcp 65001 >nul
call "%~dp0runtime\_env.cmd"
cd /d "%PLANER_ROOT%"

if not exist plan.json (
  echo Pierwsze uruchomienie: pobieranie i generowanie planow...
  call "%PLANER_ROOT%\run-all.cmd" || goto :err
)

if not "%PLANER_NO_UPDATE%"=="1" (
  if exist "%PLANER_ROOT%\runtime\node\node.exe" (
    "%PLANER_ROOT%\runtime\node\node.exe" "%PLANER_ROOT%\aplikacja\src\main\update.js" --auto
  )
)

start "" "%PLANER_ROOT%\aplikacja\node_modules\electron\dist\electron.exe" "%PLANER_ROOT%\aplikacja"
exit /b 0

:err
echo [BLAD] Nie udalo sie wygenerowac danych. Uruchom run-all.cmd, aby zobaczyc blad.
exit /b 1
