@echo off
setlocal
set "SPAWNER_SCRIPT=%~dp0hosting\start-local.ps1"
set "SPAWNER_PWSH="
for /f "delims=" %%P in ('where pwsh.exe 2^>nul') do if not defined SPAWNER_PWSH set "SPAWNER_PWSH=%%P"
if not defined SPAWNER_PWSH if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "SPAWNER_PWSH=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined SPAWNER_PWSH if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe" set "SPAWNER_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not defined SPAWNER_PWSH goto missing_powershell
if not exist "%SPAWNER_SCRIPT%" goto missing_script
"%SPAWNER_PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%SPAWNER_SCRIPT%" %*
if errorlevel 1 goto failed
exit /b 0

:missing_powershell
echo ENV^> POWERSHELL 7 IS REQUIRED.
pause
exit /b 1

:missing_script
echo ENV^> SPAWNER LAUNCHER WAS NOT FOUND.
pause
exit /b 1

:failed
set "spawner_exit=%errorlevel%"
echo SYSTEM^> SPAWNER START FAILED.
pause
exit /b %spawner_exit%
