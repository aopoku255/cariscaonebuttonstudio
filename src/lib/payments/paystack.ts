import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Thin, typed wrapper over the Paystack REST API.
 *
 * The secret key is read here and nowhere else, and never leaves the server. Only the
 * public key is ever exposed to the browser, and even that is not required for the
 * redirect checkout flow this app uses.
 */

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyResponse {
  id: number;
  status: string;
  reference: string;
  /** Amount in minor units (pesewas for GHS). */
  amount: number;
  currency: string;
  channel: string | null;
  paid_at: string | null;
  gateway_response: string | null;
  customer: { email: string } | null;
  metadata: unknown;
}

async function paystackFetch<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${serverEnv.paystackSecretKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      // Payment calls must never be served from a cache.
      cache: "no-store",
    });
  } catch (error) {
    throw new PaystackError(
      `Could not reach Paystack: ${error instanceof Error ? error.message : "network error"}`,
    );
  }

  let payload: PaystackEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as PaystackEnvelope<T>;
  } catch {
    throw new PaystackError(
      `Paystack returned an unreadable response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (!response.ok || !payload.status) {
    throw new PaystackError(
      payload?.message || `Paystack request failed (HTTP ${response.status}).`,
      response.status,
    );
  }

  return payload.data;
}

export interface InitializeParams {
  email: string;
  /** Amount in minor units. Always computed from database values, never from the client. */
  amountMinor: number;
  reference: string;
  callbackUrl: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export async function initializeTransaction(
  params: InitializeParams,
): Promise<InitializeResponse> {
  return paystackFetch<InitializeResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      reference: params.reference,
      callback_url: params.callbackUrl,
      currency: params.currency ?? "GHS",
      // The methods Paystack offers Ghanaian customers.
      channels: ["card", "mobile_money", "bank_transfer"],
      metadata: params.metadata ?? {},
    }),
  });
}

/** Ask Paystack what actually happened. This is the only thing we trust. */
export async function verifyTransaction(reference: string): Promise<VerifyResponse> {
  return paystackFetch<VerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

/**
 * Validate the `x-paystack-signature` header against the raw request body.
 * Paystack signs webhook payloads with HMAC-SHA512 keyed on the secret key.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac("sha512", serverEnv.paystackSecretKey)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
