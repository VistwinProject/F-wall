$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\runtime.ps1"
    . "$PSScriptRoot\health.ps1"
    $file = Write-FDiagnostics
    Write-Host "Report saved: $file"
    Start-Process notepad.exe -ArgumentList ('"' + $file + '"')
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
Read-Host 'Press Enter to close'
