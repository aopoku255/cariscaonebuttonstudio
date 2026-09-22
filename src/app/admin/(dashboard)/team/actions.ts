"use server";

import { revalidatePath } from "next/cache";

import { AdminRole } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { revokeAllAdminSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { adminUserSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Admin user management.
 *
 * Two safeguards worth noting: the last active Super Admin can never be demoted or
 * deactivated (otherwise nobody could administer the system), and changing a password
 * revokes that user's existing sessions.
 */

async function countActiveSuperAdmins(excludeId?: string): Promise<number> {
  return prisma.adminUser.count({
    where: {
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

export async function saveAdminUser(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("admins:manage");

  const parsed = adminUserSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const role = parsed.data.role as AdminRole;
  const password = parsed.data.password?.trim();

  if (!id && !password) {
    return actionError("Set a password for the new admin.", {
      password: "A password is required",
    });
  }

  if (password) {
    const strength = checkPasswordStrength(password);
    if (!strength.ok) {
      const message = strength.message ?? "That password is not strong enough.";
      return actionError(message, { password: message });
    }
  }

  const clash = await prisma.adminUser.findFirst({
    where: { email: parsed.data.email, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return actionError("Another admin already uses that email address.", {
      email: "This email is already registered",
    });
  }

  // Never let the last Super Admin lose their access.
  if (id) {
    const existing = await prisma.adminUser.findUnique({ where: { id } });
    if (!existing) return actionError("That admin no longer exists.");

    const losingSuperAdmin =
      existing.role === AdminRole.SUPER_ADMIN &&
      (role !== AdminRole.SUPER_ADMIN || !parsed.data.isActive);

    if (losingSuperAdmin && (await countActiveSuperAdmins(id)) === 0) {
      return actionError(
        "This is the only active Super Admin. Promote someone else first, or nobody will be able to administer the studio.",
      );
    }
  }

  const data = {
    name: parsed.data.name,
    email: parsed.data.email,
    role,
    isActive: parsed.data.isActive,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };

  const user = id
    ? await prisma.adminUser.update({ where: { id }, data })
    : await prisma.adminUser.create({ data: { ...data, passwordHash: data.passwordHash! } });

  // A password change should log the user out everywhere.
  if (id && password) await revokeAllAdminSessions(id);
  if (id && !parsed.data.isActive) await revokeAllAdminSessions(id);

  await recordAudit(admin, {
    action: id ? "admin.update" : "admin.create",
    entity: "AdminUser",
    entityId: user.id,
    summary: `${id ? "Updated" : "Created"} admin ${user.name} (${user.role})${
      password ? " and changed their password" : ""
    }`,
    metadata: { role: user.role, isActive: user.isActive },
  });

  revalidatePath("/admin/team");
  return actionOk({ id: user.id }, id ? "Admin updated." : "Admin created.");
}

export async function deleteAdminUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("admins:manage");

  if (id === admin.id) {
    return actionError("You cannot delete your own account while signed in.");
  }

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return actionError("That admin no longer exists.");

  if (user.role === AdminRole.SUPER_ADMIN && (await countActiveSuperAdmins(id)) === 0) {
    return actionError("This is the only active Super Admin, so it cannot be removed.");
  }

  await prisma.adminUser.delete({ where: { id } });

  await recordAudit(admin, {
    action: "admin.delete",
    entity: "AdminUser",
    entityId: id,
    summary: `Deleted admin ${user.name} (${user.email})`,
  });

  revalidatePath("/admin/team");
  return actionOk(undefined, "Admin removed.");
}
