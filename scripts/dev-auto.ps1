param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
}

if (-not $SkipInstall -and -not (Test-Path "node_modules")) {
  npm install
}

npm run dev:auto
