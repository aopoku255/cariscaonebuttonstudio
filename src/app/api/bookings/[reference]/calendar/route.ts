import { NextResponse } from "next/server";

import { verifyBookingAccessToken } from "@/lib/booking/access";
import { toIcsTimestamp } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { formatDuration } from "@/lib/utils";

/**
 * "Add to Calendar": serves the booking as an .ics file that every major calendar
 * app understands. Requires the same signed token as the booking page.
 */
export async function GET(
  request: Request,
  context: RouteContext<"/api/bookings/[reference]/calendar">,
) {
  const { reference } = await context.params;
  const decoded = decodeURIComponent(reference);
  const token = new URL(request.url).searchParams.get("t");

  if (!verifyBookingAccessToken(decoded, token)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { reference: decoded },
      include: { addOns: true },
    }),
    getSettings(),
  ]);

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const studioName = settings["studio.name"];
  const location = settings["studio.location"];

  const descriptionLines = [
    `Booking reference: ${booking.reference}`,
    `Package: ${booking.packageNameSnapshot ?? "Studio session"}`,
    `Duration: ${formatDuration(booking.durationMinutes)}`,
  ];
  if (booking.addOns.length) {
    descriptionLines.push(
      `Add-ons: ${booking.addOns.map((a) => a.nameSnapshot).join(", ")}`,
    );
  }
  descriptionLines.push("Please arrive about ten minutes early.");

  // RFC 5545 escaping: backslash, semicolon, comma and newline.
  const escape = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//One Button Studio//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.reference}@carisca-studio`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART:${toIcsTimestamp(booking.startsAt)}`,
    `DTEND:${toIcsTimestamp(booking.endsAt)}`,
    `SUMMARY:${escape(`${studioName}: ${booking.packageNameSnapshot ?? "Studio session"}`)}`,
    `DESCRIPTION:${escape(descriptionLines.join("\n"))}`,
    `LOCATION:${escape(location)}`,
    `URL:${appUrl()}/booking/${encodeURIComponent(booking.reference)}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`${studioName} session in 1 hour`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.reference}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
