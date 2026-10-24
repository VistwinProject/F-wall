# Called by setup and direct launch, before hardware checks.
function New-FDesktopShortcuts {
    $packageRoot = Split-Path $PSScriptRoot -Parent
    $desktop = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell
    foreach ($action in @('Start','Stop')) {
        $shortcut = $shell.CreateShortcut((Join-Path $desktop ($action + ' F.lnk')))
        $shortcut.TargetPath = Join-Path $packageRoot ($action + '-F.cmd')
        $shortcut.WorkingDirectory = $packageRoot
        $shortcut.Description = $action + ' Final_F Wall, Table and Graph'
        $shortcut.Save()
    }
}
