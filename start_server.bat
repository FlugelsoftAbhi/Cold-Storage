@echo off
echo =============================================================
echo   FrigidFlow Logistics Dashboard - Local Development Server
echo =============================================================
echo.
echo [INFO] Starting HTTP server on http://localhost:3000
echo [INFO] Press Ctrl+C in this terminal window to stop the server.
echo.
python -m http.server 3000
