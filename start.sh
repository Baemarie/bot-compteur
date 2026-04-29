#!/usr/bin/env bash
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)
echo "Using Chromium: $PUPPETEER_EXECUTABLE_PATH"
cd whatsapp-quiz-bot
node index.js
