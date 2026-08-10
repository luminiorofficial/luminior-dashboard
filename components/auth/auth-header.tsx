import { BriefcaseBusiness } from "lucide-react";

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-luxe">
        <BriefcaseBusiness className="h-6 w-6" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        Luminior Dashboard
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-heading">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
