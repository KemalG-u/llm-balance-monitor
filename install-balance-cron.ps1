# Registers a Windows Task Scheduler entry that runs run-check.cmd daily at 09:00.
# Idempotent: running it again overwrites the task. Remove with:
#   schtasks /delete /tn "LLM Balance Monitor" /f
$ErrorActionPreference = 'Stop'

$runner = Join-Path $PSScriptRoot 'run-check.cmd'
$action = New-ScheduledTaskAction -Execute $runner -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At '09:00'
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::FromMinutes(5))
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName 'LLM Balance Monitor' `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description 'Daily LLM API balance check; warns when a balance is low.' `
    -Force | Format-List TaskName, State, Description
