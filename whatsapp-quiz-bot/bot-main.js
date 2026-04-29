require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const pointsFile = path.join(__dirname, 'points-state.json');
const backupFile = path.join(__dirname, 'points-state.backup.json');
const scoringEmoji = process.env.SCORE_EMOJI || '🖤';
const backupIntervalMs = Number(process.env.BACKUP_INTERVAL_MS || 300000);

const proverbPool = [
    'Petit à petit, on va plus loin.',
    'Régularité bat vitesse.',
    'Chaque point compte.',
    'Discipline et patience.',
    'Le calme gagne souvent.',
    'Un effort, un progrès.',
    'Jouer juste avant tout.',
    'Mieux vaut constant que pressé.'
];

const defaultChatState = () => ({
    enabled: false,
    moderatorId: null,
    theme: 'Quizz Multiverse',
    participants: {},
    lastAward: null,
    actionHistory: [],
    awardedMessageIds: {},
    customEmoji: null,
    pendingEmojiSetupMessageId: null
});

const defaultGlobalState = { chats: {} };

const loadState = () => {
    try {
        if (!fs.existsSync(pointsFile)) return { ...defaultGlobalState };
        const raw = JSON.parse(fs.readFileSync(pointsFile, 'utf8'));

        // migration old single-chat format -> multi-chat
        if (!raw.chats) {
            return {
                chats: {
                    default: {
                        ...defaultChatState(),
                        ...raw,
                        participants: raw.participants || {},
                        actionHistory: raw.actionHistory || [],
                        awardedMessageIds: raw.awardedMessageIds || {}
                    }
                }
            };
        }

        const hydrated = { chats: {} };
        Object.entries(raw.chats).forEach(([chatId, state]) => {
            hydrated.chats[chatId] = {
                ...defaultChatState(),
                ...state,
                participants: state.participants || {},
                actionHistory: state.actionHistory || [],
                awardedMessageIds: state.awardedMessageIds || {}
            };
        });

        return hydrated;
    } catch (error) {
        console.error('❌ Impossible de lire points-state.json:', error.message);
        return { ...defaultGlobalState };
    }
};

let pointsState = loadState();

const saveState = () => {
    try {
        fs.writeFileSync(pointsFile, JSON.stringify(pointsState, null, 2), 'utf8');
    } catch (error) {
        console.error('❌ Impossible de sauvegarder points-state.json:', error.message);
    }
};

const backupState = () => {
    try {
        fs.writeFileSync(backupFile, JSON.stringify(pointsState, null, 2), 'utf8');
        console.log('💾 Backup points-state.backup.json effectué');
    } catch (error) {
        console.error('❌ Impossible de sauvegarder le backup:', error.message);
    }
};

const getRandomProverb = () => proverbPool[Math.floor(Math.random() * proverbPool.length)];
const getChatId = (message) => (message.fromMe && message.to) ? message.to : message.from;

const getChatState = (chatId) => {
    if (!pointsState.chats[chatId]) pointsState.chats[chatId] = defaultChatState();
    return pointsState.chats[chatId];
};

const normalizeActorId = (message) => message.author || message.from;
const getActiveEmoji = (chatState) => chatState.customEmoji || scoringEmoji;
const hasScoringEmoji = (chatState, text) => (text || '').includes(getActiveEmoji(chatState));
const isAdminCmd = (text) => text === '.bot' || text.startsWith('.bot ') || text === '.actual' || text === '.final' || text === '.undo' || text === '.menu' || text.startsWith('.add ') || text.startsWith('.remove ') || text.startsWith('.set ') || text.startsWith('.clear ');

const ensureParticipant = (chatState, id, displayName) => {
    if (!chatState.participants[id]) chatState.participants[id] = { id, displayName: displayName || id.split('@')[0], points: 0 };
};

const parseMentionedTarget = (message, text) => {
    const ids = message.mentionedIds || [];
    if (ids.length > 0) return ids[0];
    const token = text.split(' ')[1];
    if (!token) return null;
    if (token.startsWith('@')) return `${token.slice(1)}@c.us`;
    return null;
};


const moderatorNoticeText = (chatState) => {
    if (!chatState.moderatorId) return 'Aucun modérateur actif.';
    return `@${chatState.moderatorId.split('@')[0]} est actuellement le moderateur`;
};

const replyWithModeratorMention = async (message, chatState) => {
    if (!chatState.moderatorId) {
        await message.reply('Aucun modérateur actif.');
        return;
    }

    const chat = await message.getChat();
    const modContact = await client.getContactById(chatState.moderatorId);
    await chat.sendMessage(moderatorNoticeText(chatState), { mentions: [modContact] });
};

const applyScoreChange = (chatState, targetId, displayName, delta, reason) => {
    ensureParticipant(chatState, targetId, displayName);
    chatState.participants[targetId].points = Math.max(0, (chatState.participants[targetId].points || 0) + delta);
    const action = { ts: new Date().toISOString(), targetId, displayName: chatState.participants[targetId].displayName, delta, reason };
    chatState.lastAward = action;
    chatState.actionHistory.push(action);
    if (chatState.actionHistory.length > 300) chatState.actionHistory.shift();
    saveState();
    return action;
};

const formatLeaderboard = (chatState, { isFinal = false, groupName = '', moderatorName = '' } = {}) => {
    const entries = Object.values(chatState.participants).sort((a, b) => b.points - a.points);
    const totalPoints = entries.reduce((sum, p) => sum + (p.points || 0), 0);

    const medal = (index) => {
        if (!isFinal) return '';
        if (index === 0) return ' 🏆🥇';
        if (index === 1) return ' 🥈';
        if (index === 2) return ' 🥉';
        return '';
    };

    const lines = [
        '〖      *🔰 ＱＵＩＺＺ 🔰*     〗',
        '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
        `*Ⓜ️odo : ${moderatorName || '—'}.*`,
        '',
        `*🏰 : ${groupName || '—'}*`,
        '┏━━━━━━━━━━━━━━━━━━━━',
        `*📌 THÈME :* \`\`\`『${chatState.theme}』\`\`\` `,
        '┗━━━━━━━━━━━━━━━━━━━━',
        '',
        `*✅️ NB : ${totalPoints}*`,
        '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒'
    ];

    if (entries.length === 0) {
        lines.push('➠ _Aucun participant pour le moment._');
    } else {
        entries.forEach((entry, index) => {
            lines.push(`➠ ${entry.displayName} ${entry.points}PT${medal(index)}`);
        });
    }

    lines.push('▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒');
    lines.push('');
    lines.push(`\`▰ ${getRandomProverb()}\``);

    return lines.join('\n');
};

const buildLeaderboardContext = async (message, chatState) => {
    let groupName = '';
    let moderatorName = '';
    try {
        const chat = await message.getChat();
        groupName = chat?.name || '';
    } catch (_) {}
    if (chatState.moderatorId) {
        try {
            const contact = await client.getContactById(chatState.moderatorId);
            moderatorName = contact?.pushname || contact?.name || contact?.shortName || chatState.moderatorId.split('@')[0];
        } catch (_) {
            moderatorName = chatState.moderatorId.split('@')[0];
        }
    }
    return { groupName, moderatorName };
};

const formatMenu = () => [
    '📚 *MENU COMMANDES*',
    '━━━━━━━━━━━━━━━━━━',
    '`.bot on` → active le comptage (1er modérateur du salon)',
    '`.bot off` → désactive et réinitialise complètement ce salon',
    '`.bot theme <nom>` → change le thème du salon',
    '`.bot reset` → remet à zéro les scores (garde le modérateur)',
    '`.bot table` ou `.actual` → tableau actuel',
    '`.final` → tableau final avec podium',
    '`.undo` → annule la dernière action',
    '`.add @user N` → ajoute N points',
    '`.remove @user N` → retire N points',
    '`.set @user N` → fixe le score à N',
    '`.clear @user` → remet un joueur à 0',
    `Répondre avec l'emoji actif à un message → +1 point`,
    '━━━━━━━━━━━━━━━━━━'
].join('\n');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'assistant-bot-session', dataPath: sessionsDir }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process', '--disable-extensions', '--disable-background-networking', '--disable-default-apps', '--mute-audio', '--no-default-browser-check'],
        timeout: 120000
    }
});

let isReady = false;
client.on('qr', (qr) => { if (!isReady) qrcode.generate(qr, { small: true }); });
client.on('ready', () => { isReady = true; console.log('✅ WhatsApp multi-salons points bot connecté'); });

client.on('message_create', async (message) => {
    try {
        if (message.isStatus) return;
        const text = (message.body || '').trim();
        if (!text) return;

        const chatId = getChatId(message);
        const chatState = getChatState(chatId);

        const lowered = text.toLowerCase();
        const isOperatorIntent =
            isAdminCmd(lowered)
            || (hasScoringEmoji(chatState, text) && message.hasQuotedMsg)
            || (chatState.pendingEmojiSetupMessageId && message.hasQuotedMsg);
        if (message.fromMe && !isOperatorIntent) return;

        const command = text.toLowerCase();
        const senderId = normalizeActorId(message);
        const isModerator = senderId && senderId === chatState.moderatorId;

        if (command === '.menu') return void await message.reply(formatMenu());

        if (command === '.bot on') {
            if (!chatState.moderatorId) {
                chatState.moderatorId = senderId;
                chatState.enabled = true;
                chatState.customEmoji = null;
                chatState.pendingEmojiSetupMessageId = null;
                saveState();

                await message.reply('*Vous etes desormais le moderateur je vais compter pour vous*');
                const setupMsg = await message.reply("*Si vous voulez changer l'emoji par defaut pour compter repondez a ce message ci par uniquement l'emoji qui me servira de repere*");
                chatState.pendingEmojiSetupMessageId = setupMsg.id?._serialized || null;
                saveState();
                return;
            }
            if (!isModerator) return void await replyWithModeratorMention(message, chatState);
            chatState.enabled = true;
            saveState();
            return void await message.reply('*Comptage active pour ce salon.*');
        }

        if (isAdminCmd(command) && chatState.moderatorId && !isModerator) {
            return void await replyWithModeratorMention(message, chatState);
        }

        if (command === '.bot off') {
            if (!isModerator) return void await message.reply('Seul le modérateur peut désactiver le comptage.');
            delete pointsState.chats[chatId];
            saveState();
            return void await message.reply('*Salon entièrement réinitialisé : modérateur, emoji et scores effacés. Tapez `.bot on` pour redémarrer.*');
        }

        if (command.startsWith('.bot theme ')) {
            if (!isModerator) return void await message.reply('Seul le modérateur peut changer le thème.');
            const nextTheme = text.substring('.bot theme '.length).trim();
            if (!nextTheme) return void await message.reply('Usage: .bot theme <nom_du_theme>');
            chatState.theme = nextTheme;
            saveState();
            return void await message.reply(`*Theme mis a jour:* ${chatState.theme}`);
        }

        if (command === '.bot reset') {
            if (!isModerator) return void await message.reply('Seul le modérateur peut reset.');
            const keptModeratorId = chatState.moderatorId;
            const keptTheme = chatState.theme;
            const keptCustomEmoji = chatState.customEmoji;
            pointsState.chats[chatId] = defaultChatState();
            pointsState.chats[chatId].moderatorId = keptModeratorId;
            pointsState.chats[chatId].theme = keptTheme;
            pointsState.chats[chatId].customEmoji = keptCustomEmoji;
            pointsState.chats[chatId].enabled = true;
            saveState();
            return void await message.reply('*Scores reinitialises pour ce salon.*');
        }

        if (command === '.bot table' || command === '.actual') {
            if (!isModerator && command === '.actual') return void await message.reply('Seul le modérateur peut demander .actual.');
            const ctx = await buildLeaderboardContext(message, chatState);
            return void await message.reply(formatLeaderboard(chatState, { isFinal: false, ...ctx }));
        }

        if (command === '.final') {
            if (!isModerator) return void await message.reply('Seul le modérateur peut demander .final.');
            const ctx = await buildLeaderboardContext(message, chatState);
            return void await message.reply(formatLeaderboard(chatState, { isFinal: true, ...ctx }));
        }

        if (command === '.undo') {
            if (!isModerator) return void await message.reply('Seul le modérateur peut annuler.');
            const lastAction = chatState.actionHistory.pop();
            if (!lastAction) return void await message.reply('Aucune action à annuler.');
            ensureParticipant(chatState, lastAction.targetId, lastAction.displayName);
            chatState.participants[lastAction.targetId].points = Math.max(0, chatState.participants[lastAction.targetId].points - lastAction.delta);
            chatState.lastAward = chatState.actionHistory[chatState.actionHistory.length - 1] || null;
            saveState();
            return void await message.reply(`*Annulation effectuee* pour @${lastAction.displayName}`);
        }

        if (command.startsWith('.add ') || command.startsWith('.remove ') || command.startsWith('.set ') || command.startsWith('.clear ')) {
            if (!isModerator) return void await message.reply('Seul le modérateur peut modifier les scores manuellement.');
            const targetId = parseMentionedTarget(message, text);
            if (!targetId) return void await message.reply('Utilise une mention: ex .add @pseudo 2');

            const displayName = targetId.split('@')[0];
            const parts = text.split(/\s+/);
            const amount = Number(parts[2] || 1);

            if (command.startsWith('.add ')) {
                const applied = applyScoreChange(chatState, targetId, displayName, Number.isFinite(amount) ? Math.max(1, amount) : 1, 'manual_add');
                return void await message.reply(`*Ajout confirme* : @${applied.displayName} +${applied.delta}PT`);
            }
            if (command.startsWith('.remove ')) {
                const delta = Number.isFinite(amount) ? Math.max(1, amount) : 1;
                const applied = applyScoreChange(chatState, targetId, displayName, -delta, 'manual_remove');
                return void await message.reply(`*Retrait confirme* : @${applied.displayName} -${Math.abs(applied.delta)}PT`);
            }
            if (command.startsWith('.set ')) {
                const setValue = Number.isFinite(amount) ? Math.max(0, amount) : 0;
                ensureParticipant(chatState, targetId, displayName);
                chatState.participants[targetId].points = setValue;
                applyScoreChange(chatState, targetId, displayName, 0, `manual_set_${setValue}`);
                return void await message.reply(`*Score fixe* : @${displayName} = ${setValue}PT`);
            }
            if (command.startsWith('.clear ')) {
                ensureParticipant(chatState, targetId, displayName);
                chatState.participants[targetId].points = 0;
                applyScoreChange(chatState, targetId, displayName, 0, 'manual_clear');
                return void await message.reply(`*Remise a zero* : @${displayName}`);
            }
        }

        if (chatState.enabled && isModerator && message.hasQuotedMsg) {
            const quotedMessage = await message.getQuotedMessage();
            const quotedId = quotedMessage.id?._serialized;
            if (chatState.pendingEmojiSetupMessageId && quotedId === chatState.pendingEmojiSetupMessageId) {
                const candidate = text.trim();
                const looksLikeEmojiOnly = candidate.length > 0 && candidate.length <= 16 && !/[a-zA-Z0-9]/.test(candidate) && !candidate.includes(' ');
                if (!looksLikeEmojiOnly) {
                    return void await message.reply("*Reponse invalide:* envoie uniquement un emoji.");
                }
                chatState.customEmoji = candidate;
                chatState.pendingEmojiSetupMessageId = null;
                saveState();
                return void await message.reply(`*Emoji de comptage mis a jour:* ${candidate}`);
            }
        }

        if (isAdminCmd(command)) return;

        if (chatState.enabled && isModerator && hasScoringEmoji(chatState, text) && message.hasQuotedMsg) {
            const quotedMessage = await message.getQuotedMessage();
            if (quotedMessage?.fromMe) return;
            const targetId = normalizeActorId(quotedMessage);
            const targetName = quotedMessage._data?.notifyName || targetId.split('@')[0];

            if (targetId === senderId) return void await message.reply('❌ Tu ne peux pas te donner des points.');
            const quotedId = quotedMessage.id?._serialized;
            if (quotedId && chatState.awardedMessageIds[quotedId]) {
                try { await message.react('⚠️'); } catch (_) {}
                return;
            }

            if (quotedId) chatState.awardedMessageIds[quotedId] = true;
            applyScoreChange(chatState, targetId, targetName, 1, 'emoji_reply_award');
            try { await message.react('✨'); } catch (_) {}
            return;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        try { await message.reply('Erreur interne.'); } catch (_) {}
    }
});

client.on('auth_failure', () => { isReady = false; });
client.on('disconnected', () => { isReady = false; });

setInterval(backupState, backupIntervalMs);

(async () => {
    client.initialize();
})();
