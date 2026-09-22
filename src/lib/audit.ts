import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import type { AdminSessionUser } from "@/lib/auth/session";

/**
 * Audit trail for admin actions. Writing the log must never break the action that
 * triggered it, so failures are logged to the console and swallowed.
 */

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(
  admin: AdminSessionUser | null,
  entry: AuditEntry,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: admin?.id ?? null,
        actorEmail: admin?.email ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: (entry.metadata ?? undefined) as object | undefined,
        ipAddress: await clientIp(),
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry:", error);
  }
}

/**
 * Best-effort client IP. Behind a proxy this reads the forwarding headers; treat the
 * value as diagnostic, never as an authorisation input.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
    return store.get("x-real-ip");
  } catch {
    return null;
  }
}
