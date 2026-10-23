# Stand-in for a user's PowerShell profile that puts its own Node first on PATH.
# This machine has no real profile, so the spike dot-sources this instead of touching $PROFILE.
$env:PATH = (Join-Path $PSScriptRoot '..\03-mise\stores\store-build\data\installs\node\22.23.4') + ';' + $env:PATH
