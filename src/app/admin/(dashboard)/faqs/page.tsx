import type { Metadata } from "next";

import { FaqsManager } from "@/components/admin/faqs-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "FAQs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  await requireAdminPage("faqs:manage");

  const faqs = await prisma.faq.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Questions shown on the homepage and the FAQ page. They are also published as structured data, so they can appear directly in search results."
      />
      <FaqsManager
        faqs={faqs.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          sortOrder: faq.sortOrder,
          isActive: faq.isActive,
        }))}
      />
    </>
  );
}
