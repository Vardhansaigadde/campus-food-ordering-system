@echo off
rem Double-click to (re)start only the Order Service after it was rebuilt.
title Order Service :8083
call "%~dp0start-service.bat" order-service
pause
