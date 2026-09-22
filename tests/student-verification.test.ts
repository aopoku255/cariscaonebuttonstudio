import { describe, expect, it } from "vitest";

import { StudentVerificationMethod } from "@/generated/prisma/enums";
import { resolveStudentVerification } from "@/lib/booking/student-verification";
import type { StudentPolicy } from "@/lib/settings";

/**
 * `resolveStudentVerification` is pure, so these tests pin down the two verification
 * paths exactly: instant email match versus a manual student-ID review that must never
 * grant `verified: true` on the spot.
 */

const EMAIL_POLICY: StudentPolicy = {
  verificationMethod: "EMAIL",
  knustEmailDomain: "knust.edu.gh",
};
const STUDENT_ID_POLICY: StudentPolicy = {
  verificationMethod: "STUDENT_ID",
  knustEmailDomain: "knust.edu.gh",
};
const EITHER_POLICY: StudentPolicy = {
  verificationMethod: "EITHER",
  knustEmailDomain: "knust.edu.gh",
};

describe("resolveStudentVerification", () => {
  it("short-circuits to verified when the customer was already verified", () => {
    const result = resolveStudentVerification({
      alreadyVerified: true,
      email: "not-a-knust-email@example.com",
      studentIdRef: null,
      policy: EMAIL_POLICY,
    });
    expect(result.verified).toBe(true);
    expect(result.requiresManualReview).toBe(false);
  });

  it("verifies instantly on a matching KNUST email", () => {
    const result = resolveStudentVerification({
      alreadyVerified: false,
      email: "Jane.Doe@Knust.Edu.Gh",
      studentIdRef: null,
      policy: EMAIL_POLICY,
    });
    expect(result.verified).toBe(true);
    expect(result.method).toBe(StudentVerificationMethod.EMAIL);
    expect(result.matchedKnustEmail).toBe("jane.doe@knust.edu.gh");
    expect(result.requiresManualReview).toBe(false);
  });

  it("rejects an email-only policy when the email does not match the domain", () => {
    const result = resolveStudentVerification({
      alreadyVerified: false,
      email: "student@gmail.com",
      studentIdRef: null,
      policy: EMAIL_POLICY,
    });
    expect(result.verified).toBe(false);
    expect(result.requiresManualReview).toBe(false);
    expect(result.reason).toMatch(/knust email/i);
  });

  it("does not verify on the bare domain with no local part", () => {
    const result = resolveStudentVerification({
      alreadyVerified: false,
      email: "@knust.edu.gh",
      studentIdRef: null,
      policy: EMAIL_POLICY,
    });
    expect(result.verified).toBe(false);
  });

  it("never verifies a student ID automatically: it always holds for manual review", () => {
    const result = resolveStudentVerification({
      alreadyVerified: false,
      email: "someone@example.com",
      studentIdRef: "UEB1234567",
      policy: STUDENT_ID_POLICY,
    });
    expect(result.verified).toBe(false);
    expect(result.requiresManualReview).toBe(true);
    expect(result.method).toBe(StudentVerificationMethod.STUDENT_ID);
  });

  it("rejects a student-ID policy submission with no ID given", () => {
    const result = resolveStudentVerification({
      alreadyVerified: false,
      email: "someone@example.com",
      studentIdRef: "   ",
      policy: STUDENT_ID_POLICY,
    });
    expect(result.verified).toBe(false);
    expect(result.requiresManualReview).toBe(false);
    expect(result.reason).toMatch(/student id/i);
  });

  it("under EITHER, tries the email match before falling back to student ID review", () => {
    const emailMatch = resolveStudentVerification({
      alreadyVerified: false,
      email: "student@knust.edu.gh",
      studentIdRef: "UEB1234567",
      policy: EITHER_POLICY,
    });
    expect(emailMatch.verified).toBe(true);
    expect(emailMatch.method).toBe(StudentVerificationMethod.EMAIL);

    const idFallback = resolveStudentVerification({
      alreadyVerified: false,
      email: "student@gmail.com",
      studentIdRef: "UEB1234567",
      policy: EITHER_POLICY,
    });
    expect(idFallback.verified).toBe(false);
    expect(idFallback.requiresManualReview).toBe(true);
  });
});
