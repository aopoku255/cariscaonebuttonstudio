"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { clientIp, recordAudit } from "@/lib/audit";
import { fakeVerify, verifyPassword } from "@/lib/auth/password";
import { createAdminSession, destroyAdminSession } from "@/lib/auth/session";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation/admin";

/**
 * Admin sign-in.
 *
 * Failures are deliberately indistinguishable: an unknown email, a wrong password and
 * a deactivated account all return the same message after the same amount of work, so
 * the form cannot be used to enumerate staff accounts.
 */
export async function signIn(
  _previous: { ok: boolean; message?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const ip = await clientIp();
  const limit = rateLimit(`admin-login:${ip}`, RATE_LIMITS.adminLogin);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many sign-in attempts. Try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    await fakeVerify();
    return { ok: false, message: "Enter your email address and password." };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });

  if (!admin || !admin.isActive) {
    // Spend the same time as a real check so timing does not reveal the difference.
    await fakeVerify();
    return { ok: false, message: "Those details did not match an active account." };
  }

  const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!valid) {
    return { ok: false, message: "Those details did not match an active account." };
  }

  const headerStore = await headers();
  await createAdminSession(admin.id, {
    ipAddress: ip,
    userAgent: headerStore.get("user-agent"),
  });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit(
    { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    {
      action: "admin.signin",
      entity: "AdminUser",
      entityId: admin.id,
      summary: `${admin.name} signed in`,
    },
  );

  return { ok: true };
}

export async function signOut(): Promise<void> {
  await destroyAdminSession();
}
