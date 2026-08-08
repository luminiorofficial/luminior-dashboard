"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  value?: string;
  onChange: (date?: string) => void;
  className?: string;
}

export function DatePicker({ value, onChange, className }: Props) {
  return (
    <Button variant="outline" className={cn("h-9 w-full justify-between rounded-md border border-input bg-background/40 px-3 text-sm font-normal shadow-sm transition-all duration-200 hover:border-[color-mix(in_srgb,var(--gold)_35%,transparent)] focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <span className={cn("truncate", !value && "text-muted-foreground")}>{value ?? "Select date"}</span>
      <CalendarIcon className="h-4 w-4 opacity-70" />
    </Button>
  );
}
