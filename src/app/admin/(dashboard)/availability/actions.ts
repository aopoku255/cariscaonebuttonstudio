"use server";

import { revalidatePath } from "next/cache";

import type { BlockType } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { parseDateKey, parseTimeToMinute } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import {
  blockedDateSchema,
  blockedTimeSchema,
  operatingHoursSchema,
} from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Studio availability.
 *
 * Blocking a date or time never touches existing bookings: it only stops new ones
 * being taken. If there is already a booking inside the window, the admin is told so
 * they can reschedule it deliberately rather than having it silently disappear.
 */

function refresh() {
  revalidatePath("/admin/availability");
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
  revalidatePath("/");
}

export async function saveOperatingHours(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("availability:manage");

  const parsed = operatingHoursSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the opening times.", fieldErrors(parsed.error));
  }

  for (const day of parsed.data.days) {
    const openMinute = parseTimeToMinute(day.open);
    const closeMinute = parseTimeToMinute(day.close);

    if (openMinute === null || closeMinute === null) {
      return actionError("Enter times as HH:MM.");
    }
    if (day.isOpen && closeMinute <= openMinute) {
      return actionError("Closing time must be after opening time on every open day.");
    }

    await prisma.operatingHour.upsert({
      where: { dayOfWeek: day.dayOfWeek },
      create: { dayOfWeek: day.dayOfWeek, isOpen: day.isOpen, openMinute, closeMinute },
      update: { isOpen: day.isOpen, openMinute, closeMinute },
    });
  }

  await recordAudit(admin, {
    action: "availability.hours",
    entity: "OperatingHour",
    summary: "Updated studio opening hours",
    metadata: { days: parsed.data.days },
  });

  refresh();
  return actionOk(undefined, "Opening hours saved.");
}

export async function addBlockedDate(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("availability:manage");

  const parsed = blockedDateSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const date = parseDateKey(parsed.data.date);
  if (!date) return actionError("Choose a valid date.", { date: "Invalid date" });

  const existing = await prisma.blockedDate.findUnique({ where: { date } });
  if (existing) return actionError("That date is already blocked.");

  // Warn about bookings already in the window rather than cancelling them silently.
  const clashes = await prisma.booking.count({
    where: {
      bookingDate: date,
      status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "IN_PROGRESS"] },
    },
  });

  await prisma.blockedDate.create({
    data: {
      date,
      reason: parsed.data.reason,
      type: parsed.data.type as BlockType,
    },
  });

  await recordAudit(admin, {
    action: "availability.block_date",
    entity: "BlockedDate",
    summary: `Blocked ${parsed.data.date}: ${parsed.data.reason}`,
    metadata: { existingBookings: clashes },
  });

  refresh();
  return actionOk(
    undefined,
    clashes > 0
      ? `Date blocked. Note that ${clashes} booking(s) already exist on this date: they are untouched, so reschedule or cancel them if needed.`
      : "Date blocked.",
  );
}

export async function removeBlockedDate(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("availability:manage");

  const record = await prisma.blockedDate.findUnique({ where: { id } });
  if (!record) return actionError("That block no longer exists.");

  await prisma.blockedDate.delete({ where: { id } });

  await recordAudit(admin, {
    action: "availability.unblock_date",
    entity: "BlockedDate",
    summary: `Unblocked ${record.date.toISOString().slice(0, 10)}`,
  });

  refresh();
  return actionOk(undefined, "Date unblocked.");
}

export async function addBlockedTime(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("availability:manage");

  const parsed = blockedTimeSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const date = parseDateKey(parsed.data.date);
  const startMinute = parseTimeToMinute(parsed.data.start);
  const endMinute = parseTimeToMinute(parsed.data.end);

  if (!date || startMinute === null || endMinute === null) {
    return actionError("Enter a valid date and time range.");
  }
  if (endMinute <= startMinute) {
    return actionError("The end time must be after the start time.", {
      end: "Must be after the start",
    });
  }

  const clashes = await prisma.booking.count({
    where: {
      bookingDate: date,
      status: { in: ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "IN_PROGRESS"] },
      startMinute: { lt: endMinute },
      endMinute: { gt: startMinute },
    },
  });

  await prisma.blockedTime.create({
    data: {
      date,
      startMinute,
      endMinute,
      reason: parsed.data.reason,
      type: parsed.data.type as BlockType,
    },
  });

  await recordAudit(admin, {
    action: "availability.block_time",
    entity: "BlockedTime",
    summary: `Blocked ${parsed.data.date} ${parsed.data.start}–${parsed.data.end}: ${parsed.data.reason}`,
    metadata: { existingBookings: clashes },
  });

  refresh();
  return actionOk(
    undefined,
    clashes > 0
      ? `Time blocked. ${clashes} existing booking(s) overlap this window: they are untouched, so reschedule them if needed.`
      : "Time blocked.",
  );
}

export async function removeBlockedTime(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("availability:manage");

  const record = await prisma.blockedTime.findUnique({ where: { id } });
  if (!record) return actionError("That block no longer exists.");

  await prisma.blockedTime.delete({ where: { id } });

  await recordAudit(admin, {
    action: "availability.unblock_time",
    entity: "BlockedTime",
    summary: `Unblocked ${record.date.toISOString().slice(0, 10)} ${record.startMinute}–${record.endMinute}`,
  });

  refresh();
  return actionOk(undefined, "Time unblocked.");
}
