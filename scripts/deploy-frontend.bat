@echo off
rem ============================================================
rem  Campus Food - put the website (frontend) changes live on the server
rem  Use after changing photos, text or screens in the frontend folder.
rem  Double-click. Takes about 2-4 minutes. The backend is not touched.
rem  The server address (user@ip) is read from a private file on this laptop:
rem    %USERPROFILE%\campus-food-secrets\server-address.txt
rem ============================================================
setlocal
cd /d "%~dp0.."
set CONF=%USERPROFILE%\campus-food-secrets\server-address.txt
set KEY=%USERPROFILE%\.ssh\campus-food-server_key.pem
set PACK=%TEMP%\campus-food-frontend.tgz

if not exist "%CONF%" (
  echo Missing %CONF%
  echo Create it with one line: user@server-ip   for example  azureuser@1.2.3.4
  pause
  exit /b 1
)
set /p SERVER=<"%CONF%"
if not exist "%KEY%" (
  echo Server key not found: %KEY%
  pause
  exit /b 1
)

echo Packing the frontend ...
tar -czf "%PACK%" --exclude=node_modules --exclude=dist frontend
if errorlevel 1 (
  echo Packing FAILED.
  pause
  exit /b 1
)

echo Uploading to %SERVER% ...
scp -q -i "%KEY%" "%PACK%" "%SERVER%:campus-food-frontend.tgz"
if errorlevel 1 (
  echo Upload FAILED - check the internet, or that the server is running.
  pause
  exit /b 1
)

echo Rebuilding the website on the server (2-4 minutes) ...
ssh -i "%KEY%" %SERVER% "cd ~/campus-food && chmod -R u+w frontend 2>/dev/null; rm -rf frontend && tar -xzf ~/campus-food-frontend.tgz --delay-directory-restore && chmod -R u+rwX frontend && docker compose up -d --build web"
if errorlevel 1 (
  echo.
  echo Rebuild FAILED - read the messages above. The old website keeps running.
  pause
  exit /b 1
)

del "%PACK%" >nul 2>nul
echo.
echo Done. Open the website and press Ctrl+F5 (or close and reopen the app on the phone).
pause
endlocal
