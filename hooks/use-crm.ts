"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiMutate } from "@/lib/fetcher";
import { useAccountStore } from "@/store/account-store";
import type { CrmSnapshot } from "@/features/crm/types";

export function useCrm() {
  const accountId = useAccountStore((state) => state.selectedAccount?.accountId);
  return useQuery({
    queryKey: ["crm", accountId],
    queryFn: () =>
      apiGet<CrmSnapshot>("/api/crm", { account: accountId }),
    enabled: Boolean(accountId),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useCrmAction() {
  const queryClient = useQueryClient();
  const accountId = useAccountStore((state) => state.selectedAccount?.accountId);
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (!accountId) throw new Error("Select a brand first");
      return apiMutate<CrmSnapshot>("POST", "/api/crm", {
        body: payload,
        params: { account: accountId },
      });
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["crm", accountId], snapshot);
    },
  });
}
