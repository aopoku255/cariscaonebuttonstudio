import "server-only";

import { redirect } from "next/navigation";

import { type AdminSessionUser, getAdminSession } from "@/lib/auth/session";
import { type Permission, roleHas } from "@/lib/auth/permissions";

/**
 * Server-side authorisation.
 *
 * Every admin page, server action and route handler goes through one of these. The
 * proxy at the edge of the app only handles the redirect experience for signed-out
 * visitors: it is not a security boundary, because a Server Action can be POSTed
 * directly without ever passing through a page render.
 */

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For pages and layouts: redirect signed-out visitors to the login screen. */
export async function requireAdminPage(
  permission?: Permission,
  returnTo?: string,
): Promise<AdminSessionUser> {
  const admin = await getAdminSession();
  if (!admin) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/admin/login${next}`);
  }
  if (permission && !roleHas(admin.role, permission)) {
    redirect("/admin/no-access");
  }
  return admin;
}

/** For server actions and route handlers: throw rather than redirect. */
export async function requireAdmin(permission?: Permission): Promise<AdminSessionUser> {
  const admin = await getAdminSession();
  if (!admin) {
    throw new AuthorizationError("You need to sign in to do that.");
  }
  if (permission && !roleHas(admin.role, permission)) {
    throw new AuthorizationError(
      "Your role does not have permission to perform this action.",
    );
  }
  return admin;
}

/** Non-throwing check, for conditionally rendering admin-only UI. */
export async function adminCan(permission: Permission): Promise<boolean> {
  const admin = await getAdminSession();
  return admin ? roleHas(admin.role, permission) : false;
}
