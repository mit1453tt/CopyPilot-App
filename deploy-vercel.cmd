@echo off
REM Run after: npx vercel login
cd /d "%~dp0"
echo Deploying CopyPilot to Vercel production...
call npx vercel --prod --yes
if errorlevel 1 (
  echo.
  echo FAILED. First run: npx vercel login
  pause
  exit /b 1
)
echo.
echo Done. Check https://fixiby.vercel.app/
pause
