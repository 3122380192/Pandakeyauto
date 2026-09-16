# Pandakeyauto Pro VIP - Remote 1-Click Launcher

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = "Pandakeyauto Pro - Dang Khoi Chay..."

Write-Host ""
Write-Host " ===========================================================" -ForegroundColor Cyan
Write-Host "   PANDAKEYAUTO PRO VIP v2.0 - REMOTE 1-CLICK LAUNCHER     " -ForegroundColor Yellow
Write-Host "   Khong can tai thu cong - Tu dong dong bo tu GitHub      " -ForegroundColor Gray
Write-Host " ===========================================================" -ForegroundColor Cyan
Write-Host ""

$repoOwner = "3122380192"
$repoName  = "Pandakeyauto"
$branch    = "master"
$zipUrl    = "https://github.com/$repoOwner/$repoName/archive/refs/heads/$branch.zip"

$installDir = Join-Path $env:LOCALAPPDATA "Pandakeyauto"
$zipFile    = Join-Path $env:TEMP "pandakeyauto_latest.zip"
$tempExtract = Join-Path $env:TEMP "pandakeyauto_extract"

# 1. Kiem tra thu muc cai dat
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# 2. Tai ma nguon moi nhat tu GitHub
Write-Host " [*] Dang tai ma nguon moi nhat tu GitHub..." -ForegroundColor Cyan
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($zipUrl, $zipFile)
    $wc.Dispose()
    Write-Host " [+] Da tai xong ma nguon!" -ForegroundColor Green
} catch {
    Write-Host " [!] Khong the tai tu GitHub: $_" -ForegroundColor Red
    Write-Host " [!] Vui long kiem tra ket noi Internet." -ForegroundColor Red
    Read-Host "Nhan Enter de thoat..."
    exit 1
}

# 3. Giai nen ma nguon
Write-Host " [*] Dang dong bo tep tin..." -ForegroundColor Cyan
try {
    if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract -ErrorAction SilentlyContinue }
    Expand-Archive -Path $zipFile -DestinationPath $tempExtract -Force
    
    $extractedFolder = Join-Path $tempExtract "$repoName-$branch"
    if (Test-Path $extractedFolder) {
        Get-ChildItem -Path $extractedFolder | ForEach-Object {
            $dest = Join-Path $installDir $_.Name
            Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
        }
    }
    Remove-Item -Force $zipFile -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tempExtract -ErrorAction SilentlyContinue
    Write-Host " [+] Dong bo tep thanh cong vao: $installDir" -ForegroundColor Green
} catch {
    Write-Host " [!] Loi giai nen: $_" -ForegroundColor Red
}

Set-Location $installDir

# 4. Kiem tra va khoi chay Electron
$electronLocal = Join-Path $installDir "node_modules\electron\dist\electron.exe"
$hasNode = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)

if (-not (Test-Path $electronLocal)) {
    if ($hasNode) {
        Write-Host " [*] Dang thiet lap moi truong chay (npm install)..." -ForegroundColor Yellow
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -WorkingDirectory $installDir -Wait -NoNewWindow
    } else {
        Write-Host " [*] May tinh chua co Node.js, dang tai Electron Portable..." -ForegroundColor Yellow
        $electronZipUrl = "https://github.com/electron/electron/releases/download/v30.0.9/electron-v30.0.9-win32-x64.zip"
        $electronZip = Join-Path $env:TEMP "electron_portable.zip"
        $electronTarget = Join-Path $installDir "node_modules\electron\dist"
        New-Item -ItemType Directory -Path $electronTarget -Force | Out-Null
        $wc2 = New-Object System.Net.WebClient
        $wc2.DownloadFile($electronZipUrl, $electronZip)
        $wc2.Dispose()
        Expand-Archive -Path $electronZip -DestinationPath $electronTarget -Force
        Remove-Item -Force $electronZip -ErrorAction SilentlyContinue
        Write-Host " [+] Da thiet lap xong Electron Portable!" -ForegroundColor Green
    }
}

# 5. Khoi dong Pandakeyauto hoan toan khong co bang den
Write-Host " [>>] Dang mo Pandakeyauto Pro GUI..." -ForegroundColor Green
$vbsScript = Join-Path $installDir "start.vbs"

if (Test-Path $vbsScript) {
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsScript`"" -WorkingDirectory $installDir
} else {
    $electronExe = Join-Path $installDir "node_modules\electron\dist\electron.exe"
    Start-Process -FilePath $electronExe -ArgumentList "`"$installDir`"" -WorkingDirectory $installDir
}

Start-Sleep -Seconds 1
Write-Host " [OK] Ung dung da san sang tren man hinh! Chuc ban chien game vui ve." -ForegroundColor Cyan
Start-Sleep -Seconds 2
exit 0
