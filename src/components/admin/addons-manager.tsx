"use client";

import { Badge } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import {
  deleteAddOn,
  saveAddOn,
  toggleAddOn,
} from "@/app/admin/(dashboard)/catalogue-actions";
import { formatMoney, minorToMajorString, slugify } from "@/lib/utils";

export interface AdminAddOn {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMinor: number;
  pricingUnit: string;
  maxQuantity: number;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
}

const PRICING_UNITS = [
  { value: "PER_HOUR", label: "Per hour" },
  { value: "PER_BOOKING", label: "Per booking" },
  { value: "FIXED", label: "Fixed" },
  { value: "CUSTOM", label: "Custom (quoted manually)" },
];

const UNIT_LABELS: Record<string, string> = {
  PER_HOUR: "per hour",
  PER_BOOKING: "per booking",
  FIXED: "fixed",
  CUSTOM: "quoted",
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "Camera Operator" },
  {
    key: "slug",
    label: "Slug",
    type: "text",
    required: true,
    placeholder: "camera-operator",
    description: "Used in links and pre-filled booking URLs.",
  },
  {
    key: "priceMajor",
    label: "Price (GH₵)",
    type: "money",
    required: true,
    placeholder: "150",
    description: "Ignored when the pricing unit is Custom.",
  },
  { key: "pricingUnit", label: "Pricing unit", type: "select", options: PRICING_UNITS },
  {
    key: "maxQuantity",
    label: "Maximum quantity",
    type: "number",
    placeholder: "1",
    description: "How many of this a customer may add to one booking.",
  },
  { key: "sortOrder", label: "Sort order", type: "number", placeholder: "0" },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    wide: true,
    placeholder: "What the customer gets.",
  },
  {
    key: "isActive",
    label: "Active",
    type: "checkbox",
    description: "Inactive add-ons disappear from the booking flow.",
  },
];

export function AddOnsManager({ addOns }: { addOns: AdminAddOn[] }) {
  return (
    <ResourceManager<AdminAddOn>
      rows={addOns}
      titleOf={(row) => row.name}
      subtitleOf={(row) => `/${row.slug}`}
      isActive={(row) => row.isActive}
      columns={[
        {
          label: "Add-on",
          render: (row) => (
            <>
              <span className="font-semibold text-ink">{row.name}</span>
              <span className="block text-[12px] text-muted">/{row.slug}</span>
            </>
          ),
        },
        {
          label: "Price",
          mobile: true,
          render: (row) =>
            row.pricingUnit === "CUSTOM" ? (
              <span className="text-muted">Quoted</span>
            ) : (
              <span className="font-medium text-ink">{formatMoney(row.priceMinor)}</span>
            ),
        },
        {
          label: "Unit",
          mobile: true,
          render: (row) => UNIT_LABELS[row.pricingUnit] ?? row.pricingUnit,
        },
        { label: "Max qty", mobile: true, render: (row) => String(row.maxQuantity) },
        { label: "Times booked", mobile: true, render: (row) => String(row.usageCount) },
        {
          label: "Status",
          render: (row) => (
            <Badge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? "Active" : "Disabled"}
            </Badge>
          ),
        },
      ]}
      fields={FIELDS}
      emptyForm={{
        name: "",
        slug: "",
        description: "",
        priceMajor: "",
        pricingUnit: "PER_BOOKING",
        maxQuantity: "1",
        sortOrder: "0",
        isActive: true,
      }}
      toForm={(row) => ({
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        priceMajor: minorToMajorString(row.priceMinor),
        pricingUnit: row.pricingUnit,
        maxQuantity: String(row.maxQuantity),
        sortOrder: String(row.sortOrder),
        isActive: row.isActive,
      })}
      save={(id, values) =>
        saveAddOn(id, {
          ...values,
          slug: slugify(String(values.slug || values.name || "")),
        })
      }
      toggle={toggleAddOn}
      remove={deleteAddOn}
      labels={{
        createButton: "New add-on",
        createTitle: "New add-on",
        editTitle: "Edit add-on",
        emptyTitle: "No add-ons yet",
        emptyDescription:
          "Add production services (a camera operator, audio setup, editing) and customers can add them at checkout.",
        formDescription: "These appear on the booking flow's add-ons step.",
        deleteWarning: (row) =>
          row.usageCount > 0
            ? `This add-on is on ${row.usageCount} booking(s), so it will be disabled rather than deleted and the booking history will stay intact.`
            : "This add-on has never been booked, so it will be removed completely. This cannot be undone.",
      }}
    />
  );
}
