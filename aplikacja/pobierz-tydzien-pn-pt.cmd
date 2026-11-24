@echo off
chcp 65001 >nul
cd /d "%~dp0.."
if exist "%~dp0..\runtime\_env.cmd" call "%~dp0..\runtime\_env.cmd"
python scripts\fetch_week_pon_pt.py
pause
