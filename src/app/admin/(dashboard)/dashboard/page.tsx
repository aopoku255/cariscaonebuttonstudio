import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Inbox,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import {
  BookingsChart,
  RankedBarChart,
  RevenueChart,
  STATUS_COLORS,
} from "@/components/admin/charts";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAdminPage } from "@/lib/auth/guard";
import { roleHas } from "@/lib/auth/permissions";
import { formatLongDate, formatTimeRange } from "@/lib/booking/time";
import {
  getCustomerTypeBreakdown,
  getDashboardStats,
  getMembershipUsage,
  getPaymentStatusBreakdown,
  getPeakTimes,
  getPopularAddOns,
  getPopularPackages,
  getTimeSeries,
  getUpcomingBookings,
} from "@/lib/queries/analytics";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage("bookings:read");
  const canSeeMoney = roleHas(admin.role, "payments:read");

  const [
    stats,
    series,
    packages,
    addOns,
    customerTypes,
    paymentStatuses,
    peakTimes,
    membershipUsage,
    upcoming,
  ] = await Promise.all([
    getDashboardStats(),
    getTimeSeries(30),
    getPopularPackages(),
    getPopularAddOns(),
    getCustomerTypeBreakdown(),
    getPaymentStatusBreakdown(),
    getPeakTimes(),
    getMembershipUsage(),
    getUpcomingBookings(6),
  ]);

  const firstName = admin.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="Here is how the studio is doing right now."
        action={
          <>
            <ButtonLink href="/admin/bookings/new" size="sm">
              New booking
            </ButtonLink>
            <ButtonLink href="/admin/calendar" size="sm" variant="outline">
              Open calendar
            </ButtonLink>
          </>
        }
      />

      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's bookings"
          value={String(stats.todayBookings)}
          hint="Sessions scheduled for today"
          icon={CalendarDays}
          href="/admin/calendar"
        />
        <StatCard
          label="Upcoming"
          value={String(stats.upcomingBookings)}
          hint="Confirmed sessions still to come"
          icon={CalendarClock}
          href="/admin/bookings?status=CONFIRMED"
        />
        <StatCard
          label="Total bookings"
          value={String(stats.totalBookings)}
          hint="All time, every status"
          icon={ClipboardList}
          href="/admin/bookings"
        />
        <StatCard
          label="Customers"
          value={String(stats.totalCustomers)}
          hint={`${stats.repeatCustomers} have booked more than once`}
          icon={Users}
          href="/admin/customers"
        />

        {canSeeMoney ? (
          <>
            <StatCard
              label="Revenue (all time)"
              value={formatMoney(stats.revenueMinor)}
              hint={`${formatMoney(stats.revenueThisMonthMinor)} this month`}
              icon={TrendingUp}
              tone="accent"
              href="/admin/payments"
            />
            <StatCard
              label="Average booking"
              value={formatMoney(stats.averageBookingValueMinor)}
              hint="Across paid bookings"
              icon={Wallet}
              tone="accent"
            />
            <StatCard
              label="Pending payments"
              value={String(stats.pendingPaymentsCount)}
              hint={`${formatMoney(stats.pendingPaymentsMinor)} outstanding`}
              icon={Wallet}
              tone={stats.pendingPaymentsCount > 0 ? "warning" : "default"}
              href="/admin/payments?status=PENDING"
            />
          </>
        ) : null}

        <StatCard
          label="Active memberships"
          value={String(stats.activeMemberships)}
          hint={`${membershipUsage.remainingHours} hours still available`}
          icon={BadgeCheck}
          href="/admin/memberships"
        />

        {stats.newInquiries > 0 ? (
          <StatCard
            label="New enquiries"
            value={String(stats.newInquiries)}
            hint="Corporate package requests waiting"
            icon={Inbox}
            tone="warning"
            href="/admin/inquiries"
          />
        ) : null}
      </div>

      {/* Charts: revenue and bookings are separate frames, never a dual axis. */}
      {canSeeMoney ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <RevenueChart data={series} />
          <BookingsChart data={series} />
        </div>
      ) : (
        <div className="mt-6">
          <BookingsChart data={series} />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RankedBarChart
          title="Most popular packages"
          description="By number of live bookings."
          data={packages}
          emptyMessage="No bookings yet: this fills in as soon as the first session is booked."
        />
        <RankedBarChart
          title="Payment status"
          description="Every booking, by where its payment stands."
          data={paymentStatuses}
          unit="bookings"
          colorByName={STATUS_COLORS}
          emptyMessage="No bookings yet."
        />
        <RankedBarChart
          title="Customer categories"
          description="Who books the studio."
          data={customerTypes}
          unit="customers"
          emptyMessage="No customers yet."
        />
        <RankedBarChart
          title="Most popular add-ons"
          description="Production services chosen at checkout."
          data={addOns}
          unit="times added"
          emptyMessage="No add-ons booked yet."
        />
        <RankedBarChart
          title="Peak booking times"
          description="Which start times get booked most often."
          data={peakTimes}
          unit="bookings"
          emptyMessage="No bookings yet."
        />

        {/* Coming up */}
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-[14.5px] font-semibold text-ink">Coming up</h3>
            <Link
              href="/admin/bookings"
              className="text-[12.5px] font-semibold text-brand-700 underline underline-offset-4"
            >
              All bookings
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              description="There are no upcoming sessions on the calendar."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((booking) => (
                <li key={booking.id}>
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="-mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-paper"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-ink">
                        {booking.customer.name}
                        {booking.customer.organisation ? (
                          <span className="font-normal text-muted">
                            {" "}
                            · {booking.customer.organisation}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {formatLongDate(booking.bookingDate)} ·{" "}
                        {formatTimeRange(booking.startMinute, booking.endMinute)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {booking.packageNameSnapshot}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <BookingStatusBadge status={booking.status} />
                      <PaymentStatusBadge status={booking.paymentStatus} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
