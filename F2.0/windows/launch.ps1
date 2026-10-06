$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\display.ps1"
    $root = Split-Path $PSScriptRoot -Parent
    $settingsPath = Join-Path $PSScriptRoot 'settings.json'
    if (-not (Test-Path $settingsPath)) { throw 'Run Install-F.cmd first to select the two displays.' }
    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
    if ($settings.mode -notin @('live','sim')) { throw 'Invalid mode in windows/settings.json.' }
    $displays = Get-FDisplays
    $tableDisplay = @($displays | Where-Object DeviceName -eq $settings.tableDisplay)
    $wallDisplay = @($displays | Where-Object DeviceName -eq $settings.wallDisplay)
    if ($tableDisplay.Count -ne 1 -or $wallDisplay.Count -ne 1 -or $settings.tableDisplay -eq $settings.wallDisplay) {
        throw 'Connect both displays in Extend mode, or run Install-F.cmd again to select displays.'
    }
    $browser = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $browser) { throw 'Install Microsoft Edge or Google Chrome first.' }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $runtime = Join-Path $env:LOCALAPPDATA 'FZone'
    New-Item -ItemType Directory -Force $runtime | Out-Null
    $mutex = New-Object System.Threading.Mutex($false, 'Local\FZoneLaunch')
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { Write-Host 'F Zone is already starting.'; exit 0 }
    function Get-Health {
        try { return Invoke-RestMethod 'http://127.0.0.1:6273/health' -TimeoutSec 2 } catch { return $null }
    }
    $health = Get-Health
    if (-not $health) {
        # Do not inherit a developer's alternate port setting into the exhibition launcher.
        $env:F_PORT_BASE = '6273'
        $arguments = @(('"' + (Join-Path $root 'server\index.mjs') + '"'), ('--' + $settings.mode))
        if ($settings.mode -eq 'live') { $arguments += '--no-sim' }
        $server = Start-Process $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $runtime 'server.log') -RedirectStandardError (Join-Path $runtime 'server-error.log')
        for ($i=0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 500
            $server.Refresh()
            if ($server.HasExited) { throw "Server stopped. Check $runtime\server-error.log" }
            $health = Get-Health
            if ($health) { break }
        }
    }
    if (-not $health -or $health.app -ne 'f-control-tower') { throw 'F Zone server is unavailable, or port 6273 is occupied by an older/different server.' }
    if ($health.mode -ne $settings.mode -or ($settings.mode -eq 'live' -and $health.sim)) {
        throw 'A server with a different mode is already running. Close it before launching this configuration.'
    }
    foreach ($port in @(6274,6275)) {
        $other = Invoke-RestMethod "http://127.0.0.1:$port/health" -TimeoutSec 2
        if ($other.app -ne 'f-control-tower') { throw "F Zone endpoint $port is unavailable." }
    }
    foreach ($view in @(
        @{ role='table'; port=6273; display=$tableDisplay[0] },
        @{ role='wall'; port=6274; display=$wallDisplay[0] }
    )) {
        $profile = Join-Path $runtime ('browser-' + $view.role)
        $handle = Find-FWindow $profile
        if ($handle -eq [IntPtr]::Zero) {
            $url = 'http://localhost:' + $view.port + '/' + $view.role + '?projection&exhibition'
            $bounds = $view.display.Bounds
            $argsList = @(('--user-data-dir="' + $profile + '"'), ('--app="' + $url + '"'),
                '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
                "--window-position=$($bounds.X),$($bounds.Y)", "--window-size=$($bounds.Width),$($bounds.Height)")
            Start-Process $browser -ArgumentList $argsList | Out-Null
            for ($i=0; $i -lt 40; $i++) {
                Start-Sleep -Milliseconds 250
                $handle = Find-FWindow $profile
                if ($handle -ne [IntPtr]::Zero) { break }
            }
        }
        if ($handle -eq [IntPtr]::Zero) { throw "Cannot find the $($view.role) window. Close its F Zone window and try again." }
        Set-FWindow $handle $view.display
    }
    Write-Host 'Wall and Table are open. iPad addresses (use the exhibition LAN adapter):'
    Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host "  http://$($_.IPAddress):6275/ipad" }
    Start-Sleep -Seconds 3
} catch {
    Write-Host "F Zone: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
