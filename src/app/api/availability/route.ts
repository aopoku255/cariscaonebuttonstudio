import { NextResponse } from "next/server";

import { getDayAvailability, getRangeAvailability } from "@/lib/booking/availability";
import { expireStalePendingBookings } from "@/lib/booking/service";
import { prisma } from "@/lib/db";
import { clientIp } from "@/lib/audit";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { availabilityQuerySchema } from "@/lib/validation/booking";

/**
 * Availability lookup for the booking calendar.
 *
 * `GET /api/availability?date=2026-09-22&packageId=…`        → slots for one day
 * `GET /api/availability?date=2026-09-22&days=42&packageId=…` → day statuses for a range
 *
 * The duration is derived from the package on the server; a caller cannot widen or
 * narrow the window it is checking against.
 */
export async function GET(request: Request) {
  const limit = rateLimit(`availability:${await clientIp()}`, RATE_LIMITS.availability);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": `${limit.retryAfterSeconds}` } },
    );
  }

  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    date: url.searchParams.get("date") ?? "",
    packageId: url.searchParams.get("packageId") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid availability query." }, { status: 400 });
  }

  // Free any holds that have timed out before reporting what is available, so a
  // customer never sees a slot blocked by an abandoned checkout.
  await expireStalePendingBookings();

  let durationMinutes = 60;
  if (parsed.data.packageId) {
    const pkg = await prisma.package.findUnique({
      where: { id: parsed.data.packageId },
      select: { durationMinutes: true, isActive: true },
    });
    if (!pkg || !pkg.isActive) {
      return NextResponse.json({ error: "That package is not available." }, { status: 404 });
    }
    durationMinutes = pkg.durationMinutes;
  }

  if (parsed.data.days) {
    const days = await getRangeAvailability(
      parsed.data.date,
      parsed.data.days,
      durationMinutes,
    );
    return NextResponse.json({ durationMinutes, days }, { headers: noStore });
  }

  const day = await getDayAvailability(parsed.data.date, durationMinutes);
  return NextResponse.json({ durationMinutes, day }, { headers: noStore });
}

const noStore = { "Cache-Control": "no-store" } as const;
