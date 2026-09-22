import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Table primitives for the admin dashboard.
 *
 * On narrow screens the caller renders `<CardList>` instead: see the bookings and
 * payments screens. Tables stay horizontally scrollable so nothing is ever clipped.
 */

export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("scrollbar-slim w-full overflow-x-auto", className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line bg-paper/70 px-4 py-2.5 text-[11.5px] font-semibold tracking-wide text-muted uppercase whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-line px-4 py-3 text-[13.5px] text-ink-soft align-middle", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-paper/60", className)} {...props} />;
}

/** Mobile equivalent of a table row: a stacked label/value card. */
export function MobileRowCard({
  title,
  subtitle,
  badges,
  rows,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  rows: { label: string; value: ReactNode }[];
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{title}</p>
          {subtitle ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p> : null}
        </div>
        {badges ? <div className="flex shrink-0 flex-col items-end gap-1">{badges}</div> : null}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              {row.label}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] text-ink-soft">{row.value}</dd>
          </div>
        ))}
      </dl>

      {action ? <div className="mt-3.5 border-t border-line pt-3">{action}</div> : null}
    </div>
  );
}
