import type { Metadata } from "next";

import { EquipmentManager } from "@/components/admin/equipment-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Equipment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminEquipmentPage() {
  await requireAdminPage("equipment:manage");

  const equipment = await prisma.equipment.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Equipment"
        description="What is in the studio. Items marked as included appear on the public equipment section at no extra cost."
      />
      <EquipmentManager
        equipment={equipment.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          isAvailable: item.isAvailable,
          includedInPackages: item.includedInPackages,
          rentalPriceMinor: item.rentalPriceMinor,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }))}
      />
    </>
  );
}
