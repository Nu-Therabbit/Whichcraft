# Runs a command with the environment Windows builds from the registry for the current
# user (CreateEnvironmentBlock, no inheritance) - what a newly launched Terminal gets,
# not this shell's stale environment.
# Usage: . .\fresh-env.ps1; Invoke-FreshEnv 'cmd.exe' '/c where node & node --version'

Add-Type -Language CSharp @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Principal;

public static class FreshEnv {
    [DllImport("userenv.dll", SetLastError = true)]
    static extern bool CreateEnvironmentBlock(out IntPtr block, IntPtr token, bool inherit);
    [DllImport("userenv.dll", SetLastError = true)]
    static extern bool DestroyEnvironmentBlock(IntPtr block);

    public static Dictionary<string, string> Build() {
        IntPtr token = WindowsIdentity.GetCurrent().Token;
        IntPtr block;
        if (!CreateEnvironmentBlock(out block, token, false))
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try {
            IntPtr p = block;
            while (true) {
                string entry = Marshal.PtrToStringUni(p);
                if (string.IsNullOrEmpty(entry)) break;
                int eq = entry.IndexOf('=', 1);
                if (eq > 0) result[entry.Substring(0, eq)] = entry.Substring(eq + 1);
                p = IntPtr.Add(p, (entry.Length + 1) * 2);
            }
        } finally { DestroyEnvironmentBlock(block); }
        return result;
    }
}
'@

function Invoke-FreshEnv([string]$File, [string]$Arguments) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo $File, $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.EnvironmentVariables.Clear()
    foreach ($kv in [FreshEnv]::Build().GetEnumerator()) { $psi.EnvironmentVariables[$kv.Key] = $kv.Value }
    $p = [System.Diagnostics.Process]::Start($psi)
    # Drain both pipes at once: reading one to the end first deadlocks when the child fills the other.
    $stdout = $p.StandardOutput.ReadToEndAsync()
    $stderr = $p.StandardError.ReadToEndAsync()
    $p.WaitForExit()
    ($stdout.Result + $stderr.Result).TrimEnd()
}

function Get-NodeResolution {
    Invoke-FreshEnv 'cmd.exe' '/c where node & node --version'
}
