"use server";

import { revalidatePath } from "next/cache";

import type { AddOnPricingUnit } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { addOnSchema, equipmentSchema, faqSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * CRUD for the simpler catalogue resources: add-ons, equipment and FAQs.
 *
 * Each action checks its own permission and writes an audit entry, then revalidates
 * both the admin screen and the public pages that read the same data.
 */

function refresh(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

/* -------------------------------------------------------------------------- */
/* Add-ons                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveAddOn(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("addons:manage");

  const parsed = addOnSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const clash = await prisma.addOn.findFirst({
    where: { slug: parsed.data.slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return actionError("Another add-on already uses that slug.", {
      slug: "This slug is already taken",
    });
  }

  const data = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    priceMinor: parsed.data.priceMajor,
    pricingUnit: parsed.data.pricingUnit as AddOnPricingUnit,
    maxQuantity: parsed.data.maxQuantity,
    isActive: parsed.data.isActive,
    sortOrder: parsed.data.sortOrder,
  };

  const record = id
    ? await prisma.addOn.update({ where: { id }, data })
    : await prisma.addOn.create({ data });

  await recordAudit(admin, {
    action: id ? "addon.update" : "addon.create",
    entity: "AddOn",
    entityId: record.id,
    summary: `${id ? "Updated" : "Created"} add-on "${record.name}"`,
    metadata: { priceMinor: record.priceMinor, pricingUnit: record.pricingUnit },
  });

  refresh(["/admin/addons", "/book", "/"]);
  return actionOk({ id: record.id }, id ? "Add-on updated." : "Add-on created.");
}

export async function toggleAddOn(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin("addons:manage");
  const record = await prisma.addOn.update({ where: { id }, data: { isActive } });

  await recordAudit(admin, {
    action: "addon.toggle",
    entity: "AddOn",
    entityId: id,
    summary: `${isActive ? "Enabled" : "Disabled"} add-on "${record.name}"`,
  });

  refresh(["/admin/addons", "/book"]);
  return actionOk(undefined, isActive ? "Add-on enabled." : "Add-on disabled.");
}

export async function deleteAddOn(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("addons:manage");

  const record = await prisma.addOn.findUnique({
    where: { id },
    select: { name: true, _count: { select: { bookingAddOns: true } } },
  });
  if (!record) return actionError("That add-on no longer exists.");

  // Booked add-ons keep a name snapshot, so deleting the row is safe for history -
  // but disabling is still the kinder default when it is in active use.
  if (record._count.bookingAddOns > 0) {
    await prisma.addOn.update({ where: { id }, data: { isActive: false } });
    await recordAudit(admin, {
      action: "addon.disable",
      entity: "AddOn",
      entityId: id,
      summary: `Disabled add-on "${record.name}" (used on ${record._count.bookingAddOns} bookings)`,
    });
    refresh(["/admin/addons", "/book"]);
    return actionOk(
      undefined,
      `"${record.name}" is on ${record._count.bookingAddOns} booking(s), so it was disabled rather than deleted.`,
    );
  }

  await prisma.addOn.delete({ where: { id } });
  await recordAudit(admin, {
    action: "addon.delete",
    entity: "AddOn",
    entityId: id,
    summary: `Deleted add-on "${record.name}"`,
  });

  refresh(["/admin/addons", "/book"]);
  return actionOk(undefined, "Add-on deleted.");
}

/* -------------------------------------------------------------------------- */
/* Equipment                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveEquipment(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("equipment:manage");

  const parsed = equipmentSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const clash = await prisma.equipment.findFirst({
    where: { slug: parsed.data.slug, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return actionError("Another item already uses that slug.", {
      slug: "This slug is already taken",
    });
  }

  const data = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    quantity: parsed.data.quantity,
    isAvailable: parsed.data.isAvailable,
    includedInPackages: parsed.data.includedInPackages,
    rentalPriceMinor: parsed.data.rentalPriceMajor,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  };

  const record = id
    ? await prisma.equipment.update({ where: { id }, data })
    : await prisma.equipment.create({ data });

  await recordAudit(admin, {
    action: id ? "equipment.update" : "equipment.create",
    entity: "Equipment",
    entityId: record.id,
    summary: `${id ? "Updated" : "Created"} equipment "${record.name}"`,
  });

  refresh(["/admin/equipment", "/studio", "/"]);
  return actionOk({ id: record.id }, id ? "Equipment updated." : "Equipment added.");
}

export async function toggleEquipment(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin("equipment:manage");
  const record = await prisma.equipment.update({ where: { id }, data: { isActive } });

  await recordAudit(admin, {
    action: "equipment.toggle",
    entity: "Equipment",
    entityId: id,
    summary: `${isActive ? "Enabled" : "Disabled"} equipment "${record.name}"`,
  });

  refresh(["/admin/equipment", "/studio", "/"]);
  return actionOk(undefined, isActive ? "Equipment shown." : "Equipment hidden.");
}

export async function deleteEquipment(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("equipment:manage");
  const record = await prisma.equipment.findUnique({ where: { id }, select: { name: true } });
  if (!record) return actionError("That item no longer exists.");

  await prisma.equipment.delete({ where: { id } });
  await recordAudit(admin, {
    action: "equipment.delete",
    entity: "Equipment",
    entityId: id,
    summary: `Deleted equipment "${record.name}"`,
  });

  refresh(["/admin/equipment", "/studio", "/"]);
  return actionOk(undefined, "Equipment deleted.");
}

/* -------------------------------------------------------------------------- */
/* FAQs                                                                        */
/* -------------------------------------------------------------------------- */

export async function saveFaq(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("faqs:manage");

  const parsed = faqSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = {
    question: parsed.data.question,
    answer: parsed.data.answer,
    category: parsed.data.category ?? null,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  };

  const record = id
    ? await prisma.faq.update({ where: { id }, data })
    : await prisma.faq.create({ data });

  await recordAudit(admin, {
    action: id ? "faq.update" : "faq.create",
    entity: "Faq",
    entityId: record.id,
    summary: `${id ? "Updated" : "Created"} FAQ "${record.question.slice(0, 60)}"`,
  });

  refresh(["/admin/faqs", "/faq", "/"]);
  return actionOk({ id: record.id }, id ? "FAQ updated." : "FAQ created.");
}

export async function toggleFaq(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin("faqs:manage");
  const record = await prisma.faq.update({ where: { id }, data: { isActive } });

  await recordAudit(admin, {
    action: "faq.toggle",
    entity: "Faq",
    entityId: id,
    summary: `${isActive ? "Published" : "Unpublished"} FAQ "${record.question.slice(0, 60)}"`,
  });

  refresh(["/admin/faqs", "/faq", "/"]);
  return actionOk(undefined, isActive ? "FAQ published." : "FAQ hidden.");
}

export async function deleteFaq(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("faqs:manage");
  const record = await prisma.faq.findUnique({ where: { id }, select: { question: true } });
  if (!record) return actionError("That FAQ no longer exists.");

  await prisma.faq.delete({ where: { id } });
  await recordAudit(admin, {
    action: "faq.delete",
    entity: "Faq",
    entityId: id,
    summary: `Deleted FAQ "${record.question.slice(0, 60)}"`,
  });

  refresh(["/admin/faqs", "/faq", "/"]);
  return actionOk(undefined, "FAQ deleted.");
}
