import type { Metadata } from "next";

import { MembershipsManager } from "@/components/admin/memberships-manager";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { PackageCategory } from "@/generated/prisma/enums";
import { requireAdminPage } from "@/lib/auth/guard";
import { toDateKey } from "@/lib/booking/time";
import { prisma } from "@/lib/db";
import { getMembershipUsage } from "@/lib/queries/analytics";

export const metadata: Metadata = {
  title: "Memberships",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMembershipsPage() {
  await requireAdminPage("memberships:manage");

  const [memberships, packages, usage] = await Promise.all([
    prisma.membership.findMany({
      include: {
        customer: { select: { name: true, email: true } },
        usage: { orderBy: { createdAt: "desc" }, take: 8 },
      },
      orderBy: [{ status: "asc" }, { expiryDate: "desc" }],
    }),
    prisma.package.findMany({
      where: { category: PackageCategory.MEMBERSHIP },
      select: {
        id: true,
        name: true,
        priceMinor: true,
        includedHours: true,
        validityDays: true,
        extraHourDiscountPercent: true,
        priorityBooking: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    getMembershipUsage(),
  ]);

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Prepaid bundles of studio hours. Nothing renews on its own: a member's hours simply expire unless you extend them."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active memberships"
          value={String(
            memberships.filter((membership) => membership.status === "ACTIVE").length,
          )}
        />
        <StatCard label="Hours granted" value={String(usage.totalHours)} tone="accent" />
        <StatCard label="Hours used" value={String(usage.usedHours)} />
        <StatCard
          label="Hours remaining"
          value={String(usage.remainingHours)}
          hint={`${usage.utilisationPercent}% of granted hours used`}
        />
      </div>

      <MembershipsManager
        memberships={memberships.map((membership) => ({
          id: membership.id,
          reference: membership.reference,
          customerName: membership.customer.name,
          customerEmail: membership.customer.email,
          packageName: membership.packageNameSnapshot ?? "Membership",
          status: membership.status,
          totalMinutes: membership.totalMinutes,
          usedMinutes: membership.usedMinutes,
          startDate: toDateKey(membership.startDate),
          expiryDate: toDateKey(membership.expiryDate),
          pricePaidMinor: membership.pricePaidMinor,
          priorityBooking: membership.priorityBooking,
          extraHourDiscountPercent: membership.extraHourDiscountPercent,
          autoRenew: membership.autoRenew,
          usage: membership.usage.map((entry) => ({
            id: entry.id,
            minutesUsed: entry.minutesUsed,
            note: entry.note,
            createdAt: entry.createdAt.toISOString(),
          })),
        }))}
        packages={packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          priceMinor: pkg.priceMinor,
          includedHours: pkg.includedHours ?? 0,
          validityDays: pkg.validityDays ?? 30,
          extraHourDiscountPercent: pkg.extraHourDiscountPercent ?? 0,
          priorityBooking: pkg.priorityBooking,
        }))}
      />
    </>
  );
}
