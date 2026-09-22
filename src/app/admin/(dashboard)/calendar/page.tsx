import type { Metadata } from "next";

import { AdminCalendar } from "@/components/admin/admin-calendar";
import { PageHeader } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { BookingStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import {
  addDays,
  formatMinuteOfDay24,
  parseDateKey,
  studioToday,
  toDateKey,
} from "@/lib/booking/time";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: PageProps<"/admin/calendar">) {
  await requireAdminPage("bookings:read");
  const params = await searchParams;

  // The month being viewed, defaulting to the current one.
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const today = studioToday();
  const anchor =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? new Date(Date.UTC(Number(monthParam.slice(0, 4)), Number(monthParam.slice(5, 7)) - 1, 1))
      : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const monthStart = anchor;
  const monthEnd = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  );

  const [bookings, blockedDates, blockedTimes, operatingHours] = await Promise.all([
    prisma.booking.findMany({
      where: {
        bookingDate: { gte: monthStart, lte: monthEnd },
        status: { not: BookingStatus.CANCELLED },
      },
      include: { customer: { select: { name: true } } },
      orderBy: [{ bookingDate: "asc" }, { startMinute: "asc" }],
    }),
    prisma.blockedDate.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.blockedTime.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.operatingHour.findMany(),
  ]);

  const closedDays = new Set(
    operatingHours.filter((row) => !row.isOpen).map((row) => row.dayOfWeek),
  );

  const previousMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1),
  );
  const nextMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  const monthKey = (date: Date) =>
    `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Every session this month, alongside the days and times the studio is closed or blocked."
        action={
          <>
            <ButtonLink href={`/admin/calendar?month=${monthKey(previousMonth)}`} size="sm" variant="outline">
              Previous
            </ButtonLink>
            <ButtonLink href="/admin/calendar" size="sm" variant="outline">
              Today
            </ButtonLink>
            <ButtonLink href={`/admin/calendar?month=${monthKey(nextMonth)}`} size="sm" variant="outline">
              Next
            </ButtonLink>
            <ButtonLink href="/admin/bookings/new" size="sm">
              New booking
            </ButtonLink>
          </>
        }
      />

      <AdminCalendar
        year={anchor.getUTCFullYear()}
        month={anchor.getUTCMonth()}
        todayKey={toDateKey(today)}
        closedDaysOfWeek={[...closedDays]}
        bookings={bookings.map((booking) => ({
          id: booking.id,
          dateKey: toDateKey(booking.bookingDate),
          reference: booking.reference,
          customerName: booking.customer.name,
          packageName: booking.packageNameSnapshot ?? "Session",
          startTime: formatMinuteOfDay24(booking.startMinute),
          endTime: formatMinuteOfDay24(booking.endMinute),
          status: booking.status,
        }))}
        blockedDates={blockedDates.map((entry) => ({
          dateKey: toDateKey(entry.date),
          reason: entry.reason,
          type: entry.type,
        }))}
        blockedTimes={blockedTimes.map((entry) => ({
          dateKey: toDateKey(entry.date),
          startTime: formatMinuteOfDay24(entry.startMinute),
          endTime: formatMinuteOfDay24(entry.endMinute),
          reason: entry.reason,
        }))}
        nextDayKey={toDateKey(addDays(parseDateKey(toDateKey(today))!, 1))}
      />
    </>
  );
}
