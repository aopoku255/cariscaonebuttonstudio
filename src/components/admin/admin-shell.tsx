"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Badge as BadgeIcon,
  Bell,
  Calendar,
  Camera,
  ClipboardList,
  Clock,
  CreditCard,
  ExternalLink,
  Gauge,
  GraduationCap,
  HelpCircle,
  History,
  Images,
  Inbox,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlusSquare,
  Settings,
  Shield,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { NAV_GROUPS } from "@/components/admin/nav-config";
import { BrandLogo } from "@/components/ui/brand-logo";
import { signOut } from "@/app/admin/login/actions";
import type { AdminRole } from "@/generated/prisma/enums";
import { ROLE_LABELS, roleHas, type Permission } from "@/lib/auth/permissions";
import { cn, initials } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  gauge: Gauge,
  calendar: Calendar,
  clipboard: ClipboardList,
  users: Users,
  "graduation-cap": GraduationCap,
  badge: BadgeIcon,
  inbox: Inbox,
  package: Package,
  "plus-square": PlusSquare,
  camera: Camera,
  images: Images,
  tag: Tag,
  help: HelpCircle,
  clock: Clock,
  "credit-card": CreditCard,
  settings: Settings,
  shield: Shield,
  bell: Bell,
  history: History,
};

const COLLAPSE_STORAGE_KEY = "obs-admin-sidebar-collapsed";

export function AdminShell({
  admin,
  children,
}: {
  admin: { name: string; email: string; role: AdminRole };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Closed from the links themselves rather than a route-change effect, which would
  // cost an extra render on every navigation.
  const close = () => setOpen(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The collapsed state is a per-viewer convenience, remembered across visits but
  // never depended on for anything functional, so a failed read is harmless. It
  // defaults to expanded for the server-rendered markup and the first client render
  // (so there is nothing to hydrate mismatched), then syncs from storage a tick later
  // via a microtask rather than synchronously in the effect body.
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
      } catch {
        // Ignore: private browsing or blocked storage just keeps the default (expanded).
      }
    });
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        // Nothing to do if storage is unavailable; the toggle still works this visit.
      }
      return next;
    });
  }

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => roleHas(admin.role, item.permission as Permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Sidebar: fixed top-to-bottom on desktop (never floating), a slide-in drawer on
          small screens. Collapses to an icon rail on desktop via the toggle below. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-brand-800 bg-brand-950 transition-[transform,width] duration-200 lg:translate-x-0",
          collapsed ? "lg:w-24" : "lg:w-64",
          "w-64",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Admin navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-800 px-4">
          <Link
            href="/admin/dashboard"
            className={cn("flex min-w-0 items-center", collapsed && "lg:justify-center")}
          >
            <BrandLogo
              variant="studio"
              src="/logo-white.svg"
              size="sm"
              tone="dark"
              className={cn(collapsed && "lg:hidden")}
            />
            <BrandLogo
              variant="studio"
              src="/icon.svg"
              size="sm"
              tone="dark"
              className={cn("hidden w-9", collapsed && "lg:block")}
            />
          </Link>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden shrink-0 rounded-lg p-1.5 text-brand-300 transition-colors hover:bg-brand-900 hover:text-white lg:block"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </button>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-brand-300 transition-colors hover:bg-brand-900 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="scrollbar-slim flex-1 overflow-x-hidden overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p
                className={cn(
                  "px-3 pb-2 text-[10.5px] font-semibold tracking-[0.14em] text-brand-400 uppercase",
                  collapsed && "lg:sr-only",
                )}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon] ?? Gauge;
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                          collapsed && "lg:justify-center lg:px-2",
                          active
                            ? "bg-brand-800 text-white"
                            : "text-brand-200 hover:bg-brand-900 hover:text-white",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-brand-800 p-3">
          <div className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2", collapsed && "lg:justify-center")}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11.5px] font-semibold text-white">
              {initials(admin.name)}
            </span>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-[13px] font-semibold text-white">{admin.name}</p>
              <p className="truncate text-[11px] text-brand-300">{ROLE_LABELS[admin.role]}</p>
            </div>
          </div>

          <Link
            href="/"
            target="_blank"
            title={collapsed ? "View public site" : undefined}
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-brand-200 transition-colors hover:bg-brand-900 hover:text-white",
              collapsed && "lg:justify-center lg:px-2",
            )}
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            <span className={cn(collapsed && "lg:hidden")}>View public site</span>
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-brand-200 transition-colors hover:bg-brand-900 hover:text-white",
                collapsed && "lg:justify-center lg:px-2",
              )}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className={cn(collapsed && "lg:hidden")}>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Backdrop for the mobile drawer */}
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          aria-label="Close menu"
          tabIndex={-1}
        />
      ) : null}

      {/* Main column */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-24" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-1.5 rounded-lg p-2 text-ink transition-colors hover:bg-paper-deep"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="text-[14px] font-semibold text-ink">Studio Admin</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
