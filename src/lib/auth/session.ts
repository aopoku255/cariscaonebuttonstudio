import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { cache } from "react";

import type { AdminRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * Sessions are opaque random tokens stored server-side. Only the SHA-256 of the token
 * is persisted, so a leaked database backup cannot be replayed as a login, and an
 * admin can be signed out instantly by deleting the row: something a stateless JWT
 * cannot offer.
 */

export const ADMIN_COOKIE = "carisca_admin_session";
export const CUSTOMER_COOKIE = "carisca_customer_session";

const ADMIN_SESSION_DAYS = 7;
const CUSTOMER_SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Admin sessions
// ---------------------------------------------------------------------------

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export async function createAdminSession(
  adminUserId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60_000);

  await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      adminUserId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  });

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Resolve the signed-in admin, or null. Memoised per request so a page that checks
 * permissions in several places still hits the database once.
 */
export const getAdminSession = cache(async (): Promise<AdminSessionUser | null> => {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { adminUser: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  if (!session.adminUser.isActive) return null;

  return {
    id: session.adminUser.id,
    email: session.adminUser.email,
    name: session.adminUser.name,
    role: session.adminUser.role,
  };
});

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(ADMIN_COOKIE);
}

/** Remove every session for an admin, e.g. after a password change. */
export async function revokeAllAdminSessions(adminUserId: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { adminUserId } });
}

// ---------------------------------------------------------------------------
// Customer sessions
// ---------------------------------------------------------------------------

export interface CustomerSessionUser {
  id: string;
  email: string;
  name: string;
}

export async function createCustomerSession(customerId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60_000);

  await prisma.customerSession.create({
    data: { tokenHash: hashToken(token), customerId, expiresAt },
  });

  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, cookieOptions(expiresAt));
}

export const getCustomerSession = cache(async (): Promise<CustomerSessionUser | null> => {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });

  if (!session || session.expiresAt < new Date()) return null;

  return {
    id: session.customer.id,
    email: session.customer.email,
    name: session.customer.name,
  };
});

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await prisma.customerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(CUSTOMER_COOKIE);
}

/** Delete expired rows. Called from the cron endpoint. */
export async function pruneExpiredSessions(): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}

/** Constant-time string comparison, for comparing secrets from headers. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
