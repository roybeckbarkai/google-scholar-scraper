@echo off
setlocal

title Google Scholar Publication Scraper

echo Google Scholar Publication Scraper
echo Starting local app...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. It is normally installed with Node.js.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run detected. Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation failed.
    pause
    exit /b 1
  )
  echo.
)

echo Launching the full local app...
echo Keep this window open while you use the app.
echo.
call npx vercel dev

if errorlevel 1 (
  echo.
  echo The app stopped with an error.
  pause
)
