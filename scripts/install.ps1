param([string]$PluginsDirectory = (Join-Path $env:APPDATA 'HotSpot\StreamDock\plugins'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$bundledPath = Join-Path $PSScriptRoot 'com.rucard.amnezia.sdPlugin'
if (Test-Path -LiteralPath $bundledPath -PathType Container) {
    $projectRoot = $PSScriptRoot
    $sourcePath = $bundledPath
} else { $sourcePath = Join-Path $projectRoot 'dist\com.rucard.amnezia.sdPlugin' }
if (!(Test-Path -LiteralPath (Join-Path $sourcePath 'bin\AmneziaBridge.exe'))) { throw 'Run scripts/build.ps1 first' }
if (!(Test-Path -LiteralPath $PluginsDirectory -PathType Container)) { throw "Plugin directory not found: $PluginsDirectory. Start AJAZZ once, or pass -PluginsDirectory with its plugin folder." }
$destinationPath = Join-Path $PluginsDirectory 'com.rucard.amnezia.sdPlugin'
if (Test-Path -LiteralPath $destinationPath) {
    $backupPath = Join-Path $projectRoot ('artifacts\backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
    Copy-Item -LiteralPath $destinationPath -Destination $backupPath -Recurse
}
New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
Copy-Item -Path (Join-Path $sourcePath '*') -Destination $destinationPath -Recurse -Force
Write-Output "Installed: $destinationPath"
Write-Output 'Restart Stream Dock AJAZZ to load the plugin. AmneziaVPN was not restarted or controlled.'
