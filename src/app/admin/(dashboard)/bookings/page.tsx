import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { BookingFilters } from "@/components/admin/booking-filters";
import { PageHeader } from "@/components/admin/page-header";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatShortDate, formatTimeRange, parseDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminBookingsPage({
  searchParams,
}: PageProps<"/admin/bookings">) {
  await requireAdminPage("bookings:read");
  const params = await searchParams;

  const readParam = (key: string) => {
    const value = params[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const q = readParam("q");
  const status = readParam("status");
  const paymentStatus = readParam("payment");
  const packageId = readParam("package");
  const from = readParam("from");
  const to = readParam("to");
  const page = Math.max(1, Number.parseInt(readParam("page") ?? "1", 10) || 1);

  const where: Prisma.BookingWhereInput = {};

  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { email: { contains: q } } },
      { customer: { phone: { contains: q } } },
      { customer: { organisation: { contains: q } } },
    ];
  }

  if (status && status in BookingStatus) where.status = status as BookingStatus;
  if (paymentStatus && paymentStatus in PaymentStatus) {
    where.paymentStatus = paymentStatus as PaymentStatus;
  }
  if (packageId) where.packageId = packageId;

  const fromDate = from ? parseDateKey(from) : null;
  const toDate = to ? parseDateKey(to) : null;
  if (fromDate || toDate) {
    where.bookingDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const [bookings, total, packages] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: { customer: { select: { name: true, email: true, organisation: true } } },
      orderBy: [{ bookingDate: "desc" }, { startMinute: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
    prisma.package.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || status || paymentStatus || packageId || from || to);

  const buildPageHref = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `/admin/bookings?${search.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"}${hasFilters ? " matching your filters" : ""}.`}
        action={<ButtonLink href="/admin/bookings/new" size="sm">New booking</ButtonLink>}
      />

      <BookingFilters packages={packages} />

      {bookings.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<ClipboardList className="size-5" aria-hidden />}
          title={hasFilters ? "No bookings match those filters" : "No bookings yet"}
          description={
            hasFilters
              ? "Try widening the date range or clearing a filter."
              : "Bookings made on the website will appear here, and you can add phone bookings yourself."
          }
          action={
            hasFilters ? (
              <ButtonLink href="/admin/bookings" variant="outline">
                Clear filters
              </ButtonLink>
            ) : (
              <ButtonLink href="/admin/bookings/new">Create a booking</ButtonLink>
            )
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="mt-4 hidden rounded-xl border border-line bg-surface lg:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Customer</Th>
                    <Th>Date &amp; time</Th>
                    <Th>Package</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <Tr key={booking.id}>
                      <Td>
                        <Link
                          href={`/admin/bookings/${booking.id}`}
                          className="font-mono text-[12.5px] font-semibold text-brand-700 underline underline-offset-4"
                        >
                          {booking.reference}
                        </Link>
                      </Td>
                      <Td>
                        <span className="block font-medium text-ink">
                          {booking.customer.name}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {booking.customer.organisation ?? booking.customer.email}
                        </span>
                      </Td>
                      <Td>
                        <span className="block">{formatShortDate(booking.bookingDate)}</span>
                        <span className="block text-[12px] text-muted">
                          {formatTimeRange(booking.startMinute, booking.endMinute)}
                        </span>
                      </Td>
                      <Td>{booking.packageNameSnapshot ?? "-"}</Td>
                      <Td className="text-right font-medium text-ink">
                        {formatMoney(booking.totalMinor, booking.currency)}
                      </Td>
                      <Td>
                        <PaymentStatusBadge status={booking.paymentStatus} />
                      </Td>
                      <Td>
                        <BookingStatusBadge status={booking.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          {/* Mobile */}
          <div className="mt-4 space-y-3 lg:hidden">
            {bookings.map((booking) => (
              <MobileRowCard
                key={booking.id}
                title={booking.customer.name}
                subtitle={booking.reference}
                badges={
                  <>
                    <BookingStatusBadge status={booking.status} />
                    <PaymentStatusBadge status={booking.paymentStatus} />
                  </>
                }
                rows={[
                  { label: "Date", value: formatShortDate(booking.bookingDate) },
                  {
                    label: "Time",
                    value: formatTimeRange(booking.startMinute, booking.endMinute),
                  },
                  { label: "Package", value: booking.packageNameSnapshot ?? "-" },
                  {
                    label: "Amount",
                    value: formatMoney(booking.totalMinor, booking.currency),
                  },
                ]}
                action={
                  <ButtonLink
                    href={`/admin/bookings/${booking.id}`}
                    size="sm"
                    variant="outline"
                    fullWidth
                  >
                    View details
                  </ButtonLink>
                }
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="mt-5 flex items-center justify-between gap-3"
              aria-label="Pagination"
            >
              <p className="text-[13px] text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <ButtonLink href={buildPageHref(page - 1)} size="sm" variant="outline">
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink href={buildPageHref(page + 1)} size="sm" variant="outline">
                    Next
                  </ButtonLink>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
