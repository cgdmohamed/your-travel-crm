/**
 * Plain PostgreSQL connection pool — replaces the Supabase client entirely.
 * Server-only module (imported from createServerFn handlers / API routes).
 */
import { Pool, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __pgPool?: Pool };

function getPool(): Pool {
  if (!g.__pgPool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — configure it in .env before starting the app");
    }
    g.__pgPool = new Pool({ connectionString, max: 10 });
  }
  return g.__pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const res = await pool.query<T>(text, params as never[]);
  return { rows: res.rows, rowCount: res.rowCount ?? 0 };
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a single client transaction (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction<T>(
  fn: (client: { query: typeof query }) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wrapped = {
      query: (async (text: string, params: unknown[] = []) => {
        const res = await client.query(text, params as never[]);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      }) as typeof query,
    };
    const result = await fn(wrapped);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
