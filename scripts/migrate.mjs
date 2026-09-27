#!/usr/bin/env node
// Idempotent migration runner — applies db/migrations/*.sql not yet recorded
// in `schema_migrations`, in filename order, each inside its own transaction.
//
// Run automatically on every container start (see Dockerfile CMD) instead of
// relying solely on Postgres's docker-entrypoint-initdb.d, which only runs
// once against a brand-new, empty data volume — a redeploy against an
// existing (even empty-of-tables) volume silently skips it, leaving the app
// with no schema at all.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function main() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("DATABASE_URL is not set — cannot run migrations.");
    process.exit(1);
  }

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows: applied } = await client.query("select name from schema_migrations");
    const appliedNames = new Set(applied.map((r) => r.name));

    let pending = 0;
    for (const file of files) {
      if (appliedNames.has(file)) continue;
      pending++;
      const sql = await readFile(join(migrationsDir, file), "utf8");
      console.log(`Applying migration: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(
      pending === 0
        ? "No pending migrations — schema already up to date."
        : `Applied ${pending} migration(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
