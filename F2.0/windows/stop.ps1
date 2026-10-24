param([switch]$CloseDisplaysFirst)
$ErrorActionPreference = 'Stop'
function Close-FDisplays {
    foreach ($role in @('table','wall','graph')) {
        $profile = Join-Path $runtime ('browser-' + $role)
        Get-CimInstance Win32_Process | Where-Object {
            $_.Name -in @('msedge.exe','chrome.exe') -and $_.CommandLine -and $_.CommandLine.Contains($profile) -and $_.CommandLine -notmatch '--type='
        } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
    }
}
try {
    . "$PSScriptRoot\runtime.ps1"
    . "$PSScriptRoot\health.ps1"
    # Escape is launched by the server. Close windows before the parent exits.
    if ($CloseDisplaysFirst) { Close-FDisplays }
    # Request graceful server shutdown so configured lights are sent off.
    $pidFile = Join-Path $runtime 'server.pid'
    if (Test-Path $pidFile) {
        $serverPid = [int](Get-Content $pidFile -Raw)
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
        if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains((Join-Path $root 'server\index.mjs'))) {
            $response = Get-FHealth 6273
            if ($response -and $response.instance -ne $instance) { throw 'The running F server belongs to another installation.' }
            # A local stop-file is scoped to this installation, never a public HTTP shutdown endpoint.
            Set-Content (Join-Path $runtime 'stop-request') $instance -Encoding ASCII
            for ($i=0; $i -lt 40; $i++) {
                if (-not (Get-Process -Id $serverPid -ErrorAction SilentlyContinue)) { break }
                Start-Sleep -Milliseconds 250
            }
            if (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) {
                # Only recover this package's previously verified process, never another port owner.
                $stillOwned = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid"
                if (-not $response -and $stillOwned -and $stillOwned.Name -eq 'node.exe' -and $stillOwned.CommandLine.Contains((Join-Path $root 'server\index.mjs'))) {
                    Stop-Process -Id $serverPid
                    Write-Host "Stopped this installation's unresponsive server. Verify any connected lights manually." -ForegroundColor Yellow
                } else { throw 'Graceful stop timed out; check server log and light state.' }
            }
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }
    Close-FDisplays
    Write-Host 'F Zone stopped. Browser calibration and reader mappings were preserved.'
} catch {
    Write-Host "F Zone: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
