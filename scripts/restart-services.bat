@echo off
rem ============================================================
rem  Restart several microservices after rebuilding them (development).
rem  Double-click: restarts restaurant, order and notification services.
rem  Or:  scripts\restart-services.bat auth-service api-gateway
rem  Asks for the MySQL password once; each service gets its own window.
rem ============================================================
setlocal
cd /d "%~dp0.."
set SERVICES=%*
if "%SERVICES%"=="" set SERVICES=restaurant-service order-service notification-service
if "%DB_PASSWORD%"=="" set /p DB_PASSWORD=Enter your MySQL root password:
for %%S in (%SERVICES%) do (
  if exist "backend\%%S\target\%%S-0.0.1-SNAPSHOT.jar" (
    echo Starting %%S ...
    start "%%S" cmd /k java -jar backend\%%S\target\%%S-0.0.1-SNAPSHOT.jar
  ) else (
    echo Missing backend\%%S\target\%%S-0.0.1-SNAPSHOT.jar - build it first.
  )
)
echo.
echo Started. Give them about 30 seconds. You can close this window.
endlocal
