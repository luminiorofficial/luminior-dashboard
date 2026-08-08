"use client";

import { ErrorState, TableSkeleton } from "@/components/states";

export function CrmLoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (loading) return <TableSkeleton rows={6} />;
  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  return null;
}
