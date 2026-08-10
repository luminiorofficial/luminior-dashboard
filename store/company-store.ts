"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SafeAccount } from "@/types";

interface CompanyState {
  company: SafeAccount | null;
  setCompany: (company: SafeAccount | null) => void;
  reset: () => void;
}

/** The one company profile the app belongs to. */
export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      company: null,
      setCompany: (company) => set({ company }),
      reset: () => set({ company: null }),
    }),
    {
      name: "luminior-company",
    },
  ),
);
