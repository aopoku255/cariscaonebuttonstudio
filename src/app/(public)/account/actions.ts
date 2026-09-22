"use server";

import { clientIp } from "@/lib/audit";
import { checkPasswordStrength, fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createCustomerSession,
  destroyCustomerSession,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation/common";
import { type ActionResult, actionError, actionOk } from "@/lib/validation/common";

/**
 * Customer accounts.
 *
 * Accounts are optional: guests book without one. A customer row already exists for
 * anyone who has booked, so "signing up" really means claiming that row by setting a
 * password on it.
 */

export async function claimAccount(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const limit = rateLimit(`claim:${await clientIp()}`, RATE_LIMITS.customerLogin);
  if (!limit.ok) {
    return actionError("Too many attempts. Please wait a few minutes and try again.");
  }

  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) {
    return actionError("Enter a valid email address.", { email: "Enter a valid email" });
  }

  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) {
    const message = strength.message ?? "Choose a stronger password.";
    return actionError(message, { password: message });
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsedEmail.data } });

  // Same message either way, so this cannot be used to discover who has booked.
  if (!customer) {
    await fakeVerify();
    return actionError(
      "We could not find a booking with that email address. Book a session first, then you can set up an account with the same address.",
    );
  }

  if (customer.passwordHash) {
    return actionError("That email already has an account. Sign in instead.");
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash: await hashPassword(input.password) },
  });

  await createCustomerSession(customer.id);
  return actionOk(undefined, "Your account is set up.");
}

export async function signInCustomer(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const limit = rateLimit(`customer-login:${await clientIp()}`, RATE_LIMITS.customerLogin);
  if (!limit.ok) {
    return actionError("Too many sign-in attempts. Please wait a few minutes.");
  }

  const parsedEmail = emailSchema.safeParse(input.email);
  if (!parsedEmail.success) {
    await fakeVerify();
    return actionError("Those details did not match an account.");
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsedEmail.data } });

  if (!customer?.passwordHash) {
    await fakeVerify();
    return actionError("Those details did not match an account.");
  }

  const valid = await verifyPassword(input.password, customer.passwordHash);
  if (!valid) {
    return actionError("Those details did not match an account.");
  }

  await createCustomerSession(customer.id);
  return actionOk(undefined, "Signed in.");
}

export async function signOutCustomer(): Promise<void> {
  await destroyCustomerSession();
}
