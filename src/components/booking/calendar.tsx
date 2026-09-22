"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/feedback";
import type { DayStatus } from "@/lib/booking/availability";
import { useJsonFetch } from "@/lib/hooks/use-json-fetch";
import { cn } from "@/lib/utils";

/**
 * Month calendar showing real availability.
 *
 * Day statuses come from `/api/availability`, which computes them server-side from
 * operating hours, admin blocks and existing bookings. The calendar only renders what
 * the server reports: it never decides for itself whether a day is bookable.
 */

interface DaySummary {
  dateKey: string;
  status: DayStatus;
  availableCount: number;
  message?: string;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toKey(date: Date): string {
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 1)));
}

/** Days rendered in the grid: leading blanks (Mon-first) then each day of the month. */
function buildGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay(): 0 = Sunday. Shift so Monday is column 0.
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toKey(new Date(Date.UTC(year, month, day))));
  }
  return cells;
}

const STATUS_STYLES: Record<DayStatus, string> = {
  AVAILABLE: "text-ink hover:border-brand-500 hover:bg-brand-50 border-line-strong bg-surface",
  LIMITED: "text-ink hover:border-accent-500 hover:bg-accent-50 border-accent-200 bg-accent-50/40",
  FULL: "text-muted/60 border-line bg-paper-deep cursor-not-allowed line-through",
  CLOSED: "text-muted/50 border-line bg-paper-deep/60 cursor-not-allowed",
  BLOCKED: "text-danger-500/60 border-danger-100 bg-danger-50/50 cursor-not-allowed line-through",
  PAST: "text-muted/40 border-transparent bg-transparent cursor-not-allowed",
};

export function AvailabilityCalendar({
  packageId,
  selectedDate,
  onSelect,
}: {
  packageId: string | null;
  selectedDate: string | null;
  onSelect: (dateKey: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const cells = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);

  const firstOfMonth = toKey(new Date(Date.UTC(cursor.year, cursor.month, 1)));
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();

  const { data, loading, error } = useJsonFetch<{ days: DaySummary[] }>(
    packageId
      ? `/api/availability?date=${firstOfMonth}&days=${daysInMonth}&packageId=${encodeURIComponent(packageId)}`
      : null,
  );

  const days = useMemo(
    () => new Map((data?.days ?? []).map((day) => [day.dateKey, day])),
    [data],
  );

  const currentMonthKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}`;
  const atFirstMonth = `${cursor.year}-${cursor.month}` === currentMonthKey;

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={atFirstMonth}
          className="rounded-lg border border-line-strong p-2 text-ink-soft transition-colors hover:bg-paper-deep disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        <h3 aria-live="polite" className="text-[15px] font-semibold text-ink">
          {monthLabel(cursor.year, cursor.month)}
        </h3>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg border border-line-strong p-2 text-ink-soft transition-colors hover:bg-paper-deep"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5" role="presentation">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[11px] font-semibold tracking-wide text-muted uppercase"
          >
            <span aria-hidden>{label.slice(0, 1)}</span>
            <span className="sr-only">{label}</span>
          </div>
        ))}

        {loading
          ? Array.from({ length: 35 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-lg" />
            ))
          : cells.map((dateKey, index) => {
              if (!dateKey) return <div key={`blank-${index}`} aria-hidden />;

              const summary = days.get(dateKey);
              const status: DayStatus = summary?.status ?? "CLOSED";
              const selectable = status === "AVAILABLE" || status === "LIMITED";
              const isSelected = selectedDate === dateKey;
              const dayNumber = Number(dateKey.slice(8, 10));

              const describedAs =
                status === "AVAILABLE" || status === "LIMITED"
                  ? `${summary?.availableCount ?? 0} slots available`
                  : (summary?.message ?? "Unavailable");

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={!selectable}
                  onClick={() => onSelect(dateKey)}
                  aria-pressed={isSelected}
                  aria-label={`${dayNumber}: ${describedAs}`}
                  title={describedAs}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[13.5px] font-medium transition-all duration-150",
                    STATUS_STYLES[status],
                    isSelected &&
                      "border-brand-800! bg-brand-800! text-white! no-underline! ring-2 ring-brand-800/20",
                  )}
                >
                  <span>{dayNumber}</span>
                  {status === "LIMITED" && !isSelected ? (
                    <span
                      className="absolute bottom-1.5 size-1 rounded-full bg-accent-500"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
      </div>

      {error ? (
        <p className="mt-4 text-[13px] text-danger-500" role="alert">
          {error}. Please refresh and try again.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-line-strong bg-surface" aria-hidden />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-accent-200 bg-accent-50" aria-hidden />
            Limited
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-line bg-paper-deep" aria-hidden />
            Unavailable
          </span>
        </div>
      )}
    </div>
  );
}
