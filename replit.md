# WhatsApp Points Bot

## Overview

Bot WhatsApp de gestion de points (sans IA) pour des quiz/événements en groupe.

## Architecture

- Runtime: Node.js 20
- WhatsApp client: `whatsapp-web.js`
- Persistance: JSON local (`points-state.json`)
- Backup: JSON local (`points-state.backup.json`)
- Session storage: local filesystem (`whatsapp-quiz-bot/sessions/`)

## Run

Le script racine `start.sh`:
1. détecte Chromium,
2. entre dans `whatsapp-quiz-bot/`,
3. lance `node index.js`.

## Variables d'environnement

- `SCORE_EMOJI` (optionnel, défaut `🖤`)
- `BACKUP_INTERVAL_MS` (optionnel, défaut `300000`)
