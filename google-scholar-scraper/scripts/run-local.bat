@echo off
setlocal

echo Google Scholar Publication Scraper
echo Starting full local app on Windows
echo.

if not exist node_modules (
  echo Dependencies are not installed yet.
  echo Run scripts\start-local.bat instead.
  exit /b 1
)

call npx vercel dev
