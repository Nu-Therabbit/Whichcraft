# Spike 4: drive the built envarly.exe against the real registry with a test variable
# and a test PATH entry. Run backup first (backup\*.reg). Usage: .\registry-test.ps1 user|elevated
param([Parameter(Mandatory)][ValidateSet('user', 'elevated')][string]$Phase)

$exe = Join-Path $PSScriptRoot 'envarly\src-tauri\target\release\envarly.exe'
$log = Join-Path $PSScriptRoot "registry-test-$Phase.log"
$testDir = Join-Path $PSScriptRoot 'testbin'
$sysKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment'
New-Item -ItemType Directory -Force $testDir | Out-Null

function Raw($key, $name) {
    (Get-Item $key).GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
}
function Kind($key, $name) { try { (Get-Item $key).GetValueKind($name) } catch { 'absent' } }
function State($label) {
    $u = Raw 'HKCU:\Environment' 'Path'
    "[$label] user SPIKE=[$(Raw 'HKCU:\Environment' 'SWITCHYARD_SPIKE')] sys SPIKE=[$(Raw $sysKey 'SWITCHYARD_SPIKE')] " +
    "userPATH len=$($u.Length) kind=$(Kind 'HKCU:\Environment' 'Path') hasTest=$($u -like "*$testDir*") " +
    "sysPATH len=$((Raw $sysKey 'Path').Length) kind=$(Kind $sysKey 'Path')"
}
function Run([string[]]$a) { "> envarly $($a -join ' ')"; & $exe @a 2>&1 | ForEach-Object { "  $_" }; "  exit=$LASTEXITCODE" }

$userPath = Raw 'HKCU:\Environment' 'Path'
# envarly's JSON parser rejects a UTF-8 BOM, which Windows PowerShell's Set-Content adds.
function WriteJson($path, $obj) { [IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 4)) }

$batch = Join-Path $PSScriptRoot "batch-$Phase.json"
WriteJson $batch @{ version = 2
   user = @{ SWITCHYARD_SPIKE = @{ value = 'user-batch'; kind = 'String' }
             Path = @{ value = "$userPath;$testDir"; kind = 'ExpandString' } }
   system = @{ SWITCHYARD_SPIKE = @{ value = 'system-batch'; kind = 'String' } } }

& {
    "whoami: $(whoami)  elevated-check: $([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole('Administrators'))"
    State 'start'
    if ($Phase -eq 'user') {
        "## T1 single User set then delete"
        Run 'set', 'SWITCHYARD_SPIKE', 'user-single', '--scope', 'user', '--apply'
        State 'after set'
        Run 'delete', 'SWITCHYARD_SPIKE', '--scope', 'user', '--apply'
        State 'after delete'
        "## T2 batch User(var+PATH) + System(var) while NOT elevated: expect System to fail and User to roll back"
        Run 'import', $batch, '--apply'
        State 'after failed batch'
    } else {
        "## T3 batch User(var+PATH) + System(var) while elevated: expect all to succeed"
        Run 'import', $batch, '--apply'
        State 'after batch'
        "## T4 clean up through envarly"
        Run 'delete', 'SWITCHYARD_SPIKE', '--scope', 'system', '--apply'
        Run 'delete', 'SWITCHYARD_SPIKE', '--scope', 'user', '--apply'
        $cleanBatch = Join-Path $PSScriptRoot 'batch-clean.json'
        WriteJson $cleanBatch @{ version = 2; user = @{ Path = @{ value = $userPath; kind = 'ExpandString' } } }
        Run 'import', $cleanBatch, '--scope', 'user', '--apply'
        State 'after cleanup'
    }
} | Tee-Object $log
