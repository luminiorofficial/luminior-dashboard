export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function initials(value: string | null | undefined) {
  if (!value) return "?";
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase();
}