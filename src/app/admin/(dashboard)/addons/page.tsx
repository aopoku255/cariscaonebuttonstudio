import type { Metadata } from "next";

import { AddOnsManager } from "@/components/admin/addons-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Add-ons",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAddOnsPage() {
  await requireAdminPage("addons:manage");

  const addOns = await prisma.addOn.findMany({
    include: { _count: { select: { bookingAddOns: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Add-ons"
        description="Production services customers can add to a booking. Prices here are what the booking engine charges."
      />
      <AddOnsManager
        addOns={addOns.map((addOn) => ({
          id: addOn.id,
          name: addOn.name,
          slug: addOn.slug,
          description: addOn.description,
          priceMinor: addOn.priceMinor,
          pricingUnit: addOn.pricingUnit,
          maxQuantity: addOn.maxQuantity,
          isActive: addOn.isActive,
          sortOrder: addOn.sortOrder,
          usageCount: addOn._count.bookingAddOns,
        }))}
      />
    </>
  );
}
