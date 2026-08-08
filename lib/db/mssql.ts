// ---------------------------------------------------------------------------
// MSSQL (SQL Server) data access — the single connection pool + the common
// execution helpers used everywhere:
//
//   query<T>(sql, params)     — run arbitrary/table SQL, returns rows
//   queryOne<T>(sql, params)  — first row or null
//   execProc<T>(name, params) — run a stored procedure, returns rows + output
//
// Connection settings come from env (see .env). Server-only: never import from
// client components.
// ---------------------------------------------------------------------------
import "server-only";
import sql, { type ConnectionPool, type IProcedureResult } from "mssql";

const poolConfig: sql.config = {
  server: process.env.MSSQL_SERVER ?? "localhost",
  port: Number(process.env.MSSQL_PORT ?? 1433),
  database: process.env.MSSQL_DATABASE ?? "",
  user: process.env.MSSQL_USER ?? "",
  password: process.env.MSSQL_PASSWORD ?? "",
  options: {
    // Azure SQL needs encrypt=true; local dev usually trusts a self-signed cert.
    encrypt: (process.env.MSSQL_ENCRYPT ?? "true") !== "false",
    trustServerCertificate: (process.env.MSSQL_TRUST_CERT ?? "true") !== "false",
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
};

// One shared pool per server process. The promise is cached so concurrent
// callers await the same connect(); it self-clears on failure so the next call
// retries instead of being stuck with a rejected promise.
let poolPromise: Promise<ConnectionPool> | null = null;

export function getPool(): Promise<ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(poolConfig)
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

/** Bind a params object onto a request (node-mssql infers types from values). */
function bind(
  request: ReturnType<ConnectionPool["request"]>,
  params: Record<string, unknown>,
) {
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value as never);
  }
  return request;
}

/** Run arbitrary/table SQL with named params (`@name`). Returns the recordset. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const pool = await getPool();
  const result = await bind(pool.request(), params).query(text);
  return (result.recordset ?? []) as T[];
}

/** Like query, but returns just the first row (or null). */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Execute a stored procedure. Returns rows plus return value + output params. */
export async function execProc<T = Record<string, unknown>>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<{
  recordset: T[];
  recordsets: T[][];
  returnValue: number;
  output: Record<string, unknown>;
}> {
  const pool = await getPool();
  const result = (await bind(pool.request(), params).execute(
    name,
  )) as IProcedureResult<T>;
  return {
    
    recordset: (result.recordset ?? []) as T[],
    recordsets: (result.recordsets ?? []) as unknown as T[][],
    returnValue: result.returnValue,
    output: result.output as Record<string, unknown>,
  };
}

/** Convenience: first row from a stored procedure, or null. */
export async function execProcOne<T = Record<string, unknown>>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  const { recordset } = await execProc<T>(name, params);
  return recordset[0] ?? null;
}

/** True when the MSSQL connection env is present. */
export function isMssqlConfigured(): boolean {
  return Boolean(
    process.env.MSSQL_SERVER &&
      process.env.MSSQL_DATABASE &&
      process.env.MSSQL_USER,
  );
}

export { sql };
