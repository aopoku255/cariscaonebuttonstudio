import "server-only";

import {
  BookingStatus,
  MembershipStatus,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  addDays,
  formatMinuteOfDay12,
  studioToday,
  toDateKey,
} from "@/lib/booking/time";

/**
 * Dashboard analytics.
 *
 * Aggregation is done in JavaScript over a bounded date range rather than in raw SQL.
 * At studio scale (hundreds of bookings a month, not millions) this is comfortably
 * fast, and it keeps the queries portable and readable. If the dataset ever outgrows
 * it, these functions are the only place that needs rewriting.
 */

/** Statuses that represent a real, revenue-bearing booking. */
const LIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.PENDING_APPROVAL,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
];

export interface DashboardStats {
  todayBookings: number;
  upcomingBookings: number;
  totalBookings: number;
  revenueMinor: number;
  revenueThisMonthMinor: number;
  pendingPaymentsCount: number;
  pendingPaymentsMinor: number;
  activeMemberships: number;
  totalCustomers: number;
  averageBookingValueMinor: number;
  newInquiries: number;
  repeatCustomers: number;
}

export async function getDashboardStats(now: Date = new Date()): Promise<DashboardStats> {
  const today = studioToday(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    todayBookings,
    upcomingBookings,
    totalBookings,
    revenue,
    revenueThisMonth,
    pendingPayments,
    activeMemberships,
    totalCustomers,
    paidAggregate,
    newInquiries,
    repeatGroups,
  ] = await Promise.all([
    prisma.booking.count({
      where: { bookingDate: today, status: { in: LIVE_STATUSES } },
    }),
    prisma.booking.count({
      where: {
        startsAt: { gte: now },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_APPROVAL] },
      },
    }),
    prisma.booking.count(),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID },
      _sum: { amountMinor: true },
    }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID, paidAt: { gte: monthStart } },
      _sum: { amountMinor: true },
    }),
    prisma.booking.aggregate({
      where: {
        paymentStatus: PaymentStatus.PENDING,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
      },
      _count: true,
      _sum: { totalMinor: true },
    }),
    prisma.membership.count({
      where: { status: MembershipStatus.ACTIVE, expiryDate: { gte: now } },
    }),
    prisma.customer.count(),
    prisma.booking.aggregate({
      where: { paymentStatus: PaymentStatus.PAID },
      _avg: { totalMinor: true },
    }),
    prisma.corporateInquiry.count({ where: { status: "NEW" } }),
    prisma.booking.groupBy({
      by: ["customerId"],
      where: { status: { in: LIVE_STATUSES } },
      _count: { customerId: true },
    }),
  ]);

  return {
    todayBookings,
    upcomingBookings,
    totalBookings,
    revenueMinor: revenue._sum.amountMinor ?? 0,
    revenueThisMonthMinor: revenueThisMonth._sum.amountMinor ?? 0,
    pendingPaymentsCount: pendingPayments._count,
    pendingPaymentsMinor: pendingPayments._sum.totalMinor ?? 0,
    activeMemberships,
    totalCustomers,
    averageBookingValueMinor: Math.round(paidAggregate._avg.totalMinor ?? 0),
    newInquiries,
    repeatCustomers: repeatGroups.filter((group) => group._count.customerId > 1).length,
  };
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  revenue: number;
  bookings: number;
}

/** Revenue and booking counts per day over the last `days` days. */
export async function getTimeSeries(
  days = 30,
  now: Date = new Date(),
): Promise<TimeSeriesPoint[]> {
  const today = studioToday(now);
  const from = addDays(today, -(days - 1));

  const [payments, bookings] = await Promise.all([
    prisma.payment.findMany({
      where: { status: PaymentStatus.PAID, paidAt: { gte: from } },
      select: { amountMinor: true, paidAt: true },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: from } },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, TimeSeriesPoint>();
  for (let index = 0; index < days; index += 1) {
    const date = addDays(from, index);
    const key = toDateKey(date);
    buckets.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date),
      revenue: 0,
      bookings: 0,
    });
  }

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const bucket = buckets.get(toDateKey(payment.paidAt));
    // Chart values are in major units so the axis reads in cedis.
    if (bucket) bucket.revenue += payment.amountMinor / 100;
  }

  for (const booking of bookings) {
    const bucket = buckets.get(toDateKey(booking.createdAt));
    if (bucket) bucket.bookings += 1;
  }

  return [...buckets.values()];
}

export interface NamedCount {
  name: string;
  value: number;
  revenue?: number;
}

/** Most-booked packages, by number of live bookings. */
export async function getPopularPackages(limit = 6): Promise<NamedCount[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["packageNameSnapshot"],
    where: { status: { in: LIVE_STATUSES } },
    _count: { _all: true },
    _sum: { totalMinor: true },
  });

  return grouped
    .map((row) => ({
      name: row.packageNameSnapshot ?? "Other",
      value: row._count._all,
      revenue: Math.round((row._sum.totalMinor ?? 0) / 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Most-selected add-ons. */
export async function getPopularAddOns(limit = 6): Promise<NamedCount[]> {
  const grouped = await prisma.bookingAddOn.groupBy({
    by: ["nameSnapshot"],
    _count: { _all: true },
    _sum: { lineTotalMinor: true },
  });

  return grouped
    .map((row) => ({
      name: row.nameSnapshot,
      value: row._count._all,
      revenue: Math.round((row._sum.lineTotalMinor ?? 0) / 100),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Booking counts by customer category. */
export async function getCustomerTypeBreakdown(): Promise<NamedCount[]> {
  const grouped = await prisma.customer.groupBy({
    by: ["userType"],
    _count: { _all: true },
  });

  const labels: Record<string, string> = {
    STUDENT: "Students",
    RESEARCHER: "Researchers",
    CREATOR: "Creators",
    STARTUP: "Startups",
    BUSINESS: "Businesses",
    NGO: "NGOs",
    CORPORATE: "Corporate",
    OTHER: "Other",
  };

  return grouped
    .map((row) => ({ name: labels[row.userType] ?? row.userType, value: row._count._all }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Booking counts by payment status. */
export async function getPaymentStatusBreakdown(): Promise<NamedCount[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["paymentStatus"],
    _count: { _all: true },
  });

  const labels: Record<string, string> = {
    PENDING: "Pending",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
  };

  return grouped.map((row) => ({
    name: labels[row.paymentStatus] ?? row.paymentStatus,
    value: row._count._all,
  }));
}

/** Which start times get booked most: used to spot peak demand. */
export async function getPeakTimes(): Promise<NamedCount[]> {
  const grouped = await prisma.booking.groupBy({
    by: ["startMinute"],
    where: { status: { in: LIVE_STATUSES } },
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({
      name: formatMinuteOfDay12(row.startMinute),
      value: row._count._all,
      sortKey: row.startMinute,
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ name, value }) => ({ name, value }));
}

/** Total minutes granted vs consumed across active memberships. */
export async function getMembershipUsage() {
  const memberships = await prisma.membership.findMany({
    where: { status: MembershipStatus.ACTIVE },
    select: { totalMinutes: true, usedMinutes: true },
  });

  const totalMinutes = memberships.reduce((sum, m) => sum + m.totalMinutes, 0);
  const usedMinutes = memberships.reduce((sum, m) => sum + m.usedMinutes, 0);

  return {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    usedHours: Math.round((usedMinutes / 60) * 10) / 10,
    remainingHours: Math.round(((totalMinutes - usedMinutes) / 60) * 10) / 10,
    utilisationPercent:
      totalMinutes > 0 ? Math.round((usedMinutes / totalMinutes) * 100) : 0,
  };
}

/** The next few sessions, for the dashboard's "coming up" list. */
export async function getUpcomingBookings(limit = 6, now: Date = new Date()) {
  return prisma.booking.findMany({
    where: {
      startsAt: { gte: now },
      status: {
        in: [
          BookingStatus.CONFIRMED,
          BookingStatus.PENDING_APPROVAL,
          BookingStatus.PENDING_PAYMENT,
        ],
      },
    },
    include: { customer: { select: { name: true, organisation: true } } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

/** Most recent bookings, whatever their status. */
export async function getRecentBookings(limit = 6) {
  return prisma.booking.findMany({
    include: { customer: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
