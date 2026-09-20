# Deployment runbook — new client install

Your Travel CRM is **not** a shared multi-tenant SaaS. Every client gets a
fully separate deployment: its own PostgreSQL database, its own container,
its own secrets, its own branding. There is no `company_id`/tenant column
anywhere in the schema — isolation is at the infrastructure level.

## 1. Provision a dedicated PostgreSQL database

Use a separate `postgres:16` container/volume (via the included
`docker-compose.yml`) or a managed Postgres resource on Coolify — either
way, this database must not be shared with any other client.

## 2. Run migrations

Migrations are plain SQL, no Supabase CLI or other tooling required.

```sh
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```

With the provided `docker-compose.yml`, this happens automatically on first
boot: Postgres's official image runs every `.sql` file under
`/docker-entrypoint-initdb.d` (mounted from `db/migrations/`) the first time
its data volume is empty. If you add a `002_*.sql` file later for an
existing installation, apply it manually with `psql` instead — the
init-scripts mechanism only runs once, against a brand-new database.

## 3. Prepare this client's `.env`

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — this client's Postgres connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — generate unique random secrets per
  client, e.g. `openssl rand -hex 32` for each. **Never reuse secrets across
  clients** — anyone who has one client's `JWT_SECRET` could forge access
  tokens for that client's install, but a different secret per install keeps
  that blast radius to a single client.
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN` — from this client's own Meta for Developers
  WhatsApp Business app (or leave blank and set them later from
  Settings → Integrations inside the app; they're stored per-install in the
  `integration_config` table either way).
- `OPENAI_API_KEY` — for WhatsApp intent classification.
- SMTP is **not** an env var — configure it from Settings → Integrations
  after first login (stored in the database, so it can be rotated without a
  redeploy).

## 4. Deploy the app container

Either:

```sh
docker compose up -d --build
```

or, on Coolify, deploy this repo's `Dockerfile` as its own service pointed
at this client's `DATABASE_URL` and secrets, with a persistent volume
mounted at `/app/data/uploads` (package images, customer attachments,
company logo — see `src/lib/upload.functions.ts`... *not yet implemented,
see note at the bottom of this file*).

## 5. Create the first admin account

Open the deployed URL. With zero rows in `users`, the login screen
automatically shows a "create first admin" form instead of a login form
(`needsBootstrap` / `bootstrapAdmin` in `src/lib/bootstrap.functions.ts`).
Create the admin account for this client, then log in normally. From there,
the admin creates accounts for the rest of the team from
Settings → المستخدمون (role: `admin` / `sales_manager` / `agent` /
`accountant`).

## 6. Set up this client's branding

`company_settings` (a single row per install) holds `company_name`,
`logo_url`, `accent_color`, `contact_phone`, `contact_email`. *(Wiring this
into the header/login page/page title — Phase 7 of the original plan — is
not yet implemented in the UI; the table exists and is ready for it.)*

## Meta WhatsApp webhook setup (per client)

Point this client's WhatsApp Business app's webhook at:

```
https://<this-client's-domain>/api/public/whatsapp/webhook
```

- **Verify token**: whatever you set as `WHATSAPP_VERIFY_TOKEN` — Meta calls
  this URL with `?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
  once, and the route echoes back `hub.challenge` only if the token matches.
- **App secret**: `WHATSAPP_APP_SECRET` — every subsequent webhook POST is
  verified via the `X-Hub-Signature-256` HMAC-SHA256 header before any
  payload is processed.

## Known gaps as of this deployment setup (see final handoff notes)

- The full migration of `src/lib/crm-data.tsx` off its in-memory React store
  onto these Postgres tables (packages/customers/bookings/etc.) is **not**
  done yet — the app's day-to-day CRM data still resets on every
  restart/redeploy. Only auth, integration config, and the WhatsApp/Meta
  logs are Postgres-backed so far.
- Local file storage (`src/lib/upload.functions.ts`, Phase 2 of the plan)
  is not implemented — there is no working image/attachment/logo upload to
  disk yet; `data/uploads/` volume above is provisioned for it but unused.
- `company_settings` branding is not wired into the UI yet (see step 6).
