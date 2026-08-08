"use client";

export function CrmLoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-slate-200 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm font-medium text-red-900">Error loading CRM data</p>
        <p className="text-xs text-red-700 mt-1">{error.message}</p>
        <button
          onClick={retry}
          className="mt-3 inline-block text-xs font-medium text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return null;
}
