import type { Permission } from "@/lib/auth/permissions";

/**
 * Admin navigation.
 *
 * `permission` decides whether an item is rendered, but that is presentation only.
 * The page and every action behind it call `requireAdminPage` / `requireAdmin` with
 * the same permission, which is what actually enforces access.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/admin/dashboard",
        label: "Dashboard",
        icon: "gauge",
        permission: "bookings:read",
      },
      {
        href: "/admin/calendar",
        label: "Calendar",
        icon: "calendar",
        permission: "bookings:read",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/admin/bookings",
        label: "Bookings",
        icon: "clipboard",
        permission: "bookings:read",
      },
      {
        href: "/admin/customers",
        label: "Customers",
        icon: "users",
        permission: "customers:read",
      },
      {
        href: "/admin/students",
        label: "Student customers",
        icon: "graduation-cap",
        permission: "customers:read",
      },
      {
        href: "/admin/memberships",
        label: "Memberships",
        icon: "badge",
        permission: "memberships:manage",
      },
      {
        href: "/admin/inquiries",
        label: "Corporate enquiries",
        icon: "inbox",
        permission: "inquiries:manage",
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        href: "/admin/packages",
        label: "Packages",
        icon: "package",
        permission: "packages:manage",
      },
      {
        href: "/admin/addons",
        label: "Add-ons",
        icon: "plus-square",
        permission: "addons:manage",
      },
      {
        href: "/admin/equipment",
        label: "Equipment",
        icon: "camera",
        permission: "equipment:manage",
      },
      {
        href: "/admin/gallery",
        label: "Studio gallery",
        icon: "images",
        permission: "gallery:manage",
      },
      {
        href: "/admin/discounts",
        label: "Discounts",
        icon: "tag",
        permission: "discounts:manage",
      },
      { href: "/admin/faqs", label: "FAQs", icon: "help", permission: "faqs:manage" },
    ],
  },
  {
    label: "Studio",
    items: [
      {
        href: "/admin/availability",
        label: "Availability",
        icon: "clock",
        permission: "availability:manage",
      },
      {
        href: "/admin/payments",
        label: "Payments",
        icon: "credit-card",
        permission: "payments:read",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/admin/settings",
        label: "Settings",
        icon: "settings",
        permission: "settings:manage",
      },
      { href: "/admin/team", label: "Admin users", icon: "shield", permission: "admins:manage" },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icon: "bell",
        permission: "settings:manage",
      },
      { href: "/admin/audit", label: "Audit log", icon: "history", permission: "audit:read" },
    ],
  },
];
