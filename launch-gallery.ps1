# Launches Liminosity: starts the Next dev server if it's not already running,
# waits for it to be ready, then opens the gallery URL in the default browser.
# Writes a log to %TEMP%\liminosity-launcher.log for debugging.
param(
    [string]$Url = 'http://localhost:3000/qualia-fields/liminal-gallery',
    [string]$AppDir = 'C:\Users\Aaron\.gemini\antigravity\scratch\qualia-app',
    [int]$Port = 3000,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $env:TEMP 'liminosity-launcher.log'

function Write-Log {
    param([string]$Message)
    $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    "$stamp  $Message" | Out-File -FilePath $LogPath -Append -Encoding utf8
}

function Test-ServerUp {
    param([int]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(500, $false)
        if ($ok -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

Write-Log "Launcher starting. Url=$Url AppDir=$AppDir Port=$Port"

if (-not (Test-ServerUp -Port $Port)) {
    Write-Log "Server not up on port $Port. Starting dev server."
    $bat = Join-Path $AppDir 'start-dev.bat'
    if (-not (Test-Path $bat)) {
        Write-Log "ERROR: start-dev.bat not found at $bat"
        [System.Windows.Forms.MessageBox]::Show("start-dev.bat not found at $bat", 'Liminosity') | Out-Null
        exit 1
    }
    Start-Process -FilePath $bat -WorkingDirectory $AppDir -WindowStyle Minimized | Out-Null

    $elapsed = 0
    while (-not (Test-ServerUp -Port $Port)) {
        Start-Sleep -Seconds 1
        $elapsed++
        if ($elapsed -ge $TimeoutSeconds) {
            Write-Log "ERROR: server did not come up within $TimeoutSeconds seconds."
            exit 1
        }
    }
    Write-Log "Server up after $elapsed seconds. Waiting 2s for first compile."
    Start-Sleep -Seconds 2
} else {
    Write-Log "Server already running on port $Port."
}

Write-Log "Opening URL: $Url"
try {
    Start-Process $Url
    Write-Log "Start-Process succeeded."
} catch {
    Write-Log "Start-Process failed: $($_.Exception.Message). Falling back to explorer.exe."
    Start-Process -FilePath 'explorer.exe' -ArgumentList $Url
}
