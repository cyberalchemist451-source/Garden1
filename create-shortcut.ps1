$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Garden.lnk'
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'http://localhost:3000/qualia-fields/simulation'
$Shortcut.Description = 'Qualia Fields Simulation Environment'
$Shortcut.Save()
Write-Host "Shortcut created at: $ShortcutPath"
