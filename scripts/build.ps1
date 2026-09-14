$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$frameworkPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compilerPath = Join-Path $frameworkPath 'csc.exe'
$pluginPath = Join-Path $projectRoot 'plugin'
$binPath = Join-Path $pluginPath 'bin'
New-Item -ItemType Directory -Force -Path $binPath | Out-Null
$references = @('System.Web.Extensions.dll', 'WPF\UIAutomationClient.dll', 'WPF\UIAutomationTypes.dll', 'WPF\WindowsBase.dll')
$compilerArgs = @('/nologo', '/target:exe', '/optimize+', '/platform:x64', "/out:$binPath\AmneziaBridge.exe")
foreach ($reference in $references) { $compilerArgs += '/reference:' + (Join-Path $frameworkPath $reference) }
& $compilerPath @compilerArgs (Join-Path $projectRoot 'src\AmneziaBridge.cs')
if ($LASTEXITCODE -ne 0) { throw 'Bridge compilation failed' }
& (Join-Path $PSScriptRoot 'icons.ps1')
& (Join-Path $PSScriptRoot 'dependencies.ps1')
$distPath = Join-Path $projectRoot 'dist'
$packagePath = Join-Path $distPath 'com.rucard.amnezia.sdPlugin'
if (Test-Path -LiteralPath $packagePath) {
    $expectedPackage = [IO.Path]::GetFullPath((Join-Path $projectRoot 'dist\com.rucard.amnezia.sdPlugin'))
    if ([IO.Path]::GetFullPath($packagePath) -ne $expectedPackage) { throw 'Unexpected package directory' }
    Remove-Item -LiteralPath $packagePath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $packagePath | Out-Null
# Explicit inputs prevent logs and local experiments from entering a release.
foreach ($name in @('index.js','core.js','background.js','config.js','inspector.js','inspector.html','manifest.json','package.json','package-lock.json','images')) {
    Copy-Item -LiteralPath (Join-Path $pluginPath $name) -Destination $packagePath -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $packagePath 'bin'),(Join-Path $packagePath 'node_modules') | Out-Null
Copy-Item -LiteralPath (Join-Path $pluginPath 'bin\AmneziaBridge.exe') -Destination (Join-Path $packagePath 'bin')
Copy-Item -LiteralPath (Join-Path $pluginPath 'node_modules\ws') -Destination (Join-Path $packagePath 'node_modules') -Recurse
foreach ($name in @('README.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md','VERIFICATION.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md','docs')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $packagePath -Recurse -Force
}
$installerPath = Join-Path $distPath 'Install-AmneziaPlugin.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install.ps1') -Destination $installerPath -Force
Compress-Archive -LiteralPath $packagePath,$installerPath -DestinationPath (Join-Path $distPath 'AmneziaVPN-AJAZZ.zip') -Force
$checksum = (Get-FileHash -LiteralPath (Join-Path $distPath 'AmneziaVPN-AJAZZ.zip') -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $distPath 'SHA256SUMS.txt'), "$checksum  AmneziaVPN-AJAZZ.zip`n", (New-Object Text.UTF8Encoding($false)))
Write-Output "Built: $packagePath"
