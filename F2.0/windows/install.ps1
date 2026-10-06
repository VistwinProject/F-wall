$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\display.ps1"
    $root = Split-Path $PSScriptRoot -Parent
    Set-Location $root
    Get-Command node.exe -ErrorAction Stop | Out-Null
    Get-Command npm.cmd -ErrorAction Stop | Out-Null
    Write-Host 'F Zone - first-time Windows setup'
    Write-Host 'Install Windows dependencies (do not copy node_modules from a Mac).'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Check Node.js, Python, C++ Build Tools and NFC prerequisites in the Windows guide.' }
    $displays = Get-FDisplays
    if ($displays.Count -lt 2) { throw 'Connect two displays and choose Extend in Windows Display Settings.' }
    for ($i=0; $i -lt $displays.Count; $i++) {
        $d=$displays[$i]
        Write-Host "$i : $($d.DeviceName) / $($d.Bounds.Width)x$($d.Bounds.Height) / X=$($d.Bounds.X), Y=$($d.Bounds.Y) / Primary=$($d.Primary)"
    }
    # These are the list indexes above, not Windows Settings monitor numbers.
    $tableIndex = [int](Read-Host 'Table display index from the list above')
    $wallIndex = [int](Read-Host 'Wall display index from the list above')
    if ($tableIndex -lt 0 -or $tableIndex -ge $displays.Count -or $wallIndex -lt 0 -or $wallIndex -ge $displays.Count -or $tableIndex -eq $wallIndex) {
        throw 'Select two different display indexes from the list.'
    }
    $mode = Read-Host 'Mode: live = NFC hardware, sim = rehearsal (Enter = live)'
    if (-not $mode) { $mode = 'live' }
    if ($mode -notin @('live','sim')) { throw 'Mode must be live or sim.' }
    @{ tableDisplay=$displays[$tableIndex].DeviceName; wallDisplay=$displays[$wallIndex].DeviceName; mode=$mode } |
        ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'settings.json') -Encoding UTF8
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'F Zone.lnk'))
    $shortcut.TargetPath = Join-Path $root 'Start-F.cmd'
    $shortcut.WorkingDirectory = $root
    $shortcut.Description = 'Start F Zone Wall and Table'
    $shortcut.Save()
    Write-Host 'Setup complete. Double-click F Zone on the desktop.' -ForegroundColor Green
    Write-Host 'Allow Node.js on the Private network if Windows Firewall prompts. See the Windows guide for iPad access.'
    Read-Host 'Press Enter to close'
} catch {
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
