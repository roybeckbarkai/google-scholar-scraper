#!/usr/bin/env bash
set -euo pipefail

echo "Google Scholar Publication Scraper"
echo "Starting full local app on macOS/Linux"
echo

if [ ! -d node_modules ]; then
  echo "Dependencies are not installed yet."
  echo "Run ./scripts/install-local.sh first."
  exit 1
fi

npx vercel dev
