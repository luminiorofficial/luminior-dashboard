import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  className,
  children,
  required = false,
  description,
  error,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
  required?: boolean;
  description?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className={cn("space-y-1.5 ", className)}>
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
      {description && !error && (
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </div>
      )}
      {error && (
        <p className="text-[11px] leading-relaxed text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
