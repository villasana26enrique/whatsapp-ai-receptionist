// Copies the versioned workflows to a temp folder, filling in values from the environment, for `n8n import:workflow`.
// Runs inside the n8n container: node /repo/scripts/prepare-import.js
const fs = require('fs');
const path = require('path');

const SOURCE = '/repo/workflows';
const TARGET = '/tmp/workflows-to-import';
const calendarId = process.env.GOOGLE_CALENDAR_ID;
// Optional: without it the clinic documents tool answers that it cannot check them
const ragSearchUrl = process.env.RAG_SEARCH_URL || 'http://rag-search-url-not-configured.invalid/webhook/search';
// Without them every webhook from Meta is rejected (403)
const metaAppSecret = process.env.META_APP_SECRET;
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
if (!metaAppSecret || !verifyToken) console.warn('META_APP_SECRET or WHATSAPP_VERIFY_TOKEN is not set in .env: Meta webhooks will be rejected');

if (!calendarId) {
  console.error('GOOGLE_CALENDAR_ID is not set in .env');
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });

for (const file of fs.readdirSync(SOURCE).filter(f => f.endsWith('.json'))) {
  const content = fs.readFileSync(path.join(SOURCE, file), 'utf8')
    .replaceAll('__GOOGLE_CALENDAR_ID__', calendarId)
    .replaceAll('__RAG_SEARCH_URL__', ragSearchUrl)
    .replaceAll('__META_APP_SECRET__', metaAppSecret || '__META_APP_SECRET__')
    .replaceAll('__WHATSAPP_VERIFY_TOKEN__', verifyToken || '__WHATSAPP_VERIFY_TOKEN__');
  fs.writeFileSync(path.join(TARGET, file), content, { mode: 0o600 });
  console.log(`prepared ${file}`);
}
