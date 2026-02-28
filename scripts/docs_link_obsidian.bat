@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..\docs") do set "docs_dir=%%~fI"
if not exist "%docs_dir%" (
  echo [ERROR] Project docs directory not found: "%docs_dir%"
  exit /b 1
)

echo This script creates a directory junction in your Obsidian vault:
echo   fd_prototype_docs ^> "%docs_dir%"
echo.
set /P "vault_path=Enter Obsidian vault path: "
if not defined vault_path (
  echo [ERROR] Vault path is empty.
  exit /b 1
)

for %%I in ("%vault_path%") do set "vault_dir=%%~fI"
if not exist "%vault_dir%" (
  echo [ERROR] Vault path does not exist: "%vault_dir%"
  exit /b 1
)

set "link_dir=%vault_dir%\fd_prototype_docs"
if exist "%link_dir%" (
  echo [ERROR] Target already exists: "%link_dir%"
  echo Delete the existing folder/junction first to avoid accidental overwrite.
  exit /b 1
)

mklink /J "%link_dir%" "%docs_dir%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to create directory junction.
  exit /b 1
)

echo [DONE] Junction created: "%link_dir%"
exit /b 0
