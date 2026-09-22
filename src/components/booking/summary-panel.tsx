"use client";

import { CalendarDays, Clock, Package as PackageIcon, Tag } from "lucide-react";

import { LoadingLine } from "@/components/ui/feedback";
import { formatMinuteOfDay12, formatTimeRange } from "@/lib/booking/time";
import { formatDuration, formatMoney } from "@/lib/utils";

export interface QuoteView {
  packageName: string;
  durationMinutes: number;
  baseMinor: number;
  addOnLines: {
    addOnId: string;
    name: string;
    quantity: number;
    lineTotalMinor: number;
    requiresCustomQuote: boolean;
  }[];
  addOnsMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  discountLabel: string | null;
  taxMinor: number;
  taxLabel: string;
  totalMinor: number;
  currency: string;
  requiresCustomQuote: boolean;
}

function longDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function SummaryPanel({
  quote,
  loading,
  dateKey,
  startMinute,
  packageName,
}: {
  quote: QuoteView | null;
  loading: boolean;
  dateKey: string | null;
  startMinute: number | null;
  packageName: string | null;
}) {
  const duration = quote?.durationMinutes ?? 0;

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ink">Booking summary</h2>
      </div>

      <div className="space-y-4 px-5 py-4">
        <dl className="space-y-3">
          <div className="flex gap-3">
            <PackageIcon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Package
              </dt>
              <dd className="mt-0.5 text-[14px] font-medium text-ink">
                {packageName ?? <span className="text-muted/70">Not chosen yet</span>}
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Date
              </dt>
              <dd className="mt-0.5 text-[14px] font-medium text-ink">
                {dateKey ? longDate(dateKey) : <span className="text-muted/70">Not chosen yet</span>}
              </dd>
            </div>
          </div>

          <div className="flex gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
                Time
              </dt>
              <dd className="mt-0.5 text-[14px] font-medium text-ink">
                {startMinute !== null && duration ? (
                  <>
                    {formatTimeRange(startMinute, startMinute + duration)}
                    <span className="ml-1.5 text-[12.5px] font-normal text-muted">
                      ({formatDuration(duration)})
                    </span>
                  </>
                ) : startMinute !== null ? (
                  formatMinuteOfDay12(startMinute)
                ) : (
                  <span className="text-muted/70">Not chosen yet</span>
                )}
              </dd>
            </div>
          </div>
        </dl>

        <div className="border-t border-line pt-4">
          {loading ? (
            <LoadingLine label="Updating price…" />
          ) : quote ? (
            <div className="space-y-2">
              <Line label={quote.packageName} value={formatMoney(quote.baseMinor, quote.currency)} />

              {quote.addOnLines.map((line) => (
                <Line
                  key={line.addOnId}
                  label={line.quantity > 1 ? `${line.name} ×${line.quantity}` : line.name}
                  value={
                    line.requiresCustomQuote
                      ? "Quoted"
                      : formatMoney(line.lineTotalMinor, quote.currency)
                  }
                  muted
                />
              ))}

              <div className="border-t border-line pt-2">
                <Line
                  label="Subtotal"
                  value={formatMoney(quote.subtotalMinor, quote.currency)}
                  muted
                />
              </div>

              {quote.discountMinor > 0 ? (
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-start gap-1.5 text-[13px] text-success-700">
                    <Tag className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>{quote.discountLabel ?? "Discount"}</span>
                  </span>
                  <span className="text-[13px] font-semibold whitespace-nowrap text-success-700">
                    −{formatMoney(quote.discountMinor, quote.currency)}
                  </span>
                </div>
              ) : null}

              {quote.taxMinor > 0 ? (
                <Line
                  label={quote.taxLabel}
                  value={formatMoney(quote.taxMinor, quote.currency)}
                  muted
                />
              ) : null}

              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-[14px] font-semibold text-ink">Total</span>
                <span className="font-display text-[24px] leading-none font-semibold text-ink">
                  {formatMoney(quote.totalMinor, quote.currency)}
                </span>
              </div>

              {quote.requiresCustomQuote ? (
                <p className="rounded-lg bg-info-50 px-3 py-2 text-[12.5px] leading-relaxed text-info-700">
                  One of your add-ons is priced per project. You will only pay the amount
                  above now: the team will send a separate quote for the rest.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-[13px] text-muted">
              Choose a package to see your price.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={muted ? "text-[13px] text-muted" : "text-[13.5px] text-ink-soft"}>
        {label}
      </span>
      <span
        className={
          muted
            ? "text-[13px] whitespace-nowrap text-muted"
            : "text-[13.5px] font-medium whitespace-nowrap text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
