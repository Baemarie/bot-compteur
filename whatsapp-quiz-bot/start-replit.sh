#!/usr/bin/env bash
set -euo pipefail

# Replit startup helper for WhatsApp + Puppeteer/Chromium
if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  if command -v chromium >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="$(command -v chromium)"
  elif command -v chromium-browser >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="$(command -v chromium-browser)"
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    export PUPPETEER_EXECUTABLE_PATH="$(command -v google-chrome-stable)"
  else
    echo "⚠️ Chromium not found in PATH; relying on app-side auto-detection."
  fi
fi

if [ -n "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  export CHROME_BIN="${CHROME_BIN:-$PUPPETEER_EXECUTABLE_PATH}"
  export CHROMIUM_PATH="${CHROMIUM_PATH:-$PUPPETEER_EXECUTABLE_PATH}"
  echo "🧭 Using Chromium at: $PUPPETEER_EXECUTABLE_PATH"
fi

if [ ! -d node_modules ]; then
  npm install
fi

npm start
