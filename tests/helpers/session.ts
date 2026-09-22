import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

/**
 * Test helpers for signing in over HTTP.
 *
 * These write a session row directly and hand back the raw cookie value, which is the
 * same thing `createAdminSession` does: it just cannot be called from outside a
 * Next.js request, because it needs the `cookies()` store.
 */

export async function mintAdminSession(email: string): Promise<{ cookie: string; id: string }> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) throw new Error(`No admin user with email ${email}`);

  const token = randomBytes(32).toString("base64url");
  const session = await prisma.adminSession.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      adminUserId: admin.id,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });

  return { cookie: `carisca_admin_session=${token}`, id: session.id };
}

export async function revokeSession(id: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { id } });
}

/** Is the dev server up? Smoke tests skip themselves when it is not. */
export async function serverIsUp(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}
