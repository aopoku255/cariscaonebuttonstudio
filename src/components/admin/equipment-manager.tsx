"use client";

import { Badge } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import {
  deleteEquipment,
  saveEquipment,
  toggleEquipment,
} from "@/app/admin/(dashboard)/catalogue-actions";
import { formatMoney, minorToMajorString, slugify } from "@/lib/utils";

export interface AdminEquipment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  quantity: number;
  isAvailable: boolean;
  includedInPackages: boolean;
  rentalPriceMinor: number;
  sortOrder: number;
  isActive: boolean;
}

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Camera" },
  { key: "slug", label: "Slug", type: "text", required: true, placeholder: "camera" },
  { key: "quantity", label: "Quantity", type: "number", placeholder: "3" },
  { key: "sortOrder", label: "Sort order", type: "number", placeholder: "0" },
  {
    key: "rentalPriceMajor",
    label: "Extra rental price (GH₵)",
    type: "money",
    placeholder: "0",
    description: "Leave at 0 when the item is included with every booking.",
  },
  { key: "imageUrl", label: "Image URL", type: "url", placeholder: "https://… (optional)" },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    wide: true,
    placeholder: "What it is and what it is good for.",
  },
  {
    key: "includedInPackages",
    label: "Included in packages",
    type: "checkbox",
    description: "Shown as 'Included' rather than carrying an extra charge.",
  },
  {
    key: "isAvailable",
    label: "Currently available",
    type: "checkbox",
    description: "Untick while an item is away for repair.",
  },
  {
    key: "isActive",
    label: "Show on the website",
    type: "checkbox",
    description: "Hidden items stay in your records but disappear from the public page.",
  },
];

export function EquipmentManager({ equipment }: { equipment: AdminEquipment[] }) {
  return (
    <ResourceManager<AdminEquipment>
      rows={equipment}
      titleOf={(row) => row.name}
      subtitleOf={(row) => `/${row.slug}`}
      isActive={(row) => row.isActive}
      columns={[
        {
          label: "Item",
          render: (row) => <span className="font-semibold text-ink">{row.name}</span>,
        },
        { label: "Quantity", mobile: true, render: (row) => String(row.quantity) },
        {
          label: "Pricing",
          mobile: true,
          render: (row) =>
            row.includedInPackages ? (
              <Badge tone="brand">Included</Badge>
            ) : row.rentalPriceMinor > 0 ? (
              <span className="font-medium text-ink">
                + {formatMoney(row.rentalPriceMinor)}
              </span>
            ) : (
              <span className="text-muted">On request</span>
            ),
        },
        {
          label: "Condition",
          mobile: true,
          render: (row) => (
            <Badge tone={row.isAvailable ? "success" : "warning"}>
              {row.isAvailable ? "Available" : "Unavailable"}
            </Badge>
          ),
        },
        {
          label: "Website",
          render: (row) => (
            <Badge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? "Shown" : "Hidden"}
            </Badge>
          ),
        },
      ]}
      fields={FIELDS}
      emptyForm={{
        name: "",
        slug: "",
        description: "",
        imageUrl: "",
        quantity: "1",
        isAvailable: true,
        includedInPackages: false,
        rentalPriceMajor: "0",
        sortOrder: "0",
        isActive: true,
      }}
      toForm={(row) => ({
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        imageUrl: row.imageUrl ?? "",
        quantity: String(row.quantity),
        isAvailable: row.isAvailable,
        includedInPackages: row.includedInPackages,
        rentalPriceMajor: minorToMajorString(row.rentalPriceMinor),
        sortOrder: String(row.sortOrder),
        isActive: row.isActive,
      })}
      save={(id, values) =>
        saveEquipment(id, {
          ...values,
          slug: slugify(String(values.slug || values.name || "")),
        })
      }
      toggle={toggleEquipment}
      remove={deleteEquipment}
      labels={{
        createButton: "Add equipment",
        createTitle: "Add equipment",
        editTitle: "Edit equipment",
        emptyTitle: "No equipment listed",
        emptyDescription:
          "List the cameras, microphones, lighting and other kit available in the studio.",
        formDescription: "This feeds the equipment section on the public website.",
        deleteWarning: () =>
          "This item will be removed from your records and from the website. This cannot be undone.",
      }}
    />
  );
}
