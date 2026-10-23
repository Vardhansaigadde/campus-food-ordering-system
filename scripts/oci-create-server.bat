@echo off
rem Double-click: keeps trying to create the free Oracle server until it works. Leave the window open.
title Getting the free Oracle server...
cd /d "%~dp0.."
python scripts\oci_create_server.py
pause
