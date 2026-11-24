@echo off
setlocal
chcp 65001 >nul
set "ROOT=%~dp0.."
set "RUNTIME_INSTALLED=0"

pushd "%ROOT%"
if errorlevel 1 goto :root_error
if exist "%~dp0..\runtime\_env.cmd" call "%~dp0..\runtime\_env.cmd"

where python >nul 2>nul
if errorlevel 1 call :install_python
if errorlevel 1 goto :failed

where node >nul 2>nul
if errorlevel 1 call :install_node
if errorlevel 1 goto :failed

if "%RUNTIME_INSTALLED%"=="1" goto :restart_required

python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)"
if errorlevel 1 goto :python_old

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"
if errorlevel 1 goto :node_old

where npm >nul 2>nul
if errorlevel 1 goto :npm_missing
if not exist requirements.txt goto :project_files_missing
if not exist package.json goto :project_files_missing

python -m pip --version >nul 2>nul
if errorlevel 1 (
  echo Instalowanie pip...
  python -m ensurepip --upgrade
  if errorlevel 1 goto :failed
)

python -c "import PIL" >nul 2>nul
if errorlevel 1 (
  echo Instalowanie pakietow Pythona...
  python -m pip install -r requirements.txt
  if errorlevel 1 goto :failed
)

node -e "require('playwright')" >nul 2>nul
if errorlevel 1 (
  echo Instalowanie zaleznosci Node.js...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
)

node -e "const fs=require('fs'); const {chromium}=require('playwright'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
  echo Instalowanie przegladarki Chromium dla Playwright...
  call npx playwright install chromium
  if errorlevel 1 goto :failed
)

echo Wymagania sa gotowe.
popd
if /i not "%~1"=="--no-pause" pause
exit /b 0

:install_python
where winget >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Brak Pythona i winget. Zainstaluj App Installer ze sklepu Microsoft Store.
  exit /b 1
)
echo Brak Pythona. Instalowanie Python 3.13 przez winget...
call winget install --id Python.Python.3.13 --exact --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 exit /b 1
set "RUNTIME_INSTALLED=1"
exit /b 0

:install_node
where winget >nul 2>nul
if errorlevel 1 (
  echo [BLAD] Brak Node.js i winget. Zainstaluj App Installer ze sklepu Microsoft Store.
  exit /b 1
)
echo Brak Node.js. Instalowanie Node.js LTS przez winget...
call winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 exit /b 1
set "RUNTIME_INSTALLED=1"
exit /b 0

:restart_required
echo.
echo Uzyj polecenia ponownie, aby sprawdzic zaleznosci po instalacji Python/Node.js.
popd
if /i not "%~1"=="--no-pause" pause
exit /b 2

:python_old
echo [BLAD] Wymagany jest Python 3.10 lub nowszy.
goto :fail

:node_old
echo [BLAD] Wymagany jest Node.js 18 lub nowszy.
goto :fail

:npm_missing
echo [BLAD] Brak npm. Zainstaluj pelna wersje Node.js 18 lub nowsza.
goto :fail

:project_files_missing
echo [BLAD] Brakuje package.json lub requirements.txt. Skopiuj caly folder projektu.
goto :fail

:root_error
echo [BLAD] Nie mozna otworzyc folderu projektu.
pause
exit /b 1

:failed
echo [BLAD] Nie udalo sie przygotowac zaleznosci.

:fail
popd
pause
exit /b 1
