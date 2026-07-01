@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MAKECC Control Center

set "DOTNET=dotnet"
where dotnet >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\dotnet\dotnet.exe" (
    set "DOTNET=%ProgramFiles%\dotnet\dotnet.exe"
  ) else (
    echo .NET SDK not found. Install with:  winget install Microsoft.DotNet.SDK.8
    pause
    exit /b 1
  )
)

"%DOTNET%" run -c Release --project "%~dp0tools\makecc-console\MakeccConsole.csproj"
if errorlevel 1 (
  echo.
  echo   MAKECC exited with an error. See logs\ for details.
  pause
)
