import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { PaymentFilters } from "@/components/admin/payment-filters";
import { StatCard } from "@/components/admin/stat-card";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { MobileRowCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { formatDateTime, parseDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { formatMoney, titleCase } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminPaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  await requireAdminPage("payments:read");
  const params = await searchParams;

  const read = (key: string) => {
    const value = params[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const q = read("q");
  const status = read("status");
  const from = read("from");
  const to = read("to");
  const page = Math.max(1, Number.parseInt(read("page") ?? "1", 10) || 1);

  const where: Prisma.PaymentWhereInput = {};

  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { providerReference: { contains: q } },
      { booking: { reference: { contains: q } } },
      { booking: { customer: { name: { contains: q } } } },
      { booking: { customer: { email: { contains: q } } } },
    ];
  }
  if (status && status in PaymentStatus) where.status = status as PaymentStatus;

  const fromDate = from ? parseDateKey(from) : null;
  const toDate = to ? parseDateKey(to) : null;
  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      // Include the whole end day, not just its midnight.
      ...(toDate ? { lt: new Date(toDate.getTime() + 86_400_000) } : {}),
    };
  }

  const [payments, total, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          select: {
            id: true,
            reference: true,
            customer: { select: { name: true, email: true } },
          },
        },
        membership: { select: { reference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({
      by: ["status"],
      where,
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
  ]);

  const sumFor = (target: PaymentStatus) =>
    totals.find((row) => row.status === target)?._sum.amountMinor ?? 0;
  const countFor = (target: PaymentStatus) =>
    totals.find((row) => row.status === target)?._count._all ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || status || from || to);

  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `/admin/payments?${search.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every transaction, with its Paystack reference for reconciliation."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Received"
          value={formatMoney(sumFor(PaymentStatus.PAID))}
          hint={`${countFor(PaymentStatus.PAID)} successful payments`}
          tone="accent"
        />
        <StatCard
          label="Pending"
          value={formatMoney(sumFor(PaymentStatus.PENDING))}
          hint={`${countFor(PaymentStatus.PENDING)} awaiting completion`}
          tone={countFor(PaymentStatus.PENDING) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Failed"
          value={String(countFor(PaymentStatus.FAILED))}
          hint="Did not complete"
        />
        <StatCard
          label="Refunded"
          value={formatMoney(sumFor(PaymentStatus.REFUNDED))}
          hint={`${countFor(PaymentStatus.REFUNDED)} refunds`}
        />
      </div>

      <PaymentFilters />

      {payments.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<CreditCard className="size-5" aria-hidden />}
          title={hasFilters ? "No payments match those filters" : "No payments yet"}
          description={
            hasFilters
              ? "Try widening the date range or clearing a filter."
              : "Payments appear here as soon as customers start paying online."
          }
          action={
            hasFilters ? (
              <ButtonLink href="/admin/payments" variant="outline">
                Clear filters
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mt-4 hidden rounded-xl border border-line bg-surface lg:block">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Booking</Th>
                    <Th>Customer</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Method</Th>
                    <Th>Paystack reference</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <Tr key={payment.id}>
                      <Td>
                        {payment.booking ? (
                          <Link
                            href={`/admin/bookings/${payment.booking.id}`}
                            className="font-mono text-[12.5px] font-semibold text-brand-700 underline underline-offset-4"
                          >
                            {payment.booking.reference}
                          </Link>
                        ) : payment.membership ? (
                          <span className="font-mono text-[12.5px]">
                            {payment.membership.reference}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </Td>
                      <Td>
                        {payment.booking ? (
                          <>
                            <span className="block">{payment.booking.customer.name}</span>
                            <span className="block text-[12px] text-muted">
                              {payment.booking.customer.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </Td>
                      <Td className="text-right font-medium text-ink">
                        {formatMoney(payment.amountMinor, payment.currency)}
                      </Td>
                      <Td>{payment.channel ?? titleCase(payment.provider)}</Td>
                      <Td>
                        <span className="font-mono text-[11.5px] text-muted">
                          {payment.providerReference ?? payment.reference}
                        </span>
                      </Td>
                      <Td>{formatDateTime(payment.paidAt ?? payment.createdAt)}</Td>
                      <Td>
                        <PaymentStatusBadge status={payment.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>

          <div className="mt-4 space-y-3 lg:hidden">
            {payments.map((payment) => (
              <MobileRowCard
                key={payment.id}
                title={formatMoney(payment.amountMinor, payment.currency)}
                subtitle={payment.booking?.reference ?? payment.reference}
                badges={<PaymentStatusBadge status={payment.status} />}
                rows={[
                  { label: "Customer", value: payment.booking?.customer.name ?? "-" },
                  { label: "Method", value: payment.channel ?? titleCase(payment.provider) },
                  { label: "Date", value: formatDateTime(payment.paidAt ?? payment.createdAt) },
                  {
                    label: "Reference",
                    value: (
                      <span className="font-mono text-[11px]">
                        {payment.providerReference ?? payment.reference}
                      </span>
                    ),
                  },
                ]}
                action={
                  payment.booking ? (
                    <ButtonLink
                      href={`/admin/bookings/${payment.booking.id}`}
                      size="sm"
                      variant="outline"
                      fullWidth
                    >
                      View booking
                    </ButtonLink>
                  ) : undefined
                }
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
              <p className="text-[13px] text-muted">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <ButtonLink href={pageHref(page - 1)} size="sm" variant="outline">
                    Previous
                  </ButtonLink>
                ) : null}
                {page < totalPages ? (
                  <ButtonLink href={pageHref(page + 1)} size="sm" variant="outline">
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
