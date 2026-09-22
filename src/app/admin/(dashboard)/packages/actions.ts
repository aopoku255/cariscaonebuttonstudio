"use server";

import { revalidatePath } from "next/cache";

import { PackageCategory } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { packageSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Package CRUD.
 *
 * Every action asserts `packages:manage` before touching anything, and records what
 * changed in the audit log. Prices arrive as major-unit strings from the form and are
 * converted to minor units by the schema.
 */

function toData(input: ReturnType<typeof packageSchema.parse>) {
  const isMembership = input.category === PackageCategory.MEMBERSHIP;
  return {
    name: input.name,
    slug: input.slug,
    category: input.category as PackageCategory,
    summary: input.summary ?? null,
    description: input.description ?? null,
    priceMinor: input.priceMajor,
    durationMinutes: input.durationMinutes,
    imageUrl: input.imageUrl ?? null,
    isActive: input.isActive,
    isPopular: input.isPopular,
    studentOnly: input.studentOnly,
    sortOrder: input.sortOrder,
    // Membership fields are only meaningful on membership packages.
    includedHours: isMembership ? (input.includedHours ?? null) : null,
    extraHourDiscountPercent: isMembership
      ? (input.extraHourDiscountPercent ?? null)
      : null,
    validityDays: isMembership ? (input.validityDays ?? null) : null,
    priorityBooking: isMembership ? input.priorityBooking : false,
  };
}

export async function savePackage(
  packageId: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("packages:manage");

  const parsed = packageSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = toData(parsed.data);

  // Slugs are unique and appear in URLs, so check before writing for a clear message.
  const clash = await prisma.package.findFirst({
    where: { slug: data.slug, ...(packageId ? { NOT: { id: packageId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return actionError("Another package already uses that slug.", {
      slug: "This slug is already taken",
    });
  }

  const record = packageId
    ? await prisma.package.update({ where: { id: packageId }, data })
    : await prisma.package.create({ data });

  // Features are replaced wholesale: simpler and safer than diffing an ordered list.
  await prisma.packageFeature.deleteMany({ where: { packageId: record.id } });
  if (parsed.data.features.length) {
    await prisma.packageFeature.createMany({
      data: parsed.data.features
        .filter((label) => label.trim())
        .map((label, index) => ({
          packageId: record.id,
          label: label.trim(),
          sortOrder: index,
        })),
    });
  }

  await recordAudit(admin, {
    action: packageId ? "package.update" : "package.create",
    entity: "Package",
    entityId: record.id,
    summary: `${packageId ? "Updated" : "Created"} package "${record.name}"`,
    metadata: { priceMinor: record.priceMinor, isActive: record.isActive },
  });

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  revalidatePath("/");

  return actionOk({ id: record.id }, packageId ? "Package updated." : "Package created.");
}

export async function togglePackageActive(
  packageId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin("packages:manage");

  const record = await prisma.package.update({
    where: { id: packageId },
    data: { isActive },
  });

  await recordAudit(admin, {
    action: "package.toggle",
    entity: "Package",
    entityId: packageId,
    summary: `${isActive ? "Enabled" : "Disabled"} package "${record.name}"`,
  });

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  revalidatePath("/");

  return actionOk(undefined, isActive ? "Package enabled." : "Package disabled.");
}

export async function deletePackage(packageId: string): Promise<ActionResult> {
  const admin = await requireAdmin("packages:manage");

  const record = await prisma.package.findUnique({
    where: { id: packageId },
    select: { name: true, _count: { select: { bookings: true, memberships: true } } },
  });

  if (!record) return actionError("That package no longer exists.");

  /**
   * Packages with history are disabled rather than deleted. Bookings keep a name
   * snapshot, so the record would survive: but removing the row would break the
   * link from a booking back to what was actually sold.
   */
  if (record._count.bookings > 0 || record._count.memberships > 0) {
    await prisma.package.update({ where: { id: packageId }, data: { isActive: false } });

    await recordAudit(admin, {
      action: "package.disable",
      entity: "Package",
      entityId: packageId,
      summary: `Disabled package "${record.name}" (has ${record._count.bookings} bookings, so it was not deleted)`,
    });

    revalidatePath("/admin/packages");
    revalidatePath("/packages");

    return actionOk(
      undefined,
      `"${record.name}" has ${record._count.bookings} booking(s) attached, so it was disabled rather than deleted. It no longer appears on the website.`,
    );
  }

  await prisma.package.delete({ where: { id: packageId } });

  await recordAudit(admin, {
    action: "package.delete",
    entity: "Package",
    entityId: packageId,
    summary: `Deleted package "${record.name}"`,
  });

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  revalidatePath("/");

  return actionOk(undefined, "Package deleted.");
}
