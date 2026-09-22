import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Receipt } from "lucide-react";

import { AccountAuthForm } from "@/components/public/account-auth-form";
import { Container, Section } from "@/components/public/section";
import {
  Badge,
  BookingStatusBadge,
  MembershipStatusBadge,
  PaymentStatusBadge,
} from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { CustomerType, MembershipStatus, PaymentStatus } from "@/generated/prisma/enums";
import { getCustomerSession } from "@/lib/auth/session";
import { bookingAccessToken, bookingPath } from "@/lib/booking/access";
import { formatLongDate, formatTimeRange } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/public/account-sign-out";
import { formatHours, formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My bookings",
  description:
    "Sign in to see your upcoming and past One Button Studio bookings, your membership hours and your receipts.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCustomerSession();

  if (!session) {
    return (
      <Section tone="paper">
        <Container className="max-w-md">
          <h1 className="font-display text-center text-[32px] leading-tight font-semibold tracking-tight text-ink">
            My bookings
          </h1>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-muted">
            Sign in to see your upcoming sessions, membership hours and receipts. You do not
            need an account to book: this is just for keeping track.
          </p>
          <div className="mt-8">
            <AccountAuthForm />
          </div>
          <p className="mt-6 text-center text-[13.5px] text-muted">
            Looking for one specific booking?{" "}
            <Link
              href="/booking/lookup"
              className="font-semibold text-brand-700 underline underline-offset-4"
            >
              Find it by reference
            </Link>
          </p>
        </Container>
      </Section>
    );
  }

  const now = new Date();

  const [customer, upcoming, past] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.id },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          orderBy: { expiryDate: "asc" },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        customerId: session.id,
        startsAt: { gte: now },
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        customerId: session.id,
        OR: [{ startsAt: { lt: now } }, { status: { in: ["CANCELLED", "REFUNDED"] } }],
      },
      orderBy: { startsAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <Section tone="paper">
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight text-ink sm:text-[38px]">
              My bookings
            </h1>
            <p className="mt-2 text-[15px] text-muted">
              Signed in as {session.email}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href="/book" size="sm">
              Book a session
            </ButtonLink>
            <SignOutButton />
          </div>
        </div>

        {/* Student Studio summary */}
        {customer?.userType === CustomerType.KNUST_STUDENT ? (
          <div className="mt-8 rounded-2xl border border-brand-200 bg-brand-900 p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold tracking-wide text-brand-200 uppercase">
                  My Student Studio
                </p>
                <h2 className="font-display mt-1 text-[20px] font-semibold">
                  {customer.isVerified
                    ? "You're verified as a KNUST student"
                    : "Verification pending"}
                </h2>
              </div>
              <Badge tone={customer.isVerified ? "success" : "warning"}>
                {customer.isVerified ? "Verified" : "Pending review"}
              </Badge>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[12px] text-brand-200">Hours available</p>
                <p className="mt-1 text-[20px] font-semibold">
                  {customer.memberships[0]
                    ? formatHours(
                        Math.max(
                          0,
                          customer.memberships[0].totalMinutes -
                            customer.memberships[0].usedMinutes,
                        ),
                      )
                    : "Pay per session"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-brand-200">Membership</p>
                <p className="mt-1 text-[15px] font-medium">
                  {customer.memberships[0]?.packageNameSnapshot ?? "No active membership"}
                </p>
                {customer.memberships[0] ? (
                  <p className="mt-0.5 text-[12.5px] text-brand-200">
                    Expires {formatLongDate(customer.memberships[0].expiryDate)}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[12px] text-brand-200">Next booking</p>
                <p className="mt-1 text-[15px] font-medium">
                  {upcoming[0]
                    ? `${formatLongDate(upcoming[0].bookingDate)} · ${formatTimeRange(upcoming[0].startMinute, upcoming[0].endMinute)}`
                    : "Nothing booked yet"}
                </p>
              </div>
            </div>

            {!customer.isVerified ? (
              <p className="mt-5 text-[13px] leading-relaxed text-brand-200">
                Your booking is held at student pricing while our team confirms your student
                status. This usually only takes a short while.
              </p>
            ) : null}

            <div className="mt-5">
              <ButtonLink href="/book?category=KNUST_STUDENT" size="sm" variant="accent">
                Book a Student Session
              </ButtonLink>
            </div>
          </div>
        ) : null}

        {/* Memberships */}
        {customer?.memberships.length ? (
          <div className="mt-8 space-y-3">
            {customer.memberships.map((membership) => {
              const remaining = Math.max(0, membership.totalMinutes - membership.usedMinutes);
              const percent =
                membership.totalMinutes > 0
                  ? Math.min(
                      100,
                      Math.round((membership.usedMinutes / membership.totalMinutes) * 100),
                    )
                  : 0;

              return (
                <div
                  key={membership.id}
                  className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-semibold text-ink">
                        {membership.packageNameSnapshot ?? "Membership"}
                      </h2>
                      <p className="mt-0.5 text-[13px] text-muted">
                        Valid until {formatLongDate(membership.expiryDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {membership.priorityBooking ? (
                        <Badge tone="accent">Priority booking</Badge>
                      ) : null}
                      <MembershipStatusBadge status={membership.status} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-muted">
                        {formatHours(membership.usedMinutes)} of{" "}
                        {formatHours(membership.totalMinutes)} hours used
                      </span>
                      <span className="font-semibold text-ink">
                        {formatHours(remaining)} hours left
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${percent}% of membership hours used`}
                    >
                      <div className="h-full bg-brand-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Upcoming */}
        <h2 className="font-display mt-12 text-[22px] leading-tight font-semibold text-ink">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<CalendarDays className="size-5" aria-hidden />}
            title="Nothing booked yet"
            description="When you book a session it will show up here."
            action={<ButtonLink href="/book">Book the studio</ButtonLink>}
          />
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ul>
        )}

        {/* Past */}
        {past.length > 0 ? (
          <>
            <h2 className="font-display mt-12 text-[22px] leading-tight font-semibold text-ink">
              Past bookings
            </h2>
            <ul className="mt-4 space-y-3">
              {past.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </ul>
          </>
        ) : null}
      </Container>
    </Section>
  );
}

function BookingRow({
  booking,
}: {
  booking: {
    id: string;
    reference: string;
    bookingDate: Date;
    startMinute: number;
    endMinute: number;
    packageNameSnapshot: string | null;
    totalMinor: number;
    currency: string;
    status: Parameters<typeof BookingStatusBadge>[0]["status"];
    paymentStatus: PaymentStatus;
  };
}) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15.5px] font-semibold text-ink">
            {booking.packageNameSnapshot ?? "Studio session"}
          </p>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            {formatLongDate(booking.bookingDate)} ·{" "}
            {formatTimeRange(booking.startMinute, booking.endMinute)}
          </p>
          <p className="mt-0.5 font-mono text-[12px] text-muted">{booking.reference}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <p className="font-display text-[18px] font-semibold text-ink">
            {formatMoney(booking.totalMinor, booking.currency)}
          </p>
          <div className="flex gap-1.5">
            <BookingStatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
        <ButtonLink href={bookingPath(booking.reference)} size="sm" variant="outline">
          View booking
        </ButtonLink>
        {booking.paymentStatus === PaymentStatus.PAID ? (
          <ButtonLink
            href={`/booking/${encodeURIComponent(booking.reference)}/receipt?t=${bookingAccessToken(booking.reference)}`}
            size="sm"
            variant="ghost"
          >
            <Receipt className="size-4" aria-hidden />
            Receipt
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}
