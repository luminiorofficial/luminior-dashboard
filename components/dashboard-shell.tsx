"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AccountSwitcher } from "@/components/ui/account-switcher";

const navItems = [
  { href: "/crm", label: "CRM" },
  { href: "/users", label: "Users" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const redirect = pathname && pathname !== "/dashboard" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    }
  }, [loading, pathname, router, user]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-slate-600">Loading your workspace…</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Luminior Dashboard</p>
            <h1 className="text-lg font-semibold">Welcome back, {user.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <AccountSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
