"use client";

import { useMemo } from "react";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import { deleteIncident, saveIncident } from "@/app/admin/(dashboard)/incidents/actions";
import { formatMoney, truncate } from "@/lib/utils";

export interface AdminIncident {
  id: string;
  equipmentId: string | null;
  equipmentName: string | null;
  itemName: string | null;
  bookingReference: string | null;
  category: "WEAR_AND_TEAR" | "ACCIDENTAL" | "NEGLIGENT" | "INTENTIONAL";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  description: string;
  occurredOn: string;
  costMinor: number | null;
  resolutionNotes: string | null;
  reportedByName: string | null;
}

export const INCIDENT_CATEGORY_LABELS: Record<AdminIncident["category"], string> = {
  WEAR_AND_TEAR: "Normal wear and tear",
  ACCIDENTAL: "Accidental damage",
  NEGLIGENT: "Negligent damage",
  INTENTIONAL: "Intentional damage",
};

const CATEGORY_TONES: Record<AdminIncident["category"], BadgeTone> = {
  WEAR_AND_TEAR: "neutral",
  ACCIDENTAL: "info",
  NEGLIGENT: "warning",
  INTENTIONAL: "danger",
};

const STATUS_LABELS: Record<AdminIncident["status"], string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  RESOLVED: "Resolved",
};

const STATUS_TONES: Record<AdminIncident["status"], BadgeTone> = {
  OPEN: "warning",
  UNDER_REVIEW: "info",
  RESOLVED: "success",
};

export function IncidentsManager({
  incidents,
  equipment,
}: {
  incidents: AdminIncident[];
  equipment: { id: string; name: string }[];
}) {
  const fields = useMemo<FieldDef[]>(
    () => [
      {
        key: "equipmentId",
        label: "Equipment item",
        type: "select",
        options: [
          { value: "", label: "Not in the equipment list" },
          ...equipment.map((item) => ({ value: item.id, label: item.name })),
        ],
      },
      {
        key: "itemName",
        label: "Item description",
        type: "text",
        placeholder: "Use when the item is not in the list",
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        required: true,
        description: "The Studio Policy treats each of these differently.",
        options: Object.entries(INCIDENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
      },
      { key: "occurredOn", label: "Date it happened", type: "date", required: true },
      {
        key: "bookingReference",
        label: "Booking reference",
        type: "text",
        placeholder: "Optional",
        description: "Links the incident to a booking.",
      },
      {
        key: "cost",
        label: "Repair or replacement cost",
        type: "money",
        placeholder: "Optional",
      },
      {
        key: "description",
        label: "What happened",
        type: "textarea",
        required: true,
        wide: true,
        rows: 4,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        key: "resolutionNotes",
        label: "Resolution notes",
        type: "textarea",
        wide: true,
        rows: 3,
        placeholder: "How it was resolved, and any compensation agreed.",
      },
    ],
    [equipment],
  );

  return (
    <ResourceManager<AdminIncident>
      rows={incidents}
      titleOf={(row) => row.equipmentName ?? row.itemName ?? "Item"}
      subtitleOf={(row) => row.occurredOn}
      columns={[
        {
          label: "Item",
          render: (row) => (
            <>
              <span className="font-semibold text-ink">
                {row.equipmentName ?? row.itemName ?? "Item"}
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {truncate(row.description, 80)}
              </span>
            </>
          ),
        },
        { label: "Date", mobile: true, render: (row) => row.occurredOn },
        {
          label: "Category",
          render: (row) => (
            <Badge tone={CATEGORY_TONES[row.category]}>{INCIDENT_CATEGORY_LABELS[row.category]}</Badge>
          ),
        },
        {
          label: "Booking",
          mobile: true,
          render: (row) => row.bookingReference ?? <span className="text-muted">-</span>,
        },
        {
          label: "Cost",
          mobile: true,
          render: (row) =>
            row.costMinor === null ? <span className="text-muted">-</span> : formatMoney(row.costMinor),
        },
        {
          label: "Status",
          render: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
        },
      ]}
      fields={fields}
      emptyForm={{
        equipmentId: "",
        itemName: "",
        category: "ACCIDENTAL",
        occurredOn: new Date().toISOString().slice(0, 10),
        bookingReference: "",
        cost: "",
        description: "",
        status: "OPEN",
        resolutionNotes: "",
      }}
      toForm={(row) => ({
        equipmentId: row.equipmentId ?? "",
        itemName: row.itemName ?? "",
        category: row.category,
        occurredOn: row.occurredOn,
        bookingReference: row.bookingReference ?? "",
        cost: row.costMinor === null ? "" : (row.costMinor / 100).toFixed(2),
        description: row.description,
        status: row.status,
        resolutionNotes: row.resolutionNotes ?? "",
      })}
      save={(id, values) => saveIncident(id, values)}
      remove={(id) => deleteIncident(id)}
      labels={{
        createButton: "Record an incident",
        createTitle: "Record an equipment incident",
        editTitle: "Edit incident",
        emptyTitle: "No incidents recorded",
        emptyDescription:
          "Record damage, faults and losses here so there is a clear account of what happened and how it was resolved.",
        formDescription:
          "Record what happened as fact. Whether any compensation is sought is decided separately, under the Studio Policy.",
        deleteWarning: () => "This incident record will be removed permanently.",
      }}
    />
  );
}
