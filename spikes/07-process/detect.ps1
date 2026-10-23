# Spike 7: which processes are using an installation folder?
# Method A: processes whose executable lives under the folder (WMI ExecutablePath).
# Method B: Windows Restart Manager - processes holding key files of the installation open.
# Usage: .\detect.ps1 <installation root>
param([Parameter(Mandatory)][string]$Root)

Add-Type -Language CSharp @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class RestartManager {
    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS { public int dwProcessId; public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string strServiceShortName;
        public int ApplicationType; public uint AppStatus; public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
    }
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmStartSession(out uint handle, int flags, string key);
    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint handle);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
    static extern int RmRegisterResources(uint handle, uint nFiles, string[] files, uint nApps, IntPtr apps, uint nServices, string[] services);
    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint handle, out uint needed, ref uint count, [In, Out] RM_PROCESS_INFO[] info, ref uint reasons);

    public static List<string> Who(string[] files) {
        var result = new List<string>();
        uint h;
        int rc = RmStartSession(out h, 0, Guid.NewGuid().ToString());
        if (rc != 0) throw new Exception("RmStartSession " + rc);
        try {
            rc = RmRegisterResources(h, (uint)files.Length, files, 0, IntPtr.Zero, 0, null);
            if (rc != 0) throw new Exception("RmRegisterResources " + rc);
            uint needed, count = 0, reasons = 0;
            rc = RmGetList(h, out needed, ref count, null, ref reasons);
            if (rc == 234) {
                var info = new RM_PROCESS_INFO[needed];
                count = needed;
                rc = RmGetList(h, out needed, ref count, info, ref reasons);
                for (int i = 0; i < count; i++) result.Add(info[i].Process.dwProcessId + " " + info[i].strAppName);
            }
            if (rc != 0) throw new Exception("RmGetList " + rc);
        } finally { RmEndSession(h); }
        return result;
    }
}
'@

$root = $Root.TrimEnd('\') + '\'
"## A: executable under $root"
Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, 'OrdinalIgnoreCase') } |
    ForEach-Object { "  $($_.ProcessId) $($_.Name)" }

# Key files a running JDK keeps open; extend per tool.
$files = 'bin\java.exe', 'bin\javaw.exe', 'bin\server\jvm.dll', 'lib\modules' |
    ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
"## B: Restart Manager on $($files.Count) key files"
[RestartManager]::Who([string[]]$files) | ForEach-Object { "  $_" }
