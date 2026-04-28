$ErrorActionPreference = "Stop"

$startupFolder = [Environment]::GetFolderPath("Startup")
$targetPath = Join-Path $startupFolder "salon-start-dev.bat"

if (Test-Path $targetPath) {
  Remove-Item $targetPath -Force
  Write-Output "Disabled startup via Startup folder: $targetPath"
} else {
  Write-Output "Startup entry not found: $targetPath"
}
