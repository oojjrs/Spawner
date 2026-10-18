@echo off
setlocal
set "SPAWNER_SCRIPT=%~dp0Start-Server.ps1"
set "PWSH="
for /f "delims=" %%P in ('where pwsh.exe 2^>nul') do if not defined PWSH set "PWSH=%%P"
if not defined PWSH if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "PWSH=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined PWSH if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" set "PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not defined PWSH (
    echo PowerShell 7 was not found.
    pause
    exit /b 1
)
"%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%SPAWNER_SCRIPT%"
if errorlevel 1 (
    echo Spawner could not start. See the error above.
    pause
    exit /b 1
)
endlocal
