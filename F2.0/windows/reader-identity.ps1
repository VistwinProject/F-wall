# Bind logical positions to confirmed Windows USB device instances, not PC/SC names.
function Get-FReaderIdentities {
    if (-not ('FReaderIdentityNative' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class FReaderIdentityNative {
 [DllImport("winscard.dll")] public static extern int SCardEstablishContext(uint scope,IntPtr a,IntPtr b,out IntPtr ctx);
 [DllImport("winscard.dll",CharSet=CharSet.Unicode,ExactSpelling=true)] public static extern int SCardListReadersW(IntPtr ctx,string groups,[Out] char[] readers,ref uint size);
 [DllImport("winscard.dll",CharSet=CharSet.Unicode,ExactSpelling=true)] public static extern int SCardGetReaderDeviceInstanceIdW(IntPtr ctx,string reader,StringBuilder id,ref uint size);
 [DllImport("winscard.dll")] public static extern int SCardReleaseContext(IntPtr ctx);
}
'@
    }
    $context = [IntPtr]::Zero
    $result = [FReaderIdentityNative]::SCardEstablishContext(2,[IntPtr]::Zero,[IntPtr]::Zero,[ref]$context)
    if ($result -ne 0) { throw "NFC identity: cannot open Smart Card service ($result)." }
    try {
        [uint32]$length = 0
        $result = [FReaderIdentityNative]::SCardListReadersW($context,$null,$null,[ref]$length)
        if ($result -ne 0) { throw "NFC identity: cannot list readers ($result)." }
        $chars = New-Object char[] $length
        $result = [FReaderIdentityNative]::SCardListReadersW($context,$null,$chars,[ref]$length)
        if ($result -ne 0) { throw "NFC identity: cannot list readers ($result)." }
        foreach ($name in ((-join $chars) -split [char]0)) {
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            $buffer = [Text.StringBuilder]::new(1024)
            [uint32]$size = 1024
            $result = [FReaderIdentityNative]::SCardGetReaderDeviceInstanceIdW($context,$name,$buffer,[ref]$size)
            if ($result -ne 0) { throw "NFC identity: cannot identify reader '$name' ($result)." }
            [pscustomobject]@{ reader=$name; deviceInstance=$buffer.ToString() }
        }
    } finally { [void][FReaderIdentityNative]::SCardReleaseContext($context) }
}

function Resolve-FReaderIdentityMap {
    param([object[]]$Bindings,[object[]]$Readers)
    if ($Bindings.Count -ne 9) { throw 'NFC identity: exactly nine confirmed bindings are required.' }
    $slots = @{}; $identities = @{}
    foreach ($binding in $Bindings) {
        if (($binding.slot -isnot [int] -and $binding.slot -isnot [long]) -or $binding.slot -lt 1 -or $binding.slot -gt 9 -or $slots.ContainsKey([int]$binding.slot)) {
            throw 'NFC identity: invalid or duplicate logical position.'
        }
        if ([string]::IsNullOrWhiteSpace($binding.deviceInstance) -or $identities.ContainsKey($binding.deviceInstance)) {
            throw 'NFC identity: invalid or duplicate USB identity.'
        }
        $slots[[int]$binding.slot] = $true
        $identities[$binding.deviceInstance] = [int]$binding.slot
    }
    $mapping = [ordered]@{}; $seen = @{}
    foreach ($reader in $Readers) {
        if (-not $identities.ContainsKey($reader.deviceInstance)) {
            # Unrelated smart-card readers are harmless; unknown exhibition readers are not.
            if ($reader.deviceInstance -like 'USB\VID_072F&PID_2200\*') { throw 'NFC identity: USB wiring changed or an unconfirmed ACR122 reader is connected. Reconfirm physical positions; no mapping was changed.' }
            continue
        }
        if ([string]::IsNullOrWhiteSpace($reader.reader) -or $mapping.Contains($reader.reader) -or $seen.ContainsKey($reader.deviceInstance)) {
            throw 'NFC identity: duplicate or invalid active reader identity.'
        }
        $mapping[$reader.reader] = $identities[$reader.deviceInstance]
        $seen[$reader.deviceInstance] = $true
    }
    if ($mapping.Count -ne 9) { throw 'NFC identity: one or more confirmed readers are missing. Check USB power/cables; no mapping was changed.' }
    return $mapping
}

function Sync-FReaderIdentityMap {
    param([string]$Root)
    $identityPath = Join-Path $Root 'server\reader-identities.json'
    if (-not (Test-Path -LiteralPath $identityPath)) { throw 'NFC identity: confirmed reader-identities.json is missing; refusing to guess positions.' }
    $config = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
    if ($config.version -ne 1) { throw 'NFC identity: unsupported binding version.' }
    $readers = @(Get-FReaderIdentities)
    $mapping = Resolve-FReaderIdentityMap -Bindings @($config.bindings) -Readers $readers
    $mapPath = Join-Path $Root 'server\reader-map.json'
    $same = $false
    if (Test-Path -LiteralPath $mapPath) {
        $existing = Get-Content -LiteralPath $mapPath -Raw | ConvertFrom-Json
        $properties = @($existing.PSObject.Properties)
        $same = $properties.Count -eq 9
        foreach ($entry in $mapping.GetEnumerator()) {
            if ($existing.PSObject.Properties.Name -notcontains $entry.Key -or $existing.($entry.Key) -ne $entry.Value) { $same = $false }
        }
    }
    if (-not $same) {
        $temporary = $mapPath + '.identity-' + [guid]::NewGuid().ToString('N') + '.tmp'
        try {
            [IO.File]::WriteAllText($temporary,($mapping | ConvertTo-Json),[Text.UTF8Encoding]::new($false))
            Move-Item -LiteralPath $temporary -Destination $mapPath -Force
        } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary } }
    }
    Write-Host 'NFC: 9 confirmed USB identities matched; physical positions preserved.'
}
