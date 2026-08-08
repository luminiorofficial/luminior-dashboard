"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SafeAccount } from "@/types";

interface AccountState {
  accounts: SafeAccount[];
  selectedAccount: SafeAccount | null;
  setAccounts: (accounts: SafeAccount[]) => void;
  setSelectedAccount: (account: SafeAccount) => void;
  selectAccountById: (accountId: number) => void;
  reset: () => void;
}

/**
 * Chrome-style account switcher state. The selection is persisted in a browser
 * store, but we reset it whenever the authenticated user changes so one Gmail
 * login cannot inherit another user's brand list or selected account.
 */
export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      selectedAccount: null,
      setAccounts: (accounts) => {
        const current = get().selectedAccount;
        // Keep the current selection if it's still accessible, else pick first.
        const stillValid =
          current && accounts.some((a) => a.accountId === current.accountId);
        set({
          accounts,
          selectedAccount: stillValid ? current : (accounts[0] ?? null),
        });
      },
      setSelectedAccount: (account) => set({ selectedAccount: account }),
      selectAccountById: (accountId) => {
        const acc = get().accounts.find((a) => a.accountId === accountId);
        if (acc) set({ selectedAccount: acc });
      },
      reset: () => set({ accounts: [], selectedAccount: null }),
    }),
    {
      name: "opscenter-account",
      partialize: (s) => ({ selectedAccount: s.selectedAccount }),
    },
  ),
);
