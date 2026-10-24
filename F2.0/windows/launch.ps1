$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\shortcuts.ps1"
    New-FDesktopShortcuts
    . "$PSScriptRoot\runtime.ps1"
    . "$PSScriptRoot\health.ps1"
    . "$PSScriptRoot\display.ps1"
    $settingsPath = Join-Path $PSScriptRoot 'settings.json'
    $settings = if (Test-Path $settingsPath) { Get-Content $settingsPath -Raw | ConvertFrom-Json } else { [pscustomobject]@{mode='live'} }
    if ($settings.mode -notin @('live','sim')) { throw 'Invalid mode in windows/settings.json.' }
    $displays = @(Get-FDisplays)
    $displays | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runtime 'display-detection.json') -Encoding UTF8
    $roles = Resolve-FDisplayRoles $displays $settings
    Set-FFixedOutputs $settings $roles
    # Re-read physical bounds after a mode change; Windows may rearrange origins.
    $displays = @(Get-FDisplays)
    $roles = Resolve-FDisplayRoles $displays $settings
    $displays | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runtime 'display-detection.json') -Encoding UTF8
    Save-FDisplaySettings $settings $roles $settingsPath
    $tableDisplay = @($displays | Where-Object DeviceName -eq $roles.table.deviceName)
    $wallDisplay = @($displays | Where-Object DeviceName -eq $roles.wall.deviceName)
    $graphDisplay = @($displays | Where-Object DeviceName -eq $roles.graph.deviceName)
    Write-Host "Wall: $($roles.wall.name) / Table: $($roles.table.name) / Graph: $($roles.graph.name)"
    $browser = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $browser) { throw 'Install Microsoft Edge or Google Chrome first.' }
    $mutex = New-Object System.Threading.Mutex($false, ('Local\FZoneLaunch-' + $hash))
    $locked = $mutex.WaitOne(0)
    if (-not $locked) { Write-Host 'F Zone is already starting.'; exit 0 }
    if ($settings.mode -eq 'live') {
        $smartCard = Get-Service SCardSvr -ErrorAction SilentlyContinue
        if (-not $smartCard -or $smartCard.Status -ne 'Running') {
            Write-Host 'Smart Card service is stopped. Displays can open, but NFC needs SCardSvr running. Start it in services.msc; NFC will retry automatically.' -ForegroundColor Yellow
        }
    }
    $health = Get-FHealth
    if (-not $health) {
        $listeners = @(Get-NetTCPConnection -LocalPort 6273,6274,6275 -State Listen -ErrorAction SilentlyContinue)
        if ($listeners.Count -gt 0) {
            $owners = ($listeners | ForEach-Object { "$($_.LocalPort):PID=$($_.OwningProcess)" }) -join ', '
            throw "F ports are already occupied ($owners). Health check: $script:FHealthError. Stop the previous installation first."
        }
        if ($settings.mode -eq 'live') {
            . "$PSScriptRoot\reader-identity.ps1"
            Sync-FReaderIdentityMap -Root $root
        }
        # Do not inherit a developer's alternate port setting into the exhibition launcher.
        $env:F_PORT_BASE = '6273'
        $env:F_BIND_HOST = '0.0.0.0'
        $env:F_LOG_DIR = Join-Path $runtime 'logs'
        $env:F_REQUIRED_DISPLAYS = 'table,wall,graph'
        $env:F_INSTANCE_ID = $instance
        $env:F_WINDOW_CONTROL = '1'
        $env:F_STOP_FILE = Join-Path $runtime 'stop-request'
        Remove-Item $env:F_STOP_FILE -ErrorAction SilentlyContinue
        $env:F_GRAPH_ROOT = Join-Path $root 'public\graph'
        $env:F_LED_CONFIG = Join-Path $root 'server\led-settings.json'
        Remove-Item Env:F_WALL_ROOT,Env:F_IPAD_ROOT -ErrorAction SilentlyContinue
        $arguments = @(('"' + (Join-Path $root 'server\index.mjs') + '"'), ('--' + $settings.mode))
        if ($settings.mode -eq 'live') { $arguments += '--no-sim' }
        $server = Start-Process $node -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $runtime 'server.log') -RedirectStandardError (Join-Path $runtime 'server-error.log')
        $server.Id | Set-Content (Join-Path $runtime 'server.pid')
        for ($i=0; $i -lt 30; $i++) {
            Start-Sleep -Milliseconds 500
            $server.Refresh()
            if ($server.HasExited) { throw "Server stopped. Check $runtime\server-error.log" }
            $health = Get-FHealth
            if ($health) { break }
        }
    }
    if (-not $health -or $health.app -ne 'f-control-tower') { throw "F server health check failed: $script:FHealthError. See the diagnostic report for the server error." }
    if ($health.instance -ne $instance -or -not $health.graphBundled) { throw 'Another or older F server owns the ports. Stop that server before starting this package.' }
    if ($health.mode -ne $settings.mode -or ($settings.mode -eq 'live' -and $health.sim)) {
        throw 'A server with a different mode is already running. Close it before launching this configuration.'
    }
    if (($health.displayStatus.required -join ',') -ne 'table,wall,graph') {
        throw 'Display requirements changed. Stop F Zone and start this package again.'
    }
    foreach ($port in @(6274,6275)) {
        $other = Get-FHealth $port
        if ($other.app -ne 'f-control-tower' -or $other.instance -ne $instance) { throw "F Zone endpoint $port is unavailable." }
    }
    foreach ($view in @(
        @{ role='table'; port=6273; display=$tableDisplay[0] },
        @{ role='wall'; port=6274; display=$wallDisplay[0] },
        @{ role='graph'; port=6273; display=$graphDisplay[0] }
    )) {
        $profile = Join-Path $runtime ('browser-' + $view.role)
        $debugPort = @{table=6283;wall=6284;graph=6285}[$view.role]
        $handle = Find-FWindow $profile
        if ($handle -eq [IntPtr]::Zero) {
            $url = 'http://localhost:' + $view.port + '/' + $view.role + '?projection&exhibition'
            if ($view.role -eq 'graph') { $url = 'http://localhost:6273/graph?ws=ws%3A%2F%2F127.0.0.1%3A6273' }
            $bounds = $view.display.Bounds
            $argsList = @(('--user-data-dir="' + $profile + '"'), ('--app="' + $url + '"'),
                '--no-first-run', '--no-default-browser-check', '--start-fullscreen', '--remote-debugging-address=127.0.0.1', "--remote-debugging-port=$debugPort", '--autoplay-policy=no-user-gesture-required',
                "--window-position=$($bounds.X),$($bounds.Y)", "--window-size=$($bounds.Width),$($bounds.Height)")
            if ($view.role -in @('table','wall')) { $argsList += '--force-device-scale-factor=1' }
            Start-Process $browser -ArgumentList $argsList | Out-Null
            for ($i=0; $i -lt 40; $i++) {
                Start-Sleep -Milliseconds 250
                $handle = Find-FWindow $profile
                if ($handle -ne [IntPtr]::Zero) { break }
            }
        }
        if ($handle -eq [IntPtr]::Zero) { throw "Cannot find the $($view.role) window. Close its F Zone window and try again." }
        Set-FWindow $handle $view.display
        & $node (Join-Path $root 'server\window-control.mjs') $view.role
        if ($LASTEXITCODE -ne 0) { throw 'Cannot enable true browser fullscreen. Stop F, then restart using this updated package.' }
    }
    Write-Host 'Wall, Table and Graph are open. iPad addresses (use the exhibition LAN adapter):'
    Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host "  http://$($_.IPAddress):6275/ipad" }
    Start-Sleep -Seconds 3
} catch {
    Write-Host "F Zone: $($_.Exception.Message)" -ForegroundColor Red
    if (Get-Command Write-FDiagnostics -ErrorAction SilentlyContinue) {
        try {
            $report = Write-FDiagnostics $_.Exception.Message
            Write-Host "Diagnostic report: $report" -ForegroundColor Yellow
            Write-Host 'A copy is saved as F-diagnostics.txt in this package folder.'
            Start-Process notepad.exe -ArgumentList ('"' + $report + '"')
        } catch { Write-Host "Could not write diagnostic report: $($_.Exception.Message)" }
    }
    Read-Host 'Press Enter to close'
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}

