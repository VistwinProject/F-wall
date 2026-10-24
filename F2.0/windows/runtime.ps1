$root = Split-Path $PSScriptRoot -Parent
$node = Join-Path $root 'runtime\node.exe'
if (-not (Test-Path $node)) { throw 'Missing Windows offline runtime/node.exe. Use the complete Windows x64 offline package.' }
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))).Replace('-','').Substring(0,12)
$sha.Dispose()
$instance = 'f-win-' + $hash
$runtime = Join-Path $env:LOCALAPPDATA ('FZone-' + $hash)
New-Item -ItemType Directory -Force $runtime | Out-Null
