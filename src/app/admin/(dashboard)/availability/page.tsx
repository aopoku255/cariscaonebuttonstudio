import type { Metadata } from "next";

import { AvailabilityManager } from "@/components/admin/availability-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import {
  WEEKDAY_NAMES,
  formatMinuteOfDay24,
  studioToday,
  toDateKey,
} from "@/lib/booking/time";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Availability",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAvailabilityPage() {
  await requireAdminPage("availability:manage");

  const today = studioToday();

  const [hours, blockedDates, blockedTimes] = await Promise.all([
    prisma.operatingHour.findMany({ orderBy: { dayOfWeek: "asc" } }),
    prisma.blockedDate.findMany({
      where: { date: { gte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.blockedTime.findMany({
      where: { date: { gte: today } },
      orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    }),
  ]);

  // Always render all seven days, defaulting anything not yet configured.
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const row = hours.find((entry) => entry.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      name: WEEKDAY_NAMES[dayOfWeek],
      isOpen: row?.isOpen ?? false,
      open: formatMinuteOfDay24(row?.openMinute ?? 8 * 60),
      close: formatMinuteOfDay24(row?.closeMinute ?? 18 * 60),
    };
  });

  return (
    <>
      <PageHeader
        title="Availability"
        description="Opening hours decide which slots the booking calendar offers. Blocks take specific dates and times off the calendar without touching bookings already made."
      />

      <AvailabilityManager
        days={days}
        blockedDates={blockedDates.map((entry) => ({
          id: entry.id,
          date: toDateKey(entry.date),
          reason: entry.reason,
          type: entry.type,
        }))}
        blockedTimes={blockedTimes.map((entry) => ({
          id: entry.id,
          date: toDateKey(entry.date),
          start: formatMinuteOfDay24(entry.startMinute),
          end: formatMinuteOfDay24(entry.endMinute),
          reason: entry.reason,
          type: entry.type,
        }))}
      />
    </>
  );
}
