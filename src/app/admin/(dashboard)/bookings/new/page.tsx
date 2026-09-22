import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminBookingForm } from "@/components/admin/admin-booking-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "New booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminNewBookingPage() {
  await requireAdminPage("bookings:write");

  const [packages, addOns, recentCustomers] = await Promise.all([
    prisma.package.findMany({
      where: { isActive: true },
      select: { id: true, name: true, priceMinor: true, durationMinutes: true, category: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.addOn.findMany({
      where: { isActive: true },
      select: { id: true, name: true, priceMinor: true, pricingUnit: true, maxQuantity: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        organisation: true,
        userType: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <>
      <Link
        href="/admin/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All bookings
      </Link>

      <PageHeader
        title="New booking"
        description="For bookings taken over the phone or in person. The price is calculated from the catalogue exactly as it would be online."
      />

      <AdminBookingForm
        packages={packages}
        addOns={addOns}
        customers={recentCustomers}
      />
    </>
  );
}
