"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/store/company-store";
import { cn, initials } from "@/lib/utils";

const baseNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/team", label: "Team Members", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: ClipboardCheck },
  { href: "/attendance", label: "Attendance", icon: Clock3 },
  { href: "/leave", label: "Leave", icon: CalendarDays },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();
  const company = useCompanyStore((s) => s.company);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);/*  */
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isManager = user?.role === "admin" || user?.role === "superadmin";
  const companyName = company?.name || "Luminior CRM";

  // Company Settings edits the one company's profile — manager-only,
  // distinct from the Users page (platform-wide, Super Admin only).
  const navItems = [
    ...baseNavItems,
    ...(isManager ? [{ href: "/settings", label: "Company Settings", icon: Settings }] : []),
    ...(user?.role === "superadmin"
      ? [{ href: "/users", label: "Users", icon: Users }]
      : []),
  ];

  // Route protection itself lives in proxy.ts (edge, runs before this ever
  // renders) — this loading guard just covers the brief client hydration
  // window while the session finishes resolving.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background text-foreground md:h-dvh md:overflow-hidden">
      <div className="w-full md:flex md:h-full">
        {/* Desktop sidebar — collapsible via the chevron below, and the same
            nav also renders inside <MobileNav> as a drawer below the md
            breakpoint, so navigation is never hidden. */}
        <aside
          className={cn(
            "hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out md:flex",
            collapsed ? "w-[4.5rem]" : "w-[17rem]",
          )}
        >
          <div
            className={cn(
              "flex h-16 shrink-0 items-center gap-3 border-b border-border px-3",
              collapsed && "justify-center px-2",
            )}
          >
            <div className="shrink-0 rounded-xl bg-primary p-2 text-primary-foreground shadow-sm">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div
              className={cn(
                "min-w-0 overflow-hidden transition-all duration-300",
                collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100",
              )}
            >
              <p className="truncate text-sm font-semibold">{companyName}</p>
              <p className="truncate text-xs text-muted-foreground">Operations workspace</p>
            </div>
          </div>

          <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-all duration-300",
                      collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-border p-3">
            <div className={cn("flex items-center gap-3 rounded-xl p-2", collapsed && "justify-center px-0")}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
                </div>
              )}
              {!collapsed && (
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Sign out" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </aside>

        <MobileNav
          open={mobileNavOpen}
          onOpenChange={setMobileNavOpen}
          navItems={navItems}
          isActive={isActive}
          companyName={companyName}
        />

        <div className="min-w-0 flex-1 md:h-dvh md:overflow-y-auto">
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-3 py-3 backdrop-blur-xl sm:px-5 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 md:hidden"
                aria-label="Open menu"
                onClick={() => setMobileNavOpen(true)}
              >
                  <Menu className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden shrink-0 md:inline-flex"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={collapsed}
                onClick={() => setCollapsed((value) => !value)}
              >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted-foreground sm:text-sm">
                    Luminior Dashboard
                  </p>
                  <h1 className="truncate text-base font-semibold sm:text-lg">
                    Welcome back, {user.name}
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ThemeToggle />
                <div className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
                    {user.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Sign out"
                    onClick={() => signOut()}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="overflow-x-hidden p-3 sm:p-5 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
