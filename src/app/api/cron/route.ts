import { NextResponse } from "next/server";

import { expireLapsedMemberships } from "@/app/admin/(dashboard)/memberships/actions";
import { pruneExpiredSessions, safeEqual } from "@/lib/auth/session";
import { expireStalePendingBookings } from "@/lib/booking/service";
import { sendDueReminders } from "@/lib/email/notifications";
import { serverEnv } from "@/lib/env";

/**
 * Scheduled maintenance.
 *
 * Call this once every few minutes from your host's scheduler:
 *   POST /api/cron  with  Authorization: Bearer <CRON_SECRET>
 *
 * It does four things, all of them safe to repeat:
 *   1. Releases unpaid bookings whose hold has timed out, freeing the slot.
 *   2. Sends reminders for sessions inside the configured window.
 *   3. Marks lapsed memberships as expired. Nothing is ever auto-renewed.
 *   4. Deletes expired session rows.
 */
export async function POST(request: Request) {
  const secret = serverEnv.cronSecret;

  // Without a configured secret the endpoint stays closed rather than open.
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured, so scheduled jobs are disabled." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const startedAt = Date.now();

  const [expiredBookings, reminders, expiredMemberships] = await Promise.all([
    expireStalePendingBookings(),
    sendDueReminders(),
    expireLapsedMemberships(),
  ]);

  await pruneExpiredSessions();

  return NextResponse.json(
    {
      ok: true,
      expiredBookings,
      remindersSent: reminders,
      expiredMemberships,
      durationMs: Date.now() - startedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** A GET returns the same 401/503 so a misconfigured scheduler fails loudly. */
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with an Authorization: Bearer <CRON_SECRET> header." },
    { status: 405 },
  );
}
