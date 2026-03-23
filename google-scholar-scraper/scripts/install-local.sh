#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export npm_config_cache="$PROJECT_ROOT/.npm-cache"

mkdir -p "$npm_config_cache"
cd "$PROJECT_ROOT"

echo "Google Scholar Publication Scraper"
echo "Local installation for macOS/Linux"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required."
  echo "Install Node.js from https://nodejs.org/ and run this script again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. It is normally installed with Node.js."
  exit 1
fi

echo "Installing project dependencies..."
npm install

echo
echo "Installation complete."
echo "To start the full local app, run:"
echo "./scripts/start-local.sh"
