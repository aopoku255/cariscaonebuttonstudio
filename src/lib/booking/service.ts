import "server-only";

import { prisma } from "@/lib/db";
import {
  BookingSource,
  BookingStatus,
  CustomerType,
  MembershipStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { validateRequestedSlot } from "@/lib/booking/availability";
import {
  type Quote,
  computeQuote,
  type PricingDiscountRule,
} from "@/lib/booking/pricing";
import { generateBookingReference } from "@/lib/booking/reference";
import { resolveStudentVerification } from "@/lib/booking/student-verification";
import { parseDateKey, slotMinutesFor, toUtcInstant } from "@/lib/booking/time";
import { getBookingPolicy, getStudentPolicy } from "@/lib/settings";

/** A rejected booking attempt the caller should surface to the user verbatim. */
export class BookingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_INPUT"
      | "PACKAGE_UNAVAILABLE"
      | "SLOT_UNAVAILABLE"
      | "SLOT_TAKEN"
      | "MEMBERSHIP_INVALID"
      | "STUDENT_ONLY",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type AdminPaymentMode = "PAYSTACK" | "PAY_LATER" | "PAID_MANUAL" | "COMPLIMENTARY";

export interface CustomerDetailsInput {
  name: string;
  email: string;
  phone: string;
  organisation?: string | null;
  userType: CustomerType;
  /** Collected when the studio's verification method accepts a student ID. */
  studentIdRef?: string | null;
}

export interface CreateBookingInput {
  packageId: string;
  dateKey: string;
  startMinute: number;
  addOns: { addOnId: string; quantity: number }[];
  customer: CustomerDetailsInput;
  purpose?: string | null;
  specialRequirements?: string | null;
  /** Redeem prepaid membership hours if the customer has an active membership. */
  useMembership?: boolean;

  // Admin-only overrides
  source?: BookingSource;
  createdByAdminId?: string;
  paymentMode?: AdminPaymentMode;
  durationOverrideMinutes?: number;
  allowOutsideHours?: boolean;
  internalNotes?: string | null;
}

export interface CreateBookingResult {
  bookingId: string;
  reference: string;
  quote: Quote;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  requiresPayment: boolean;
}

function toPricingRules(
  rows: {
    id: string;
    name: string;
    percentOff: number;
    eligibleUserTypes: string;
    requiresVerification: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    appliesToAllPackages: boolean;
    packages: { packageId: string }[];
  }[],
): PricingDiscountRule[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    percentOff: row.percentOff,
    eligibleUserTypes: row.eligibleUserTypes,
    requiresVerification: row.requiresVerification,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    appliesToAllPackages: row.appliesToAllPackages,
    packageIds: row.packages.map((entry) => entry.packageId),
  }));
}

/**
 * Price a prospective booking without writing anything. Used by the live booking
 * summary so the figure the customer sees is the same one the server will charge.
 */
export async function quoteBooking(params: {
  packageId: string;
  addOns: { addOnId: string; quantity: number }[];
  customerType: CustomerType;
  customerEmail?: string | null;
  useMembership?: boolean;
  durationOverrideMinutes?: number;
  now?: Date;
}): Promise<Quote> {
  const policy = await getBookingPolicy();

  const pkg = await prisma.package.findUnique({ where: { id: params.packageId } });
  if (!pkg || !pkg.isActive) {
    throw new BookingError("That package is not available.", "PACKAGE_UNAVAILABLE");
  }

  const addOnIds = params.addOns.map((selection) => selection.addOnId);
  const [addOnRows, discountRows] = await Promise.all([
    addOnIds.length
      ? prisma.addOn.findMany({ where: { id: { in: addOnIds }, isActive: true } })
      : Promise.resolve([]),
    prisma.discountRule.findMany({
      where: { isActive: true },
      include: { packages: { select: { packageId: true } } },
    }),
  ]);

  const customer = params.customerEmail
    ? await prisma.customer.findUnique({ where: { email: params.customerEmail.toLowerCase() } })
    : null;

  const membership =
    params.useMembership && customer ? await findRedeemableMembership(customer.id) : null;

  return computeQuote({
    pkg: {
      id: pkg.id,
      name: pkg.name,
      priceMinor: pkg.priceMinor,
      durationMinutes: pkg.durationMinutes,
    },
    durationMinutes: params.durationOverrideMinutes ?? pkg.durationMinutes,
    addOns: addOnRows.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      priceMinor: addOn.priceMinor,
      pricingUnit: addOn.pricingUnit,
      maxQuantity: addOn.maxQuantity,
    })),
    selections: params.addOns,
    customerType: params.customerType,
    customerIsVerified: customer?.isVerified ?? false,
    discountRules: toPricingRules(discountRows),
    membership,
    taxPercent: policy.taxPercent,
    taxLabel: policy.taxLabel,
    currency: policy.currency,
    now: params.now,
  });
}

/**
 * The customer's active membership, if any.
 *
 * Returned even when the prepaid hours are exhausted: a membership's "discount on
 * additional hours" is precisely the benefit that applies once the included hours are
 * used up, so dropping the membership at zero minutes would quietly remove it. The
 * pricing engine handles `remainingMinutes === 0` by covering nothing while still
 * applying the member rate.
 */
export async function findRedeemableMembership(customerId: string, now: Date = new Date()) {
  const membership = await prisma.membership.findFirst({
    where: {
      customerId,
      status: MembershipStatus.ACTIVE,
      expiryDate: { gte: now },
    },
    orderBy: { expiryDate: "asc" },
  });

  if (!membership) return null;

  return {
    id: membership.id,
    remainingMinutes: Math.max(0, membership.totalMinutes - membership.usedMinutes),
    extraHourDiscountPercent: membership.extraHourDiscountPercent,
  };
}

/**
 * Create a booking.
 *
 * Everything that determines money or availability is re-read from the database here.
 * The caller's payload only selects *which* package, add-ons, date and time: never
 * what they cost or whether the slot is free.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const now = new Date();
  const policy = await getBookingPolicy();

  const bookingDate = parseDateKey(input.dateKey);
  if (!bookingDate) {
    throw new BookingError("Please choose a valid date.", "INVALID_INPUT");
  }

  const isAdmin = input.source === BookingSource.ADMIN;

  const pkg = await prisma.package.findUnique({ where: { id: input.packageId } });
  if (!pkg || (!pkg.isActive && !isAdmin)) {
    throw new BookingError("That package is no longer available.", "PACKAGE_UNAVAILABLE");
  }

  const durationMinutes = Math.max(
    30,
    Math.round(
      isAdmin && input.durationOverrideMinutes
        ? input.durationOverrideMinutes
        : pkg.durationMinutes,
    ),
  );

  const slotCheck = await validateRequestedSlot({
    dateKey: input.dateKey,
    startMinute: input.startMinute,
    durationMinutes,
    policy,
    now,
    allowOutsideHours: isAdmin && input.allowOutsideHours,
  });
  if (!slotCheck.ok) {
    throw new BookingError(slotCheck.reason ?? "That time is unavailable.", "SLOT_UNAVAILABLE");
  }

  // --- Student Studio eligibility -------------------------------------------------
  // Checked before anything is written: a customer must actually be a KNUST student
  // to book a student-only package, and the public flow (never the admin one, which
  // is staff acting on their own judgement) must verify that claim before the
  // student rate is granted.
  if (pkg.studentOnly && !isAdmin && input.customer.userType !== CustomerType.KNUST_STUDENT) {
    throw new BookingError(
      "This package is only available to verified KNUST students. Choose \"KNUST Student\" as your category to see it.",
      "STUDENT_ONLY",
    );
  }

  // --- Customer -----------------------------------------------------------------
  const email = input.customer.email.trim().toLowerCase();
  const existingCustomer = await prisma.customer.findUnique({ where: { email } });

  let studentVerification: ReturnType<typeof resolveStudentVerification> | null = null;
  if (pkg.studentOnly && !isAdmin) {
    const studentPolicy = await getStudentPolicy();
    studentVerification = resolveStudentVerification({
      alreadyVerified: existingCustomer?.isVerified ?? false,
      email,
      studentIdRef: input.customer.studentIdRef,
      policy: studentPolicy,
    });

    if (!studentVerification.verified && !studentVerification.requiresManualReview) {
      throw new BookingError(
        studentVerification.reason ?? "We could not verify your KNUST student status.",
        "STUDENT_ONLY",
      );
    }
  }

  const customer = await prisma.customer.upsert({
    where: { email },
    create: {
      email,
      name: input.customer.name.trim(),
      phone: input.customer.phone.trim(),
      organisation: input.customer.organisation?.trim() || null,
      userType: input.customer.userType,
      ...(studentVerification?.verified
        ? {
            isVerified: true,
            studentVerificationMethod: "EMAIL",
            knustEmail: studentVerification.matchedKnustEmail,
          }
        : studentVerification?.requiresManualReview
          ? {
              studentVerificationMethod: "STUDENT_ID",
              studentIdRef: input.customer.studentIdRef?.trim() || null,
            }
          : {}),
    },
    // Refresh contact details with what they just told us, but never touch
    // credentials. Verification only ever moves from unverified to verified here,
    // never the reverse, and a manual ID submission never overwrites an existing
    // verified student.
    update: {
      name: input.customer.name.trim(),
      phone: input.customer.phone.trim(),
      organisation: input.customer.organisation?.trim() || null,
      userType: input.customer.userType,
      ...(studentVerification?.verified && !existingCustomer?.isVerified
        ? {
            isVerified: true,
            studentVerificationMethod: "EMAIL",
            knustEmail: studentVerification.matchedKnustEmail,
          }
        : studentVerification?.requiresManualReview && !existingCustomer?.isVerified
          ? {
              studentVerificationMethod: "STUDENT_ID",
              studentIdRef: input.customer.studentIdRef?.trim() || null,
            }
          : {}),
    },
  });

  // --- Pricing ------------------------------------------------------------------
  const addOnIds = input.addOns.map((selection) => selection.addOnId);
  const [addOnRows, discountRows] = await Promise.all([
    addOnIds.length
      ? prisma.addOn.findMany({ where: { id: { in: addOnIds }, isActive: true } })
      : Promise.resolve([]),
    prisma.discountRule.findMany({
      where: { isActive: true },
      include: { packages: { select: { packageId: true } } },
    }),
  ]);

  const membership = input.useMembership
    ? await findRedeemableMembership(customer.id, now)
    : null;

  const quote = computeQuote({
    pkg: {
      id: pkg.id,
      name: pkg.name,
      priceMinor: pkg.priceMinor,
      durationMinutes,
    },
    durationMinutes,
    addOns: addOnRows.map((addOn) => ({
      id: addOn.id,
      name: addOn.name,
      priceMinor: addOn.priceMinor,
      pricingUnit: addOn.pricingUnit,
      maxQuantity: addOn.maxQuantity,
    })),
    selections: input.addOns,
    customerType: input.customer.userType,
    customerIsVerified: customer.isVerified,
    discountRules: toPricingRules(discountRows),
    membership,
    taxPercent: policy.taxPercent,
    taxLabel: policy.taxLabel,
    currency: policy.currency,
    now,
  });

  // --- Status derivation --------------------------------------------------------
  const paymentMode: AdminPaymentMode = isAdmin ? (input.paymentMode ?? "PAY_LATER") : "PAYSTACK";
  const complimentary = isAdmin && paymentMode === "COMPLIMENTARY";
  const totalMinor = complimentary ? 0 : quote.totalMinor;

  let status: BookingStatus;
  let paymentStatus: PaymentStatus;
  let expiresAt: Date | null = null;

  if (isAdmin) {
    status = BookingStatus.CONFIRMED;
    paymentStatus =
      paymentMode === "PAID_MANUAL" || paymentMode === "COMPLIMENTARY"
        ? PaymentStatus.PAID
        : PaymentStatus.PENDING;
    if (paymentMode === "PAYSTACK") {
      status = BookingStatus.PENDING_PAYMENT;
      expiresAt = new Date(now.getTime() + policy.pendingExpiryMinutes * 60_000);
    }
  } else if (totalMinor <= 0) {
    // Fully covered by membership hours: nothing to charge. A student booking still
    // awaiting manual ID review holds at Pending approval regardless of the general
    // approval policy, since nothing has confirmed their student status yet.
    status =
      studentVerification?.requiresManualReview || policy.requireApproval
        ? BookingStatus.PENDING_APPROVAL
        : BookingStatus.CONFIRMED;
    paymentStatus = PaymentStatus.PAID;
  } else {
    status = BookingStatus.PENDING_PAYMENT;
    paymentStatus = PaymentStatus.PENDING;
    expiresAt = new Date(now.getTime() + policy.pendingExpiryMinutes * 60_000);
  }

  const endMinute = input.startMinute + durationMinutes;
  const slotMinutes = slotMinutesFor(input.startMinute, endMinute);
  const reference = await generateBookingReference(bookingDate);

  // --- Write --------------------------------------------------------------------
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          reference,
          customerId: customer.id,
          packageId: pkg.id,
          packageNameSnapshot: pkg.name,
          status,
          paymentStatus,
          source: input.source ?? BookingSource.PUBLIC,
          bookingDate,
          startMinute: input.startMinute,
          endMinute,
          startsAt: toUtcInstant(bookingDate, input.startMinute),
          endsAt: toUtcInstant(bookingDate, endMinute),
          durationMinutes,
          subtotalMinor: quote.subtotalMinor,
          discountMinor: complimentary ? quote.subtotalMinor : quote.discountMinor,
          taxMinor: complimentary ? 0 : quote.taxMinor,
          totalMinor,
          currency: quote.currency,
          discountLabel: complimentary ? "Complimentary booking" : quote.discountLabel,
          membershipId: quote.membershipId,
          membershipMinutesUsed: quote.membershipMinutesUsed,
          purpose: input.purpose?.trim() || null,
          specialRequirements: input.specialRequirements?.trim() || null,
          internalNotes: input.internalNotes?.trim() || null,
          createdByAdminId: input.createdByAdminId ?? null,
          expiresAt,
          confirmedAt: status === BookingStatus.CONFIRMED ? now : null,
          addOns: {
            create: quote.addOnLines.map((line) => ({
              addOnId: line.addOnId,
              nameSnapshot: line.name,
              pricingUnitSnapshot: line.pricingUnit,
              unitPriceMinor: line.unitPriceMinor,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotalMinor,
            })),
          },
        },
      });

      // The unique index on (bookingDate, slotMinute) is what actually prevents
      // double booking. If another request won the race, this throws P2002.
      await tx.bookingSlot.createMany({
        data: slotMinutes.map((slotMinute) => ({
          bookingDate,
          slotMinute,
          bookingId: created.id,
        })),
      });

      if (quote.membershipId && quote.membershipMinutesUsed > 0) {
        await tx.membership.update({
          where: { id: quote.membershipId },
          data: { usedMinutes: { increment: quote.membershipMinutesUsed } },
        });
        await tx.membershipUsage.create({
          data: {
            membershipId: quote.membershipId,
            bookingId: created.id,
            minutesUsed: quote.membershipMinutesUsed,
            note: `Booking ${created.reference}`,
          },
        });
      }

      if (isAdmin && (paymentMode === "PAID_MANUAL" || paymentMode === "COMPLIMENTARY")) {
        await tx.payment.create({
          data: {
            reference: `${created.reference}-ADM`,
            bookingId: created.id,
            provider:
              paymentMode === "COMPLIMENTARY"
                ? PaymentProvider.COMPLIMENTARY
                : PaymentProvider.MANUAL,
            amountMinor: totalMinor,
            currency: quote.currency,
            status: PaymentStatus.PAID,
            paidAt: now,
            channel: paymentMode === "COMPLIMENTARY" ? "complimentary" : "manual",
          },
        });
      }

      return created;
    });

    return {
      bookingId: booking.id,
      reference: booking.reference,
      quote: complimentary ? { ...quote, totalMinor: 0 } : quote,
      status,
      paymentStatus,
      requiresPayment: status === BookingStatus.PENDING_PAYMENT && totalMinor > 0,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new BookingError(
        "Someone just booked that slot. Please choose another time.",
        "SLOT_TAKEN",
      );
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "P2002") return true;
  // The MariaDB driver surfaces duplicate keys as ER_DUP_ENTRY (errno 1062).
  const errno = (error as { errno?: unknown }).errno;
  return errno === 1062;
}

/**
 * Release the slots a booking was holding and hand back any membership minutes it
 * consumed. Used by cancellation, refunds and the pending-payment sweeper so a failed
 * payment never blocks a slot permanently.
 */
export async function releaseBookingHold(bookingId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, membershipId: true, membershipMinutesUsed: true },
    });
    if (!booking) return;

    await tx.bookingSlot.deleteMany({ where: { bookingId } });

    if (booking.membershipId && booking.membershipMinutesUsed > 0) {
      await tx.membership.update({
        where: { id: booking.membershipId },
        data: { usedMinutes: { decrement: booking.membershipMinutesUsed } },
      });
      await tx.membershipUsage.create({
        data: {
          membershipId: booking.membershipId,
          bookingId: booking.id,
          minutesUsed: -booking.membershipMinutesUsed,
          note: "Hours returned after cancellation",
        },
      });
      await tx.booking.update({
        where: { id: bookingId },
        data: { membershipMinutesUsed: 0 },
      });
    }
  });
}

/**
 * Release bookings that were never paid for. Run from the cron endpoint; also called
 * opportunistically when availability is read so a stale hold never survives long.
 */
export async function expireStalePendingBookings(now: Date = new Date()): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      expiresAt: { not: null, lt: now },
    },
    select: { id: true },
    take: 200,
  });

  for (const booking of stale) {
    await releaseBookingHold(booking.id);
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: now,
        cancellationReason: "Payment was not completed in time.",
        expiresAt: null,
      },
    });
  }

  return stale.length;
}
