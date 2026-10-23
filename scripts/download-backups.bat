@echo off
rem ============================================================
rem  Campus Food - copy the server's nightly database backups to this laptop
rem  Double-click once a week. Files go to C:\Users\<you>\campus-food-backups
rem  The server address (user@ip) is read from a private file on this laptop, not from the repo:
rem    %USERPROFILE%\campus-food-secrets\server-address.txt   e.g.  azureuser@1.2.3.4
rem  After moving to a new server, change that file (and KEY below if the key changed).
rem ============================================================
setlocal
set CONF=%USERPROFILE%\campus-food-secrets\server-address.txt
set KEY=%USERPROFILE%\.ssh\campus-food-server_key.pem
if not exist "%CONF%" (
  echo Missing %CONF%
  echo Create it with one line: user@server-ip   for example  azureuser@1.2.3.4
  pause
  exit /b 1
)
set /p SERVER=<"%CONF%"

set DEST=%USERPROFILE%\campus-food-backups

if not exist "%KEY%" (
  echo Server key not found: %KEY%
  pause
  exit /b 1
)
if not exist "%DEST%" mkdir "%DEST%"

echo Copying backups from %SERVER% ...
scp -q -i "%KEY%" "%SERVER%:backups/cf-*.sql.gz" "%DEST%"
if errorlevel 1 (
  echo.
  echo FAILED - check the internet, or that the server is running.
  pause
  exit /b 1
)

echo.
echo Done. Backups on this laptop (newest last):
dir /b /od "%DEST%\cf-*.sql.gz"
echo.
echo Folder: %DEST%
echo Tip: upload the newest file to Google Drive now and then.
start "" "%DEST%"
pause
endlocal
