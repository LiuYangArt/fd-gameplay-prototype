@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%" || (
  echo Failed to enter project root: "%ROOT_DIR%"
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm was not found. Please install pnpm or enable corepack first.
  exit /b 1
)

set "MODE=%~1"
if "%MODE%"=="" set "MODE=menu"

call :normalize_mode "%MODE%"
if "%RET_MODE%"=="" (
  echo Usage: scripts\dev.cmd [menu/install/dev/devfresh/typecheck/lint/lintfix/format/formatcheck/test/build/verify/freeport]
  exit /b 1
)

if /I "%RET_MODE%"=="menu" goto :menu

call :run_task "%RET_MODE%"
set "TASK_EXIT=%errorlevel%"
if not "%TASK_EXIT%"=="0" call :pause_after_failure "%RET_MODE%" "%TASK_EXIT%"
exit /b %TASK_EXIT%

:menu
call :print_menu
set "SEL="
set /p "SEL=Select action: "
if errorlevel 1 (
  echo.
  echo Input stream is not available.
  pause
  exit /b 1
)

if /I "%SEL%"=="q" exit /b 0
call :map_selection "%SEL%"
if defined SELECTED_TASK (
  call :run_task_in_menu "%SELECTED_TASK%"
  goto :menu
)

echo Invalid option, try again.
goto :menu

:print_menu
echo ================ Dev Menu (Windows) ================
echo 1^) install     Install dependencies
echo 2^) dev         Start dev server
echo 3^) typecheck   Run type checking
echo 4^) lint        Run ESLint
echo 5^) lintfix     Auto-fix ESLint issues
echo 6^) format      Run Prettier format
echo 7^) formatcheck Check Prettier format
echo 8^) test        Run tests
echo 9^) build       Build all packages
echo 10^) verify     Run full verification
echo 11^) freeport   Kill process using port 5173
echo 12^) devfresh   Free port 5173 then start dev server
echo q^) Exit
echo =====================================================
exit /b 0

:normalize_mode
set "RET_MODE="
set "RAW_MODE=%~1"

if /I "%RAW_MODE%"=="menu" set "RET_MODE=menu"
if /I "%RAW_MODE%"=="install" set "RET_MODE=install"
if /I "%RAW_MODE%"=="dev" set "RET_MODE=dev"
if /I "%RAW_MODE%"=="typecheck" set "RET_MODE=typecheck"
if /I "%RAW_MODE%"=="lint" set "RET_MODE=lint"
if /I "%RAW_MODE%"=="lintfix" set "RET_MODE=lintfix"
if /I "%RAW_MODE%"=="lint:fix" set "RET_MODE=lintfix"
if /I "%RAW_MODE%"=="format" set "RET_MODE=format"
if /I "%RAW_MODE%"=="formatcheck" set "RET_MODE=formatcheck"
if /I "%RAW_MODE%"=="format:check" set "RET_MODE=formatcheck"
if /I "%RAW_MODE%"=="test" set "RET_MODE=test"
if /I "%RAW_MODE%"=="build" set "RET_MODE=build"
if /I "%RAW_MODE%"=="verify" set "RET_MODE=verify"
if /I "%RAW_MODE%"=="freeport" set "RET_MODE=freeport"
if /I "%RAW_MODE%"=="devfresh" set "RET_MODE=devfresh"
if /I "%RAW_MODE%"=="devclean" set "RET_MODE=devfresh"
if /I "%RAW_MODE%"=="dev-safe" set "RET_MODE=devfresh"
if /I "%RAW_MODE%"=="freeportdev" set "RET_MODE=devfresh"
if /I "%RAW_MODE%"=="killport" set "RET_MODE=freeport"
if /I "%RAW_MODE%"=="kill5173" set "RET_MODE=freeport"

exit /b 0

:run_task
set "TASK=%~1"
set "PNPM_TASK="

if /I "%TASK%"=="install" set "PNPM_TASK=install"
if /I "%TASK%"=="dev" set "PNPM_TASK=dev"
if /I "%TASK%"=="typecheck" set "PNPM_TASK=typecheck"
if /I "%TASK%"=="lint" set "PNPM_TASK=lint"
if /I "%TASK%"=="lintfix" set "PNPM_TASK=lint:fix"
if /I "%TASK%"=="format" set "PNPM_TASK=format"
if /I "%TASK%"=="formatcheck" set "PNPM_TASK=format:check"
if /I "%TASK%"=="test" set "PNPM_TASK=test"
if /I "%TASK%"=="build" set "PNPM_TASK=build"
if /I "%TASK%"=="verify" set "PNPM_TASK=verify"

if defined PNPM_TASK (
  pnpm %PNPM_TASK%
  exit /b %errorlevel%
)

if /I "%TASK%"=="freeport" (
  call :free_port_5173
  exit /b %errorlevel%
)

if /I "%TASK%"=="devfresh" (
  call :free_port_5173
  if not "%errorlevel%"=="0" exit /b %errorlevel%
  pnpm dev
  exit /b %errorlevel%
)

echo Unknown task: %TASK%
exit /b 1

:map_selection
set "SELECTED_TASK="

if "%~1"=="1" set "SELECTED_TASK=install"
if "%~1"=="2" set "SELECTED_TASK=dev"
if "%~1"=="3" set "SELECTED_TASK=typecheck"
if "%~1"=="4" set "SELECTED_TASK=lint"
if "%~1"=="5" set "SELECTED_TASK=lintfix"
if "%~1"=="6" set "SELECTED_TASK=format"
if "%~1"=="7" set "SELECTED_TASK=formatcheck"
if "%~1"=="8" set "SELECTED_TASK=test"
if "%~1"=="9" set "SELECTED_TASK=build"
if "%~1"=="10" set "SELECTED_TASK=verify"
if "%~1"=="11" set "SELECTED_TASK=freeport"
if "%~1"=="12" set "SELECTED_TASK=devfresh"

exit /b 0

:run_task_in_menu
set "MENU_TASK=%~1"
call :run_task "%MENU_TASK%"
set "MENU_TASK_EXIT=%errorlevel%"
if not "%MENU_TASK_EXIT%"=="0" call :pause_after_failure "%MENU_TASK%" "%MENU_TASK_EXIT%"
exit /b %MENU_TASK_EXIT%

:pause_after_failure
set "FAIL_TASK=%~1"
set "FAIL_CODE=%~2"
echo.
echo Task "%FAIL_TASK%" failed with exit code %FAIL_CODE%.
echo Press any key to continue...
pause >nul
exit /b 0

:free_port_5173
set "TARGET_PORT=5173"
set "FOUND_PORT_PID="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%TARGET_PORT% .*LISTENING"') do (
  set "FOUND_PORT_PID=1"
  call :kill_pid %%P
)

if not defined FOUND_PORT_PID (
  echo No process is using port %TARGET_PORT%.
)

exit /b 0

:kill_pid
set "TARGET_PID=%~1"
if "%TARGET_PID%"=="" exit /b 0

tasklist /FI "PID eq %TARGET_PID%" /FO CSV /NH | findstr /V /I "INFO:" >nul
if errorlevel 1 (
  echo PID %TARGET_PID% is already stopped.
  exit /b 0
)

echo Killing PID %TARGET_PID% ...
taskkill /PID %TARGET_PID% /F >nul 2>&1
if errorlevel 1 (
  echo Failed to kill PID %TARGET_PID%.
  exit /b 1
)

echo Port 5173 owner PID %TARGET_PID% has been terminated.
exit /b 0
