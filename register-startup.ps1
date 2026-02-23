$batPath = "C:\Users\Aaron\.gemini\antigravity\scratch\qualia-app\start-dev.bat"
$startupFolder = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder "QualiaDev.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = "C:\Users\Aaron\.gemini\antigravity\scratch\qualia-app"
$shortcut.WindowStyle = 7  # 7 = minimized
$shortcut.Description = "Qualia Dev Server"
$shortcut.Save()

Write-Host "Startup shortcut created at: $shortcutPath"
