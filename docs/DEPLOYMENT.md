# Deployment runbook — new client install

Your Travel CRM is **not** a shared multi-tenant SaaS. Every client gets a
fully separate deployment: its own PostgreSQL database, its own container,
its own secrets, its own branding. There is no `company_id`/tenant column
anywhere in the schema — isolation is at the infrastructure level.

## 1. Provision a dedicated PostgreSQL database

Use a separate `postgres:16` container/volume (via the included
`docker-compose.yaml`) or a managed Postgres resource on Coolify — either
way, this database must not be shared with any other client.

## 2. Run migrations

Migrations are plain SQL, no Supabase CLI or other tooling required — and
you normally don't need to do anything here at all. The app container
applies every `db/migrations/*.sql` file not yet recorded in its
`schema_migrations` table automatically, every time it starts (see
`scripts/migrate.mjs`, run by the Dockerfile's `CMD` before the server
starts). This is idempotent and safe to run against an already-migrated
database, so it's not gated on the Postgres volume being brand-new the way
`docker-entrypoint-initdb.d` is.

If you ever need to apply a migration manually (e.g. debugging outside the
container), it's still plain SQL:

```sh
psql "$DATABASE_URL" -f db/migrations/001_init.sql
```

If you do this, and later start the app container against the same
database, either delete that database and start clean, or manually
`insert into schema_migrations (name) values ('001_init.sql')` for whatever
you already applied — otherwise the app's migration runner will try to
re-run it and fail on "relation already exists".

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

**Plain Docker Compose** (no Coolify):

```sh
docker compose up -d --build
```

Note the shipped `docker-compose.yaml` does **not** publish any host ports
(`ports:`) — `postgres` is reachable only from `app` over the internal
Compose network, and `app` uses `expose: ["3000"]` rather than a host port
mapping, since a reverse proxy (or Coolify, below) is expected to sit in
front of it. For a bare `docker compose up` with no proxy at all, add a
`docker-compose.override.yaml` next to it with:

```yaml
services:
  app:
    ports: ["3000:3000"]
```

**On Coolify**: add this repository as a **Docker Compose** resource
(Coolify reads `docker-compose.yaml` directly — see
[Coolify's Docker Compose docs](https://coolify.io/docs/knowledge-base/docker/compose)).
Set this client's `DATABASE_URL`/`JWT_SECRET`/etc. as environment variables
on the `app` service in Coolify's UI (or via a `.env` Coolify loads), then
assign a **Domain** to the `app` service from Coolify's service settings —
Coolify's built-in proxy terminates TLS and routes that domain to the
container's exposed port 3000 automatically; you do not need to (and should
not) publish a host port yourself. Coolify persists the `postgres-data` and
`uploads-data` named volumes across redeploys the same way any other
Compose-based Coolify service does.

## 5. Create the first admin account

Open the deployed URL. With zero rows in `users`, the login screen
automatically shows a "create first admin" form instead of a login form
(`needsBootstrap` / `bootstrapAdmin` in `src/lib/bootstrap.functions.ts`).
Create the admin account for this client, then log in normally. From there,
the admin creates accounts for the rest of the team from
Settings → المستخدمون (role: `admin` / `sales_manager` / `agent` /
`accountant`).

## 6. Set up this client's branding

As the admin, go to Settings → بيانات الشركة → الهوية البصرية والعلامة
التجارية and set the company name, upload a logo, and pick an accent color.
This is stored in `company_settings` (a single row per install) and is read
on the login page (before authentication), the sidebar header, and the page
title.

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

## Known gaps as of this deployment setup

- Server-side permission checks are limited to "is logged in" plus
  owner-scoping (an `agent` only sees their own customers/bookings/
  opportunities); there is no server-side enforcement of finer-grained
  permissions like `packages.edit` per role — those remain UI-only, matching
  the original app's design. Tighten this later if a client needs it.
- A full `docker compose up` from a clean checkout (rather than a directly
  installed Postgres + `vite dev`) has not been exercised end-to-end — do
  this once before the first real client install.
- WhatsApp (Meta), OpenAI, and SMTP integrations are structurally complete
  and match their documented API contracts, but have not been exercised
  against real credentials — verify each with a real Meta WhatsApp Business
  app, a real OpenAI key, and a real SMTP server before relying on them.
