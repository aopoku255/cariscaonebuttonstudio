"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { incidentSchema, releaseSchema } from "@/lib/validation/admin";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Equipment incidents and participant releases: two small record-keeping tools the
 * studio policies rely on.
 */

function toDate(key: string | undefined | null): Date | null {
  return key ? new Date(`${key}T00:00:00.000Z`) : null;
}

/* -------------------------------------------------------------------------- */
/* Equipment incidents                                                         */
/* -------------------------------------------------------------------------- */

export async function saveIncident(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("incidents:manage");

  const parsed = incidentSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  if (!input.equipmentId && !input.itemName) {
    return actionError("Say which item was affected.", {
      itemName: "Choose an item from the list or describe it here",
    });
  }

  let bookingId: string | null = null;
  if (input.bookingReference) {
    const booking = await prisma.booking.findUnique({
      where: { reference: input.bookingReference.toUpperCase() },
      select: { id: true },
    });
    if (!booking) {
      return actionError("No booking has that reference.", {
        bookingReference: "Booking not found",
      });
    }
    bookingId = booking.id;
  }

  const data = {
    equipmentId: input.equipmentId ?? null,
    itemName: input.itemName ?? null,
    bookingId,
    category: input.category,
    status: input.status,
    description: input.description,
    occurredOn: toDate(input.occurredOn)!,
    costMinor: input.cost,
    resolutionNotes: input.resolutionNotes ?? null,
  };

  const record = id
    ? await prisma.equipmentIncident.update({ where: { id }, data })
    : await prisma.equipmentIncident.create({
        data: { ...data, reportedByAdminId: admin.id, reportedByName: admin.name },
      });

  await recordAudit(admin, {
    action: id ? "incident.update" : "incident.create",
    entity: "EquipmentIncident",
    entityId: record.id,
    summary: `${id ? "Updated" : "Recorded"} equipment incident (${input.category.toLowerCase().replaceAll("_", " ")})`,
  });
  revalidatePath("/admin/incidents");
  return actionOk({ id: record.id }, id ? "Incident updated." : "Incident recorded.");
}

export async function deleteIncident(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("incidents:manage");
  await prisma.equipmentIncident.delete({ where: { id } });
  await recordAudit(admin, {
    action: "incident.delete",
    entity: "EquipmentIncident",
    entityId: id,
    summary: "Deleted an equipment incident record",
  });
  revalidatePath("/admin/incidents");
  return actionOk(undefined, "Incident deleted.");
}

/* -------------------------------------------------------------------------- */
/* Participant releases                                                        */
/* -------------------------------------------------------------------------- */

export async function saveRelease(
  bookingId: string,
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("bookings:write");

  const parsed = releaseSchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }
  const input = parsed.data;

  // A minor's consent is given by a parent or guardian. This cannot be skipped.
  if (input.isMinor && input.status === "SIGNED" && !input.guardianName) {
    return actionError(
      "A release for a participant under 18 needs the name of the parent or guardian who signed it.",
      { guardianName: "Required for a participant under 18" },
    );
  }
  if (input.status === "SIGNED" && !input.signedOn) {
    return actionError("Enter the date the release was signed.", {
      signedOn: "Required when the release is signed",
    });
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!booking) return actionError("That booking no longer exists.");

  const data = {
    participantName: input.participantName,
    participantContact: input.participantContact ?? null,
    isMinor: input.isMinor,
    guardianName: input.guardianName ?? null,
    scopeOfUse: input.scopeOfUse ?? null,
    status: input.status,
    signedOn: toDate(input.signedOn),
    notes: input.notes ?? null,
  };

  const record = id
    ? await prisma.contentRelease.update({ where: { id }, data })
    : await prisma.contentRelease.create({
        data: { ...data, bookingId, recordedByAdminId: admin.id, recordedByName: admin.name },
      });

  await recordAudit(admin, {
    action: id ? "release.update" : "release.create",
    entity: "ContentRelease",
    entityId: record.id,
    summary: `${id ? "Updated" : "Recorded"} a participant release (${input.status.toLowerCase()})`,
    metadata: { bookingId },
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return actionOk({ id: record.id }, id ? "Release updated." : "Release recorded.");
}

export async function deleteRelease(bookingId: string, id: string): Promise<ActionResult> {
  const admin = await requireAdmin("bookings:write");
  await prisma.contentRelease.delete({ where: { id } });
  await recordAudit(admin, {
    action: "release.delete",
    entity: "ContentRelease",
    entityId: id,
    summary: "Deleted a participant release record",
    metadata: { bookingId },
  });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return actionOk(undefined, "Release deleted.");
}
