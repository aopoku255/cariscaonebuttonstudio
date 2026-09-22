"use server";

import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import { clientIp } from "@/lib/audit";
import { bookingPath, verifyBookingAccessToken } from "@/lib/booking/access";
import { releaseBookingHold } from "@/lib/booking/service";
import { prisma } from "@/lib/db";
import { notifyBookingCancelled } from "@/lib/email/notifications";
import { calculateRefundDue } from "@/lib/payments/service";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation/common";

/**
 * Customer-facing booking actions.
 *
 * Each one re-checks the signed access token server-side; holding a booking reference
 * is never enough on its own to change someone else's booking.
 */

export async function cancelBookingByCustomer(input: {
  reference: string;
  token: string;
  reason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const limit = rateLimit(`cancel:${await clientIp()}`, RATE_LIMITS.createBooking);
  if (!limit.ok) {
    return { ok: false, message: "Too many attempts. Please wait a moment." };
  }

  if (!verifyBookingAccessToken(input.reference, input.token)) {
    return { ok: false, message: "This link is not valid. Please use the link we emailed you." };
  }

  const booking = await prisma.booking.findUnique({
    where: { reference: input.reference },
    select: { id: true, status: true, paymentStatus: true, startsAt: true },
  });

  if (!booking) {
    return { ok: false, message: "We could not find that booking." };
  }

  const cancellable: BookingStatus[] = [
    BookingStatus.PENDING_PAYMENT,
    BookingStatus.PENDING_APPROVAL,
    BookingStatus.CONFIRMED,
  ];
  if (!cancellable.includes(booking.status)) {
    return { ok: false, message: "This booking can no longer be cancelled online." };
  }

  if (booking.startsAt.getTime() <= Date.now()) {
    return {
      ok: false,
      message: "This session has already started. Please call the studio instead.",
    };
  }

  const refund = await calculateRefundDue(booking.id);

  // Free the slot first so it becomes bookable again immediately.
  await releaseBookingHold(booking.id);

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date(),
      cancellationReason: input.reason?.trim() || "Cancelled by the customer.",
      expiresAt: null,
    },
  });

  await notifyBookingCancelled(booking.id, input.reason?.trim() || null);

  const refundNote =
    booking.paymentStatus === PaymentStatus.PAID && refund
      ? ` ${refund.note}`
      : "";

  return {
    ok: true,
    message: `Your booking has been cancelled.${refundNote}`,
  };
}

/**
 * Look up a booking by reference and email, and return the secure link if they match.
 *
 * Deliberately returns the same message whether or not a booking exists, so this
 * cannot be used to discover which references or email addresses are real.
 */
export async function lookupBooking(input: {
  reference: string;
  email: string;
}): Promise<{ ok: boolean; message: string; url?: string }> {
  const limit = rateLimit(`lookup:${await clientIp()}`, RATE_LIMITS.customerLogin);
  if (!limit.ok) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  }

  const parsedEmail = emailSchema.safeParse(input.email);
  const reference = input.reference.trim().toUpperCase();

  if (!parsedEmail.success || reference.length < 4) {
    return { ok: false, message: "Enter both your booking reference and email address." };
  }

  const booking = await prisma.booking.findFirst({
    where: {
      reference,
      customer: { email: parsedEmail.data },
    },
    select: { reference: true },
  });

  if (!booking) {
    return {
      ok: false,
      message:
        "We could not match that reference and email address. Check both and try again, or contact the studio.",
    };
  }

  return { ok: true, message: "Booking found.", url: bookingPath(booking.reference) };
}
