$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$batchPath = Join-Path $projectRoot "start-dev.bat"

if (-not (Test-Path $batchPath)) {
  throw "start-dev.bat not found: $batchPath"
}

$startupFolder = [Environment]::GetFolderPath("Startup")
$targetPath = Join-Path $startupFolder "salon-start-dev.bat"

Copy-Item $batchPath $targetPath -Force

Write-Output "Enabled startup via Startup folder: $targetPath"
