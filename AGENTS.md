# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository.
Read `README.md` first for what the project does and how it is structured.

## Project in one paragraph

A WhatsApp AI receptionist for a fictional dental clinic. n8n hosts the agent (Gemini chat model, Postgres chat
memory, five tools). Each tool is an n8n sub-workflow that calls a PL/pgSQL function in the `dental_clinic` schema.
PostgreSQL is the source of truth; Google Calendar is only a mirror kept in sync by a scheduled workflow.

## Conventions

- **Everything technical is in English**: tables, columns, functions, workflow and node names, files, comments,
  commit messages, docs. Messages returned to the LLM are English too (the agent replies in the patient's language).
- **Business rules live in the database**, not in n8n Code nodes or prompts. n8n nodes stay thin:
  call a function, branch on `ok`, pass `message` back to the agent.
- Database functions return `jsonb` with `ok` and `message` instead of raising errors for business cases.
- Every function declares `SET search_path = dental_clinic` (n8n connects with the default schema; without it the
  function cannot find its tables).
- Times are `timestamptz`; the clinic time zone is in `dental_clinic.clinic.time_zone`.
- Cancelling is a soft delete (`status = 'cancelled'`); every change is logged in `appointment_history`.

## Database changes (Flyway)

- New tables, columns or data: add `database/migrations/V<next>__short_description.sql`.
  **Never modify a versioned migration that has already been applied.**
- Functions: edit or add `database/functions/R__*.sql` with `CREATE OR REPLACE`; Flyway re-applies them on change.
- Apply: `docker compose run --rm flyway` (also runs on `docker compose up`).
- Run the tests after any database change and keep them green:

  ```bash
  docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < database/tests/booking_tests.sql
  ```

  Add a test for new behavior in `database/tests/booking_tests.sql` (it runs in a rolled-back transaction).

## n8n workflow changes

- The JSON files in `n8n/workflows/` are the source of truth for the repository, but n8n runs from its own database.
  After changing a workflow in n8n, run `./scripts/export-workflows.sh` and commit the result.
- Sub-workflows are referenced **by id** from the agent's tool nodes; keep ids stable (import preserves them).
  New workflows must be added to the id map in `scripts/export-workflows.sh`.
- Never hard-code personal or instance data in workflows: the calendar id is `__GOOGLE_CALENDAR_ID__` in the
  exported files; credentials are referenced, never embedded.
- `./scripts/setup-n8n.sh` is for a fresh instance: it re-creates credentials and overwrites workflows by id.
  Do not run it against an instance in use unless that is the intent.
- Credential ids are fixed in `n8n/scripts/build-credentials.js` and referenced by the workflows; keep them in sync.
- To test a setup without touching the running stack, use another project and env file:
  `COMPOSE_PROJECT_NAME=test docker compose --env-file .env.test up -d` and
  `COMPOSE_PROJECT_NAME=test ENV_FILE=.env.test ./scripts/setup-n8n.sh` (with different ports and volume names).

## Secrets

- Never commit `.env`. Document every new variable in `.env.example` with a fake value.
- Before committing, check that no token, API key, phone number or email appears in the diff.

## Useful commands

| Task | Command |
|---|---|
| Start everything | `docker compose up -d` |
| Logs | `docker compose logs -f n8n` |
| Apply migrations | `docker compose run --rm flyway` |
| Database shell | `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` |
| Export workflows | `./scripts/export-workflows.sh` |
| Set up a fresh n8n (credentials + workflows + publish) | `./scripts/setup-n8n.sh` |
