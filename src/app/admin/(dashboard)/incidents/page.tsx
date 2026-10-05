import type { Metadata } from "next";

import { IncidentsManager } from "@/components/admin/incidents-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Equipment incidents",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminIncidentsPage() {
  await requireAdminPage("incidents:manage");

  const [incidents, equipment] = await Promise.all([
    prisma.equipmentIncident.findMany({
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        equipment: { select: { name: true } },
        booking: { select: { reference: true } },
      },
    }),
    prisma.equipment.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Equipment incidents"
        description="A record of damage, faults and losses involving studio equipment, classed the way the Studio Policy describes: normal wear and tear, accidental, negligent or intentional."
      />
      <IncidentsManager
        equipment={equipment}
        incidents={incidents.map((incident) => ({
          id: incident.id,
          equipmentId: incident.equipmentId,
          equipmentName: incident.equipment?.name ?? null,
          itemName: incident.itemName,
          bookingReference: incident.booking?.reference ?? null,
          category: incident.category,
          status: incident.status,
          description: incident.description,
          occurredOn: incident.occurredOn.toISOString().slice(0, 10),
          costMinor: incident.costMinor,
          resolutionNotes: incident.resolutionNotes,
          reportedByName: incident.reportedByName,
        }))}
      />
    </>
  );
}
