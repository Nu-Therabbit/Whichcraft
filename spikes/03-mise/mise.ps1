# Runs the pinned mise.exe against an isolated store, the way Whichcraft will.
# Usage: .\mise.ps1 <store> <mise args...>   e.g. .\mise.ps1 store-a ls --json
param([Parameter(Mandatory)][string]$Store, [Parameter(ValueFromRemainingArguments)][string[]]$MiseArgs)

$root = Join-Path $PSScriptRoot "stores\$Store"
$env:MISE_DATA_DIR = Join-Path $root 'data'
$env:MISE_CACHE_DIR = Join-Path $root 'cache'
$env:MISE_STATE_DIR = Join-Path $root 'state'
$env:MISE_CONFIG_DIR = Join-Path $root 'config'
$env:MISE_GLOBAL_CONFIG_FILE = Join-Path $root 'config\config.toml'
$env:MISE_YES = '1'

# Run from the store so no project mise.toml is picked up.
Push-Location (New-Item -ItemType Directory -Force $root)
try { & (Join-Path $PSScriptRoot 'bin-extract\mise\bin\mise.exe') @MiseArgs; exit $LASTEXITCODE }
finally { Pop-Location }
