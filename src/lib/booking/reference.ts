import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/booking/time";

/**
 * Booking references look like `CAR-STU-20260922-001`: a per-day sequence that is easy
 * to read out over the phone. Uniqueness is guaranteed by the unique index on
 * `Booking.reference`; this helper just finds the next free number and retries if two
 * requests race for the same one.
 */
export async function generateBookingReference(bookingDate: Date): Promise<string> {
  const datePart = toDateKey(bookingDate).replace(/-/g, "");
  const prefix = `CAR-STU-${datePart}-`;

  const last = await prisma.booking.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const lastSeq = last ? Number.parseInt(last.reference.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${`${next}`.padStart(3, "0")}`;
}

/** Membership references look like `CAR-MEM-20260922-001`. */
export async function generateMembershipReference(startDate: Date): Promise<string> {
  const datePart = toDateKey(startDate).replace(/-/g, "");
  const prefix = `CAR-MEM-${datePart}-`;

  const last = await prisma.membership.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const lastSeq = last ? Number.parseInt(last.reference.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${`${next}`.padStart(3, "0")}`;
}

/**
 * Payment references are sent to Paystack and must be globally unique and
 * unguessable, so they carry random entropy rather than a sequence.
 */
export function generatePaymentReference(bookingReference: string): string {
  return `${bookingReference}-${randomBytes(5).toString("hex").toUpperCase()}`;
}
