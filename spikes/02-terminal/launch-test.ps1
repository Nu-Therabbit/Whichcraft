# Spike 2: after a registry change, does a Terminal launched by a process with a stale
# environment see the new value? Compares inheriting the stale environment with passing
# a fresh CreateEnvironmentBlock environment, for wt.exe and plain powershell.exe.
param([Parameter(Mandatory)][string]$Label)
. (Join-Path $PSScriptRoot '..\01-path\fresh-env.ps1')

$out = Join-Path $PSScriptRoot 'out'
New-Item -ItemType Directory -Force $out | Out-Null

function Launch([string]$File, [string]$Arguments, [bool]$Fresh) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo $File, $Arguments
    $psi.UseShellExecute = $false
    if ($Fresh) {
        $psi.EnvironmentVariables.Clear()
        foreach ($kv in [FreshEnv]::Build().GetEnumerator()) { $psi.EnvironmentVariables[$kv.Key] = $kv.Value }
    }
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}

# No ';' in the command: wt.exe treats it as a command separator.
function Probe([string]$Name) {
    $file = Join-Path $out "$Label-$Name.txt"
    Remove-Item $file -ErrorAction SilentlyContinue
    "-NoProfile -Command Set-Content -Path '$file' -Value ('[' + `$env:SWITCHYARD_SPIKE + ']')"
}

"this process sees: [$env:SWITCHYARD_SPIKE]"
foreach ($fresh in $false, $true) {
    $mode = if ($fresh) { 'fresh' } else { 'inherit' }
    Launch 'powershell.exe' (Probe "powershell-$mode") $fresh
    Launch 'wt.exe' ("-w new powershell.exe " + (Probe "wt-$mode")) $fresh
}
Start-Sleep -Seconds 8
Get-ChildItem $out -Filter "$Label-*.txt" | ForEach-Object { "{0,-28} {1}" -f $_.BaseName, (Get-Content $_.FullName) }
