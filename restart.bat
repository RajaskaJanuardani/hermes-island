@echo off
taskkill /f /im electron.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
echo Dynamic Island restarted!
