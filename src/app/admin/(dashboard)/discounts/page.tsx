import type { Metadata } from "next";

import { DiscountsManager } from "@/components/admin/discounts-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Discounts",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDiscountsPage() {
  await requireAdminPage("discounts:manage");

  const [rules, packages] = await Promise.all([
    prisma.discountRule.findMany({
      include: { packages: { select: { packageId: true } } },
      orderBy: [{ isActive: "desc" }, { percentOff: "desc" }],
    }),
    prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Configurable pricing categories: student and researcher rates and anything like them. The booking engine applies whichever active discount is worth most to the customer."
      />

      <DiscountsManager
        rules={rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          percentOff: rule.percentOff,
          eligibleUserTypes: rule.eligibleUserTypes
            ? rule.eligibleUserTypes.split(",").filter(Boolean)
            : [],
          requiresVerification: rule.requiresVerification,
          startsAt: rule.startsAt ? rule.startsAt.toISOString().slice(0, 10) : "",
          endsAt: rule.endsAt ? rule.endsAt.toISOString().slice(0, 10) : "",
          isActive: rule.isActive,
          appliesToAllPackages: rule.appliesToAllPackages,
          packageIds: rule.packages.map((entry) => entry.packageId),
        }))}
        packages={packages}
      />
    </>
  );
}
