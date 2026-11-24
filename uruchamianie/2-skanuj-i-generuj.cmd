@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0.."

pushd "%ROOT%"
if errorlevel 1 goto :root_error
if exist "%~dp0..\runtime\_env.cmd" call "%~dp0..\runtime\_env.cmd"

echo [1/3] Sprawdzanie wymaganych programow i pakietow...
call "%~dp01-sprawdz-wymagania.cmd" --no-pause
if errorlevel 2 goto :runtime_installed
if errorlevel 1 goto :failed

echo.
echo [2/3] Pobieranie planow i generowanie planow sal...
call "%ROOT%\run-all.cmd"
if errorlevel 1 goto :failed

echo.
echo [3/3] Generowanie dodatkowych wydrukow PNG i PDF...
call "%ROOT%\drukuj-sale-pon-pt.cmd"
if errorlevel 1 goto :failed
call "%ROOT%\drukuj-grupy-weekend.cmd"
if errorlevel 1 goto :failed

echo.
echo Gotowe. Pliki sa w katalogach out\a4\ oraz out\druk\.
popd
if /i not "%~1"=="--no-pause" pause
exit /b 0

:root_error
echo [BLAD] Nie mozna otworzyc folderu projektu. Skopiuj caly folder projektu.
pause
exit /b 1

:runtime_installed
echo.
echo Python lub Node.js zostal zainstalowany. Uruchom ten skrypt ponownie w nowym oknie.
popd
if /i not "%~1"=="--no-pause" pause
exit /b 2

:failed
echo.
echo [BLAD] Przerwano generowanie. Sprawdz komunikat powyzej.
popd
pause
exit /b 1
