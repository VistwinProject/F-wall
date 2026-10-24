@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node.exe" scripts\check-release.mjs
if errorlevel 1 goto fail
"%~dp0runtime\node.exe" --test tests/*.test.mjs
if errorlevel 1 goto fail
"%~dp0runtime\node.exe" tests\ipad-insights.mjs
if errorlevel 1 goto fail
echo F checks passed.
pause
exit /b 0
:fail
echo F checks failed. Save this output for Codex.
pause
exit /b 1
