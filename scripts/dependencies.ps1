$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'plugin\package.json') -Raw | ConvertFrom-Json
# Windows PowerShell 5.1 ConvertFrom-Json cannot represent the lock's empty root key.
Add-Type -AssemblyName System.Web.Extensions
$lock = (New-Object System.Web.Script.Serialization.JavaScriptSerializer).DeserializeObject([IO.File]::ReadAllText((Join-Path $projectRoot 'plugin\package-lock.json')))
$locked = $lock['packages']['node_modules/ws']
if ($locked.version -ne $manifest.dependencies.ws -or $locked.version -notmatch '^\d+\.\d+\.\d+$') { throw 'ws manifest/lock version mismatch' }
$expectedUrl = 'https://registry.npmjs.org/ws/-/ws-' + $locked.version + '.tgz'
if ($locked.resolved -ne $expectedUrl -or $locked.integrity -notmatch '^sha512-[A-Za-z0-9+/=]+$') { throw 'Invalid ws lock metadata' }
$dependencyPath = Join-Path $projectRoot 'plugin\node_modules\ws'
$archiveDirectory = Join-Path $projectRoot 'artifacts'
$archivePath = Join-Path $archiveDirectory ('ws-' + $locked.version + '.tgz')
New-Item -ItemType Directory -Force -Path $archiveDirectory,$dependencyPath | Out-Null
# The only dependency is pure JS; install no native modules or lifecycle scripts.
$expected = $locked.integrity.Substring(7)
if (!(Test-Path -LiteralPath $archivePath)) {
    Invoke-WebRequest $expectedUrl -OutFile $archivePath -UseBasicParsing
}
$hasher = [System.Security.Cryptography.SHA512]::Create()
try { $actual = [Convert]::ToBase64String($hasher.ComputeHash([IO.File]::ReadAllBytes($archivePath))) }
finally { $hasher.Dispose() }
if ($actual -ne $expected) { throw 'ws package integrity mismatch' }
# Remove only this dependency's generated directory, after verifying the target.
$expectedDirectory = [IO.Path]::GetFullPath((Join-Path $projectRoot 'plugin\node_modules\ws'))
if ([IO.Path]::GetFullPath($dependencyPath) -ne $expectedDirectory) { throw 'Unexpected dependency directory' }
Remove-Item -LiteralPath $dependencyPath -Recurse -Force
New-Item -ItemType Directory -Path $dependencyPath | Out-Null
& tar.exe -xzf $archivePath -C $dependencyPath --strip-components=1
if ($LASTEXITCODE -ne 0) { throw 'ws extraction failed' }
