# Physical pixels only: WinForms Screen.Bounds can be virtualized by the primary DPI.
if (-not ('FPhysicalOutput' -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FPhysicalOutput {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    static extern bool EnumDisplaySettingsW(string device, int mode, IntPtr data);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    static extern int ChangeDisplaySettingsExW(string device, IntPtr data, IntPtr hwnd, uint flags, IntPtr param);
    [DllImport("user32.dll", SetLastError=true)]
    static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll", SetLastError=true)]
    static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    static IntPtr Read(string device) {
        // DEVMODEW (Windows x64/x86): dmSize=68, dmFields=72, dmPosition=76,
        // dmPelsWidth=172, dmPelsHeight=176; driver-private data is not requested.
        var p=Marshal.AllocHGlobal(220);
        for(int i=0;i<220;i++) Marshal.WriteByte(p,i,0);
        Marshal.WriteInt16(p,68,220);
        if(!EnumDisplaySettingsW(device,-1,p)) { Marshal.FreeHGlobal(p); throw new InvalidOperationException("Cannot read physical display mode: "+device); }
        return p;
    }
    public static int[] Bounds(string device) {
        var p=Read(device);
        try { return new int[]{Marshal.ReadInt32(p,76),Marshal.ReadInt32(p,80),Marshal.ReadInt32(p,172),Marshal.ReadInt32(p,176)}; }
        finally { Marshal.FreeHGlobal(p); }
    }
    public static int SetSize(string device, int width, int height, bool test) {
        if(width<640 || height<480) throw new ArgumentOutOfRangeException("Display dimensions");
        var p=Read(device);
        try {
            // Change size only. Do not change primary display, position, rotation or refresh.
            Marshal.WriteInt32(p,72,0x180000);
            Marshal.WriteInt32(p,172,width); Marshal.WriteInt32(p,176,height);
            return ChangeDisplaySettingsExW(device,p,IntPtr.Zero,test?2u:1u,IntPtr.Zero);
        } finally { Marshal.FreeHGlobal(p); }
    }
    public static void Place(IntPtr window, string device) {
        var previous=SetThreadDpiAwarenessContext(new IntPtr(-4));
        if(previous==IntPtr.Zero) throw new InvalidOperationException("Cannot enter per-monitor DPI context");
        try {
            var b=Bounds(device);
            if(!SetWindowPos(window,new IntPtr(-2),b[0],b[1],b[2],b[3],0x0060))
                throw new InvalidOperationException("Cannot place display window");
        } finally { SetThreadDpiAwarenessContext(previous); }
    }
}
'@
}

function Get-FFixedOutputPlan($Settings, $Roles) {
    $used=@{}
    foreach($role in @('table','wall')) {
        $fixed=$Settings.fixedOutputs.$role
        if (-not $fixed) { throw "Missing fixedOutputs.$role in windows/settings.json." }
        $width=if($role -eq 'table'){1600}else{1440}
        if($fixed.width -ne $width -or $fixed.height -ne 900) { throw "Invalid fixed output for $role. Expected ${width}x900." }
        $binding=$Settings.displayBindings.$role
        if(-not $binding -or $Roles.$role.identity -ne $binding) { throw "Fixed $role projector identity changed. Verify the projector before changing output." }
        $device=$Roles.$role.deviceName
        if(-not $device -or $used.ContainsKey($device)) { throw 'Fixed outputs must use two distinct displays.' }
        $used[$device]=$true
        [pscustomobject]@{Role=$role;Device=$device;Width=$width;Height=900}
    }
}

function Set-FFixedOutputs($Settings, $Roles) {
    $plan=@(Get-FFixedOutputPlan $Settings $Roles)
    $changes=@()
    # Validate both outputs before modifying either one.
    foreach($item in $plan) {
        $old=[FPhysicalOutput]::Bounds($item.Device)
        $item | Add-Member NoteProperty Old $old
        if($old[2] -eq $item.Width -and $old[3] -eq $item.Height){continue}
        $result=[FPhysicalOutput]::SetSize($item.Device,$item.Width,$item.Height,$true)
        if($result -ne 0){throw "Unsupported fixed resolution for $($item.Role): $result. No display mode was changed."}
        $changes+=$item
    }
    $applied=@()
    try {
        foreach($item in $changes) {
            $applied+=$item
            $result=[FPhysicalOutput]::SetSize($item.Device,$item.Width,$item.Height,$false)
            if($result -ne 0){throw "Cannot set $($item.Role) fixed resolution: $result"}
        }
        foreach($item in $plan) {
            $actual=[FPhysicalOutput]::Bounds($item.Device)
            if($actual[2] -ne $item.Width -or $actual[3] -ne $item.Height){throw "Fixed resolution verification failed: $($item.Role)"}
        }
    } catch {
        $failure=$_
        foreach($item in $applied) {
            $result=[FPhysicalOutput]::SetSize($item.Device,$item.Old[2],$item.Old[3],$false)
            if($result -ne 0){Write-Warning "Output rollback failed for $($item.Role): $result"}
        }
        throw $failure
    }
}
