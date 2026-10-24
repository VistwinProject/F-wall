$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
foreach ($file in Get-ChildItem (Join-Path $root 'windows') -Filter '*.ps1') {
    $tokens=$null; $parseErrors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)
    if ($parseErrors.Count) { throw "$($file.Name): $($parseErrors | Out-String)" }
    Write-Host "PASS PowerShell parser: $($file.Name)"
}
