import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Booking references are human-readable and sequential (`CAR-STU-20260922-001`), which
 * is exactly what you want when reading one out over the phone: and exactly what you
 * do not want as the only thing guarding a customer's personal details.
 *
 * So every booking link carries a short token derived from the reference and the
 * server's session secret. Without a valid token (or a signed-in customer who owns the
 * booking), the page asks for the email address on the booking instead of showing it.
 */

export function bookingAccessToken(reference: string): string {
  return createHmac("sha256", serverEnv.sessionSecret)
    .update(`booking:${reference}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyBookingAccessToken(
  reference: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const expected = bookingAccessToken(reference);
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(token);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

/** Canonical customer-facing link for a booking, including its access token. */
export function bookingPath(reference: string): string {
  return `/booking/${encodeURIComponent(reference)}?t=${bookingAccessToken(reference)}`;
}
