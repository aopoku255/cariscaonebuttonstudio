import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { BookingSource, BookingStatus, CustomerType, PaymentStatus } from "@/generated/prisma/enums";
import { getDayAvailability, validateRequestedSlot } from "@/lib/booking/availability";
import {
  BookingError,
  createBooking,
  expireStalePendingBookings,
  releaseBookingHold,
} from "@/lib/booking/service";
import { addDays, parseDateKey, slotMinutesFor, studioToday, toDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { getBookingPolicy, updateSettings } from "@/lib/settings";

/**
 * Integration tests for the booking engine, run against a real MySQL-compatible
 * database. These cover the rules that would cost the studio real money or real
 * embarrassment if they broke: double booking, price manipulation and expiry.
 *
 * Fixtures use a far-future date and a recognisable email prefix so they never collide
 * with seed data or with a real booking.
 */

const TEST_EMAIL_PREFIX = "vitest-booking";

/**
 * Test dates sit ~60 days out: far enough that the calendar is empty, but inside the
 * `booking.maxAdvanceDays` window so the policy does not reject them. The base is
 * snapped forward to a Wednesday, which makes `futureDateKey(4)` reliably a Sunday for
 * the closed-day test.
 */
const BASE_DATE = (() => {
  let date = addDays(studioToday(), 60);
  while (date.getUTCDay() !== 3) date = addDays(date, 1);
  return date;
})();

function futureDateKey(offsetDays = 0): string {
  return toDateKey(addDays(BASE_DATE, offsetDays));
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
      await prisma.membershipUsage.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.notification.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.bookingAddOn.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await prisma.membership.deleteMany({ where: { customerId: { in: customerIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  // Remove any stray slot rows left on the test dates.
  for (let offset = 0; offset < 6; offset += 1) {
    await prisma.bookingSlot.deleteMany({
      where: { bookingDate: parseDateKey(futureDateKey(offset))! },
    });
    await prisma.blockedDate.deleteMany({
      where: { date: parseDateKey(futureDateKey(offset))! },
    });
    await prisma.blockedTime.deleteMany({
      where: { date: parseDateKey(futureDateKey(offset))! },
    });
  }
}

async function getThreeHourPackage() {
  const pkg = await prisma.package.findUnique({ where: { slug: "studio-3-hours" } });
  if (!pkg) throw new Error("Seed data missing: run `npm run db:seed` before the tests.");
  return pkg;
}

async function getStudentHourPackage() {
  const pkg = await prisma.package.findUnique({ where: { slug: "student-hour" } });
  if (!pkg) throw new Error("Seed data missing: run `npm run db:seed` before the tests.");
  return pkg;
}

function customerInput(
  suffix: string,
  overrides: { userType?: CustomerType; email?: string; studentIdRef?: string | null } = {},
) {
  return {
    name: "Vitest Customer",
    email: overrides.email ?? `${TEST_EMAIL_PREFIX}-${suffix}@example.com`,
    phone: "0241234567",
    organisation: null,
    userType: overrides.userType ?? CustomerType.CREATOR,
    studentIdRef: overrides.studentIdRef,
  };
}

beforeEach(cleanUp);
afterAll(cleanUp);

describe("createBooking", () => {
  it("creates a booking and holds every half-hour slot it occupies", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("basic"),
    });

    expect(result.reference).toMatch(/^CAR-STU-\d{8}-\d{3}$/);
    expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
    expect(result.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(result.requiresPayment).toBe(true);

    const booking = await prisma.booking.findUnique({
      where: { id: result.bookingId },
      include: { slots: true },
    });

    expect(booking).not.toBeNull();
    expect(booking!.durationMinutes).toBe(180);
    expect(booking!.startMinute).toBe(600);
    expect(booking!.endMinute).toBe(780);
    // 180 minutes on a 30-minute grid = 6 slot rows.
    expect(booking!.slots).toHaveLength(6);
    expect(booking!.slots.map((s) => s.slotMinute).sort((a, b) => a - b)).toEqual(
      slotMinutesFor(600, 780),
    );
  });

  it("prices the booking from the database, ignoring anything the client might claim", async () => {
    const pkg = await getThreeHourPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(),
      startMinute: 9 * 60,
      addOns: [],
      customer: customerInput("pricing"),
      // These are not part of CreateBookingInput at all: the type system alone stops a
      // client-supplied price reaching the engine, and the stored total proves it.
    });

    const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
    expect(booking!.totalMinor).toBe(pkg.priceMinor);
    expect(booking!.subtotalMinor).toBe(pkg.priceMinor);
  });

  it("sets an expiry on bookings that still need paying", async () => {
    const pkg = await getThreeHourPackage();
    const policy = await getBookingPolicy();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(),
      startMinute: 9 * 60,
      addOns: [],
      customer: customerInput("expiry"),
    });

    const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
    expect(booking!.expiresAt).not.toBeNull();

    const minutesAhead = (booking!.expiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutesAhead).toBeGreaterThan(policy.pendingExpiryMinutes - 2);
    expect(minutesAhead).toBeLessThanOrEqual(policy.pendingExpiryMinutes + 1);
  });
});

describe("double booking prevention", () => {
  it("rejects a second booking that starts at the same time", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("first"),
    });

    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("second"),
      }),
    ).rejects.toThrow(BookingError);
  });

  it("rejects a booking that overlaps an existing one only partially", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    // 10:00–13:00
    await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("overlap-a"),
    });

    // 12:00–15:00 overlaps the last hour of the first booking.
    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 12 * 60,
        addOns: [],
        customer: customerInput("overlap-b"),
      }),
    ).rejects.toThrow(/just booked that slot/i);
  });

  it("allows a booking that starts exactly when another ends", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 9 * 60, // 09:00–12:00
      addOns: [],
      customer: customerInput("back-to-back-a"),
    });

    const second = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 12 * 60, // 12:00–15:00
      addOns: [],
      customer: customerInput("back-to-back-b"),
    });

    expect(second.bookingId).toBeTruthy();
  });

  it("holds the slot against concurrent requests for the same time", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    // Fire both at once: the unique index on (bookingDate, slotMinute) is what decides.
    const results = await Promise.allSettled([
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 14 * 60,
        addOns: [],
        customer: customerInput("race-a"),
      }),
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 14 * 60,
        addOns: [],
        customer: customerInput("race-b"),
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const slots = await prisma.bookingSlot.count({
      where: { bookingDate: parseDateKey(dateKey)!, slotMinute: 14 * 60 },
    });
    expect(slots).toBe(1);
  });

  it("frees the slot again once the booking is released", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    const first = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("release-a"),
    });

    await releaseBookingHold(first.bookingId);

    const second = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("release-b"),
    });

    expect(second.bookingId).toBeTruthy();
  });
});

describe("availability", () => {
  it("marks booked slots unavailable and leaves the rest open", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    const before = await getDayAvailability(dateKey, 180);
    const openBefore = before.slots.filter((s) => s.available).length;
    expect(openBefore).toBeGreaterThan(0);

    await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("avail"),
    });

    const after = await getDayAvailability(dateKey, 180);
    const tenAm = after.slots.find((s) => s.startMinute === 10 * 60);
    expect(tenAm?.available).toBe(false);
    expect(tenAm?.reason).toBe("Already booked");
    expect(after.slots.filter((s) => s.available).length).toBeLessThan(openBefore);
  });

  it("reports a blocked date as unavailable with the admin's reason", async () => {
    const dateKey = futureDateKey(1);
    await prisma.blockedDate.create({
      data: {
        date: parseDateKey(dateKey)!,
        reason: "CARISCA Internal Event",
        type: "INTERNAL_EVENT",
      },
    });

    const day = await getDayAvailability(dateKey, 60);
    expect(day.status).toBe("BLOCKED");
    expect(day.message).toBe("CARISCA Internal Event");
    expect(day.slots).toHaveLength(0);
  });

  it("refuses to book a blocked date", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey(1);
    await prisma.blockedDate.create({
      data: { date: parseDateKey(dateKey)!, reason: "Maintenance", type: "MAINTENANCE" },
    });

    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("blocked"),
      }),
    ).rejects.toThrow(/unavailable on this date/i);
  });

  it("refuses to book over a blocked time range", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey(2);

    await prisma.blockedTime.create({
      data: {
        date: parseDateKey(dateKey)!,
        startMinute: 14 * 60,
        endMinute: 16 * 60,
        reason: "CARISCA Internal Event",
        type: "INTERNAL_EVENT",
      },
    });

    // 13:00–16:00 runs into the block.
    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey,
        startMinute: 13 * 60,
        addOns: [],
        customer: customerInput("blocked-time"),
      }),
    ).rejects.toThrow(/blocked/i);

    // 09:00–12:00 is clear of it.
    const ok = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 9 * 60,
      addOns: [],
      customer: customerInput("blocked-time-ok"),
    });
    expect(ok.bookingId).toBeTruthy();
  });

  it("refuses a Sunday, when the studio is closed", async () => {
    const pkg = await getThreeHourPackage();
    // The base date is a Wednesday, so +4 days is a Sunday.
    const sunday = futureDateKey(4);
    expect(parseDateKey(sunday)!.getUTCDay()).toBe(0);

    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey: sunday,
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("sunday"),
      }),
    ).rejects.toThrow(/closed/i);
  });

  it("refuses a slot that runs past closing time", async () => {
    const pkg = await getThreeHourPackage();
    const policy = await getBookingPolicy();

    // 17:00 + 3 hours = 20:00, past the 18:00 close.
    const check = await validateRequestedSlot({
      dateKey: futureDateKey(),
      startMinute: 17 * 60,
      durationMinutes: 180,
      policy,
    });

    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/opening hours/i);
    expect(pkg.durationMinutes).toBe(180);
  });

  it("refuses a start time that is not on the half-hour grid", async () => {
    const policy = await getBookingPolicy();
    const check = await validateRequestedSlot({
      dateKey: futureDateKey(),
      startMinute: 10 * 60 + 17,
      durationMinutes: 60,
      policy,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/half-hour/i);
  });

  it("refuses dates in the past", async () => {
    const policy = await getBookingPolicy();
    const check = await validateRequestedSlot({
      dateKey: "2020-01-15",
      startMinute: 10 * 60,
      durationMinutes: 60,
      policy,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/passed/i);
  });
});

describe("expiry sweeper", () => {
  it("cancels unpaid bookings past their expiry and frees the slot", async () => {
    const pkg = await getThreeHourPackage();
    const dateKey = futureDateKey();

    const created = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("sweep"),
    });

    // Pretend the hold timed out.
    await prisma.booking.update({
      where: { id: created.bookingId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const swept = await expireStalePendingBookings();
    expect(swept).toBeGreaterThanOrEqual(1);

    const booking = await prisma.booking.findUnique({
      where: { id: created.bookingId },
      include: { slots: true },
    });
    expect(booking!.status).toBe(BookingStatus.CANCELLED);
    expect(booking!.slots).toHaveLength(0);

    // The freed slot can be booked by someone else.
    const replacement = await createBooking({
      packageId: pkg.id,
      dateKey,
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("sweep-next"),
    });
    expect(replacement.bookingId).toBeTruthy();
  });

  it("leaves bookings that have not expired alone", async () => {
    const pkg = await getThreeHourPackage();

    const created = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(),
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("not-expired"),
    });

    await expireStalePendingBookings();

    const booking = await prisma.booking.findUnique({ where: { id: created.bookingId } });
    expect(booking!.status).toBe(BookingStatus.PENDING_PAYMENT);
  });
});

describe("student packages", () => {
  it("refuses a student-only package for a customer who is not booking as a KNUST student", async () => {
    const pkg = await getStudentHourPackage();

    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey: futureDateKey(),
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("not-student", { userType: CustomerType.CREATOR }),
      }),
    ).rejects.toThrow(/only available to verified KNUST students/i);
  });

  it("refuses a KNUST Student booking when the email cannot be verified under the default email-only policy", async () => {
    const pkg = await getStudentHourPackage();

    await expect(
      createBooking({
        packageId: pkg.id,
        dateKey: futureDateKey(),
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("unverified-email", {
          userType: CustomerType.KNUST_STUDENT,
          email: `${TEST_EMAIL_PREFIX}-unverified-email@gmail.com`,
        }),
      }),
    ).rejects.toThrow(/knust email/i);
  });

  it("verifies instantly and grants student pricing for a matching KNUST email", async () => {
    const pkg = await getStudentHourPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(),
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("knust-email", {
        userType: CustomerType.KNUST_STUDENT,
        email: `${TEST_EMAIL_PREFIX}-knust-email@knust.edu.gh`,
      }),
    });

    const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
    expect(booking!.totalMinor).toBe(pkg.priceMinor);

    const customer = await prisma.customer.findUnique({ where: { id: booking!.customerId } });
    expect(customer!.isVerified).toBe(true);
    expect(customer!.studentVerificationMethod).toBe("EMAIL");
    expect(customer!.knustEmail).toBe(`${TEST_EMAIL_PREFIX}-knust-email@knust.edu.gh`);
  });

  it("lets an admin book a student-only package for any customer type", async () => {
    const pkg = await getStudentHourPackage();

    const result = await createBooking({
      packageId: pkg.id,
      dateKey: futureDateKey(),
      startMinute: 10 * 60,
      addOns: [],
      customer: customerInput("admin-booked", { userType: CustomerType.CREATOR }),
      source: BookingSource.ADMIN,
      paymentMode: "PAID_MANUAL",
    });

    expect(result.bookingId).toBeTruthy();
  });

  it("holds a student ID submission for manual review instead of verifying it automatically", async () => {
    await updateSettings({ "student.verificationMethod": "EITHER" });

    try {
      const pkg = await getStudentHourPackage();

      const result = await createBooking({
        packageId: pkg.id,
        dateKey: futureDateKey(),
        startMinute: 10 * 60,
        addOns: [],
        customer: customerInput("student-id", {
          userType: CustomerType.KNUST_STUDENT,
          email: `${TEST_EMAIL_PREFIX}-student-id@gmail.com`,
          studentIdRef: "UEB1234567",
        }),
      });

      const booking = await prisma.booking.findUnique({ where: { id: result.bookingId } });
      const customer = await prisma.customer.findUnique({ where: { id: booking!.customerId } });

      expect(customer!.isVerified).toBe(false);
      expect(customer!.studentVerificationMethod).toBe("STUDENT_ID");
      expect(customer!.studentIdRef).toBe("UEB1234567");
    } finally {
      await updateSettings({ "student.verificationMethod": "EMAIL" });
    }
  });
});
