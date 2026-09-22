import type { Metadata } from "next";

import { PackagesManager } from "@/components/admin/packages-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Packages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage() {
  await requireAdminPage("packages:manage");

  const packages = await prisma.package.findMany({
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      _count: { select: { bookings: true, memberships: true } },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { priceMinor: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Packages"
        description="Everything the public site offers comes from here. Prices, durations and features are never hardcoded in the website."
      />

      <PackagesManager
        packages={packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          slug: pkg.slug,
          category: pkg.category,
          summary: pkg.summary,
          description: pkg.description,
          priceMinor: pkg.priceMinor,
          durationMinutes: pkg.durationMinutes,
          imageUrl: pkg.imageUrl,
          isActive: pkg.isActive,
          isPopular: pkg.isPopular,
          studentOnly: pkg.studentOnly,
          sortOrder: pkg.sortOrder,
          includedHours: pkg.includedHours,
          extraHourDiscountPercent: pkg.extraHourDiscountPercent,
          validityDays: pkg.validityDays,
          priorityBooking: pkg.priorityBooking,
          features: pkg.features.map((feature) => feature.label),
          bookingCount: pkg._count.bookings,
          membershipCount: pkg._count.memberships,
        }))}
      />
    </>
  );
}
