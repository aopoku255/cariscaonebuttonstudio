"use server";

import { revalidatePath } from "next/cache";

import {
  BookingSource,
  BookingStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import {
  BookingError,
  createBooking,
  releaseBookingHold,
} from "@/lib/booking/service";
import { parseDateKey, parseTimeToMinute, slotMinutesFor, toUtcInstant } from "@/lib/booking/time";
import { validateRequestedSlot } from "@/lib/booking/availability";
import { prisma } from "@/lib/db";
import {
  notifyBookingCancelled,
  notifyBookingCompleted,
} from "@/lib/email/notifications";
import { recordRefund } from "@/lib/payments/service";
import { getBookingPolicy } from "@/lib/settings";
import {
  adminBookingSchema,
  bookingNoteSchema,
  bookingStatusUpdateSchema,
  rescheduleBookingSchema,
} from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Admin booking management.
 *
 * Admin-created bookings may sit outside opening hours and skip payment, but they can
 * never overlap another live booking: that guarantee comes from the same unique index
 * the public flow relies on, so there is no privileged path around it.
 */

function refresh(bookingId?: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function createAdminBooking(
  payload: unknown,
): Promise<ActionResult<{ id: string; reference: string }>> {
  const admin = await requireAdmin("bookings:write");

  const parsed = adminBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const startMinute = parseTimeToMinute(parsed.data.startTime);
  if (startMinute === null) {
    return actionError("Enter a valid start time.", { startTime: "Use HH:MM" });
  }

  try {
    const result = await createBooking({
      packageId: parsed.data.packageId,
      dateKey: parsed.data.dateKey,
      startMinute,
      durationOverrideMinutes: parsed.data.durationMinutes,
      addOns: parsed.data.addOns,
      customer: {
        name: parsed.data.customerName,
        email: parsed.data.customerEmail,
        phone: parsed.data.customerPhone,
        organisation: parsed.data.organisation ?? null,
        userType: parsed.data.userType,
      },
      purpose: parsed.data.purpose ?? null,
      internalNotes: parsed.data.internalNotes ?? null,
      useMembership: parsed.data.useMembership,
      source: BookingSource.ADMIN,
      createdByAdminId: admin.id,
      paymentMode: parsed.data.paymentMode,
      allowOutsideHours: parsed.data.allowOutsideHours,
    });

    await recordAudit(admin, {
      action: "booking.create",
      entity: "Booking",
      entityId: result.bookingId,
      summary: `Created booking ${result.reference} for ${parsed.data.customerName} (${parsed.data.paymentMode})`,
      metadata: { totalMinor: result.quote.totalMinor, paymentMode: parsed.data.paymentMode },
    });

    refresh(result.bookingId);
    return actionOk(
      { id: result.bookingId, reference: result.reference },
      `Booking ${result.reference} created.`,
    );
  } catch (error) {
    if (error instanceof BookingError) return actionError(error.message);
    console.error("[createAdminBooking] failed:", error);
    return actionError("Something went wrong creating that booking.");
  }
}

export async function updateBookingStatus(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("bookings:write");

  const parsed = bookingStatusUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Invalid request.", fieldErrors(parsed.error));
  }

  const { bookingId, reason } = parsed.data;
  const status = parsed.data.status as BookingStatus;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { reference: true, status: true, paymentStatus: true },
  });
  if (!booking) return actionError("That booking no longer exists.");

  const now = new Date();

  // Cancelling, refunding or marking a no-show all free the slot for someone else.
  const releasesSlot =
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.REFUNDED ||
    status === BookingStatus.NO_SHOW;

  if (status === BookingStatus.REFUNDED) {
    await recordRefund({ bookingId, reason: reason ?? "Refunded by the studio." });
  } else {
    if (releasesSlot) await releaseBookingHold(bookingId);

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status,
        ...(releasesSlot
          ? { cancelledAt: now, cancellationReason: reason ?? null, expiresAt: null }
          : {}),
        ...(status === BookingStatus.CONFIRMED ? { confirmedAt: now, expiresAt: null } : {}),
        ...(status === BookingStatus.COMPLETED ? { completedAt: now } : {}),
      },
    });
  }

  await recordAudit(admin, {
    action: "booking.status",
    entity: "Booking",
    entityId: bookingId,
    summary: `Changed ${booking.reference} from ${booking.status} to ${status}`,
    metadata: { from: booking.status, to: status, reason },
  });

  // Tell the customer, but only for the transitions they would expect to hear about.
  if (status === BookingStatus.CANCELLED) {
    await notifyBookingCancelled(bookingId, reason ?? null);
  } else if (status === BookingStatus.COMPLETED) {
    await notifyBookingCompleted(bookingId);
  }

  refresh(bookingId);
  return actionOk(undefined, `Booking marked as ${status.toLowerCase().replace(/_/g, " ")}.`);
}

export async function rescheduleBooking(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("bookings:write");

  const parsed = rescheduleBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Invalid request.", fieldErrors(parsed.error));
  }

  const startMinute = parseTimeToMinute(parsed.data.startTime);
  const bookingDate = parseDateKey(parsed.data.dateKey);
  if (startMinute === null || !bookingDate) {
    return actionError("Enter a valid date and time.", { startTime: "Use HH:MM" });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, reference: true, bookingDate: true, startMinute: true },
  });
  if (!booking) return actionError("That booking no longer exists.");

  const policy = await getBookingPolicy();
  const check = await validateRequestedSlot({
    dateKey: parsed.data.dateKey,
    startMinute,
    durationMinutes: parsed.data.durationMinutes,
    policy,
    allowOutsideHours: parsed.data.allowOutsideHours,
  });
  if (!check.ok) return actionError(check.reason ?? "That time is unavailable.");

  const endMinute = startMinute + parsed.data.durationMinutes;

  try {
    await prisma.$transaction(async (tx) => {
      // Drop the old hold first, then take the new one inside the same transaction:
      // if the new slot is taken, the unique index rolls the whole thing back and the
      // booking keeps its original time.
      await tx.bookingSlot.deleteMany({ where: { bookingId: booking.id } });
      await tx.bookingSlot.createMany({
        data: slotMinutesFor(startMinute, endMinute).map((slotMinute) => ({
          bookingDate,
          slotMinute,
          bookingId: booking.id,
        })),
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          bookingDate,
          startMinute,
          endMinute,
          startsAt: toUtcInstant(bookingDate, startMinute),
          endsAt: toUtcInstant(bookingDate, endMinute),
          durationMinutes: parsed.data.durationMinutes,
          // A rescheduled session should be reminded about again.
          reminderSentAt: null,
        },
      });
    });
  } catch (error) {
    const code = (error as { code?: string; errno?: number }).code;
    const errno = (error as { errno?: number }).errno;
    if (code === "P2002" || errno === 1062) {
      return actionError("Another booking already holds that time. Choose a different slot.");
    }
    throw error;
  }

  await recordAudit(admin, {
    action: "booking.reschedule",
    entity: "Booking",
    entityId: booking.id,
    summary: `Rescheduled ${booking.reference} to ${parsed.data.dateKey} at ${parsed.data.startTime}`,
  });

  refresh(booking.id);
  return actionOk(undefined, "Booking rescheduled.");
}

export async function saveBookingNotes(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("bookings:write");

  const parsed = bookingNoteSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Invalid request.", fieldErrors(parsed.error));
  }

  const booking = await prisma.booking.update({
    where: { id: parsed.data.bookingId },
    data: { internalNotes: parsed.data.internalNotes || null },
    select: { reference: true },
  });

  await recordAudit(admin, {
    action: "booking.notes",
    entity: "Booking",
    entityId: parsed.data.bookingId,
    summary: `Updated internal notes on ${booking.reference}`,
  });

  refresh(parsed.data.bookingId);
  return actionOk(undefined, "Notes saved.");
}

/** Record an offline payment (cash, transfer) against a booking. */
export async function markBookingPaid(bookingId: string): Promise<ActionResult> {
  const admin = await requireAdmin("payments:manage");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { reference: true, totalMinor: true, currency: true, paymentStatus: true },
  });
  if (!booking) return actionError("That booking no longer exists.");
  if (booking.paymentStatus === PaymentStatus.PAID) {
    return actionError("This booking is already marked as paid.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        reference: `${booking.reference}-MANUAL-${now.getTime()}`,
        bookingId,
        provider: "MANUAL",
        amountMinor: booking.totalMinor,
        currency: booking.currency,
        status: PaymentStatus.PAID,
        paidAt: now,
        channel: "manual",
      },
    });
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status: BookingStatus.CONFIRMED,
        confirmedAt: now,
        expiresAt: null,
      },
    });
  });

  await recordAudit(admin, {
    action: "booking.mark_paid",
    entity: "Booking",
    entityId: bookingId,
    summary: `Recorded a manual payment for ${booking.reference}`,
    metadata: { amountMinor: booking.totalMinor },
  });

  refresh(bookingId);
  revalidatePath("/admin/payments");
  return actionOk(undefined, "Payment recorded and booking confirmed.");
}
