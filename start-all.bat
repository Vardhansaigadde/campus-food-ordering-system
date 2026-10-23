@echo off
rem ============================================================
rem  Campus Food Pre-Order System - start every microservice
rem  Order: Eureka -> business services -> API Gateway -> React
rem  Usage:  start-all.bat          (normal)
rem          start-all.bat scale    (also a 2nd Order Service on 8093)
rem ============================================================
setlocal
cd /d "%~dp0"

if "%DB_PASSWORD%"=="" set /p DB_PASSWORD=Enter your MySQL root password:

for %%S in (eureka-server api-gateway auth-service restaurant-service order-service notification-service) do (
  if not exist "backend\%%S\target\%%S-0.0.1-SNAPSHOT.jar" (
    echo Missing backend\%%S\target\%%S-0.0.1-SNAPSHOT.jar - run build-all.bat first.
    pause
    exit /b 1
  )
)

echo Starting Eureka Server (service registry) on port 8761...
start "Eureka Server :8761" cmd /k java -jar backend\eureka-server\target\eureka-server-0.0.1-SNAPSHOT.jar
timeout /t 15 /nobreak >nul

echo Starting Auth, Restaurant, Order and Notification services...
start "Auth Service :8081" cmd /k java -jar backend\auth-service\target\auth-service-0.0.1-SNAPSHOT.jar
start "Restaurant Service :8082" cmd /k java -jar backend\restaurant-service\target\restaurant-service-0.0.1-SNAPSHOT.jar
start "Order Service :8083" cmd /k java -jar backend\order-service\target\order-service-0.0.1-SNAPSHOT.jar
start "Notification Service :8084" cmd /k java -jar backend\notification-service\target\notification-service-0.0.1-SNAPSHOT.jar

if /i "%1"=="scale" (
  echo Starting a SECOND copy of the Order Service on port 8093 - load balancing demo...
  start "Order Service :8093" cmd /k "set PORT=8093&& java -jar backend\order-service\target\order-service-0.0.1-SNAPSHOT.jar"
)

echo Starting API Gateway on port 8080...
start "API Gateway :8080" cmd /k java -jar backend\api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar

echo Starting React frontend on port 5173...
start "Frontend :5173" cmd /k "cd frontend && npm run dev"

echo.
echo  All services are starting - give them about a minute.
echo   Eureka dashboard : http://localhost:8761
echo   Website          : http://localhost:5173
echo   Swagger (orders) : http://localhost:8083/swagger-ui.html
echo.
echo  First time? Load demo data once everything is up:  python scripts\seed_demo.py
endlocal
