import "server-only";

import { prisma } from "@/lib/db";
import {
  SLOT_GRANULARITY_MINUTES,
  addDays,
  dayOfWeek,
  parseDateKey,
  rangesOverlap,
  slotMinutesFor,
  studioNowMinute,
  studioToday,
  toDateKey,
} from "@/lib/booking/time";
import { type BookingPolicy, getBookingPolicy } from "@/lib/settings";

/**
 * Availability is always computed on the server from operating hours, admin blocks and
 * the `BookingSlot` table. The client never gets to assert that a slot is free: it only
 * renders what this module reports, and `createBooking` re-checks everything inside a
 * transaction before writing.
 */

export type DayStatus = "AVAILABLE" | "LIMITED" | "FULL" | "CLOSED" | "BLOCKED" | "PAST";

export interface TimeSlot {
  startMinute: number;
  endMinute: number;
  available: boolean;
  reason?: string;
}

export interface DayAvailability {
  dateKey: string;
  status: DayStatus;
  /** Human-readable explanation when the whole day is unavailable. */
  message?: string;
  openMinute: number;
  closeMinute: number;
  slots: TimeSlot[];
}

export interface DaySummary {
  dateKey: string;
  status: DayStatus;
  availableCount: number;
  message?: string;
}

interface DayContext {
  policy: BookingPolicy;
  operatingHours: Map<number, { isOpen: boolean; openMinute: number; closeMinute: number }>;
  blockedDates: Map<string, string>;
  blockedTimes: Map<string, { startMinute: number; endMinute: number; reason: string }[]>;
  occupied: Map<string, Set<number>>;
}

/** Booking statuses that hold a slot. Cancelled/refunded/expired bookings release theirs. */
export const SLOT_HOLDING_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

async function loadContext(dateKeys: string[], policy: BookingPolicy): Promise<DayContext> {
  const dates = dateKeys.map((key) => parseDateKey(key)!).filter(Boolean);
  const first = dates[0];
  const last = dates[dates.length - 1];

  const [operatingRows, blockedDateRows, blockedTimeRows, slotRows] = await Promise.all([
    prisma.operatingHour.findMany(),
    prisma.blockedDate.findMany({ where: { date: { gte: first, lte: last } } }),
    prisma.blockedTime.findMany({ where: { date: { gte: first, lte: last } } }),
    prisma.bookingSlot.findMany({
      where: { bookingDate: { gte: first, lte: last } },
      select: { bookingDate: true, slotMinute: true },
    }),
  ]);

  const operatingHours = new Map(
    operatingRows.map((row) => [
      row.dayOfWeek,
      { isOpen: row.isOpen, openMinute: row.openMinute, closeMinute: row.closeMinute },
    ]),
  );

  const blockedDates = new Map(
    blockedDateRows.map((row) => [toDateKey(row.date), row.reason]),
  );

  const blockedTimes = new Map<string, { startMinute: number; endMinute: number; reason: string }[]>();
  for (const row of blockedTimeRows) {
    const key = toDateKey(row.date);
    const list = blockedTimes.get(key) ?? [];
    list.push({ startMinute: row.startMinute, endMinute: row.endMinute, reason: row.reason });
    blockedTimes.set(key, list);
  }

  const occupied = new Map<string, Set<number>>();
  for (const row of slotRows) {
    const key = toDateKey(row.bookingDate);
    const set = occupied.get(key) ?? new Set<number>();
    set.add(row.slotMinute);
    occupied.set(key, set);
  }

  return { policy, operatingHours, blockedDates, blockedTimes, occupied };
}

function buildDay(
  dateKey: string,
  durationMinutes: number,
  ctx: DayContext,
  now: Date,
): DayAvailability {
  const date = parseDateKey(dateKey)!;
  const todayKey = toDateKey(studioToday(now));
  const hours = ctx.operatingHours.get(dayOfWeek(date));

  const base = { dateKey, openMinute: hours?.openMinute ?? 0, closeMinute: hours?.closeMinute ?? 0 };

  if (dateKey < todayKey) {
    return { ...base, status: "PAST", message: "This date has passed.", slots: [] };
  }

  const blockedReason = ctx.blockedDates.get(dateKey);
  if (blockedReason) {
    return { ...base, status: "BLOCKED", message: blockedReason, slots: [] };
  }

  if (!hours || !hours.isOpen || hours.closeMinute <= hours.openMinute) {
    return { ...base, status: "CLOSED", message: "The studio is closed on this day.", slots: [] };
  }

  const occupied = ctx.occupied.get(dateKey) ?? new Set<number>();
  const blocks = ctx.blockedTimes.get(dateKey) ?? [];

  // Earliest bookable minute today, honouring the configured lead time.
  let earliestMinute = hours.openMinute;
  if (dateKey === todayKey) {
    earliestMinute = Math.max(
      earliestMinute,
      studioNowMinute(now) + ctx.policy.leadTimeHours * 60,
    );
  }

  const step = Math.max(SLOT_GRANULARITY_MINUTES, ctx.policy.intervalMinutes);
  const slots: TimeSlot[] = [];

  for (
    let start = hours.openMinute;
    start + durationMinutes <= hours.closeMinute;
    start += step
  ) {
    const end = start + durationMinutes;
    let available = true;
    let reason: string | undefined;

    if (start < earliestMinute) {
      available = false;
      reason = dateKey === todayKey ? "Too soon to book" : "Outside opening hours";
    }

    if (available) {
      for (const slotMinute of slotMinutesFor(start, end)) {
        if (occupied.has(slotMinute)) {
          available = false;
          reason = "Already booked";
          break;
        }
      }
    }

    if (available) {
      const clash = blocks.find((block) =>
        rangesOverlap(start, end, block.startMinute, block.endMinute),
      );
      if (clash) {
        available = false;
        reason = clash.reason;
      }
    }

    slots.push({ startMinute: start, endMinute: end, available, reason });
  }

  const availableCount = slots.filter((slot) => slot.available).length;
  const status: DayStatus =
    availableCount === 0 ? "FULL" : availableCount <= 2 ? "LIMITED" : "AVAILABLE";

  return {
    ...base,
    status,
    message: availableCount === 0 ? "Fully booked." : undefined,
    slots,
  };
}

/** Slot-level availability for a single day. */
export async function getDayAvailability(
  dateKey: string,
  durationMinutes: number,
  now: Date = new Date(),
): Promise<DayAvailability> {
  const policy = await getBookingPolicy();
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    return {
      dateKey,
      status: "CLOSED",
      message: "Invalid date.",
      openMinute: 0,
      closeMinute: 0,
      slots: [],
    };
  }

  const ctx = await loadContext([dateKey], policy);
  return buildDay(dateKey, Math.max(SLOT_GRANULARITY_MINUTES, durationMinutes), ctx, now);
}

/** Day-level status across a range, used to colour the booking calendar. */
export async function getRangeAvailability(
  fromKey: string,
  days: number,
  durationMinutes: number,
  now: Date = new Date(),
): Promise<DaySummary[]> {
  const policy = await getBookingPolicy();
  const from = parseDateKey(fromKey);
  if (!from) return [];

  const clampedDays = Math.min(Math.max(days, 1), 62);
  const keys: string[] = [];
  for (let i = 0; i < clampedDays; i += 1) {
    keys.push(toDateKey(addDays(from, i)));
  }

  const ctx = await loadContext(keys, policy);
  const maxKey = toDateKey(addDays(studioToday(now), policy.maxAdvanceDays));

  return keys.map((key) => {
    if (key > maxKey) {
      return {
        dateKey: key,
        status: "CLOSED" as DayStatus,
        availableCount: 0,
        message: "Not yet open for booking.",
      };
    }
    const day = buildDay(key, Math.max(SLOT_GRANULARITY_MINUTES, durationMinutes), ctx, now);
    return {
      dateKey: key,
      status: day.status,
      availableCount: day.slots.filter((slot) => slot.available).length,
      message: day.message,
    };
  });
}

export interface SlotCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Validate one specific requested slot. Called by `createBooking` inside the write
 * transaction, so it must not assume anything the caller computed earlier.
 *
 * Note: this checks operating hours, blocked dates/times and policy windows. Overlap
 * with another booking is enforced by the unique constraint on `BookingSlot`, which is
 * the only race-proof guarantee.
 */
export async function validateRequestedSlot(params: {
  dateKey: string;
  startMinute: number;
  durationMinutes: number;
  policy: BookingPolicy;
  now?: Date;
  /** Admin-created bookings may sit outside opening hours and inside the lead time. */
  allowOutsideHours?: boolean;
}): Promise<SlotCheck> {
  const now = params.now ?? new Date();
  const date = parseDateKey(params.dateKey);
  if (!date) return { ok: false, reason: "Invalid date." };

  const { startMinute, durationMinutes, policy } = params;
  const endMinute = startMinute + durationMinutes;

  if (durationMinutes < policy.minDurationMinutes) {
    return { ok: false, reason: `Minimum booking length is ${policy.minDurationMinutes} minutes.` };
  }
  if (durationMinutes > policy.maxDurationMinutes) {
    return { ok: false, reason: `Maximum booking length is ${policy.maxDurationMinutes} minutes.` };
  }
  if (startMinute < 0 || endMinute > 24 * 60) {
    return { ok: false, reason: "Requested time falls outside the day." };
  }
  if (startMinute % SLOT_GRANULARITY_MINUTES !== 0) {
    return { ok: false, reason: "Bookings must start on a half-hour boundary." };
  }

  const todayKey = toDateKey(studioToday(now));
  if (!params.allowOutsideHours) {
    if (params.dateKey < todayKey) {
      return { ok: false, reason: "That date has passed." };
    }
    const maxKey = toDateKey(addDays(studioToday(now), policy.maxAdvanceDays));
    if (params.dateKey > maxKey) {
      return { ok: false, reason: "That date is not open for booking yet." };
    }
    if (params.dateKey === todayKey) {
      const earliest = studioNowMinute(now) + policy.leadTimeHours * 60;
      if (startMinute < earliest) {
        return { ok: false, reason: "That start time is too soon. Please pick a later slot." };
      }
    }
  }

  const [blockedDate, hours, blockedTimes] = await Promise.all([
    prisma.blockedDate.findUnique({ where: { date } }),
    prisma.operatingHour.findUnique({ where: { dayOfWeek: dayOfWeek(date) } }),
    prisma.blockedTime.findMany({ where: { date } }),
  ]);

  if (blockedDate) {
    return { ok: false, reason: `The studio is unavailable on this date: ${blockedDate.reason}` };
  }

  if (!params.allowOutsideHours) {
    if (!hours || !hours.isOpen) {
      return { ok: false, reason: "The studio is closed on this day." };
    }
    if (startMinute < hours.openMinute || endMinute > hours.closeMinute) {
      return { ok: false, reason: "That time falls outside the studio's opening hours." };
    }
  }

  const clash = blockedTimes.find((block) =>
    rangesOverlap(startMinute, endMinute, block.startMinute, block.endMinute),
  );
  if (clash) {
    return { ok: false, reason: `That time is blocked: ${clash.reason}` };
  }

  return { ok: true };
}
