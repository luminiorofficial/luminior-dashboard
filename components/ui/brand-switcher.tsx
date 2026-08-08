"use client";

import { useAccountStore } from "@/store/account-store";

export function BrandSwitcher() {
  const { accounts, selectedAccount, selectAccountById } = useAccountStore();

  if (!selectedAccount) {
    return (
      <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
        {accounts.length === 0 ? "No brands" : "Loading…"}
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        Brand
      </span>
      <select
        value={String(selectedAccount.accountId)}
        onChange={(event) => selectAccountById(Number(event.target.value))}
        className="bg-transparent outline-none"
      >
        {accounts.map((account) => (
          <option key={account.accountId} value={account.accountId}>
            {account.name}
          </option>
        ))}
      </select>
    </label>
  );
}
