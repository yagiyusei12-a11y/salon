param(
  [string]$TaskName = "SalonDevAutoStart"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Unregistered scheduled task: $TaskName"
} else {
  Write-Output "Scheduled task not found: $TaskName"
}
