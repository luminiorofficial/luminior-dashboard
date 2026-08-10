import { cn } from "@/lib/utils";

function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const LEVELS = [
  { label: "Too short", className: "bg-destructive" },
  { label: "Weak", className: "bg-destructive" },
  { label: "Fair", className: "bg-warning" },
  { label: "Good", className: "bg-warning" },
  { label: "Strong", className: "bg-success" },
  { label: "Excellent", className: "bg-success" },
];

export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;

  const score = scorePassword(password);
  const level = LEVELS[Math.min(score, LEVELS.length - 1)];
  const percent = Math.max(10, Math.min(100, (score / 5) * 100));

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-300", level.className)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{level.label}</p>
    </div>
  );
}
