function Get-FHealth([int]$Port=6273) {
    $script:FHealthError = ''
    try {
        $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/health")
        $request.Proxy = $null
        $request.Timeout = 2000
        $request.ReadWriteTimeout = 2000
        $request.KeepAlive = $false
        $response = $null; $reader = $null
        try {
            $response = $request.GetResponse()
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            $health = $reader.ReadToEnd() | ConvertFrom-Json
            if ($health.app -ne 'f-control-tower') { throw 'Port responds, but is not this F server.' }
            return $health
        } finally {
            if ($reader) { $reader.Dispose() }
            if ($response) { $response.Dispose() }
        }
    } catch {
        $script:FHealthError = $_.Exception.Message
        return $null
    }
}

function Write-FDiagnostics([string]$Reason='Manual diagnostics') {
    $report = New-Object System.Collections.Generic.List[string]
    $report.Add("F Zone diagnostics - $(Get-Date -Format o)")
    $report.Add("Reason: $Reason")
    $report.Add("Package: $root")
    $report.Add("Runtime logs: $runtime")
    $report.Add("OS: $([Environment]::OSVersion.VersionString); 64-bit OS: $([Environment]::Is64BitOperatingSystem); PowerShell: $($PSVersionTable.PSVersion)")
    foreach ($port in @(6273,6274,6275)) {
        $health = Get-FHealth $port
        if ($health) { $report.Add("Port $port health: app=$($health.app), mode=$($health.mode), instance=$($health.instance), NFC=$($health.nfc.state), readers=$($health.nfc.connected)") }
        else { $report.Add("Port $port health: $script:FHealthError") }
        try {
            foreach ($conn in @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) {
                $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
                $report.Add("Listener: PID=$($conn.OwningProcess) $($owner.ExecutablePath) $($owner.CommandLine)")
            }
        } catch { $report.Add("Port inventory: $($_.Exception.Message)") }
    }
    try { $report.Add((Get-Service SCardSvr -ErrorAction Stop | Format-List Name,Status,StartType | Out-String)) }
    catch { $report.Add("Smart Card service: $($_.Exception.Message)") }
    foreach ($name in @('server-error.log','server.log','logs\events.log')) {
        $file = Join-Path $runtime $name
        if (Test-Path $file) { $report.Add("--- $file ---"); $report.Add((Get-Content $file -Tail 60 | Out-String)) }
    }
    $file = Join-Path $runtime 'F-diagnostics.txt'
    $report | Set-Content $file -Encoding UTF8
    try { Copy-Item $file (Join-Path $root 'F-diagnostics.txt') -Force } catch {}
    return $file
}
