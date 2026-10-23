# Spike 1, elevated part: remove the shadowing System PATH entry, check which node a
# fresh environment resolves, then put the original System PATH back.
. (Join-Path $PSScriptRoot 'fresh-env.ps1')
$exe = Join-Path $PSScriptRoot '..\04-envarly\envarly\src-tauri\target\release\envarly.exe'
$sysKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
$log = Join-Path $PSScriptRoot 'system-test.log'

function WriteSystemPath($value, $name) {
    $f = Join-Path $PSScriptRoot "$name.json"
    [IO.File]::WriteAllText($f, (@{ version = 2; system = @{ Path = @{ value = $value; kind = 'ExpandString' } } } | ConvertTo-Json -Depth 4))
    & $exe import $f --scope system --apply 2>&1 | Select-String 'ok|FAILED|Applied' | ForEach-Object { "  $_" }
}

& {
    $original = (Get-Item $sysKey).GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $without = ($original -split ';' | Where-Object { $_ -ne 'C:\Program Files\nodejs\' }) -join ';'
    "## remove C:\Program Files\nodejs\ from System PATH"
    WriteSystemPath $without 'system-without-node'
    "--- fresh env:"; Get-NodeResolution
    "## restore original System PATH"
    WriteSystemPath $original 'system-restore'
    $now = (Get-Item $sysKey).GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    "restored identical: $($now -ceq $original)  kind: $((Get-Item $sysKey).GetValueKind('Path'))"
    "--- fresh env:"; Get-NodeResolution
} | Tee-Object $log
