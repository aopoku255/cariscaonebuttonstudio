"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { optionalText } from "@/lib/validation/common";
import {
  type ActionResult,
  actionError,
  actionOk,
  fieldErrors,
} from "@/lib/validation/common";

/**
 * Gallery image CRUD, for the public "Inside One Button Studio" section.
 *
 * `imageUrl` is optional by design: leaving it blank keeps the entry visible on
 * the public site as a labelled placeholder (via the shared `ImagePlaceholder`
 * component) rather than hiding it, so admins can lay out the gallery's
 * captions and order before real photography exists.
 */

const gallerySchema = z.object({
  caption: z.string().trim().min(2, "Enter a caption").max(160),
  category: optionalText(80),
  imageUrl: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

function refresh() {
  revalidatePath("/admin/gallery");
  revalidatePath("/");
  revalidatePath("/studio");
}

export async function saveGalleryImage(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin("gallery:manage");

  const parsed = gallerySchema.safeParse(payload);
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", fieldErrors(parsed.error));
  }

  const data = {
    caption: parsed.data.caption,
    category: parsed.data.category ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
  };

  const record = id
    ? await prisma.galleryImage.update({ where: { id }, data })
    : await prisma.galleryImage.create({ data });

  await recordAudit(admin, {
    action: id ? "gallery.update" : "gallery.create",
    entity: "GalleryImage",
    entityId: record.id,
    summary: `${id ? "Updated" : "Added"} gallery image "${record.caption}"`,
  });

  refresh();
  return actionOk({ id: record.id }, id ? "Gallery image updated." : "Gallery image added.");
}

export async function toggleGalleryImage(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin("gallery:manage");
  const record = await prisma.galleryImage.update({ where: { id }, data: { isActive } });

  await recordAudit(admin, {
    action: "gallery.toggle",
    entity: "GalleryImage",
    entityId: id,
    summary: `${isActive ? "Shown" : "Hidden"} gallery image "${record.caption}"`,
  });

  refresh();
  return actionOk(undefined, isActive ? "Gallery image shown." : "Gallery image hidden.");
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  const admin = await requireAdmin("gallery:manage");
  const record = await prisma.galleryImage.findUnique({ where: { id }, select: { caption: true } });
  if (!record) return actionError("That gallery image no longer exists.");

  await prisma.galleryImage.delete({ where: { id } });

  await recordAudit(admin, {
    action: "gallery.delete",
    entity: "GalleryImage",
    entityId: id,
    summary: `Deleted gallery image "${record.caption}"`,
  });

  refresh();
  return actionOk(undefined, "Gallery image deleted.");
}
