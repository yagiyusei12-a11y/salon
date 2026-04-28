param(
  [string]$TaskName = "SalonDevAutoStart"
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$batchPath = Join-Path $projectRoot "start-dev.bat"

if (-not (Test-Path $batchPath)) {
  throw "start-dev.bat not found: $batchPath"
}

$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batchPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Description "Start salon dev app at user logon" -Force | Out-Null
  Write-Output "Registered scheduled task via Register-ScheduledTask: $TaskName"
}
catch {
  # Fallback for environments where Register-ScheduledTask is restricted.
  $taskRunCommand = "`"$batchPath`""
  $output = & schtasks.exe /Create /SC ONLOGON /TN $TaskName /TR $taskRunCommand /F 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to register task. schtasks output: $output"
  }
  Write-Output "Registered scheduled task via schtasks: $TaskName"
}
