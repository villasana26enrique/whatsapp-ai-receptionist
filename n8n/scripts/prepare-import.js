// Copies the versioned workflows to a temp folder, filling in values from the environment, for `n8n import:workflow`.
// Runs inside the n8n container: node /repo/scripts/prepare-import.js
const fs = require('fs');
const path = require('path');

const SOURCE = '/repo/workflows';
const TARGET = '/tmp/workflows-to-import';
const calendarId = process.env.GOOGLE_CALENDAR_ID;

if (!calendarId) {
  console.error('GOOGLE_CALENDAR_ID is not set in .env');
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });

for (const file of fs.readdirSync(SOURCE).filter(f => f.endsWith('.json'))) {
  const content = fs.readFileSync(path.join(SOURCE, file), 'utf8').replaceAll('__GOOGLE_CALENDAR_ID__', calendarId);
  fs.writeFileSync(path.join(TARGET, file), content);
  console.log(`prepared ${file}`);
}
