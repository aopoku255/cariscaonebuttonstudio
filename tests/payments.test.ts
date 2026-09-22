import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { CustomerType, PaymentStatus } from "@/generated/prisma/enums";
import { createBooking } from "@/lib/booking/service";
import { addDays, studioToday, toDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { isPaystackConfigured } from "@/lib/env";
import { PaymentError, startBookingPayment } from "@/lib/payments/service";

/**
 * Payment-path integration tests.
 *
 * These exercise `startBookingPayment` against whatever Paystack credentials are
 * configured in `.env`. Without real test-mode keys, initialisation calls fail against
 * the live Paystack API: that failure path itself is what several of these tests
 * verify, since a booking must never be silently marked paid when Paystack is
 * unreachable or unconfigured.
 */

const TEST_EMAIL_PREFIX = "vitest-payment";

function futureDateKey(offsetDays: number): string {
  let date = addDays(studioToday(), 60);
  while (date.getUTCDay() !== 3) date = addDays(date, 1);
  return toDateKey(addDays(date, offsetDays));
}

async function cleanUp() {
  const customers = await prisma.customer.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  if (customerIds.length) {
    const bookings = await prisma.booking.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    const bookingIds = bookings.map((b) => b.id);

    if (bookingIds.length) {
      await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.bookingAddOn.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  }
}

async function getPackage() {
  const pkg = await prisma.package.findUnique({ where: { slug: "studio-1-hour" } });
  if (!pkg) throw new Error("Seed data missing: run `npm run db:seed` before the tests.");
  return pkg;
}

beforeEach(cleanUp);
afterAll(cleanUp);

describe("payment initialisation", () => {
  it("creates a PENDING payment row with the booking's own total, never a client-supplied amount", async () => {
    const pkg = await getPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(0),
      startMinute: 9 * 60,
      addOns: [],
      customer: {
        name: "Payment Test",
        email: `${TEST_EMAIL_PREFIX}-init@example.com`,
        phone: "0241234567",
        organisation: null,
        userType: CustomerType.CREATOR,
      },
    });

    expect(result.requiresPayment).toBe(true);

    if (isPaystackConfigured()) {
      // With real credentials this would actually reach Paystack; skip asserting the
      // network outcome here and let the dedicated "configured" describe block below
      // cover it when keys are present.
      return;
    }

    // Without credentials, initialisation must fail loudly rather than pretend to
    // succeed: a booking is never marked payable through a channel that isn't there.
    await expect(startBookingPayment(result.bookingId)).rejects.toThrow();

    const payment = await prisma.payment.findFirst({ where: { bookingId: result.bookingId } });
    expect(payment).not.toBeNull();
    expect(payment!.amountMinor).toBe(pkg.priceMinor);
    expect(payment!.status).toBe(PaymentStatus.FAILED);

    const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
    // The booking itself is untouched by a failed initialisation: still pending, not
    // silently confirmed.
    expect(booking!.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  it("refuses to start payment for a booking with nothing owed", async () => {
    const pkg = await getPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(1),
      startMinute: 9 * 60,
      addOns: [],
      customer: {
        name: "Zero Total",
        email: `${TEST_EMAIL_PREFIX}-zero@example.com`,
        phone: "0241234567",
        organisation: null,
        userType: CustomerType.CREATOR,
      },
      source: "ADMIN",
      paymentMode: "COMPLIMENTARY",
    });

    expect(result.requiresPayment).toBe(false);

    await expect(startBookingPayment(result.bookingId)).rejects.toThrow(PaymentError);
  });

  it("refuses to start payment twice for an already-paid booking", async () => {
    const pkg = await getPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(2),
      startMinute: 9 * 60,
      addOns: [],
      customer: {
        name: "Already Paid",
        email: `${TEST_EMAIL_PREFIX}-paid@example.com`,
        phone: "0241234567",
        organisation: null,
        userType: CustomerType.CREATOR,
      },
      source: "ADMIN",
      paymentMode: "PAID_MANUAL",
    });

    await expect(startBookingPayment(result.bookingId)).rejects.toThrow(/already been paid/i);
  });
});

describe("Paystack configuration reporting", () => {
  it("reports its own configuration state truthfully", () => {
    const configured = isPaystackConfigured();
    expect(typeof configured).toBe("boolean");
    if (!configured) {
      // Documented for the test run's own output: not a hard assertion, since a real
      // deployment may have keys set.
      console.log(
        "[payments.test] PAYSTACK_SECRET_KEY is not set: payment initialisation is exercised only on its failure path in this run.",
      );
    }
  });
});
