// ---------------------------------------------------------------------------
// Client-side fetch helper used by React Query hooks.
// All dashboard data flows through internal /api routes (which call Shopify,
// Gmail, etc. server-side), so this stays generic.
// ---------------------------------------------------------------------------

export class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
    /**
     * Machine-readable reason from the API body, when the route sends one.
     * Lets a caller branch on *why* a request failed rather than parsing the
     * human message — e.g. Analytics returns 424 for three different missing
     * steps, each needing a different screen.
     */
    public code?: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/** Shape of the JSON error body every /api route returns. */
type ErrorBody = { error?: string; code?: string };

/** GET JSON from an internal API route, scoped to the active account. */
export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, code } = body as ErrorBody;
    throw new FetchError(
      res.status,
      error || `Request failed (${res.status})`,
      code,
    );
  }
  return body as T;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiMutate<T>("POST", path, { body: payload });
}

/**
 * Generic mutation helper for POST/PATCH/DELETE with optional JSON body and
 * query params (params are scoped to the active account, like apiGet).
 */
export async function apiMutate<T>(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  opts: {
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers:
      opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    credentials: "same-origin",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, code } = body as ErrorBody;
    throw new FetchError(
      res.status,
      error || `Request failed (${res.status})`,
      code,
    );
  }
  return body as T;
}
