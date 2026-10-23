@echo off
rem ============================================================
rem  Campus Food Pre-Order System - build every microservice
rem  Builds the 6 Spring Boot JARs (tests skipped) and installs
rem  the React frontend's npm packages.
rem  Usage:  build-all.bat          (normal)
rem          build-all.bat test     (also run each service's tests)
rem  Needs:  JDK 21 on PATH, Node.js 20+ with npm
rem ============================================================
setlocal
cd /d "%~dp0"

set SKIP_TESTS=-DskipTests
if /i "%1"=="test" set SKIP_TESTS=

where java >nul 2>nul || (echo Java not found - install JDK 21 and add it to PATH. & pause & exit /b 1)
where npm  >nul 2>nul || (echo npm not found - install Node.js 20 or newer. & pause & exit /b 1)

for %%S in (eureka-server api-gateway auth-service restaurant-service order-service notification-service) do (
  echo.
  echo ===== Building %%S =====
  pushd backend\%%S
  rem rmdir instead of "mvn clean": Maven cannot delete OneDrive placeholder folders
  if exist target rmdir /s /q target
  call .\mvnw.cmd -q package %SKIP_TESTS%
  if errorlevel 1 (
    popd
    echo.
    echo BUILD FAILED in %%S - see the errors above.
    pause
    exit /b 1
  )
  popd
)

echo.
echo ===== Installing frontend packages =====
pushd frontend
call npm install
if errorlevel 1 (
  popd
  echo.
  echo npm install FAILED - see the errors above.
  pause
  exit /b 1
)
popd

echo.
echo  Build finished. All 6 JARs are in backend\^<service^>\target\
echo  Next: run start-all.bat
endlocal
