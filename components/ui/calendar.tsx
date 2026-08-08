"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Calendar({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-background/40 p-4 text-sm text-muted-foreground", className)}>
      Calendar unavailable in this build.
    </div>
  );
}

export const CalendarDayButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => (
  <button ref={ref} {...props} />
));
CalendarDayButton.displayName = "CalendarDayButton";
