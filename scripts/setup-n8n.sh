#!/usr/bin/env bash
# Sets up a fresh n8n with everything this project needs: credentials (from .env), workflows and publishing.
# Usage: docker compose up -d && ./scripts/setup-n8n.sh
# Only manual step left: open the "Google Calendar account" credential in n8n and click "Sign in with Google".
set -euo pipefail
# Git Bash on Windows rewrites paths like /repo/... into C:/...; this keeps them as container paths
export MSYS_NO_PATHCONV=1
cd "$(dirname "$0")/.."

# ENV_FILE / COMPOSE_PROJECT_NAME allow targeting another environment (e.g. a throwaway test stack)
ENV_FILE="${ENV_FILE:-.env}"
set -a; source "$ENV_FILE"; set +a
docker() { if [ "$1" = compose ]; then shift; command docker compose --env-file "$ENV_FILE" "$@"; else command docker "$@"; fi; }

# Secrets go to this one command only; they are never stored in the n8n container's environment
docker compose exec -T \
  -e POSTGRES_DB -e POSTGRES_USER -e POSTGRES_PASSWORD \
  -e WHATSAPP_ACCESS_TOKEN -e WHATSAPP_BUSINESS_ACCOUNT_ID \
  -e GEMINI_API_KEY -e GOOGLE_OAUTH_CLIENT_ID -e GOOGLE_OAUTH_CLIENT_SECRET \
  n8n sh -c 'node /repo/scripts/build-credentials.js \
    && n8n import:credentials --input=/tmp/credentials-to-import.json \
    ; rm -f /tmp/credentials-to-import.json'

docker compose exec -T -e GOOGLE_CALENDAR_ID n8n node /repo/scripts/prepare-import.js
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/workflows-to-import

# Sub-workflows first, so the agent's tools exist when the agent is published
for id in u4zk3B48hPfoFaaa tCInZXEmBEsGlo9t 4e88mmZwNoHCeo16 5Iy94ttvJAAoeHMJ FK9P24mIWJfyvTCV QZQq06oaHBMGxTpB \
          qQGy3dYYWmNR3kVx 6j99EaNwCWiWzInA ltnx0Bx5jpnZAskJ; do
  docker compose exec -T n8n n8n publish:workflow --id="$id"
done

# Published workflows are loaded at startup
docker compose restart n8n
echo "Done. Last step: in n8n, open the 'Google Calendar account' credential and click 'Sign in with Google'."
