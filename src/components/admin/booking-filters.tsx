"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { BOOKING_STATUS_META, PAYMENT_STATUS_META } from "@/components/ui/badge";
import type { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Booking filters. State lives entirely in the URL, so a filtered view can be
 * bookmarked, shared with a colleague, or reloaded without losing the query.
 */
export function BookingFilters({
  packages,
}: {
  packages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change resets to the first page.
    next.delete("page");
    router.push(`/admin/bookings?${next.toString()}`);
  }

  const hasFilters = ["q", "status", "payment", "package", "from", "to"].some((key) =>
    params.get(key),
  );

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q });
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search reference, name, email, phone or organisation"
              className="pl-9"
              aria-label="Search bookings"
            />
          </div>
          <Button type="submit" size="md">
            Search
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select
            value={params.get("status") ?? ""}
            onChange={(event) => apply({ status: event.target.value })}
            aria-label="Filter by booking status"
          >
            <option value="">All statuses</option>
            {Object.entries(BOOKING_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {(meta as (typeof BOOKING_STATUS_META)[BookingStatus]).label}
              </option>
            ))}
          </Select>

          <Select
            value={params.get("payment") ?? ""}
            onChange={(event) => apply({ payment: event.target.value })}
            aria-label="Filter by payment status"
          >
            <option value="">All payments</option>
            {Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {(meta as (typeof PAYMENT_STATUS_META)[PaymentStatus]).label}
              </option>
            ))}
          </Select>

          <Select
            value={params.get("package") ?? ""}
            onChange={(event) => apply({ package: event.target.value })}
            aria-label="Filter by package"
          >
            <option value="">All packages</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </Select>

          <Input
            type="date"
            value={params.get("from") ?? ""}
            onChange={(event) => apply({ from: event.target.value })}
            aria-label="From date"
          />

          <Input
            type="date"
            value={params.get("to") ?? ""}
            onChange={(event) => apply({ to: event.target.value })}
            aria-label="To date"
          />
        </div>

        {hasFilters ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                router.push("/admin/bookings");
              }}
            >
              <X className="size-4" aria-hidden />
              Clear filters
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
