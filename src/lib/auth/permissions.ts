import { AdminRole } from "@/generated/prisma/enums";

/**
 * Role-based permissions. This module is intentionally free of server-only imports so
 * both the server guards and the admin navigation can share one definition, but note
 * that hiding a nav item is only cosmetic. Every server action and route handler calls
 * `requireAdmin(permission)` itself; the UI never decides access.
 */

export const PERMISSIONS = [
  "bookings:read",
  "bookings:write",
  "customers:read",
  "customers:write",
  "packages:manage",
  "addons:manage",
  "equipment:manage",
  "gallery:manage",
  "faqs:manage",
  "availability:manage",
  "memberships:manage",
  "payments:read",
  "payments:manage",
  "inquiries:manage",
  "discounts:manage",
  "analytics:read",
  "settings:manage",
  "admins:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STUDIO_MANAGER_PERMISSIONS: Permission[] = [
  "bookings:read",
  "bookings:write",
  "customers:read",
  "customers:write",
  "packages:manage",
  "addons:manage",
  "equipment:manage",
  "gallery:manage",
  "faqs:manage",
  "availability:manage",
  "memberships:manage",
  "inquiries:manage",
  "discounts:manage",
  "payments:read",
  "analytics:read",
];

const FINANCE_PERMISSIONS: Permission[] = [
  "bookings:read",
  "customers:read",
  "payments:read",
  "payments:manage",
  "memberships:manage",
  "analytics:read",
];

const STAFF_PERMISSIONS: Permission[] = [
  "bookings:read",
  "bookings:write",
  "customers:read",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  [AdminRole.SUPER_ADMIN]: PERMISSIONS,
  [AdminRole.STUDIO_MANAGER]: STUDIO_MANAGER_PERMISSIONS,
  [AdminRole.FINANCE]: FINANCE_PERMISSIONS,
  [AdminRole.STAFF]: STAFF_PERMISSIONS,
};

export function roleHas(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function roleHasAny(role: AdminRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => roleHas(role, permission));
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: "Super Admin",
  [AdminRole.STUDIO_MANAGER]: "Studio Manager",
  [AdminRole.FINANCE]: "Finance",
  [AdminRole.STAFF]: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  [AdminRole.SUPER_ADMIN]: "Full access to every area, including settings and admin users.",
  [AdminRole.STUDIO_MANAGER]: "Bookings, customers, availability, packages and the catalogue.",
  [AdminRole.FINANCE]: "Payments, memberships and revenue reporting.",
  [AdminRole.STAFF]: "Day-to-day bookings and customer information.",
};
