"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Inbox, PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({
  title = "Nothing here yet",
  message = "There's no data to display for this view.",
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed border-gold-faint bg-transparent">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--gold)_20%,transparent)]">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="max-w-sm">
          <p className="font-display text-lg font-semibold text-heading">
            {title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const notConfigured = message?.toLowerCase().includes("not configured");
  const Icon = notConfigured ? PlugZap : AlertTriangle;
  const tone = notConfigured ? "var(--gold)" : "var(--destructive)";
  return (
    <Card
      className="border-dashed"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 32%, transparent)`,
      }}
    >
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset"
          style={{
            backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)`,
            color: tone,
            ["--tw-ring-color" as string]: `color-mix(in srgb, ${tone} 24%, transparent)`,
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="max-w-md">
          <p className="font-display text-lg font-semibold text-heading">
            {notConfigured ? "Store not connected" : "Something went wrong"}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {message ||
              "We couldn't load this data. Please try again in a moment."}
          </p>
          {notConfigured && (
            <p className="mt-2 text-xs text-muted-foreground">
              Add a valid Shopify Admin API token in account settings.
            </p>
          )}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/*
  Written as literal class strings (not interpolated) so Tailwind's static
  scanner emits them. `cols` must match the real grid the page renders once
  data lands, otherwise the layout visibly snaps on load.
*/
export const STAT_GRID: Record<4 | 5 | 6, string> = {
  4: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
};

export function CardGridSkeleton({
  count = 6,
  cols,
}: {
  count?: number;
  cols?: 4 | 5 | 6;
}) {
  const grid = STAT_GRID[cols ?? (count === 4 ? 4 : count === 5 ? 5 : 6)];
  return (
    <div className={grid}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="shimmer">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="shimmer">
          <CardContent className="space-y-2.5 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("shimmer", className)}>
      <CardContent className="p-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="h-[260px] w-full" />
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card className="shimmer">
      <CardContent className="space-y-3 p-6">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
