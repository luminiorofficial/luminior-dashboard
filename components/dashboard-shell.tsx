"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AccountSwitcher } from "@/components/ui/account-switcher";

const crmNavItems = [
  { href: "/crm/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/crm/team", label: "Team Members", icon: Users },
  { href: "/crm/projects", label: "Projects", icon: FolderKanban },
  { href: "/crm/tasks", label: "Tasks", icon: ClipboardCheck },
  { href: "/crm/attendance", label: "Attendance", icon: Clock3 },
  { href: "/crm/leave", label: "Leave", icon: CalendarDays },
];

const navItems = [
  { href: "/crm", label: "CRM", icon: BriefcaseBusiness },
  { href: "/users", label: "Users", icon: Users },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isCrmRoute = pathname === "/crm" || pathname.startsWith("/crm/");
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:block">
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-slate-900 px-3 py-3 text-white">
            <div className="rounded-xl bg-white/15 p-2">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Luminior CRM</p>
              <p className="text-xs text-slate-300">Operations workspace</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/crm" ? isCrmRoute : isActive(item.href);
              const Icon = item.icon;

              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>

                  {item.href === "/crm" && isCrmRoute && (
                    <div className="mt-1 space-y-1 border-l border-slate-200 pl-3 py-1">
                      {crmNavItems.map((crmItem) => {
                        const CrmIcon = crmItem.icon;
                        const crmActive = isActive(crmItem.href);

                        return (
                          <Link
                            key={crmItem.href}
                            href={crmItem.href}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                              crmActive
                                ? "bg-slate-100 text-slate-900"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <CrmIcon className="h-4 w-4" />
                            <span>{crmItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="mb-6 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">Luminior Dashboard</p>
                <h1 className="text-lg font-semibold">Welcome back, {user.name}</h1>
              </div>
              <AccountSwitcher />
            </div>
          </header>

          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
