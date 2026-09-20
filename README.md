# Your Travel CRM

A self-hosted CRM for travel/tourism companies — packages, customers,
bookings, tickets, hotel stays, payments, pipeline/opportunities, WhatsApp
inbox, and reporting.

This app has no dependency on Supabase or any Lovable Cloud service. It runs
entirely on:

- **PostgreSQL** for all data (see `db/migrations/`)
- **Self-rolled JWT auth** (bcrypt + access/refresh tokens in httpOnly
  cookies) — see `src/lib/auth-server.ts`
- **Meta's official WhatsApp Cloud API** for WhatsApp, called directly
- **OpenAI's API** for WhatsApp intent classification, called directly
- **Plain SMTP** (via `nodemailer`) for outgoing email

Each customer/client of this CRM gets their own fully separate deployment
(own Postgres database, own container) — this is not a shared multi-tenant
SaaS, so there is no `company_id`/tenant column anywhere in the schema.

See **`docs/DEPLOYMENT.md`** for the full per-client install runbook
(Docker Compose, migrations, environment variables, first-admin bootstrap).

## Local development

```sh
bun install
cp .env.example .env   # fill in DATABASE_URL at minimum
psql "$DATABASE_URL" -f db/migrations/001_init.sql
bun run dev
```

Open the app and you'll be prompted to create the first admin account
(only possible while the `users` table is empty).

## Build

```sh
bun run build      # emits dist/client (static assets) + dist/server/server.js
bun server-entry.mjs   # serves the built app (reads PORT, default 3000)
```

## Built with

- TanStack Start (React 19, TanStack Router/Query)
- TypeScript
- Tailwind CSS
- PostgreSQL (`pg`)
- Docker / Docker Compose for deployment
