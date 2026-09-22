/**
 * Studio time handling.
 *
 * Every booking is stored twice over: as a studio-local calendar day plus minute
 * offsets (`bookingDate`, `startMinute`, `endMinute`), and as UTC instants
 * (`startsAt`, `endsAt`). The minute form is what availability and overlap logic use,
 * because it is immune to timezone and DST arithmetic. The UTC form exists for
 * sorting, reminders and calendar export.
 *
 * The studio is in Kumasi, Ghana (Africa/Accra), which is UTC+0 all year with no DST.
 * The offset lives in one constant so a future relocation is a one-line change.
 */

export const STUDIO_TIMEZONE = "Africa/Accra";
export const STUDIO_UTC_OFFSET_MINUTES = 0;

/** Granularity of the booking slot grid. Booking intervals must be a multiple of this. */
export const SLOT_GRANULARITY_MINUTES = 30;

export const MINUTES_IN_DAY = 24 * 60;

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Build a `@db.Date` value for a studio-local calendar day.
 *
 * MySQL DATE columns carry no timezone, and Prisma round-trips them as UTC midnight.
 * Always construct them with `Date.UTC` so the day never shifts under the server's
 * local timezone.
 */
export function studioDate(year: number, month1Based: number, day: number): Date {
  return new Date(Date.UTC(year, month1Based - 1, day, 0, 0, 0, 0));
}

/** Parse "2026-09-22" into the matching `@db.Date` value. */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = studioDate(year, month, day);
  // Reject impossible days like 2026-02-31, which would roll over.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Format a `@db.Date` value (or any Date) as the "YYYY-MM-DD" studio-local day key. */
export function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day of week for a studio-local date value: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

/** Combine a studio-local day and minute offset into a UTC instant. */
export function toUtcInstant(date: Date, minuteOfDay: number): Date {
  return new Date(
    date.getTime() + (minuteOfDay - STUDIO_UTC_OFFSET_MINUTES) * 60_000,
  );
}

/** The studio-local calendar day that contains a UTC instant. */
export function dateKeyFromInstant(instant: Date): string {
  const shifted = new Date(instant.getTime() + STUDIO_UTC_OFFSET_MINUTES * 60_000);
  return toDateKey(shifted);
}

/** Minutes-from-midnight, studio-local, for a UTC instant. */
export function minuteOfDayFromInstant(instant: Date): number {
  const shifted = new Date(instant.getTime() + STUDIO_UTC_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** The studio-local "today" as a `@db.Date` value. */
export function studioToday(now: Date = new Date()): Date {
  return parseDateKey(dateKeyFromInstant(now))!;
}

/** Current studio-local minute-of-day. */
export function studioNowMinute(now: Date = new Date()): number {
  return minuteOfDayFromInstant(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

/** "09:00", "14:30": 24-hour, used in admin inputs. */
export function formatMinuteOfDay24(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${`${h}`.padStart(2, "0")}:${`${m}`.padStart(2, "0")}`;
}

/** "9:00 AM", "2:30 PM": used on the public site. */
export function formatMinuteOfDay12(minute: number): string {
  const total = ((minute % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${`${m}`.padStart(2, "0")} ${suffix}`;
}

/** "9:00 AM – 11:00 AM" */
export function formatTimeRange(startMinute: number, endMinute: number): string {
  return `${formatMinuteOfDay12(startMinute)} – ${formatMinuteOfDay12(endMinute)}`;
}

/** Parse "09:00" or "9:00" into minutes from midnight. Returns null if malformed. */
export function parseTimeToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return total > MINUTES_IN_DAY ? null : total;
}

/** "22 September 2026" */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "Tue, 22 Sep 2026" */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "22 Sep 2026, 14:05": for admin tables, rendered in studio time. */
export function formatDateTime(instant: Date): string {
  const shifted = new Date(instant.getTime() + STUDIO_UTC_OFFSET_MINUTES * 60_000);
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(shifted)}, ${formatMinuteOfDay24(minuteOfDayFromInstant(instant))}`;
}

/** The 30-minute grid cells covered by [startMinute, endMinute). */
export function slotMinutesFor(startMinute: number, endMinute: number): number[] {
  const slots: number[] = [];
  const first = Math.floor(startMinute / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES;
  for (let minute = first; minute < endMinute; minute += SLOT_GRANULARITY_MINUTES) {
    slots.push(minute);
  }
  return slots;
}

/** Do [aStart, aEnd) and [bStart, bEnd) overlap? */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** ICS timestamp: 20260922T100000Z */
export function toIcsTimestamp(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}
