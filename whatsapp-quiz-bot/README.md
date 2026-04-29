# WhatsApp Points Bot (multi-salons, sans IA)

## Architecture recommandée (starter clone)

Le `index.js` sert de starter:
- il clone le repo une fois dans `.runtime-repo/`
- puis il fait `fetch/pull` sur les redémarrages
- il lance `whatsapp-quiz-bot/bot-main.js` depuis le repo cloné
- si clone/pull échoue, fallback sur `bot-main.js` local

## Variables d'environnement starter

```env
AUTO_CLONE_REPO=true
REPO_URL=https://github.com/Baemarie/Wha-botchat.git
REPO_REF=main
```

## Commandes bot

- `.menu`
- `.points on` / `.points off`
- `.points theme <nom>`
- `.points reset`
- `.actual` ou `.points table`
- `.final`
- `.undo`
- `.add @pseudo N`
- `.remove @pseudo N`
- `.set @pseudo N`
- `.clear @pseudo`

## Variables bot
## Activation modérateur

Quand un membre fait `.points on`:
1. Le bot répond: **"Vous etes desormais le moderateur je vais compter pour vous"**
2. Le bot envoie un 2e message demandant de répondre avec un emoji pour remplacer l'emoji par défaut.

Si le modérateur répond à ce 2e message uniquement avec un emoji, cet emoji devient l'emoji de comptage **temporaire** pour le salon.

Quand le modérateur fait `.points off`, l'emoji temporaire est réinitialisé.

## Commandes

- `.menu` → menu d'aide
- `.points on` / `.points off`
- `.points theme <nom>`
- `.points reset`
- `.actual` ou `.points table`
- `.final`
- `.undo`
- `.add @pseudo N`
- `.remove @pseudo N`
- `.set @pseudo N`
- `.clear @pseudo`

## Confirmations

Toutes les commandes (sauf `.actual` et `.final`) renvoient un message court de confirmation en **gras**.

## Variables d'environnement

```env
SCORE_EMOJI=🖤
BACKUP_INTERVAL_MS=300000
```


## Mode starter (hosting)

Le `index.js` sert de **starter**:
- il peut synchroniser `bot-main.js` depuis GitHub,
- puis il lance `bot-main.js`.

Variables optionnelles:

```env
AUTO_SYNC_FROM_GITHUB=true
GITHUB_RAW_BASE=https://raw.githubusercontent.com/<owner>/<repo>
GITHUB_REF=main
```

Si `AUTO_SYNC_FROM_GITHUB=false`, le starter lance simplement le `bot-main.js` local.
