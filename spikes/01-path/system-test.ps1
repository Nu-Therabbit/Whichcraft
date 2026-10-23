# Spike 1, elevated part: remove the shadowing System PATH entry, check which node a
# fresh environment resolves, then put the original System PATH back.
. (Join-Path $PSScriptRoot 'fresh-env.ps1')
$exe = Join-Path $PSScriptRoot '..\04-envarly\envarly\src-tauri\target\release\envarly.exe'
$sysKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
$log = Join-Path $PSScriptRoot 'system-test.log'

function ReadSystemPath {
    (Get-Item $sysKey).GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
}

function WriteSystemPath($value, $name) {
    $f = Join-Path $PSScriptRoot "$name.json"
    [IO.File]::WriteAllText($f, (@{ version = 2; system = @{ Path = @{ value = $value; kind = 'ExpandString' } } } | ConvertTo-Json -Depth 4))
    $out = & $exe import $f --scope system --apply 2>&1
    $code = $LASTEXITCODE
    $out | Select-String 'ok|FAILED|Applied' | ForEach-Object { "  $_" }
    if ($code -ne 0) { throw "envarly import $name failed (exit $code)" }
}

# 0 = passed, 1 = the check failed but System PATH was restored, 2 = System PATH is NOT restored.
$script:exitCode = 0

& {
    $original = ReadSystemPath
    $without = ($original -split ';' | Where-Object { $_ -ne 'C:\Program Files\nodejs\' }) -join ';'
    try {
        "## remove C:\Program Files\nodejs\ from System PATH"
        WriteSystemPath $without 'system-without-node'
        "--- fresh env:"; Get-NodeResolution
    } catch {
        "ERROR: $_"
        $script:exitCode = 1
    } finally {
        # Restore even if the check above threw; only skip when nothing changed.
        if ((ReadSystemPath) -cne $original) {
            "## restore original System PATH"
            try { WriteSystemPath $original 'system-restore' } catch { "RESTORE FAILED: $_" }
        }
        $restored = (ReadSystemPath) -ceq $original
        "restored identical: $restored  kind: $((Get-Item $sysKey).GetValueKind('Path'))"
        if (-not $restored) {
            "System PATH is NOT restored -- import backup\hklm-environment.reg before doing anything else"
            $script:exitCode = 2
        }
    }
    if ($script:exitCode -lt 2) { "--- fresh env:"; Get-NodeResolution }
} | Tee-Object $log

exit $script:exitCode
