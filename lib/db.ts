import "server-only";
import sql, { type ConnectionPool, type IProcedureResult } from "mssql";

const poolConfig: sql.config = {
  server: process.env.MSSQL_SERVER ?? "localhost",
  port: Number(process.env.MSSQL_PORT ?? 1433),
  database: process.env.MSSQL_DATABASE ?? "",
  user: process.env.MSSQL_USER ?? "",
  password: process.env.MSSQL_PASSWORD ?? "",
  options: {
    encrypt: (process.env.MSSQL_ENCRYPT ?? "true") !== "false",
    trustServerCertificate: (process.env.MSSQL_TRUST_CERT ?? "true") !== "false",
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
};

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

function bind(request: ReturnType<ConnectionPool["request"]>, params: Record<string, unknown>) {
  for (const [name, value] of Object.entries(params)) {
    request.input(name, value as never);
  }
  return request;
}

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
  const result = (await bind(pool.request(), params).execute(name)) as IProcedureResult<T>;
  return {
    recordset: (result.recordset ?? []) as T[],
    recordsets: (result.recordsets ?? []) as unknown as T[][],
    returnValue: result.returnValue,
    output: result.output as Record<string, unknown>,
  };
}

export async function execProcOne<T = Record<string, unknown>>(name: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const { recordset } = await execProc<T>(name, params);
  return recordset[0] ?? null;
}
