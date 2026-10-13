# Creates (or updates) a Windows scheduled task that runs the weekly newspaper import
# (scripts/import/weekly-pc.mjs) on Thursday and again on Friday. Run once from the
# project folder:
#
#   npm run import:schedule
#   powershell -ExecutionPolicy Bypass -File scripts\register-weekly.ps1 -Time 9:00am
#   powershell -ExecutionPolicy Bypass -File scripts\register-weekly.ps1 -Remove
#
# The task runs as you, only while you're logged in, and if the PC was off at the
# scheduled time it runs as soon as it's back on. Output goes to logs\weekly-import.log.
param(
    [string]$Time = '11:00am',
    [switch]$Remove
)

$TaskName = 'Daf Yomi Insights - Weekly Newspaper Import'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed scheduled task '$TaskName'."
    return
}

$ProjectDir = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectDir 'logs') | Out-Null

# cmd /c so the run's console output is appended to the log too
$Command = "`"$Node`" --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file-if-exists=.env.local scripts\import\weekly-pc.mjs >> logs\weekly-import.log 2>&1"
$Action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $Command" -WorkingDirectory $ProjectDir
# The issue is usually uploaded Wednesday evening; Friday is the second try
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday, Friday -At $Time
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
    -Description "Finds Rabbi Sebrow's new column in The Jewish Home, has Claude Code review it (text, daf, topics, subtopics, stories, picture), publishes it to dafyomiinsights.com and opens a GitHub issue if anything needs a look." `
    -Force | Out-Null

Write-Host "Scheduled '$TaskName' every Thursday and Friday at $Time (folder: $ProjectDir)."
Write-Host "Run it now to test:  Start-ScheduledTask -TaskName '$TaskName'"
