import type { Metadata } from "next";
import { Inbox } from "lucide-react";

import { InquiriesManager } from "@/components/admin/inquiries-manager";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/feedback";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Corporate enquiries",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  await requireAdminPage("inquiries:manage");

  const inquiries = await prisma.corporateInquiry.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="Corporate enquiries"
        description="Organisations asking about a custom studio package."
      />

      {inquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" aria-hidden />}
          title="No enquiries yet"
          description="Requests from the Corporate & Institutional form on the website land here."
        />
      ) : (
        <InquiriesManager
          inquiries={inquiries.map((inquiry) => ({
            id: inquiry.id,
            organisation: inquiry.organisation,
            contactName: inquiry.contactName,
            email: inquiry.email,
            phone: inquiry.phone,
            sessionsRequired: inquiry.sessionsRequired,
            estimatedHours: inquiry.estimatedHours,
            contentType: inquiry.contentType,
            preferredStartDate: inquiry.preferredStartDate
              ? inquiry.preferredStartDate.toISOString().slice(0, 10)
              : null,
            requirements: inquiry.requirements,
            status: inquiry.status,
            adminNotes: inquiry.adminNotes,
            createdAt: inquiry.createdAt.toISOString(),
          }))}
        />
      )}
    </>
  );
}
