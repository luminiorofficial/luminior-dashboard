// ---------------------------------------------------------------------------
// PostgreSQL data access — the single connection pool + the common execution
// helpers used everywhere:
//
//   query<T>(sql, params)     — run arbitrary/table SQL, returns rows
//   queryOne<T>(sql, params)  — first row or null
//
// Connection settings come from env (see .env.example). Server-only: never
// import from client components.
// ---------------------------------------------------------------------------
import "server-only";
import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL ?? "";

// Hosted Postgres (Neon, Supabase, RDS, etc.) generally requires TLS but
// presents a certificate chain `pg` won't validate out of the box. Set
// PGSSLMODE=disable for a local/self-hosted server with no TLS at all.
const sslDisabled = process.env.PGSSLMODE === "disable";

let pool: Pool | null = null;

export function getPool(): Pool {
      if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

/** Run arbitrary/table SQL with `$1, $2, …` params. Returns the rows. */
export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** Like query, but returns just the first row (or null). */
export async function queryOne<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** True when the Postgres connection env is present. */
export function isDbConfigured(): boolean {
  return Boolean(connectionString);
}

type Runner = <T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

/**
 * Run a callback inside a single client + explicit BEGIN/COMMIT — for the few
 * multi-step operations (e.g. the project focus-timer toggle) that read some
 * state and then branch into different follow-up statements, where a single
 * CTE-chained statement would be harder to verify than a plain transaction.
 * Rolls back and rethrows on any error.
 */
export async function withTransaction<T>(fn: (run: Runner) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const run: Runner = (text, params = []) =>
      client.query(text, params).then((r) => r.rows);
    const result = await fn(run);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
