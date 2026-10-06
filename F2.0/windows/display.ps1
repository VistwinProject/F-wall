Add-Type -AssemblyName System.Windows.Forms
if (-not ('FZoneWindow' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FZoneWindow {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")] public static extern int GetStyle(IntPtr h, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongW")] public static extern int SetStyle(IntPtr h, int index, int value);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);
}
'@
}
[void][FZoneWindow]::SetProcessDPIAware()

function Get-FDisplays {
    return @([System.Windows.Forms.Screen]::AllScreens | Sort-Object DeviceName)
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
    # Borderless app window. Preserve other style flags and saved browser storage.
    $style = [FZoneWindow]::GetStyle($Handle, -16)
    [void][FZoneWindow]::SetStyle($Handle, -16, ($style -band (-bnot 0x00CF0000)))
    if (-not [FZoneWindow]::SetWindowPos($Handle, [IntPtr]::Zero, $bounds.X, $bounds.Y, $bounds.Width, $bounds.Height, 0x0064)) {
        throw 'Unable to position the display window.'
    }
}
