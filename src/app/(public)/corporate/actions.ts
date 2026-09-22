"use server";

import { clientIp } from "@/lib/audit";
import { parseDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { notifyCorporateInquiry } from "@/lib/email/notifications";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { corporateInquirySchema } from "@/lib/validation/booking";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Corporate package request.
 *
 * Rate limited per IP, because this is an unauthenticated form that sends email.
 */
export async function submitCorporateInquiry(payload: unknown): Promise<ActionResult> {
  const limit = rateLimit(`corporate:${await clientIp()}`, RATE_LIMITS.corporateInquiry);
  if (!limit.ok) {
    return actionError(
      "We have already received a few requests from you. Please email the studio directly instead.",
    );
  }

  const parsed = corporateInquirySchema.safeParse(payload);
  if (!parsed.success) {
    return actionError(
      "Please check the highlighted fields and try again.",
      fieldErrors(parsed.error),
    );
  }

  const inquiry = await prisma.corporateInquiry.create({
    data: {
      organisation: parsed.data.organisation,
      contactName: parsed.data.contactName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      sessionsRequired: parsed.data.sessionsRequired ?? null,
      estimatedHours: parsed.data.estimatedHours ?? null,
      contentType: parsed.data.contentType ?? null,
      preferredStartDate: parsed.data.preferredStartDate
        ? parseDateKey(parsed.data.preferredStartDate)
        : null,
      requirements: parsed.data.requirements ?? null,
    },
  });

  await notifyCorporateInquiry(inquiry.id);

  return actionOk(
    undefined,
    "Thanks: we have your request and will come back to you within two working days.",
  );
}
