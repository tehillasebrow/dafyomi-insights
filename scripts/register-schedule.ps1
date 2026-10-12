# Creates (or updates) a Windows scheduled task that runs the story pipeline
# every night. Run once from the project folder:
#
#   powershell -ExecutionPolicy Bypass -File scripts\register-schedule.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\register-schedule.ps1 -Time 3:30am
#   powershell -ExecutionPolicy Bypass -File scripts\register-schedule.ps1 -Remove
#
# The task runs as you, only while you're logged in, and if the PC was off at
# the scheduled time it runs as soon as it's back on. Output goes to
# logs\story-pipeline.log.
param(
    [string]$Time = '2:00am',
    [switch]$Remove
)

$TaskName = 'Daf Yomi Insights - Story Pipeline'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$TaskName'."
    return
}

$ProjectDir = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir 'logs') | Out-Null

# cmd /c so the pipeline's console output is appended to the log too
$Command = "`"$Node`" --env-file-if-exists=.env.local scripts\story-pipeline.mjs >> logs\story-pipeline-output.log 2>&1"
$Action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $Command" -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
    -Description 'Finds new Daf Yomi articles, has Claude Code draft their Gemara stories, checks and publishes them, and refreshes dafyomiinsights.com.' `
    -Force | Out-Null

Write-Host "Scheduled '$TaskName' daily at $Time (folder: $ProjectDir)."
Write-Host "Run it now to test:  Start-ScheduledTask -TaskName '$TaskName'"
