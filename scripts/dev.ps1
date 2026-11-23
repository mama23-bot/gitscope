# Запускает GitScope в режиме разработки.
#
# Зачем скрипт: в этом окружении нет MSVC Build Tools, поэтому Tauri
# собирается GNU-тулчейном, а линкером выступает rust-lld.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$mingwPackage = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" `
    -Directory -Filter "BrechtSanders.WinLibs*" -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $mingwPackage) {
    throw "MinGW-w64 не найден. Установи: winget install BrechtSanders.WinLibs.POSIX.UCRT"
}

$mingwBin = Join-Path $mingwPackage.FullName "mingw64\bin"
$sysroot = (& rustup run stable-x86_64-pc-windows-gnu rustc --print sysroot).Trim()
$lldBin = Join-Path $sysroot "lib\rustlib\x86_64-pc-windows-gnu\bin"

$env:PATH = "$mingwBin;$lldBin;" + $env:PATH
$env:RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-gnu"
$env:RUSTFLAGS = "-C linker=rust-lld"

Set-Location $root
npm run tauri dev
