. "$PSScriptRoot\fixed-output.ps1"
Add-Type -AssemblyName System.Windows.Forms
if (-not ('FZoneWindow' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class FZoneWindow {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct DisplayDevice {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)] public string DeviceKey;
    }
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern bool EnumDisplayDevices(string device, uint index, ref DisplayDevice value, uint flags);
    public static string[] MonitorPaths(string screen) {
        var result = new List<string>();
        for(uint i=0;;i++) {
            var value=new DisplayDevice(); value.cb=Marshal.SizeOf(typeof(DisplayDevice));
            if(!EnumDisplayDevices(screen,i,ref value,1))break;
            if((value.StateFlags & 1)!=0)result.Add(value.DeviceID);
        }
        return result.ToArray();
    }

    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")] public static extern int GetStyle(IntPtr h, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongW")] public static extern int SetStyle(IntPtr h, int index, int value);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
}
'@
}
[void][FZoneWindow]::SetProcessDPIAware()

function Convert-FMonitorText($Value) {
    return (($Value | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) -join '').Trim()
}
function Resolve-FDisplayRoles($Displays, $Settings) {
    $temp=Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
    try {
        @{displays=@($Displays);settings=$Settings} | ConvertTo-Json -Depth 8 | Set-Content $temp -Encoding UTF8
        $result=(& $node (Join-Path $PSScriptRoot 'resolve-displays.mjs') $temp) | ConvertFrom-Json
        if (-not $result.ok) { throw $result.error }
        return $result.roles
    } finally { Remove-Item $temp -ErrorAction SilentlyContinue }
}
function Save-FDisplaySettings($Settings, $Roles, [string]$File) {
    $bindings=@{}
    foreach ($role in @('wall','table','graph')) {
        $bindings[$role]=$Roles.$role.identity
        $Settings | Add-Member -Force NoteProperty ($role+'Display') $Roles.$role.deviceName
    }
    $Settings | Add-Member -Force NoteProperty displayBindings $bindings
    $Settings | Add-Member -Force NoteProperty displaySelection 'hardware-identity'
    $Settings | ConvertTo-Json -Depth 8 | Set-Content $File -Encoding UTF8
}
function Get-FDisplays {
    $metadata = @(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID -ErrorAction SilentlyContinue)
    foreach ($screen in @([System.Windows.Forms.Screen]::AllScreens | Sort-Object DeviceName)) {
        $paths = @([FZoneWindow]::MonitorPaths($screen.DeviceName))
        if ($paths.Count -gt 1) { throw 'Mirrored outputs detected. Select Extend in Windows Display Settings.' }
        $identity=''; $manufacturer=''; $friendly='Generic display'; $serial=''
        if ($paths.Count -eq 1) {
            $parts=$paths[0].Split('#')
            if ($parts.Count -ge 3) {
                $instance='DISPLAY\' + $parts[1] + '\' + $parts[2]
                $identity=$instance.ToUpperInvariant()
                $rows=@($metadata | Where-Object { ($_.InstanceName -replace '_[0-9]+$','') -ieq $instance })
                if ($rows.Count -eq 1) {
                    $manufacturer=Convert-FMonitorText $rows[0].ManufacturerName
                    $friendly=Convert-FMonitorText $rows[0].UserFriendlyName
                    $serial=Convert-FMonitorText $rows[0].SerialNumberID
                    if ($serial -and $serial -notmatch '^(0+|unknown|n/a)$') { $identity=($parts[1] + ':' + $serial).ToUpperInvariant() }
                }
            }
        }
        [pscustomobject]@{ DeviceName=$screen.DeviceName; Bounds=(Get-FPhysicalBounds $screen.DeviceName); Primary=$screen.Primary; Identity=$identity; Manufacturer=$manufacturer; FriendlyName=$friendly; Serial=$serial }
    }
}

function Find-FWindow([string]$Profile) {
    # Match only the dedicated F Zone browser profile, never other browser windows.
    $matches = Get-CimInstance Win32_Process | Where-Object {
        $_.Name -in @('msedge.exe','chrome.exe') -and $_.CommandLine -and
        $_.CommandLine.Contains($Profile) -and $_.CommandLine -notmatch '--type='
    }
    foreach ($item in $matches) {
        $process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
        if ($process -and $process.MainWindowHandle -ne 0) { return $process.MainWindowHandle }
    }
    return [IntPtr]::Zero
}

function Set-FWindow([IntPtr]$Handle, $Display) {
    $bounds = $Display.Bounds
    [void][FZoneWindow]::ShowWindow($Handle, 9)
    # Place on the assigned monitor. Chromium fullscreen hides its custom titlebar;
    # removing Win32 frame styles alone cannot hide that browser-drawn bar.
    [FPhysicalOutput]::Place($Handle, $Display.DeviceName)
}

function Get-FPhysicalBounds([string]$Device) {
    $b=[FPhysicalOutput]::Bounds($Device)
    return [pscustomobject]@{X=$b[0];Y=$b[1];Width=$b[2];Height=$b[3]}
}

