import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CustomerEditor } from "@/components/admin/customer-editor";
import { PageHeader } from "@/components/admin/page-header";
import {
  Badge,
  BookingStatusBadge,
  MembershipStatusBadge,
  PaymentStatusBadge,
} from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { roleHas } from "@/lib/auth/permissions";
import { formatLongDate, formatShortDate, formatTimeRange } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { CUSTOMER_TYPE_LABELS } from "@/lib/customer-types";
import { formatHours, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Customer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdminPage("customers:read");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bookings: {
        orderBy: [{ bookingDate: "desc" }],
        include: { payments: { where: { status: PaymentStatus.PAID }, select: { id: true } } },
      },
      memberships: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!customer) notFound();

  const totalSpent = customer.bookings
    .filter((booking) => booking.paymentStatus === PaymentStatus.PAID)
    .reduce((sum, booking) => sum + booking.totalMinor, 0);

  const canEdit = roleHas(admin.role, "customers:write");

  return (
    <>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All customers
      </Link>

      <PageHeader
        title={customer.name}
        description={customer.organisation ?? customer.email}
        action={customer.isVerified ? <Badge tone="success">Verified</Badge> : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Booking history"
              description={`${customer.bookings.length} booking${customer.bookings.length === 1 ? "" : "s"} · ${formatMoney(totalSpent)} paid`}
            />
            <CardBody className="p-0">
              {customer.bookings.length === 0 ? (
                <EmptyState
                  className="m-4 border-0 bg-transparent py-8"
                  title="No bookings yet"
                  description="This customer has not booked a session."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>Reference</Th>
                        <Th>Date</Th>
                        <Th>Package</Th>
                        <Th className="text-right">Amount</Th>
                        <Th>Payment</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.bookings.map((booking) => (
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
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Memberships" />
            <CardBody className="p-0">
              {customer.memberships.length === 0 ? (
                <EmptyState
                  className="m-4 border-0 bg-transparent py-8"
                  title="No memberships"
                  description="Assign one from the Memberships screen."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {customer.memberships.map((membership) => {
                    const remaining = Math.max(
                      0,
                      membership.totalMinutes - membership.usedMinutes,
                    );
                    return (
                      <li key={membership.id} className="px-5 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-ink">
                              {membership.packageNameSnapshot ?? "Membership"}
                            </p>
                            <p className="mt-0.5 font-mono text-[12px] text-muted">
                              {membership.reference}
                            </p>
                            <p className="mt-1 text-[12.5px] text-muted">
                              {formatHours(membership.usedMinutes)} of{" "}
                              {formatHours(membership.totalMinutes)} hours used ·{" "}
                              {formatHours(remaining)} left
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-muted">
                              {formatLongDate(membership.startDate)} -{" "}
                              {formatLongDate(membership.expiryDate)}
                            </p>
                          </div>
                          <MembershipStatusBadge status={membership.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="p-0">
              <dl className="divide-y divide-line">
                {[
                  { label: "Email", value: customer.email },
                  { label: "Phone", value: customer.phone },
                  { label: "Organisation", value: customer.organisation ?? "-" },
                  { label: "Type", value: CUSTOMER_TYPE_LABELS[customer.userType] },
                  ...(customer.knustEmail
                    ? [{ label: "KNUST email", value: customer.knustEmail }]
                    : []),
                  ...(customer.studentIdRef
                    ? [{ label: "Student ID", value: customer.studentIdRef }]
                    : []),
                  { label: "Has an account", value: customer.passwordHash ? "Yes" : "No" },
                  { label: "Customer since", value: formatLongDate(customer.createdAt) },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 px-5 py-2.5">
                    <dt className="text-[12.5px] text-muted">{row.label}</dt>
                    <dd className="text-right text-[13px] break-words text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          {canEdit ? (
            <CustomerEditor
              customerId={customer.id}
              name={customer.name}
              phone={customer.phone}
              organisation={customer.organisation ?? ""}
              userType={customer.userType}
              isVerified={customer.isVerified}
              notes={customer.notes ?? ""}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
