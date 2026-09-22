"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { discountRuleSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Discount rules: the student/researcher pricing category and anything like it.
 *
 * None of this is hardcoded: the percentage, who qualifies, whether verification is
 * required, the date window and which packages it covers are all stored and editable.
 */

function refresh() {
  revalidatePath("/admin/discounts");
  revalidatePath("/book");
  revalidatePath("/packages");
  revalidatePath("/");
}

export async function saveDiscountRule(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("discounts:manage");

  const parsed = discountRuleSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return actionError("Enter a valid start date.", { startsAt: "Invalid date" });
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return actionError("Enter a valid end date.", { endsAt: "Invalid date" });
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return actionError("The end date must be after the start date.", {
      endsAt: "Must be after the start date",
    });
  }

  const data = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    percentOff: parsed.data.percentOff,
    // Stored as a comma-separated list the pricing engine parses into a set.
    eligibleUserTypes: parsed.data.eligibleUserTypes.join(","),
    requiresVerification: parsed.data.requiresVerification,
    startsAt,
    endsAt,
    isActive: parsed.data.isActive,
    appliesToAllPackages: parsed.data.appliesToAllPackages,
  };

  const rule = id
    ? await prisma.discountRule.update({ where: { id }, data })
    : await prisma.discountRule.create({ data });

  // Replace the package scope wholesale.
  await prisma.discountRulePackage.deleteMany({ where: { discountRuleId: rule.id } });
  if (!parsed.data.appliesToAllPackages && parsed.data.packageIds.length) {
    await prisma.discountRulePackage.createMany({
      data: parsed.data.packageIds.map((packageId) => ({
        discountRuleId: rule.id,
        packageId,
      })),
    });
  }

  await recordAudit(admin, {
    action: id ? "discount.update" : "discount.create",
    entity: "DiscountRule",
    entityId: rule.id,
    summary: `${id ? "Updated" : "Created"} discount "${rule.name}" (${rule.percentOff}%)`,
    metadata: {
      percentOff: rule.percentOff,
      eligibleUserTypes: rule.eligibleUserTypes,
      requiresVerification: rule.requiresVerification,
    },
  });

  refresh();
  return actionOk({ id: rule.id }, id ? "Discount updated." : "Discount created.");
}

export async function toggleDiscountRule(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin("discounts:manage");

  const rule = await prisma.discountRule.update({ where: { id }, data: { isActive } });

  await recordAudit(admin, {
    action: "discount.toggle",
    entity: "DiscountRule",
    entityId: id,
    summary: `${isActive ? "Enabled" : "Disabled"} discount "${rule.name}"`,
  });

  refresh();
  return actionOk(undefined, isActive ? "Discount enabled." : "Discount disabled.");
}

export async function deleteDiscountRule(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("discounts:manage");

  const rule = await prisma.discountRule.findUnique({ where: { id }, select: { name: true } });
  if (!rule) return actionError("That discount no longer exists.");

  await prisma.discountRule.delete({ where: { id } });

  await recordAudit(admin, {
    action: "discount.delete",
    entity: "DiscountRule",
    entityId: id,
    summary: `Deleted discount "${rule.name}"`,
  });

  refresh();
  return actionOk(undefined, "Discount deleted.");
}
