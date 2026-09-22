import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BookingDetailActions } from "@/components/admin/booking-detail-actions";
import { PageHeader } from "@/components/admin/page-header";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/guard";
import { roleHas } from "@/lib/auth/permissions";
import { bookingPath } from "@/lib/booking/access";
import {
  formatDateTime,
  formatLongDate,
  formatMinuteOfDay24,
  formatTimeRange,
  toDateKey,
} from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { calculateRefundDue } from "@/lib/payments/service";
import { formatDuration, formatMoney, titleCase } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBookingDetailPage({
  params,
}: PageProps<"/admin/bookings/[id]">) {
  const admin = await requireAdminPage("bookings:read");
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      addOns: true,
      payments: { orderBy: { createdAt: "desc" } },
      membership: { select: { id: true, reference: true } },
      createdByAdmin: { select: { name: true } },
      notifications: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!booking) notFound();

  const refund = await calculateRefundDue(booking.id);
  const canWrite = roleHas(admin.role, "bookings:write");
  const canManagePayments = roleHas(admin.role, "payments:manage");

  const detailRows: { label: string; value: React.ReactNode }[] = [
    { label: "Customer", value: booking.customer.name },
    {
      label: "Email",
      value: (
        <a
          href={`mailto:${booking.customer.email}`}
          className="text-brand-700 underline underline-offset-4"
        >
          {booking.customer.email}
        </a>
      ),
    },
    {
      label: "Phone",
      value: (
        <a
          href={`tel:${booking.customer.phone.replace(/\s/g, "")}`}
          className="text-brand-700 underline underline-offset-4"
        >
          {booking.customer.phone}
        </a>
      ),
    },
    { label: "Organisation", value: booking.customer.organisation ?? "-" },
    { label: "Customer type", value: titleCase(booking.customer.userType) },
    { label: "Package", value: booking.packageNameSnapshot ?? "-" },
    { label: "Date", value: formatLongDate(booking.bookingDate) },
    { label: "Time", value: formatTimeRange(booking.startMinute, booking.endMinute) },
    { label: "Duration", value: formatDuration(booking.durationMinutes) },
    {
      label: "Add-ons",
      value: booking.addOns.length
        ? booking.addOns
            .map((a) => (a.quantity > 1 ? `${a.nameSnapshot} ×${a.quantity}` : a.nameSnapshot))
            .join(", ")
        : "None",
    },
    { label: "Created", value: formatDateTime(booking.createdAt) },
    {
      label: "Source",
      value:
        booking.source === "ADMIN"
          ? `Admin${booking.createdByAdmin ? ` (${booking.createdByAdmin.name})` : ""}`
          : "Website",
    },
  ];

  if (booking.membership) {
    detailRows.push({
      label: "Membership",
      value: (
        <Link
          href="/admin/memberships"
          className="text-brand-700 underline underline-offset-4"
        >
          {booking.membership.reference} ({booking.membershipMinutesUsed / 60} hrs used)
        </Link>
      ),
    });
  }
  if (booking.purpose) detailRows.push({ label: "Purpose", value: booking.purpose });
  if (booking.specialRequirements) {
    detailRows.push({ label: "Special requirements", value: booking.specialRequirements });
  }
  if (booking.cancellationReason) {
    detailRows.push({ label: "Cancellation reason", value: booking.cancellationReason });
  }

  return (
    <>
      <Link
        href="/admin/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All bookings
      </Link>

      <PageHeader
        title={booking.reference}
        description={`${booking.customer.name} · ${formatLongDate(booking.bookingDate)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Booking details" />
            <CardBody className="p-0">
              <dl className="divide-y divide-line">
                {detailRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-4"
                  >
                    <dt className="text-[12px] font-semibold tracking-wide text-muted uppercase sm:w-44 sm:shrink-0">
                      {row.label}
                    </dt>
                    <dd className="min-w-0 text-[14px] break-words text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payments" description="Every transaction against this booking." />
            <CardBody className="p-0">
              {booking.payments.length === 0 ? (
                <p className="px-5 py-6 text-[13.5px] text-muted">
                  No payment has been started for this booking yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {booking.payments.map((payment) => (
                    <li key={payment.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[12.5px] text-ink">
                            {payment.providerReference ?? payment.reference}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-muted">
                            {payment.provider}
                            {payment.channel ? ` · ${payment.channel}` : ""} ·{" "}
                            {formatDateTime(payment.paidAt ?? payment.createdAt)}
                          </p>
                          {payment.failureReason ? (
                            <p className="mt-1 text-[12.5px] text-danger-500">
                              {payment.failureReason}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-semibold text-ink">
                            {formatMoney(payment.amountMinor, payment.currency)}
                          </p>
                          <PaymentStatusBadge status={payment.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {booking.notifications.length > 0 ? (
            <Card>
              <CardHeader
                title="Emails sent"
                description="What the customer has been told about this booking."
              />
              <CardBody className="p-0">
                <ul className="divide-y divide-line">
                  {booking.notifications.map((notification) => (
                    <li key={notification.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-medium text-ink">
                            {notification.subject}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted">
                            To {notification.recipient} ·{" "}
                            {formatDateTime(notification.sentAt ?? notification.createdAt)}
                          </p>
                          {notification.error ? (
                            <p className="mt-1 text-[12px] text-warning-700">
                              {notification.error}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={
                            notification.status === "SENT"
                              ? "text-[12px] font-semibold text-success-700"
                              : notification.status === "FAILED"
                                ? "text-[12px] font-semibold text-danger-500"
                                : "text-[12px] font-semibold text-warning-700"
                          }
                        >
                          {titleCase(notification.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {/* Money */}
          <Card>
            <CardHeader title="Amount" />
            <CardBody className="space-y-2">
              <Row label="Subtotal" value={formatMoney(booking.subtotalMinor, booking.currency)} />
              {booking.discountMinor > 0 ? (
                <Row
                  label={booking.discountLabel ?? "Discount"}
                  value={`−${formatMoney(booking.discountMinor, booking.currency)}`}
                  tone="success"
                />
              ) : null}
              {booking.taxMinor > 0 ? (
                <Row
                  label="Service charge"
                  value={formatMoney(booking.taxMinor, booking.currency)}
                />
              ) : null}
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <span className="text-[14px] font-semibold text-ink">Total</span>
                <span className="font-display text-[22px] font-semibold text-ink">
                  {formatMoney(booking.totalMinor, booking.currency)}
                </span>
              </div>
              {refund && refund.refundableMinor > 0 ? (
                <p className="mt-2 rounded-lg bg-info-50 px-3 py-2 text-[12.5px] leading-relaxed text-info-700">
                  If cancelled now: {formatMoney(refund.refundableMinor, booking.currency)}{" "}
                  refundable. {refund.note}
                </p>
              ) : null}
            </CardBody>
          </Card>

          {/* Actions */}
          {canWrite || canManagePayments ? (
            <BookingDetailActions
              bookingId={booking.id}
              reference={booking.reference}
              status={booking.status}
              paymentStatus={booking.paymentStatus}
              internalNotes={booking.internalNotes ?? ""}
              dateKey={toDateKey(booking.bookingDate)}
              startTime={formatMinuteOfDay24(booking.startMinute)}
              durationMinutes={booking.durationMinutes}
              customerLink={bookingPath(booking.reference)}
              canWrite={canWrite}
              canManagePayments={canManagePayments}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={tone === "success" ? "text-[13px] text-success-700" : "text-[13px] text-muted"}>
        {label}
      </span>
      <span
        className={
          tone === "success"
            ? "text-[13px] font-semibold whitespace-nowrap text-success-700"
            : "text-[13px] font-medium whitespace-nowrap text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}
