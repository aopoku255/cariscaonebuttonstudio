import { NextResponse } from "next/server";

import { isPaystackConfigured } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/payments/paystack";
import { settlePaymentByReference } from "@/lib/payments/service";

/**
 * Paystack webhook.
 *
 * This is the authoritative confirmation path: it arrives even if the customer closes
 * the tab on the Paystack checkout page. The handler
 *   1. verifies the HMAC-SHA512 signature over the *raw* body, and
 *   2. ignores the event payload's own amount/status, re-verifying the transaction
 *      against Paystack's API before touching the booking.
 *
 * Point the Paystack dashboard webhook at: <APP_URL>/api/payments/paystack/webhook
 */
export async function POST(request: Request) {
  if (!isPaystackConfigured()) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  // The signature covers the exact bytes Paystack sent, so read the body as text and
  // parse it only after the signature checks out.
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[paystack webhook] rejected a request with an invalid signature");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    // Acknowledge events we do not act on, so Paystack stops retrying them.
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true, ignored: event.event });
  }

  try {
    const result = await settlePaymentByReference(reference);
    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    console.error("[paystack webhook] settlement failed:", error);
    // Return 500 so Paystack retries; the handler is idempotent, so a retry is safe.
    return NextResponse.json({ error: "Could not settle payment." }, { status: 500 });
  }
}
