"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { BriefcaseBusiness, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * The sidebar's content, reachable on small screens as a slide-in drawer
 * (triggered from DashboardShell's header hamburger) instead of the desktop
 * `<aside>`, which is hidden below the md breakpoint. Every nav link closes
 * the drawer on tap via DialogPrimitive.Close so navigating doesn't leave it
 * open behind the new page.
 */
export function MobileNav({
  open,
  onOpenChange,
  navItems,
  isActive,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: NavItem[];
  isActive: (href: string) => boolean;
  companyName: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-background/70 backdrop-blur-sm md:hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[88vw] flex-col border-r border-border bg-card shadow-2xl md:hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{companyName}</p>
                <p className="text-xs text-muted-foreground">Operations workspace</p>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close menu</span>
            </DialogPrimitive.Close>
          </div>

          <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <DialogPrimitive.Close asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </DialogPrimitive.Close>
              );
            })}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
