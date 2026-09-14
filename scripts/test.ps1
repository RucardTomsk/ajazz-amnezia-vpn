$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$frameworkPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$artifactsPath = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Force -Path $artifactsPath | Out-Null
$compilerArgs = @('/nologo', '/target:exe', '/main:BridgeTests', ('/out:' + (Join-Path $artifactsPath 'BridgeTests.exe')))
foreach ($name in @('System.Web.Extensions.dll','WPF\UIAutomationClient.dll','WPF\UIAutomationTypes.dll','WPF\WindowsBase.dll')) {
    $compilerArgs += '/reference:' + (Join-Path $frameworkPath $name)
}
& (Join-Path $frameworkPath 'csc.exe') @compilerArgs (Join-Path $projectRoot 'src\AmneziaBridge.cs') (Join-Path $projectRoot 'tests\BridgeTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
& (Join-Path $artifactsPath 'BridgeTests.exe')
if ($LASTEXITCODE -ne 0) { throw 'Bridge tests failed' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path ${env:ProgramFiles(x86)} 'Stream Dock AJAZZ Global\node\node20.exe' }
$testFiles = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'tests') -Filter '*.test.js' | Select-Object -ExpandProperty FullName)
& $nodePath --test @testFiles
if ($LASTEXITCODE -ne 0) { throw 'Plugin tests failed' }
