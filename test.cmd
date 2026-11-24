@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist "%~dp0runtime\_env.cmd" call "%~dp0runtime\_env.cmd"
python -m unittest discover -s tests -v
exit /b %ERRORLEVEL%
