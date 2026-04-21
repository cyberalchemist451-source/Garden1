# Creates a desktop shortcut that launches Liminosity. Re-runnable.
$AppDir = 'C:\Users\Aaron\.gemini\antigravity\scratch\qualia-app'
$LauncherPath = Join-Path $AppDir 'launch-gallery.ps1'
$IconPath = Join-Path $AppDir 'src\app\favicon.ico'

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Liminosity.lnk'

# Clean up legacy "Twisted Gallery" shortcut if present.
$LegacyPath = Join-Path $DesktopPath 'Twisted Gallery.lnk'
if (Test-Path $LegacyPath) {
    Remove-Item -Force -LiteralPath $LegacyPath
    Write-Host "Removed legacy shortcut: $LegacyPath"
}

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = 'powershell.exe'
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPath`""
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.Description = 'Qualia Fields - Liminosity (procedural liminal 3D)'
$Shortcut.WindowStyle = 7  # minimized

if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}

$Shortcut.Save()

Write-Host "Shortcut created at: $ShortcutPath"
Write-Host "Target: powershell.exe -File $LauncherPath"
