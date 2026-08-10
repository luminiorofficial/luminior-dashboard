"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiMutate } from "@/lib/fetcher";
import type { CrmSnapshot } from "@/features/crm/types";

export function useCrm() {
  return useQuery({
    queryKey: ["crm"],
    queryFn: () => apiGet<CrmSnapshot>("/api/crm"),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

/** The signed-in admin's standing invite link (lazy — only fetched while `enabled`). */
export function useCrmInviteLink(enabled: boolean) {
  return useQuery({
    queryKey: ["crm-invite"],
    queryFn: () => apiGet<{ code: string; url: string }>("/api/crm/invite"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Invalidates the current invite link and replaces it with a fresh one. */
export function useRegenerateInviteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiMutate<{ code: string; url: string }>("POST", "/api/crm/invite"),
    onSuccess: (result) => {
      queryClient.setQueryData(["crm-invite"], result);
    },
  });
}

export function useCrmAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiMutate<CrmSnapshot>("POST", "/api/crm", { body: payload }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["crm"], snapshot);
    },
  });
}
