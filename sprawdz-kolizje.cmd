@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if exist "%~dp0runtime\_env.cmd" call "%~dp0runtime\_env.cmd"
python scripts\check_conflicts.py
exit /b %ERRORLEVEL%
