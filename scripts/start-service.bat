@echo off
rem ============================================================
rem  Restart ONE microservice after rebuilding it (development).
rem  Usage:  scripts\start-service.bat notification-service
rem ============================================================
setlocal
cd /d "%~dp0.."
if "%~1"=="" (
  echo Usage: scripts\start-service.bat ^<service-name^>
  exit /b 1
)
if not exist "backend\%~1\target\%~1-0.0.1-SNAPSHOT.jar" (
  echo Missing backend\%~1\target\%~1-0.0.1-SNAPSHOT.jar - build it first.
  exit /b 1
)
if "%DB_PASSWORD%"=="" set /p DB_PASSWORD=Enter your MySQL root password:
cls
echo Starting %~1 ...
java -jar backend\%~1\target\%~1-0.0.1-SNAPSHOT.jar
endlocal
