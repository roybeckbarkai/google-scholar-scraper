#!/usr/bin/env bash
set -euo pipefail

echo "Google Scholar Publication Scraper"
echo "Starting local app..."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Install Node.js LTS from https://nodejs.org/ and run this file again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. It is normally installed with Node.js."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First run detected. Installing project dependencies..."
  npm install
  echo
fi

echo "Launching the full local app..."
echo "Keep this terminal open while you use the app."
echo

npx vercel dev
