"use client";

import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import { deleteRelease, saveRelease } from "@/app/admin/(dashboard)/incidents/actions";

export interface AdminRelease {
  id: string;
  participantName: string;
  participantContact: string | null;
  isMinor: boolean;
  guardianName: string | null;
  scopeOfUse: string | null;
  status: "PENDING" | "SIGNED" | "WITHDRAWN";
  signedOn: string | null;
  notes: string | null;
}

const STATUS_LABELS: Record<AdminRelease["status"], string> = {
  PENDING: "Awaiting signature",
  SIGNED: "Signed",
  WITHDRAWN: "Withdrawn",
};

const STATUS_TONES: Record<AdminRelease["status"], BadgeTone> = {
  PENDING: "warning",
  SIGNED: "success",
  WITHDRAWN: "danger",
};

const FIELDS: FieldDef[] = [
  { key: "participantName", label: "Participant's name", type: "text", required: true },
  { key: "participantContact", label: "Phone or email", type: "text" },
  {
    key: "isMinor",
    label: "The participant is under 18",
    type: "checkbox",
    description: "A parent or guardian must sign. The release cannot be marked as signed without their name.",
  },
  {
    key: "guardianName",
    label: "Parent or guardian's name",
    type: "text",
    showIf: (values) => values.isMinor === true,
  },
  {
    key: "scopeOfUse",
    label: "Agreed use of the recording",
    type: "textarea",
    wide: true,
    rows: 2,
    placeholder: "Where and how the content will be published.",
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
  { key: "signedOn", label: "Date signed", type: "date" },
  { key: "notes", label: "Notes", type: "textarea", wide: true, rows: 2 },
];

/**
 * Releases for a booking where the studio helps to produce the content. Staff record
 * here that a signed form is held: this is a register of consent, not a signature.
 */
export function ReleasesPanel({
  bookingId,
  releases,
}: {
  bookingId: string;
  releases: AdminRelease[];
}) {
  return (
    <ResourceManager<AdminRelease>
      rows={releases}
      titleOf={(row) => row.participantName}
      subtitleOf={(row) => (row.isMinor ? "Under 18" : null)}
      columns={[
        {
          label: "Participant",
          render: (row) => (
            <>
              <span className="font-semibold text-ink">{row.participantName}</span>
              {row.isMinor ? (
                <span className="mt-0.5 block text-[12px] text-muted">
                  Under 18. Guardian: {row.guardianName ?? "not recorded"}
                </span>
              ) : null}
            </>
          ),
        },
        {
          label: "Signed",
          mobile: true,
          render: (row) => row.signedOn ?? <span className="text-muted">-</span>,
        },
        {
          label: "Status",
          render: (row) => <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>,
        },
      ]}
      fields={FIELDS}
      emptyForm={{
        participantName: "",
        participantContact: "",
        isMinor: false,
        guardianName: "",
        scopeOfUse: "",
        status: "PENDING",
        signedOn: "",
        notes: "",
      }}
      toForm={(row) => ({
        participantName: row.participantName,
        participantContact: row.participantContact ?? "",
        isMinor: row.isMinor,
        guardianName: row.guardianName ?? "",
        scopeOfUse: row.scopeOfUse ?? "",
        status: row.status,
        signedOn: row.signedOn ?? "",
        notes: row.notes ?? "",
      })}
      save={(id, values) => saveRelease(bookingId, id, values)}
      remove={(id) => deleteRelease(bookingId, id)}
      labels={{
        createButton: "Add a participant",
        createTitle: "Record a participant release",
        editTitle: "Edit release",
        emptyTitle: "No releases recorded yet",
        emptyDescription:
          "Add each person who will appear in the content, and mark their release as signed once the studio holds the completed form.",
        deleteWarning: (row) => `The release record for ${row.participantName} will be removed.`,
      }}
    />
  );
}
