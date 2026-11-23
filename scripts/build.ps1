# Собирает установщик GitScope.
# См. комментарий в scripts/dev.ps1 про GNU-тулчейн и ASCII-путь.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$drive = "X:"

$mingwPackage = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" `
    -Directory -Filter "BrechtSanders.WinLibs*" -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $mingwPackage) {
    throw "MinGW-w64 не найден. Установи: winget install BrechtSanders.WinLibs.POSIX.UCRT"
}

$mingwBin = Join-Path $mingwPackage.FullName "mingw64\bin"
$sysroot = (& rustup run stable-x86_64-pc-windows-gnu rustc --print sysroot).Trim()
$lldBin = Join-Path $sysroot "lib\rustlib\x86_64-pc-windows-gnu\bin"

cmd /c "subst $drive /D" 2>$null | Out-Null
subst $drive $root | Out-Null

$env:PATH = "$mingwBin;$lldBin;" + $env:PATH
$env:RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-gnu"
$env:RUSTFLAGS = "-C linker=rust-lld"

Set-Location "$drive\"
npm run tauri build
