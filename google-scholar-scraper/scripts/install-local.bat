@echo off
setlocal

echo Google Scholar Publication Scraper
echo Local installation for Windows
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  echo Install Node.js from https://nodejs.org/ and run this script again.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. It is normally installed with Node.js.
  exit /b 1
)

echo Installing project dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Installation failed.
  exit /b 1
)

echo.
echo Installation complete.
echo To start the full local app, run:
echo scripts\run-local.bat
