@echo off
REM ============================================================
REM  f-wall wall projection - internal launcher (do not run directly)
REM  %1 = url suffix ("" = production / "?all" = test, all lit)
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "URL=http://localhost:5174/%~1"

echo.
echo   Starting local server...
start "f-wall-server" /min "runtime\node.exe" "server.mjs"

REM wait until server is ready (up to ~20s)
set /a tries=0
:waitloop
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://localhost:5174 -TimeoutSec 1)^|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if !errorlevel!==0 goto ready
set /a tries+=1
if !tries! geq 20 (
  echo   Server did not start. Check that runtime\node.exe exists.
  goto cleanup
)
timeout /t 1 /nobreak >nul
goto waitloop
:ready
echo   Server ready: %URL%

REM ---- find browser: Chrome first, else Edge (both support kiosk) ----
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined BROWSER (
  echo   Opening in Chrome kiosk fullscreen ^(press Alt+F4 to exit^)...
  "%BROWSER%" --kiosk --start-fullscreen --noerrdialogs --disable-infobars --disable-session-crashed-bubble --overscroll-history-navigation=0 --user-data-dir="%TEMP%\f-wall-chrome" "%URL%"
  goto cleanup
)

set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined BROWSER (
  echo   Chrome not found, opening in Edge kiosk fullscreen...
  "%BROWSER%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --user-data-dir="%TEMP%\f-wall-edge"
  goto cleanup
)

echo   Chrome / Edge not found, opening in default browser ^(not fullscreen^).
echo   Close this window to stop the server.
start "" "%URL%"
pause

:cleanup
REM after browser closes, stop only our own node server (matched by server.mjs in cmdline)
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
endlocal
