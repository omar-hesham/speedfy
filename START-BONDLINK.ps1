# BondLink v1.0 - One-Click Launcher
# Run this script - it will request Admin if needed

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "BondLink v1.0 Launcher" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host "Script path: $scriptPath" -ForegroundColor Gray

# Check for admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "`nRequesting Admin privileges..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Wait
    exit
}

Write-Host "`n[1/4] Starting BondLink Client..." -ForegroundColor Green

$clientExe = Join-Path $scriptPath "native\target\release\bondlink-client.exe"
$wintunDll = Join-Path $scriptPath "native\target\release\wintun.dll"

Write-Host "Looking for client at: $clientExe" -ForegroundColor Gray

if (-not (Test-Path $clientExe)) {
    Write-Host "ERROR: bondlink-client.exe not found!" -ForegroundColor Red
    Write-Host "Expected at: $clientExe" -ForegroundColor Yellow
    Write-Host "Run: cd native && cargo build --release" -ForegroundColor Yellow
    pause
    exit 1
}

if (-not (Test-Path $wintunDll)) {
    $srcDll = Join-Path $scriptPath "native\crates\bondlink-wintun\lib\amd64\wintun.dll"
    if (Test-Path $srcDll) {
        Copy-Item $srcDll $wintunDll
    }
}

$clientProcess = Start-Process $clientExe -PassThru -WindowStyle Minimized
Write-Host "Client started (PID: $($clientProcess.Id))" -ForegroundColor Green

Write-Host "`n[2/4] Checking client..." -ForegroundColor Green
Start-Sleep -Seconds 3

$clientRunning = $false
$tries = 0
while ($tries -lt 10 -and -not $clientRunning) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:18443/api/status" -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $clientRunning = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        $tries++
    }
}

if ($clientRunning) {
    Write-Host "Client is running!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Client not responding on port 8080" -ForegroundColor Yellow
}

Write-Host "`n[3/4] Starting Dashboard..." -ForegroundColor Green

Set-Location $scriptPath

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install
}

if (-not (Test-Path "dist")) {
    Write-Host "Building React app..." -ForegroundColor Yellow
    npm run build
}

$serverProcess = Start-Process "npm" -ArgumentList "start" -PassThru -WindowStyle Minimized
Write-Host "Dashboard server started (PID: $($serverProcess.Id))" -ForegroundColor Green

Start-Sleep -Seconds 3

Write-Host "`n[4/4] Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:47892"

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "BondLink is now running!" -ForegroundColor Cyan
Write-Host "  Dashboard:   http://localhost:47892" -ForegroundColor White
Write-Host "  Client API:  http://127.0.0.1:18443" -ForegroundColor White
Write-Host "  VPS Relay:   84.8.105.228:8443" -ForegroundColor White
Write-Host "`nClick the START button to activate bonding" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
