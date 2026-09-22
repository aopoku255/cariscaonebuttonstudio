import { NextResponse } from "next/server";

import { clientIp } from "@/lib/audit";
import { BookingError, quoteBooking } from "@/lib/booking/service";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { quoteRequestSchema } from "@/lib/validation/booking";

/**
 * Live pricing for the booking summary.
 *
 * This returns exactly what `createBooking` would charge, computed from the same
 * database rows, so the figure on screen and the figure sent to Paystack cannot drift.
 * The request carries no prices: only which package and add-ons are selected.
 */
export async function POST(request: Request) {
  const limit = rateLimit(`quote:${await clientIp()}`, RATE_LIMITS.quote);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": `${limit.retryAfterSeconds}` } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quote request." }, { status: 400 });
  }

  try {
    const quote = await quoteBooking({
      packageId: parsed.data.packageId,
      addOns: parsed.data.addOns,
      customerType: parsed.data.userType,
      customerEmail: parsed.data.email,
      useMembership: parsed.data.useMembership,
    });

    return NextResponse.json({ quote }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[quote] failed:", error);
    return NextResponse.json(
      { error: "We could not price that booking. Please try again." },
      { status: 500 },
    );
  }
}
