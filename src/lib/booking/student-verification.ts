import "server-only";

import { StudentVerificationMethod } from "@/generated/prisma/enums";
import type { StudentPolicy } from "@/lib/settings";

/**
 * KNUST student verification.
 *
 * Two paths, chosen by the studio's configured `student.verificationMethod`:
 *   - EMAIL: a booking email ending in the configured KNUST domain verifies instantly.
 *     This is the fast path and needs no staff involvement.
 *   - STUDENT_ID: the customer supplies a student ID reference instead. This cannot be
 *     confirmed automatically, so the caller holds the booking for manual review rather
 *     than granting student pricing on trust alone.
 *   - EITHER: try the email match first, then fall back to the student ID path.
 *
 * A customer who was already verified on an earlier visit stays verified; this module
 * is only consulted for someone verifying for the first time.
 */

export interface StudentVerificationResult {
  verified: boolean;
  method: StudentVerificationMethod | null;
  /** True when the booking may proceed but needs a staff member to confirm the ID. */
  requiresManualReview: boolean;
  /** The email that matched, when verification succeeded by email. */
  matchedKnustEmail: string | null;
  /** Why verification could not proceed, for the customer-facing error. */
  reason?: string;
}

function isKnustEmail(email: string, domain: string): boolean {
  const normalised = email.trim().toLowerCase();
  const suffix = `@${domain.toLowerCase()}`;
  return normalised.endsWith(suffix) && normalised.length > suffix.length;
}

export function resolveStudentVerification(params: {
  /** Already verified from a previous booking; short-circuits straight to success. */
  alreadyVerified: boolean;
  email: string;
  studentIdRef?: string | null;
  policy: StudentPolicy;
}): StudentVerificationResult {
  if (params.alreadyVerified) {
    return {
      verified: true,
      method: null,
      requiresManualReview: false,
      matchedKnustEmail: null,
    };
  }

  const allowsEmail =
    params.policy.verificationMethod === "EMAIL" || params.policy.verificationMethod === "EITHER";
  const allowsStudentId =
    params.policy.verificationMethod === "STUDENT_ID" ||
    params.policy.verificationMethod === "EITHER";

  if (allowsEmail && isKnustEmail(params.email, params.policy.knustEmailDomain)) {
    return {
      verified: true,
      method: StudentVerificationMethod.EMAIL,
      requiresManualReview: false,
      matchedKnustEmail: params.email.trim().toLowerCase(),
    };
  }

  if (allowsStudentId && params.studentIdRef?.trim()) {
    return {
      verified: false,
      method: StudentVerificationMethod.STUDENT_ID,
      requiresManualReview: true,
      matchedKnustEmail: null,
    };
  }

  const instructions =
    params.policy.verificationMethod === "STUDENT_ID"
      ? "Enter your student ID to verify."
      : params.policy.verificationMethod === "EITHER"
        ? `Book with an email ending in @${params.policy.knustEmailDomain}, or enter your student ID to verify.`
        : `Book with your KNUST email address, ending in @${params.policy.knustEmailDomain}, to access student pricing.`;

  return {
    verified: false,
    method: null,
    requiresManualReview: false,
    matchedKnustEmail: null,
    reason: instructions,
  };
}
