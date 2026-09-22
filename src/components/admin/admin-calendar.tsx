"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BookingStatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { BookingStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * Month calendar for the admin.
 *
 * Each day carries one of five visual states: booked, pending, blocked, maintenance
 * or closed: and clicking a session opens its details. The colours are reinforced by
 * text on every entry, so the state is never conveyed by colour alone.
 */

interface CalendarBooking {
  id: string;
  dateKey: string;
  reference: string;
  customerName: string;
  packageName: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
}

interface BlockedDateEntry {
  dateKey: string;
  reason: string;
  type: string;
}

interface BlockedTimeEntry {
  dateKey: string;
  startTime: string;
  endTime: string;
  reason: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Status → the dot and text treatment used inside a day cell. */
const ENTRY_STYLES: Partial<Record<BookingStatus, string>> = {
  [BookingStatus.CONFIRMED]: "border-l-success-500 bg-success-50/70 text-success-700",
  [BookingStatus.IN_PROGRESS]: "border-l-brand-600 bg-brand-50 text-brand-800",
  [BookingStatus.COMPLETED]: "border-l-line-strong bg-paper-deep text-ink-soft",
  [BookingStatus.PENDING_PAYMENT]: "border-l-warning-500 bg-warning-50/70 text-warning-700",
  [BookingStatus.PENDING_APPROVAL]: "border-l-info-500 bg-info-50/70 text-info-700",
  [BookingStatus.REFUNDED]: "border-l-accent-500 bg-accent-50 text-accent-700",
  [BookingStatus.NO_SHOW]: "border-l-danger-500 bg-danger-50/70 text-danger-700",
};

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

export function AdminCalendar({
  year,
  month,
  todayKey,
  closedDaysOfWeek,
  bookings,
  blockedDates,
  blockedTimes,
}: {
  year: number;
  month: number;
  todayKey: string;
  closedDaysOfWeek: number[];
  bookings: CalendarBooking[];
  blockedDates: BlockedDateEntry[];
  blockedTimes: BlockedTimeEntry[];
  /** Tomorrow's key: kept for callers that want a default "new booking" date. */
  nextDayKey: string;
}) {
  const [selected, setSelected] = useState<CalendarBooking | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.dateKey) ?? [];
      list.push(booking);
      map.set(booking.dateKey, list);
    }
    return map;
  }, [bookings]);

  const blockedByDate = useMemo(
    () => new Map(blockedDates.map((entry) => [entry.dateKey, entry])),
    [blockedDates],
  );

  const blockedTimesByDate = useMemo(() => {
    const map = new Map<string, BlockedTimeEntry[]>();
    for (const entry of blockedTimes) {
      const list = map.get(entry.dateKey) ?? [];
      list.push(entry);
      map.set(entry.dateKey, list);
    }
    return map;
  }, [blockedTimes]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leading = (first.getUTCDay() + 6) % 7; // Monday-first

    const result: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      result.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
    // Pad to complete weeks so the grid keeps its shape.
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [year, month]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));

  return (
    <>
      <div className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-4 text-[16px] font-semibold text-ink">{monthLabel}</h2>

        <div className="scrollbar-slim overflow-x-auto">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="pb-1 text-center text-[11px] font-semibold tracking-wide text-muted uppercase"
                >
                  {label}
                </div>
              ))}

              {cells.map((dateKey, index) => {
                if (!dateKey) {
                  return <div key={`pad-${index}`} className="min-h-28" aria-hidden />;
                }

                const dayBookings = byDate.get(dateKey) ?? [];
                const blocked = blockedByDate.get(dateKey);
                const partialBlocks = blockedTimesByDate.get(dateKey) ?? [];
                const dayOfWeek = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
                const isClosed = closedDaysOfWeek.includes(dayOfWeek);
                const isToday = dateKey === todayKey;
                const dayNumber = Number(dateKey.slice(8, 10));

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "min-h-28 rounded-lg border p-1.5",
                      blocked
                        ? blocked.type === "MAINTENANCE"
                          ? "border-warning-100 bg-warning-50/60"
                          : "border-danger-100 bg-danger-50/50"
                        : isClosed
                          ? "border-line bg-paper-deep/60"
                          : "border-line bg-surface",
                      isToday && "ring-2 ring-brand-700/25",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-[12px] font-semibold",
                          isToday ? "text-brand-800" : "text-ink-soft",
                        )}
                      >
                        {dayNumber}
                      </span>
                      {dayBookings.length > 0 ? (
                        <span className="text-[10.5px] font-medium text-muted">
                          {dayBookings.length}
                        </span>
                      ) : null}
                    </div>

                    {blocked ? (
                      <p className="mt-1 rounded border-l-2 border-l-danger-500 bg-danger-50 px-1.5 py-1 text-[10.5px] leading-tight font-medium text-danger-700">
                        {blocked.type === "MAINTENANCE" ? "Maintenance" : "Blocked"}:{" "}
                        {blocked.reason}
                      </p>
                    ) : isClosed && dayBookings.length === 0 ? (
                      <p className="mt-1 text-[10.5px] text-muted">Closed</p>
                    ) : null}

                    {partialBlocks.map((entry, position) => (
                      <p
                        key={`${entry.startTime}-${position}`}
                        className="mt-1 rounded border-l-2 border-l-warning-500 bg-warning-50 px-1.5 py-1 text-[10.5px] leading-tight font-medium text-warning-700"
                      >
                        {entry.startTime}–{entry.endTime} {entry.reason}
                      </p>
                    ))}

                    <ul className="mt-1 space-y-1">
                      {dayBookings.slice(0, 3).map((booking) => (
                        <li key={booking.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(booking)}
                            className={cn(
                              "w-full rounded border-l-2 px-1.5 py-1 text-left text-[10.5px] leading-tight font-medium transition-opacity hover:opacity-80",
                              ENTRY_STYLES[booking.status] ??
                                "border-l-line-strong bg-paper-deep text-ink-soft",
                            )}
                          >
                            <span className="block font-semibold">{booking.startTime}</span>
                            <span className="block truncate">{booking.customerName}</span>
                          </button>
                        </li>
                      ))}
                      {dayBookings.length > 3 ? (
                        <li className="px-1.5 text-[10.5px] text-muted">
                          +{dayBookings.length - 3} more
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend: text labels, so state never depends on colour alone */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[11.5px] text-muted">
          <LegendItem className="bg-success-50 border-l-success-500" label="Confirmed" />
          <LegendItem className="bg-warning-50 border-l-warning-500" label="Pending payment" />
          <LegendItem className="bg-info-50 border-l-info-500" label="Pending approval" />
          <LegendItem className="bg-danger-50 border-l-danger-500" label="Blocked" />
          <LegendItem className="bg-paper-deep border-l-line-strong" label="Closed / completed" />
        </div>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.customerName ?? "Booking"}
        description={selected?.reference}
        size="sm"
        footer={
          selected ? (
            <Link
              href={`/admin/bookings/${selected.id}`}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-800 px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-900"
            >
              Open full details
            </Link>
          ) : null
        }
      >
        {selected ? (
          <dl className="space-y-3">
            <div className="flex justify-between gap-4">
              <dt className="text-[13px] text-muted">Package</dt>
              <dd className="text-[13.5px] font-medium text-ink">{selected.packageName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[13px] text-muted">Time</dt>
              <dd className="text-[13.5px] font-medium text-ink">
                {selected.startTime} – {selected.endTime}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[13px] text-muted">Date</dt>
              <dd className="text-[13.5px] font-medium text-ink">{selected.dateKey}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13px] text-muted">Status</dt>
              <dd>
                <BookingStatusBadge status={selected.status} />
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>
    </>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-4 rounded-sm border-l-2", className)} aria-hidden />
      {label}
    </span>
  );
}
