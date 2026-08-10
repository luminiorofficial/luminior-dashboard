import "server-only";

export function safeClientMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const message = err instanceof Error ? err.message : "";
  if (!message) return fallback;
  return INTERNAL_IDENTIFIER_PATTERNS.some((re) => re.test(message))
    ? fallback
    : message;
}

const INTERNAL_IDENTIFIER_PATTERNS: RegExp[] = [
  /[A-Za-z]:\\/,
  /\b(?:src|app|lib|node_modules)\//,
  /\.(?:ts|tsx|js|jsx|sql|json)\b/,
  /\bdbo\./i,
  /\btbl_/i,
  /\bsp_/i,
];
