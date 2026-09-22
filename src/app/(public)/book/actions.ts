"use server";

import { clientIp } from "@/lib/audit";
import { bookingPath } from "@/lib/booking/access";
import { BookingError, createBooking } from "@/lib/booking/service";
import { notifyBookingCreated } from "@/lib/email/notifications";
import { isPaystackConfigured } from "@/lib/env";
import { PaymentError, startBookingPayment } from "@/lib/payments/service";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { createBookingSchema } from "@/lib/validation/booking";
import { fieldErrors } from "@/lib/validation/common";

/**
 * Submit a booking.
 *
 * Server Actions are POST-only and Next.js verifies the request Origin against the
 * configured host before running them, which is what protects this from cross-site
 * submission. Beyond that, everything that decides money or availability is re-read
 * from the database inside `createBooking`: nothing here trusts the payload.
 */

export interface SubmitBookingResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Where to send the customer next: Paystack checkout, or the confirmation page. */
  redirectUrl?: string;
  reference?: string;
  /** Tokenised link to the booking, so the customer can open it without the email. */
  bookingUrl?: string;
  /** True when the booking is confirmed with nothing to pay (membership hours). */
  alreadyConfirmed?: boolean;
}

export async function submitBooking(payload: unknown): Promise<SubmitBookingResult> {
  const ip = await clientIp();
  const limit = rateLimit(`create-booking:${ip}`, RATE_LIMITS.createBooking);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Too many booking attempts. Please try again in about ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const parsed = createBookingSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields and try again.",
      errors: fieldErrors(parsed.error),
    };
  }

  let created;
  try {
    created = await createBooking({
      packageId: parsed.data.packageId,
      dateKey: parsed.data.dateKey,
      startMinute: parsed.data.startMinute,
      addOns: parsed.data.addOns,
      customer: {
        name: parsed.data.customer.name,
        email: parsed.data.customer.email,
        phone: parsed.data.customer.phone,
        organisation: parsed.data.customer.organisation ?? null,
        userType: parsed.data.customer.userType,
        studentIdRef: parsed.data.customer.studentIdRef ?? null,
      },
      purpose: parsed.data.purpose ?? null,
      specialRequirements: parsed.data.specialRequirements ?? null,
      useMembership: parsed.data.useMembership,
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return { ok: false, message: error.message };
    }
    console.error("[submitBooking] failed:", error);
    return {
      ok: false,
      message: "Something went wrong creating your booking. Please try again.",
    };
  }

  // Acknowledge the booking straight away; a mail failure must not lose the booking.
  await notifyBookingCreated(created.bookingId);

  const url = bookingPath(created.reference);

  if (!created.requiresPayment) {
    return {
      ok: true,
      reference: created.reference,
      bookingUrl: `${url}&new=1`,
      alreadyConfirmed: true,
    };
  }

  if (!isPaystackConfigured()) {
    // The slot is held and the studio has the booking: the customer just cannot pay
    // online yet. Say so plainly rather than pretending the booking failed.
    return {
      ok: true,
      reference: created.reference,
      bookingUrl: `${url}&held=1`,
      message:
        "Your booking is held, but online payment is not configured yet. The studio will contact you to arrange payment.",
    };
  }

  try {
    const payment = await startBookingPayment(created.bookingId);
    return {
      ok: true,
      reference: created.reference,
      bookingUrl: url,
      redirectUrl: payment.authorizationUrl,
    };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    console.error("[submitBooking] payment initialisation failed:", error);
    return {
      ok: true,
      reference: created.reference,
      bookingUrl: `${url}&held=1`,
      message:
        "Your booking is held, but we could not open the payment page. Open your booking to try paying again.",
    };
  }
}

/** Retry payment for a booking that is still awaiting it. */
export async function retryPayment(
  reference: string,
): Promise<{ ok: boolean; redirectUrl?: string; message?: string }> {
  const limit = rateLimit(`retry-payment:${await clientIp()}`, RATE_LIMITS.createBooking);
  if (!limit.ok) {
    return { ok: false, message: "Too many attempts. Please wait a moment and try again." };
  }

  if (!isPaystackConfigured()) {
    return { ok: false, message: "Online payment is not configured. Please contact the studio." };
  }

  const { prisma } = await import("@/lib/db");
  const booking = await prisma.booking.findUnique({
    where: { reference },
    select: { id: true },
  });

  if (!booking) {
    return { ok: false, message: "We could not find that booking." };
  }

  try {
    const payment = await startBookingPayment(booking.id);
    return { ok: true, redirectUrl: payment.authorizationUrl };
  } catch (error) {
    if (error instanceof PaymentError) {
      return { ok: false, message: error.message };
    }
    console.error("[retryPayment] failed:", error);
    return { ok: false, message: "We could not start the payment. Please try again." };
  }
}
