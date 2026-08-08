import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/*
  Constructing an Intl formatter is one of the more expensive things you can do
  in a render — and chart axes call these once per tick, per frame, while a
  tooltip is being dragged. The formatters are pure and few, so they're built
  once and reused. Keys are cheap to derive, so the cache never needs eviction:
  it's bounded by (currency × the handful of option sets below).
*/
const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(
  key: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", options);
    numberFormatters.set(key, fmt);
  }
  return fmt;
}

export function formatCurrency(amount: number, currency = "USD") {
  // Whole amounts render without cents, so the fraction digits are part of the
  // cache key rather than a per-call formatter.
  const whole = amount % 1 === 0;
  try {
    return numberFormatter(`cur:${currency}:${whole}`, {
      style: "currency",
      currency,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(amount);
  } catch {
    // Unknown/invalid currency code — Intl throws rather than degrading.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Compact currency ("$12.4K") — the axis-tick and tooltip format for charts. */
export function formatCurrencyCompact(amount: number, currency = "USD") {
  try {
    return numberFormatter(`curc:${currency}`, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return `${currency} ${formatCompact(amount)}`;
  }
}

export function formatNumber(value: number) {
  return numberFormatter("num", {}).format(value);
}

export function formatCompact(value: number) {
  return numberFormatter("compact", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

/**
 * Seconds → "1h 04m" / "2m 14s" / "45s". For engagement and session times,
 * which GA4 reports as a float number of seconds and which nobody wants to read
 * as "134.28".
 */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}


export function prettify(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") {
    return value
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return String(value);
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "An unknown error occurred";
}