"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PAYMENT_STATUS_META } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { PaymentStatus } from "@/generated/prisma/enums";

export function PaymentFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`/admin/payments?${next.toString()}`);
  }

  const hasFilters = ["q", "status", "from", "to"].some((key) => params.get(key));

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
              placeholder="Search booking reference, Paystack reference, name or email"
              className="pl-9"
              aria-label="Search payments"
            />
          </div>
          <Button type="submit">Search</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            value={params.get("status") ?? ""}
            onChange={(event) => apply({ status: event.target.value })}
            aria-label="Filter by payment status"
          >
            <option value="">All statuses</option>
            {Object.entries(PAYMENT_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {(meta as (typeof PAYMENT_STATUS_META)[PaymentStatus]).label}
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
                router.push("/admin/payments");
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
