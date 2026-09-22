"use client";

import { Badge } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import {
  deleteGalleryImage,
  saveGalleryImage,
  toggleGalleryImage,
} from "@/app/admin/(dashboard)/gallery/actions";
import { truncate } from "@/lib/utils";

export interface AdminGalleryImage {
  id: string;
  caption: string;
  category: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const FIELDS: FieldDef[] = [
  {
    key: "caption",
    label: "Caption",
    type: "text",
    required: true,
    wide: true,
    placeholder: "Podcast setup",
  },
  {
    key: "category",
    label: "Category",
    type: "text",
    placeholder: "Recording area",
    description: "Optional grouping shown as a small label on the gallery grid.",
  },
  { key: "sortOrder", label: "Sort order", type: "number", placeholder: "0" },
  {
    key: "imageUrl",
    label: "Image URL",
    type: "url",
    wide: true,
    placeholder: "https://… (leave blank to keep a labelled placeholder)",
    description: "Until a real photograph is set, the caption renders as a placeholder block.",
  },
  {
    key: "isActive",
    label: "Show on the website",
    type: "checkbox",
    description: "Hidden entries stay saved but disappear from the public gallery.",
  },
];

export function GalleryManager({ images }: { images: AdminGalleryImage[] }) {
  return (
    <ResourceManager<AdminGalleryImage>
      rows={images}
      titleOf={(row) => row.caption}
      subtitleOf={(row) => row.category}
      isActive={(row) => row.isActive}
      columns={[
        {
          label: "Image",
          render: (row) => (
            <>
              <span className="font-semibold text-ink">{truncate(row.caption, 60)}</span>
              {!row.imageUrl ? (
                <span className="mt-0.5 block text-[12px] text-muted">Placeholder</span>
              ) : null}
            </>
          ),
        },
        {
          label: "Category",
          mobile: true,
          render: (row) => row.category ?? <span className="text-muted">Not set</span>,
        },
        { label: "Order", mobile: true, render: (row) => String(row.sortOrder) },
        {
          label: "Source",
          mobile: true,
          render: (row) =>
            row.imageUrl ? (
              <Badge tone="brand">Photo</Badge>
            ) : (
              <Badge tone="neutral">Placeholder</Badge>
            ),
        },
        {
          label: "Status",
          render: (row) => (
            <Badge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? "Shown" : "Hidden"}
            </Badge>
          ),
        },
      ]}
      fields={FIELDS}
      emptyForm={{
        caption: "",
        category: "",
        imageUrl: "",
        sortOrder: "0",
        isActive: true,
      }}
      toForm={(row) => ({
        caption: row.caption,
        category: row.category ?? "",
        imageUrl: row.imageUrl ?? "",
        sortOrder: String(row.sortOrder),
        isActive: row.isActive,
      })}
      save={saveGalleryImage}
      toggle={toggleGalleryImage}
      remove={deleteGalleryImage}
      labels={{
        createButton: "Add image",
        createTitle: "Add gallery image",
        editTitle: "Edit gallery image",
        emptyTitle: "No gallery images yet",
        emptyDescription:
          "Add an entry for each area of the studio you want to show. Leave the image URL blank until real photography is ready; the caption still shows as a placeholder.",
        deleteWarning: () => "This gallery entry will be removed from the website.",
      }}
    />
  );
}
