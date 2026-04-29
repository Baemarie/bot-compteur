try {
    require('dotenv').config();
} catch (_) {}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_URL = process.env.REPO_URL || 'https://github.com/Baemarie/Wha-botchat.git';
const REPO_REF = process.env.REPO_REF || 'main';
const AUTO_CLONE_REPO = (process.env.AUTO_CLONE_REPO || 'false').toLowerCase() === 'true';
const RUNTIME_REPO_DIR = path.join(__dirname, '.runtime-repo');

const GITHUB_RAW_BASE = process.env.GITHUB_RAW_BASE || '';
const GITHUB_REF = process.env.GITHUB_REF || 'main';
const AUTO_SYNC_FROM_GITHUB = (process.env.AUTO_SYNC_FROM_GITHUB || 'false').toLowerCase() === 'true';

const filesToSync = ['bot-main.js', 'README.md'];

const cloneOrUpdateRepo = () => {
    if (!AUTO_CLONE_REPO) {
        console.log('ℹ️ Auto clone désactivé (AUTO_CLONE_REPO=false).');
        return null;
    }

    try {
        if (!fs.existsSync(RUNTIME_REPO_DIR)) {
            console.log(`🔄 Clone repo: ${REPO_URL} (${REPO_REF})`);
            execSync(`git clone --depth 1 --branch ${REPO_REF} ${REPO_URL} ${RUNTIME_REPO_DIR}`, { stdio: 'inherit' });
        } else {
            console.log('🔄 Repo runtime déjà présent, pull des dernières modifications...');
            execSync(`git -C ${RUNTIME_REPO_DIR} fetch origin ${REPO_REF}`, { stdio: 'inherit' });
            execSync(`git -C ${RUNTIME_REPO_DIR} checkout ${REPO_REF}`, { stdio: 'inherit' });
            execSync(`git -C ${RUNTIME_REPO_DIR} pull --ff-only origin ${REPO_REF}`, { stdio: 'inherit' });
        }

        const candidate = path.join(RUNTIME_REPO_DIR, 'whatsapp-quiz-bot', 'bot-main.js');
        if (fs.existsSync(candidate)) return candidate;

        console.warn('⚠️ bot-main.js absent dans le repo cloné, fallback local.');
        return null;
    } catch (error) {
        console.error('⚠️ Clone/pull impossible, fallback local:', error.message);
        return null;
    }
};

const syncFromGithub = async () => {
    if (!AUTO_SYNC_FROM_GITHUB || !GITHUB_RAW_BASE) {
        console.log('ℹ️ GitHub sync désactivé (AUTO_SYNC_FROM_GITHUB=false ou GITHUB_RAW_BASE absent).');
        return;
    }

    console.log(`🔄 Sync GitHub activé depuis: ${GITHUB_RAW_BASE} (ref: ${GITHUB_REF})`);

    for (const relativeFile of filesToSync) {
        const fileUrl = `${GITHUB_RAW_BASE}/${GITHUB_REF}/whatsapp-quiz-bot/${relativeFile}`;
        try {
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const content = await response.text();
            const filePath = path.join(__dirname, relativeFile);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fichier synchronisé: ${relativeFile}`);
        } catch (error) {
            console.error(`⚠️ Sync ignorée pour ${relativeFile}: ${error.message}`);
        }
    }
};

(async () => {
    await syncFromGithub();

    const clonedEntrypoint = cloneOrUpdateRepo();
    const localEntrypoint = path.join(__dirname, 'bot-main.js');
    const entrypoint = clonedEntrypoint || localEntrypoint;

    if (!fs.existsSync(entrypoint)) {
        throw new Error('Aucun bot-main.js disponible (clone + local).');
    }

    console.log(`✅ Entrypoint utilisé: ${entrypoint}`);
    require(entrypoint);
})();
