#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export npm_config_cache="$PROJECT_ROOT/.npm-cache"

mkdir -p "$npm_config_cache"
cd "$PROJECT_ROOT"

open_browser_when_ready() {
  local url="http://localhost:3000"
  local opener=""

  if command -v open >/dev/null 2>&1; then
    opener="open"
  elif command -v xdg-open >/dev/null 2>&1; then
    opener="xdg-open"
  else
    return
  fi

  (
    for _ in $(seq 1 30); do
      if command -v curl >/dev/null 2>&1; then
        if curl -fsS "$url" >/dev/null 2>&1; then
          "$opener" "$url" >/dev/null 2>&1 || true
          exit 0
        fi
      else
        sleep 5
        "$opener" "$url" >/dev/null 2>&1 || true
        exit 0
      fi
      sleep 1
    done
  ) &
}

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

open_browser_when_ready
npx vercel dev --local .
