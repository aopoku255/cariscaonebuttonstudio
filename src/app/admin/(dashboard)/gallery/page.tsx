import type { Metadata } from "next";

import { GalleryManager } from "@/components/admin/gallery-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Studio gallery",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  await requireAdminPage("gallery:manage");

  const images = await prisma.galleryImage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Studio gallery"
        description="Photos for the public 'Inside One Button Studio' section. Leave the image URL blank to keep an entry as a labelled placeholder until real photography is ready."
      />
      <GalleryManager
        images={images.map((image) => ({
          id: image.id,
          caption: image.caption,
          category: image.category,
          imageUrl: image.imageUrl,
          sortOrder: image.sortOrder,
          isActive: image.isActive,
        }))}
      />
    </>
  );
}
