$batPath = "C:\Users\Aaron\.gemini\antigravity\scratch\qualia-app\start-dev.bat"
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest
Register-ScheduledTask -TaskName "QualiaDev" -Action $action -Trigger $trigger -Principal $principal -Force
Write-Host "Task registered successfully."
