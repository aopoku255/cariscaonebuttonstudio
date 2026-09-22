import "server-only";

import {
  BookingStatus,
  MembershipStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { appUrl, serverEnv } from "@/lib/env";
import { generatePaymentReference } from "@/lib/booking/reference";
import { releaseBookingHold } from "@/lib/booking/service";
import { notifyPaymentSuccessful } from "@/lib/email/notifications";
import { initializeTransaction, verifyTransaction } from "@/lib/payments/paystack";
import { getBookingPolicy } from "@/lib/settings";

/**
 * Payment orchestration.
 *
 * The rules that matter:
 *   * The charged amount is always read from the booking row, never from the client.
 *   * A booking becomes paid only after Paystack's verify endpoint says so AND the
 *     amount and currency it reports match what we recorded.
 *   * Settlement is idempotent, because the callback redirect and the webhook both
 *     race to confirm the same transaction.
 */

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "BOOKING_NOT_FOUND"
      | "NOTHING_TO_PAY"
      | "ALREADY_PAID"
      | "BOOKING_NOT_PAYABLE"
      | "AMOUNT_MISMATCH"
      | "NOT_SUCCESSFUL"
      | "REFERENCE_NOT_FOUND",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface StartPaymentResult {
  authorizationUrl: string;
  reference: string;
}

/** Create (or reuse) a pending Paystack transaction for a booking. */
export async function startBookingPayment(bookingId: string): Promise<StartPaymentResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });

  if (!booking) {
    throw new PaymentError("We could not find that booking.", "BOOKING_NOT_FOUND");
  }
  if (booking.paymentStatus === PaymentStatus.PAID) {
    throw new PaymentError("This booking has already been paid for.", "ALREADY_PAID");
  }
  if (booking.totalMinor <= 0) {
    throw new PaymentError("There is nothing to pay for this booking.", "NOTHING_TO_PAY");
  }
  if (
    booking.status === BookingStatus.CANCELLED ||
    booking.status === BookingStatus.REFUNDED ||
    booking.status === BookingStatus.NO_SHOW
  ) {
    throw new PaymentError("This booking can no longer be paid for.", "BOOKING_NOT_PAYABLE");
  }

  // Amount comes from the stored booking total: the client has no say in it.
  const amountMinor = booking.totalMinor;
  const reference = generatePaymentReference(booking.reference);

  const payment = await prisma.payment.create({
    data: {
      reference,
      bookingId: booking.id,
      provider: PaymentProvider.PAYSTACK,
      amountMinor,
      currency: booking.currency,
      status: PaymentStatus.PENDING,
    },
  });

  const callbackUrl =
    serverEnv.paystackCallbackUrl || `${appUrl()}/booking/callback`;

  try {
    const result = await initializeTransaction({
      email: booking.customer.email,
      amountMinor,
      reference,
      callbackUrl,
      currency: booking.currency,
      metadata: {
        bookingReference: booking.reference,
        bookingId: booking.id,
        customerName: booking.customer.name,
        custom_fields: [
          {
            display_name: "Booking reference",
            variable_name: "booking_reference",
            value: booking.reference,
          },
        ],
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        authorizationUrl: result.authorization_url,
        accessCode: result.access_code,
      },
    });

    return { authorizationUrl: result.authorization_url, reference };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Initialisation failed",
      },
    });
    throw error;
  }
}

export interface SettleResult {
  status: "PAID" | "FAILED" | "PENDING";
  bookingId: string | null;
  bookingReference: string | null;
  message: string;
}

/**
 * Verify a transaction with Paystack and apply the outcome.
 *
 * Safe to call repeatedly and concurrently: the callback page and the webhook both
 * do, and only the first one to see a successful verification performs the writes.
 */
export async function settlePaymentByReference(reference: string): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { booking: true },
  });

  if (!payment) {
    throw new PaymentError("We could not find that payment reference.", "REFERENCE_NOT_FOUND");
  }

  // Already settled: report the existing outcome rather than re-verifying.
  if (payment.status === PaymentStatus.PAID) {
    return {
      status: "PAID",
      bookingId: payment.bookingId,
      bookingReference: payment.booking?.reference ?? null,
      message: "This payment has already been confirmed.",
    };
  }

  const verification = await verifyTransaction(reference);

  if (verification.status !== "success") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:
          verification.status === "abandoned" ? PaymentStatus.PENDING : PaymentStatus.FAILED,
        failureReason: verification.gateway_response ?? `Paystack reported "${verification.status}".`,
        providerReference: verification.reference ?? undefined,
        rawResponse: verification as unknown as object,
      },
    });

    return {
      status: verification.status === "abandoned" ? "PENDING" : "FAILED",
      bookingId: payment.bookingId,
      bookingReference: payment.booking?.reference ?? null,
      message:
        verification.gateway_response ??
        "The payment was not completed. Your slot is still held for a short while: you can try again.",
    };
  }

  // --- The two checks that stop a customer paying less than they owe ------------
  if (verification.amount !== payment.amountMinor) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: `Amount mismatch: Paystack reported ${verification.amount}, expected ${payment.amountMinor}.`,
        providerReference: verification.reference ?? undefined,
        rawResponse: verification as unknown as object,
      },
    });
    throw new PaymentError(
      "The amount paid does not match this booking. Please contact the studio.",
      "AMOUNT_MISMATCH",
    );
  }

  if (verification.currency !== payment.currency) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: `Currency mismatch: got ${verification.currency}, expected ${payment.currency}.`,
        rawResponse: verification as unknown as object,
      },
    });
    throw new PaymentError(
      "The payment currency does not match this booking. Please contact the studio.",
      "AMOUNT_MISMATCH",
    );
  }

  const policy = await getBookingPolicy();
  const now = new Date();

  // Only the writer that flips the payment row from PENDING to PAID does the rest.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: PaymentStatus.PENDING },
    data: {
      status: PaymentStatus.PAID,
      providerReference: verification.reference ?? null,
      channel: verification.channel ?? null,
      paidAt: verification.paid_at ? new Date(verification.paid_at) : now,
      rawResponse: verification as unknown as object,
      failureReason: null,
    },
  });

  if (claimed.count === 0) {
    const current = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { booking: true },
    });
    return {
      status: current?.status === PaymentStatus.PAID ? "PAID" : "PENDING",
      bookingId: current?.bookingId ?? null,
      bookingReference: current?.booking?.reference ?? null,
      message: "This payment has already been confirmed.",
    };
  }

  if (payment.bookingId) {
    // A student booking whose ID has not been manually checked yet holds at Pending
    // approval even after payment succeeds: payment confirms they paid, not that
    // they are a KNUST student, and the price they paid already assumed they are.
    const studentReviewPending = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
      select: { package: { select: { studentOnly: true } }, customer: { select: { isVerified: true } } },
    });
    const needsStudentReview =
      Boolean(studentReviewPending?.package?.studentOnly) &&
      !studentReviewPending?.customer.isVerified;

    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status:
          needsStudentReview || policy.requireApproval
            ? BookingStatus.PENDING_APPROVAL
            : BookingStatus.CONFIRMED,
        confirmedAt: now,
        expiresAt: null,
      },
    });

    await notifyPaymentSuccessful(payment.bookingId);
  }

  if (payment.membershipId) {
    await activateMembershipAfterPayment(payment.membershipId);
  }

  return {
    status: "PAID",
    bookingId: payment.bookingId,
    bookingReference: payment.booking?.reference ?? null,
    message: "Payment confirmed.",
  };
}

async function activateMembershipAfterPayment(membershipId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership || membership.status !== MembershipStatus.PENDING_PAYMENT) return;

  await prisma.membership.update({
    where: { id: membershipId },
    data: { status: MembershipStatus.ACTIVE },
  });
}

/** Start a Paystack transaction for a prepaid membership purchase. */
export async function startMembershipPayment(
  membershipId: string,
): Promise<StartPaymentResult> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { customer: true },
  });

  if (!membership) {
    throw new PaymentError("We could not find that membership.", "BOOKING_NOT_FOUND");
  }
  if (membership.status === MembershipStatus.ACTIVE) {
    throw new PaymentError("This membership is already active.", "ALREADY_PAID");
  }
  if (membership.pricePaidMinor <= 0) {
    throw new PaymentError("There is nothing to pay for this membership.", "NOTHING_TO_PAY");
  }

  const reference = generatePaymentReference(membership.reference);

  const payment = await prisma.payment.create({
    data: {
      reference,
      membershipId: membership.id,
      provider: PaymentProvider.PAYSTACK,
      amountMinor: membership.pricePaidMinor,
      currency: "GHS",
      status: PaymentStatus.PENDING,
    },
  });

  try {
    const result = await initializeTransaction({
      email: membership.customer.email,
      amountMinor: membership.pricePaidMinor,
      reference,
      callbackUrl: serverEnv.paystackCallbackUrl || `${appUrl()}/booking/callback`,
      metadata: {
        membershipReference: membership.reference,
        membershipId: membership.id,
        customerName: membership.customer.name,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        authorizationUrl: result.authorization_url,
        accessCode: result.access_code,
      },
    });

    return { authorizationUrl: result.authorization_url, reference };
  } catch (error) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: error instanceof Error ? error.message : "Initialisation failed",
      },
    });
    throw error;
  }
}

/**
 * Mark a booking refunded. Recording a refund here also frees the slot, so a refunded
 * session becomes bookable again immediately.
 */
export async function recordRefund(params: {
  bookingId: string;
  reason: string | null;
}): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: { payments: true },
  });
  if (!booking) return;

  await releaseBookingHold(params.bookingId);

  await prisma.$transaction(async (tx) => {
    await tx.payment.updateMany({
      where: { bookingId: params.bookingId, status: PaymentStatus.PAID },
      data: { status: PaymentStatus.REFUNDED },
    });
    await tx.booking.update({
      where: { id: params.bookingId },
      data: {
        status: BookingStatus.REFUNDED,
        paymentStatus: PaymentStatus.REFUNDED,
        cancelledAt: new Date(),
        cancellationReason: params.reason,
      },
    });
  });
}

/**
 * How much of a booking is refundable right now under the configured policy.
 * Returned in minor units alongside the reasoning, so admins see why.
 */
export async function calculateRefundDue(bookingId: string, now: Date = new Date()) {
  const [booking, policy] = await Promise.all([
    prisma.booking.findUnique({ where: { id: bookingId } }),
    getBookingPolicy(),
  ]);

  if (!booking) return null;
  if (booking.paymentStatus !== PaymentStatus.PAID) {
    return { refundableMinor: 0, percent: 0, note: "No payment has been received." };
  }

  const hoursUntil = (booking.startsAt.getTime() - now.getTime()) / 3_600_000;

  if (hoursUntil >= policy.freeCancellationHours) {
    return {
      refundableMinor: booking.totalMinor,
      percent: 100,
      note: `Cancelled more than ${policy.freeCancellationHours} hours before the session: full refund.`,
    };
  }

  const percent = policy.lateRefundPercent;
  return {
    refundableMinor: Math.round((booking.totalMinor * percent) / 100),
    percent,
    note:
      percent > 0
        ? `Cancelled inside ${policy.freeCancellationHours} hours: ${percent}% refund under the current policy.`
        : `Cancelled inside ${policy.freeCancellationHours} hours: no refund under the current policy.`,
  };
}
