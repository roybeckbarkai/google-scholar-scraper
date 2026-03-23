#!/usr/bin/env bash
set -euo pipefail

echo "Google Scholar Publication Scraper"
echo "Starting full local app on macOS/Linux"
echo

if [ ! -d node_modules ]; then
  echo "Dependencies are not installed yet."
  echo "Run ./scripts/start-local.sh instead."
  exit 1
fi

npx vercel dev
