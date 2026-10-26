# Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
# Windows One-Click Setup & Build Script for Desktop Pet
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1

$ErrorActionPreference = "Stop"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Desktop Pet - Windows Setup & Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---- Check Node.js ----
Write-Host "[1/4] Checking Node.js..." -ForegroundColor Yellow
$nodeInstalled = $false
try { $v = node --version 2>$null; Write-Host "  Node.js found: $v" -ForegroundColor Green; $nodeInstalled = $true } catch {}

if (-not $nodeInstalled) {
    Write-Host "  Node.js not found. Installing via winget..." -ForegroundColor Gray
    try {
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        Write-Host "  Node.js installed. Please restart this script in a new terminal." -ForegroundColor Green
        exit 0
    } catch {
        Write-Host "  winget not available. Please install Node.js manually from https://nodejs.org" -ForegroundColor Red
        Write-Host "  Download the LTS version and run this script again." -ForegroundColor Red
        exit 1
    }
}

# ---- Check Rust ----
Write-Host "[2/4] Checking Rust toolchain..." -ForegroundColor Yellow
$rustInstalled = $false
try { $v = rustc --version 2>$null; Write-Host "  Rust found: $v" -ForegroundColor Green; $rustInstalled = $true } catch {}

if (-not $rustInstalled) {
    Write-Host "  Rust not found. Installing via rustup..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
    & "$env:TEMP\rustup-init.exe" -y --default-toolchain stable
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    Write-Host "  Rust installed." -ForegroundColor Green
}

# ---- Check VS Build Tools (required by Tauri on Windows) ----
Write-Host "[3/4] Checking Visual Studio Build Tools..." -ForegroundColor Yellow
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
        Write-Host "  VS Build Tools found: $vsPath" -ForegroundColor Green
    } else {
        Write-Host "  VS Build Tools found but C++ workload missing. Installing..." -ForegroundColor Gray
        & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe" modify --installPath "$vsPath" --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --quiet
    }
} else {
    Write-Host "  VS Build Tools not found." -ForegroundColor Red
    Write-Host "  Tauri requires Visual Studio C++ Build Tools on Windows." -ForegroundColor Red
    Write-Host "  Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
    Write-Host "  During install, select 'Desktop development with C++' workload." -ForegroundColor Yellow
    Write-Host "  Then run this script again." -ForegroundColor Yellow
    exit 1
}

# ---- Build Project ----
Write-Host "[4/4] Building Desktop Pet..." -ForegroundColor Yellow
Push-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
try {
    npm install
    npm run tauri build
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Build Complete!" -ForegroundColor Green
    Write-Host "  Output: src-tauri\target\release\bundle\" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan
} catch {
    Write-Host "Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
