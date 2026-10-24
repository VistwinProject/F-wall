$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\shortcuts.ps1"
    New-FDesktopShortcuts
    . "$PSScriptRoot\display.ps1"
    . "$PSScriptRoot\runtime.ps1"
    Set-Location $root
    Write-Host 'F Zone - Windows x64 offline setup (Wall / Table / Graph)'
    & $node -e "require('nfc-pcsc');require('ws');console.log('Bundled Windows NFC module OK')"
    if ($LASTEXITCODE -ne 0) { throw 'Bundled native module failed. Use the Windows x64 package and verify prerequisites.' }
    if (-not (Test-Path (Join-Path $root 'public\graph\index.html'))) { throw 'Missing Graph assets.' }
    if (-not (Test-Path (Join-Path $root 'server\led-settings.json'))) {
        Copy-Item (Join-Path $root 'server\led-settings.example.json') (Join-Path $root 'server\led-settings.json')
    }
    $displays = @(Get-FDisplays)
    $displays | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $runtime 'display-detection.json') -Encoding UTF8
    if ($displays.Count -lt 3) { throw 'Connect three displays and choose Extend in Windows Display Settings.' }
    for ($i=0; $i -lt $displays.Count; $i++) {
        $d=$displays[$i]
        Write-Host "$i : $($d.FriendlyName) [$($d.Manufacturer)] / $($d.DeviceName) / $($d.Bounds.Width)x$($d.Bounds.Height) / X=$($d.Bounds.X), Y=$($d.Bounds.Y) / Primary=$($d.Primary)"
    }
    try {
        $roles=Resolve-FDisplayRoles $displays ([pscustomobject]@{})
        Write-Host "Auto detected: Wall=$($roles.wall.name), Table=$($roles.table.name), Graph=$($roles.graph.name)"
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Yellow
        # One-time binding for projectors whose EDID does not contain their brand.
        $tableIndex = [int](Read-Host 'Table (JMGO) display index from the list above')
        $wallIndex = [int](Read-Host 'Wall (Acer) display index from the list above')
        $graphIndex = [int](Read-Host 'Graph TV display index from the list above')
        $indexes = @($tableIndex,$wallIndex,$graphIndex)
        if (($indexes | Where-Object { $_ -lt 0 -or $_ -ge $displays.Count }).Count -gt 0 -or ($indexes | Select-Object -Unique).Count -ne 3) { throw 'Select three different display indexes.' }
        $bindings=@{table=$displays[$tableIndex].Identity;wall=$displays[$wallIndex].Identity;graph=$displays[$graphIndex].Identity}
        if (@($bindings.Values | Where-Object { -not $_ }).Count -gt 0) { throw 'Cannot read monitor identity. Check HDMI/EDID and retry.' }
        $roles=Resolve-FDisplayRoles $displays ([pscustomobject]@{displayBindings=$bindings})
    }
    $mode = Read-Host 'Mode: live = NFC hardware, sim = rehearsal (Enter = live)'
    if (-not $mode) { $mode = 'live' }
    if ($mode -notin @('live','sim')) { throw 'Mode must be live or sim.' }
    Save-FDisplaySettings ([pscustomobject]@{mode=$mode}) $roles (Join-Path $PSScriptRoot 'settings.json')
    Write-Host 'Setup complete. Double-click Start F on the desktop.' -ForegroundColor Green
    Write-Host 'Allow Node.js on the Private network if Windows Firewall prompts. See the Windows guide for iPad access.'
    Read-Host 'Press Enter to close'
} catch {
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
