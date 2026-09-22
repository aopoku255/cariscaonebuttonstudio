import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
} from "lucide-react";

import { BookingActions } from "@/components/booking/booking-actions";
import { Container } from "@/components/public/section";
import { Badge, BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/enums";
import { bookingAccessToken, verifyBookingAccessToken } from "@/lib/booking/access";
import { formatLongDate, formatTimeRange } from "@/lib/booking/time";
import { getCustomerSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { isPaystackConfigured } from "@/lib/env";
import { getStudioProfile } from "@/lib/queries/public";
import { formatDuration, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<"/booking/[reference]">) {
  const { reference } = await params;
  const query = await searchParams;

  const booking = await prisma.booking.findUnique({
    where: { reference: decodeURIComponent(reference) },
    include: {
      customer: true,
      addOns: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) notFound();

  /**
   * Access control: a valid signed token in the link, or a signed-in customer who owns
   * this booking. Otherwise send them to the lookup form rather than leaking details.
   */
  const token = typeof query.t === "string" ? query.t : null;
  const session = await getCustomerSession();
  const authorised =
    verifyBookingAccessToken(booking.reference, token) || session?.id === booking.customerId;

  if (!authorised) {
    return (
      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-[28px] leading-tight font-semibold text-ink">
            This booking link needs verifying
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            For privacy, booking details are only shown through the secure link we emailed
            you. Look up your booking with the email address you used, and we will send the
            link again.
          </p>
          <ButtonLink href="/booking/lookup" className="mt-7">
            Find my booking
          </ButtonLink>
        </div>
      </Container>
    );
  }

  const studio = await getStudioProfile();
  const justPaid = query.paid === "1";
  const isNew = query.new === "1";
  const isHeld = query.held === "1";

  const confirmed =
    booking.status === BookingStatus.CONFIRMED ||
    booking.status === BookingStatus.COMPLETED ||
    booking.status === BookingStatus.IN_PROGRESS;
  const awaitingPayment =
    booking.status === BookingStatus.PENDING_PAYMENT &&
    booking.paymentStatus === PaymentStatus.PENDING;
  const cancelled =
    booking.status === BookingStatus.CANCELLED ||
    booking.status === BookingStatus.REFUNDED ||
    booking.status === BookingStatus.NO_SHOW;

  const accessToken = bookingAccessToken(booking.reference);
  const paidPayment = booking.payments.find((p) => p.status === PaymentStatus.PAID);

  const heading = cancelled
    ? "Booking cancelled"
    : confirmed
      ? "Booking confirmed"
      : booking.status === BookingStatus.PENDING_APPROVAL
        ? "Booking awaiting approval"
        : "Booking held: payment needed";

  const summaryRows: { label: string; value: string }[] = [
    { label: "Booking reference", value: booking.reference },
    { label: "Date", value: formatLongDate(booking.bookingDate) },
    { label: "Time", value: formatTimeRange(booking.startMinute, booking.endMinute) },
    { label: "Duration", value: formatDuration(booking.durationMinutes) },
    { label: "Package", value: booking.packageNameSnapshot ?? "Studio session" },
  ];

  if (booking.addOns.length) {
    summaryRows.push({
      label: "Add-ons",
      value: booking.addOns
        .map((a) => (a.quantity > 1 ? `${a.nameSnapshot} ×${a.quantity}` : a.nameSnapshot))
        .join(", "),
    });
  }

  summaryRows.push({
    label: confirmed && paidPayment ? "Amount paid" : "Amount",
    value: formatMoney(booking.totalMinor, booking.currency),
  });

  return (
    <Container className="py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {justPaid || isNew ? (
          <div className="animate-fade-up mb-8 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success-700">
              <CheckCircle2 className="size-7" aria-hidden />
            </span>
          </div>
        ) : null}

        <header className="text-center">
          <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight text-balance text-ink sm:text-[40px]">
            {heading}
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-muted">
            {cancelled
              ? "This session is no longer scheduled."
              : confirmed
                ? "Your One Button Studio booking has been confirmed. We have emailed you a copy."
                : booking.status === BookingStatus.PENDING_APPROVAL
                  ? "We have your payment and the studio is reviewing this booking. You will hear from us shortly."
                  : "Your slot is held. Complete payment to confirm it."}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
            {booking.membershipMinutesUsed > 0 ? (
              <Badge tone="brand">
                {(booking.membershipMinutesUsed / 60).toFixed(
                  booking.membershipMinutesUsed % 60 === 0 ? 0 : 1,
                )}{" "}
                membership hour(s) used
              </Badge>
            ) : null}
          </div>
        </header>

        {isHeld && awaitingPayment ? (
          <Alert tone="warning" className="mt-8" title="Payment still needed">
            Your booking is recorded and the slot is held, but it is not confirmed until
            payment is received.
          </Alert>
        ) : null}

        {/* Details */}
        <div className="print-sheet mt-9 overflow-hidden rounded-2xl border border-line bg-surface">
          <dl className="divide-y divide-line">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-4">
                <dt className="text-[12.5px] font-semibold tracking-wide text-muted uppercase sm:w-52 sm:shrink-0">
                  {row.label}
                </dt>
                <dd
                  className={
                    row.label === "Booking reference"
                      ? "font-mono text-[15px] font-semibold text-ink"
                      : "text-[15px] text-ink"
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-line bg-paper/60 px-5 py-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-muted">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-accent-600" aria-hidden />
                {studio.location}
              </span>
              <span className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-accent-600" aria-hidden />
                Please arrive 10 minutes early
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {!cancelled ? (
          <div className="print:hidden mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {confirmed ? (
              <>
                <ButtonLink
                  href={`/api/bookings/${encodeURIComponent(booking.reference)}/calendar?t=${accessToken}`}
                  variant="outline"
                >
                  <CalendarPlus className="size-4" aria-hidden />
                  Add to Calendar
                </ButtonLink>
                <ButtonLink
                  href={`/booking/${encodeURIComponent(booking.reference)}/receipt?t=${accessToken}`}
                  variant="outline"
                >
                  <Download className="size-4" aria-hidden />
                  Download Receipt
                </ButtonLink>
              </>
            ) : null}

            <BookingActions
              reference={booking.reference}
              accessToken={accessToken}
              awaitingPayment={awaitingPayment && booking.totalMinor > 0}
              paymentEnabled={isPaystackConfigured()}
              canCancel={confirmed || awaitingPayment}
              startsAt={booking.startsAt.toISOString()}
            />
          </div>
        ) : null}

        {booking.cancellationReason ? (
          <Alert tone="info" className="mt-7" title="Reason">
            {booking.cancellationReason}
          </Alert>
        ) : null}

        {/* Cancellation policy */}
        <div className="print:hidden mt-10 rounded-2xl border border-line bg-paper-deep/60 p-5">
          <h2 className="text-[14px] font-semibold text-ink">Cancellation policy</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {studio.cancellationPolicy}
          </p>
          <p className="mt-3 text-[13.5px] text-muted">
            Questions? Call {studio.phone} or email{" "}
            <a
              href={`mailto:${studio.email}`}
              className="font-semibold text-brand-700 underline underline-offset-4"
            >
              {studio.email}
            </a>
            .
          </p>
        </div>

        <div className="print:hidden mt-8 text-center">
          <Link
            href="/book"
            className="text-[14px] font-semibold text-brand-700 underline underline-offset-4"
          >
            Book another session
          </Link>
        </div>

        {cancelled ? (
          <div className="print:hidden mt-8">
            <Alert tone="info">
              <AlertCircle className="sr-only" aria-hidden />
              If a refund is due under the policy above, it will be returned to your original
              payment method.
            </Alert>
          </div>
        ) : null}
      </div>
    </Container>
  );
}
