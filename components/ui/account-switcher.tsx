"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export function AccountSwitcher() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase text-white">
          {user.name.charAt(0)}
        </span>
        <span>{user.name}</span>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="font-semibold text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                signOut();
                setOpen(false);
              }}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
