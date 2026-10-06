// Removes instance-specific and personal data from exported workflows so they can be committed.
// Runs inside the n8n container: node /repo/scripts/clean-export.js
const fs = require('fs');
const path = require('path');

const DIR = '/repo/workflows';
const CALENDAR_PLACEHOLDER = '__GOOGLE_CALENDAR_ID__';
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
  }

  fs.writeFileSync(full, JSON.stringify(workflow, null, 2) + '\n');
  console.log(`cleaned ${file}`);
}
