"use server";

import { revalidatePath } from "next/cache";

import { MembershipStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { generateMembershipReference } from "@/lib/booking/reference";
import { parseDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import {
  membershipAdjustSchema,
  membershipExtendSchema,
  membershipSchema,
} from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Membership management.
 *
 * Memberships are prepaid bundles of studio hours, not recurring subscriptions: they
 * are created with an explicit allowance and expiry, and nothing renews them unless an
 * administrator turns `autoRenew` on deliberately. The schema carries that flag so a
 * true subscription can be layered on later without a migration.
 */

function refresh(id?: string) {
  revalidatePath("/admin/memberships");
  revalidatePath("/admin/dashboard");
  if (id) revalidatePath(`/admin/memberships/${id}`);
}

export async function createMembership(
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("memberships:manage");

  const parsed = membershipSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const startDate = parseDateKey(parsed.data.startDate);
  if (!startDate) return actionError("Choose a valid start date.", { startDate: "Invalid date" });

  const pkg = await prisma.package.findUnique({ where: { id: parsed.data.packageId } });
  if (!pkg) return actionError("That package no longer exists.", { packageId: "Not found" });

  const customer = await prisma.customer.upsert({
    where: { email: parsed.data.customerEmail },
    create: {
      email: parsed.data.customerEmail,
      name: parsed.data.customerName,
      phone: parsed.data.customerPhone || "-",
    },
    update: { name: parsed.data.customerName },
  });

  const expiryDate = new Date(
    startDate.getTime() + parsed.data.validityDays * 24 * 60 * 60_000,
  );

  const membership = await prisma.membership.create({
    data: {
      reference: await generateMembershipReference(startDate),
      customerId: customer.id,
      packageId: pkg.id,
      packageNameSnapshot: pkg.name,
      status: parsed.data.status as MembershipStatus,
      totalMinutes: Math.round(parsed.data.totalHours * 60),
      startDate,
      expiryDate,
      pricePaidMinor: parsed.data.pricePaidMajor,
      priorityBooking: parsed.data.priorityBooking,
      extraHourDiscountPercent: parsed.data.extraHourDiscountPercent,
      autoRenew: parsed.data.autoRenew,
    },
  });

  await prisma.membershipUsage.create({
    data: {
      membershipId: membership.id,
      minutesUsed: 0,
      note: `Membership created with ${parsed.data.totalHours} hours by ${admin.name}`,
    },
  });

  await recordAudit(admin, {
    action: "membership.create",
    entity: "Membership",
    entityId: membership.id,
    summary: `Created ${pkg.name} membership for ${customer.name} (${parsed.data.totalHours} hours)`,
    metadata: { totalMinutes: membership.totalMinutes, autoRenew: membership.autoRenew },
  });

  refresh(membership.id);
  return actionOk({ id: membership.id }, `Membership ${membership.reference} created.`);
}

/** Add or remove hours. A negative delta removes them, never below what is already used. */
export async function adjustMembershipHours(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("memberships:manage");

  const parsed = membershipAdjustSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Enter a number of hours.", fieldErrors(parsed.error));
  }

  const membership = await prisma.membership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { customer: { select: { name: true } } },
  });
  if (!membership) return actionError("That membership no longer exists.");

  const deltaMinutes = Math.round(parsed.data.hoursDelta * 60);
  const nextTotal = membership.totalMinutes + deltaMinutes;

  if (nextTotal < membership.usedMinutes) {
    return actionError(
      `This member has already used ${(membership.usedMinutes / 60).toFixed(1)} hours, so the allowance cannot drop below that.`,
    );
  }
  if (nextTotal < 0) {
    return actionError("The allowance cannot go below zero.");
  }

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membership.id },
      data: { totalMinutes: nextTotal },
    }),
    prisma.membershipUsage.create({
      data: {
        membershipId: membership.id,
        minutesUsed: 0,
        note:
          parsed.data.note ||
          `${deltaMinutes > 0 ? "Added" : "Removed"} ${Math.abs(parsed.data.hoursDelta)} hour(s) by ${admin.name}`,
      },
    }),
  ]);

  await recordAudit(admin, {
    action: "membership.adjust",
    entity: "Membership",
    entityId: membership.id,
    summary: `${deltaMinutes > 0 ? "Added" : "Removed"} ${Math.abs(parsed.data.hoursDelta)} hour(s) on ${membership.reference} (${membership.customer.name})`,
    metadata: { deltaMinutes, newTotalMinutes: nextTotal },
  });

  refresh(membership.id);
  return actionOk(undefined, "Hours updated.");
}

export async function extendMembership(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("memberships:manage");

  const parsed = membershipExtendSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Enter how many days to extend by.", fieldErrors(parsed.error));
  }

  const membership = await prisma.membership.findUnique({
    where: { id: parsed.data.membershipId },
  });
  if (!membership) return actionError("That membership no longer exists.");

  // Extend from today when it has already lapsed, so the member gets the full window.
  const base =
    membership.expiryDate > new Date() ? membership.expiryDate : new Date();
  const expiryDate = new Date(base.getTime() + parsed.data.extraDays * 24 * 60 * 60_000);

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      expiryDate,
      status:
        membership.status === MembershipStatus.EXPIRED
          ? MembershipStatus.ACTIVE
          : membership.status,
    },
  });

  await recordAudit(admin, {
    action: "membership.extend",
    entity: "Membership",
    entityId: membership.id,
    summary: `Extended ${membership.reference} by ${parsed.data.extraDays} days`,
    metadata: { newExpiry: expiryDate.toISOString() },
  });

  refresh(membership.id);
  return actionOk(undefined, "Membership extended.");
}

export async function setMembershipStatus(
  membershipId: string,
  status: MembershipStatus,
): Promise<ActionResult> {
  const admin = await requireAdmin("memberships:manage");

  const membership = await prisma.membership.update({
    where: { id: membershipId },
    data: { status },
  });

  await recordAudit(admin, {
    action: "membership.status",
    entity: "Membership",
    entityId: membershipId,
    summary: `Set ${membership.reference} to ${status}`,
  });

  refresh(membershipId);
  return actionOk(undefined, `Membership marked as ${status.toLowerCase()}.`);
}

/**
 * Mark memberships past their expiry date as EXPIRED. Called from the cron endpoint;
 * nothing renews automatically: that is a deliberate product decision, not an
 * oversight.
 */
export async function expireLapsedMemberships(now: Date = new Date()): Promise<number> {
  const result = await prisma.membership.updateMany({
    where: { status: MembershipStatus.ACTIVE, expiryDate: { lt: now } },
    data: { status: MembershipStatus.EXPIRED },
  });
  return result.count;
}
