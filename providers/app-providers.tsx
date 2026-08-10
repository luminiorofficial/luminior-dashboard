"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <QueryProvider>
          {children}
          <Toaster richColors closeButton position="bottom-right" />
        </QueryProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
