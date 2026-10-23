// Removes instance-specific and personal data from exported workflows so they can be committed.
// Runs inside the n8n container: node /repo/scripts/clean-export.js
const fs = require('fs');
const path = require('path');

const DIR = '/repo/workflows';
const CALENDAR_PLACEHOLDER = '__GOOGLE_CALENDAR_ID__';
const RAG_SEARCH_URL_PLACEHOLDER = '__RAG_SEARCH_URL__';
// Filled in at import (prepare-import.js); the real secrets must never reach the repository
const APP_SECRET_PLACEHOLDER = "const APP_SECRET = '__META_APP_SECRET__';";
const VERIFY_TOKEN_PLACEHOLDER = '__WHATSAPP_VERIFY_TOKEN__';
// Fields that describe this instance (owner, versions, timestamps), not the workflow itself
const DROP = ['shared', 'versionMetadata', 'activeVersionId', 'versionCounter', 'triggerCount',
  'sourceWorkflowId', 'createdAt', 'updatedAt', 'versionId', 'staticData', 'pinData', 'isArchived'];

for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  const full = path.join(DIR, file);
  let workflow = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (Array.isArray(workflow)) workflow = workflow[0];

  for (const field of DROP) delete workflow[field];
  if (workflow.meta) delete workflow.meta.instanceId;
  workflow.active = false;

  for (const node of workflow.nodes) {
    const calendar = node.parameters && node.parameters.calendar;
    if (calendar && typeof calendar.value === 'string' && calendar.value.endsWith('@group.calendar.google.com')) {
      calendar.value = CALENDAR_PLACEHOLDER;
      calendar.cachedResultName = 'Clinic calendar';
    }
    // The RAG search URL depends on where it is deployed
    if (node.type === 'n8n-nodes-base.httpRequest' && /\/webhook\/search$/.test(node.parameters.url || '')) {
      node.parameters.url = RAG_SEARCH_URL_PLACEHOLDER;
    }
    if (node.type === 'n8n-nodes-base.code' && /const APP_SECRET = /.test(node.parameters.jsCode || '')) {
      node.parameters.jsCode = node.parameters.jsCode.replace(/const APP_SECRET = '[^']*';/, APP_SECRET_PLACEHOLDER);
    }
    if (node.name === 'Verify token matches?') {
      for (const condition of node.parameters.conditions.conditions) condition.rightValue = VERIFY_TOKEN_PLACEHOLDER;
    }
  }

  fs.writeFileSync(full, JSON.stringify(workflow, null, 2) + '\n');
  console.log(`cleaned ${file}`);
}
