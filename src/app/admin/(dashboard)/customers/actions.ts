"use server";

import { revalidatePath } from "next/cache";

import type { CustomerType } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { customerUpdateSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Customer record maintenance.
 *
 * `isVerified` is the switch that unlocks discounts requiring proof of student or
 * researcher status, so changing it is audited like any other money-adjacent action.
 */
export async function updateCustomer(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("customers:write");

  const parsed = customerUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const before = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
    select: { isVerified: true, name: true },
  });
  if (!before) return actionError("That customer no longer exists.");

  const customer = await prisma.customer.update({
    where: { id: parsed.data.customerId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      organisation: parsed.data.organisation ?? null,
      userType: parsed.data.userType as CustomerType,
      isVerified: parsed.data.isVerified,
      notes: parsed.data.notes ?? null,
    },
  });

  await recordAudit(admin, {
    action: "customer.update",
    entity: "Customer",
    entityId: customer.id,
    summary:
      before.isVerified !== customer.isVerified
        ? `Updated ${customer.name} and ${customer.isVerified ? "granted" : "removed"} verified status`
        : `Updated customer ${customer.name}`,
    metadata: { isVerified: customer.isVerified, userType: customer.userType },
  });

  revalidatePath(`/admin/customers/${customer.id}`);
  revalidatePath("/admin/customers");

  return actionOk(undefined, "Customer updated.");
}

/** One-click manual verification, for the Student customers list. */
export async function verifyStudentCustomer(customerId: string): Promise<ActionResult> {
  const admin = await requireAdmin("customers:write");

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { isVerified: true },
  });

  await recordAudit(admin, {
    action: "customer.verify",
    entity: "Customer",
    entityId: customer.id,
    summary: `Manually verified ${customer.name} as a KNUST student`,
  });

  revalidatePath("/admin/students");
  revalidatePath(`/admin/customers/${customer.id}`);
  revalidatePath("/admin/customers");

  return actionOk(undefined, "Customer verified.");
}
