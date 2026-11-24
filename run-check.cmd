@echo off
REM Wrapper for Windows Task Scheduler. Runs the check from this folder.
REM Optional environment: BUN_PATH (full path to bun.exe; default: "bun" from PATH),
REM LLM_MONITOR_ENV_FILE, LLM_MONITOR_DATA_DIR. Output goes to %TEMP%\llm-balance-check.log.
cd /d "%~dp0"
if "%BUN_PATH%"=="" set "BUN_PATH=bun"
"%BUN_PATH%" run check-balances.ts > "%TEMP%\llm-balance-check.log" 2>&1
