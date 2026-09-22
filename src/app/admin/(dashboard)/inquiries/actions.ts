"use server";

import { revalidatePath } from "next/cache";

import type { InquiryStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { inquiryUpdateSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

export async function updateInquiry(payload: unknown): Promise<ActionResult> {
  const admin = await requireAdmin("inquiries:manage");

  const parsed = inquiryUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const inquiry = await prisma.corporateInquiry.update({
    where: { id: parsed.data.inquiryId },
    data: {
      status: parsed.data.status as InquiryStatus,
      adminNotes: parsed.data.adminNotes ?? null,
    },
  });

  await recordAudit(admin, {
    action: "inquiry.update",
    entity: "CorporateInquiry",
    entityId: inquiry.id,
    summary: `Set ${inquiry.organisation}'s enquiry to ${inquiry.status}`,
  });

  revalidatePath("/admin/inquiries");
  revalidatePath("/admin/dashboard");

  return actionOk(undefined, "Enquiry updated.");
}
