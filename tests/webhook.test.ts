import { createHmac } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "@/lib/payments/paystack";

/**
 * Paystack signs webhook payloads with HMAC-SHA512 over the raw request body, keyed on
 * the secret key. This is the only thing standing between "someone POSTed to our
 * webhook claiming a payment succeeded" and "Paystack actually told us so": so it
 * gets its own focused tests independent of the network-touching payment tests.
 *
 * `verifyWebhookSignature` reads the configured secret key for any non-null signature,
 * so a placeholder is set for the duration of this file if the environment does not
 * already have real Paystack credentials. Nothing here makes a network call.
 */

const SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder_for_signature_tests";

beforeAll(() => {
  // `.env` sets this to an empty string rather than leaving it unset, so `??=` would
  // not override it: check falsiness instead.
  if (!process.env.PAYSTACK_SECRET_KEY) {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  }
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha512", secret).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123" } });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a missing signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(verifyWebhookSignature(body, null)).toBe(false);
  });

  it("rejects an empty signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123" } });
    const badSignature = sign(body, "sk_test_a_completely_different_secret");
    expect(verifyWebhookSignature(body, badSignature)).toBe(false);
  });

  it("rejects a signature for a body that was tampered with after signing", () => {
    const originalBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "abc123", amount: 55000 },
    });
    const signature = sign(originalBody);

    // Attacker changes the amount after the signature was computed.
    const tamperedBody = JSON.stringify({
      event: "charge.success",
      data: { reference: "abc123", amount: 1 },
    });

    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects a well-formed but garbage signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    expect(verifyWebhookSignature(body, "not-a-real-signature")).toBe(false);
  });

  it("is not vulnerable to a signature of different length short-circuiting unsafely", () => {
    const body = JSON.stringify({ event: "charge.success" });
    // Deliberately wrong lengths: must return false, not throw.
    expect(() => verifyWebhookSignature(body, "ab")).not.toThrow();
    expect(verifyWebhookSignature(body, "ab")).toBe(false);
    expect(() => verifyWebhookSignature(body, "a".repeat(500))).not.toThrow();
    expect(verifyWebhookSignature(body, "a".repeat(500))).toBe(false);
  });
});
