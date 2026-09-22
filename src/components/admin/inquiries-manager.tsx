"use client";

import { Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { InquiryStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { InquiryStatus } from "@/generated/prisma/enums";
import { updateInquiry } from "@/app/admin/(dashboard)/inquiries/actions";
import { formatDateTime, formatLongDate, parseDateKey } from "@/lib/booking/time";

interface InquiryRow {
  id: string;
  organisation: string;
  contactName: string;
  email: string;
  phone: string;
  sessionsRequired: number | null;
  estimatedHours: number | null;
  contentType: string | null;
  preferredStartDate: string | null;
  requirements: string | null;
  status: InquiryStatus;
  adminNotes: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: InquiryStatus.NEW, label: "New" },
  { value: InquiryStatus.IN_REVIEW, label: "In review" },
  { value: InquiryStatus.CONTACTED, label: "Contacted" },
  { value: InquiryStatus.CONVERTED, label: "Converted" },
  { value: InquiryStatus.CLOSED, label: "Closed" },
];

export function InquiriesManager({ inquiries }: { inquiries: InquiryRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {inquiries.map((inquiry) => (
        <InquiryCard key={inquiry.id} inquiry={inquiry} />
      ))}
    </div>
  );
}

function InquiryCard({ inquiry }: { inquiry: InquiryRow }) {
  const router = useRouter();
  const toast = useToast();

  const [status, setStatus] = useState<string>(inquiry.status);
  const [notes, setNotes] = useState(inquiry.adminNotes ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = status !== inquiry.status || notes !== (inquiry.adminNotes ?? "");

  async function handleSave() {
    setSaving(true);
    const result = await updateInquiry({
      inquiryId: inquiry.id,
      status,
      adminNotes: notes,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Saved", result.message);
      router.refresh();
    } else {
      toast.error("Could not save", result.message);
    }
  }

  const details: { label: string; value: string }[] = [
    { label: "Contact", value: inquiry.contactName },
    {
      label: "Sessions required",
      value: inquiry.sessionsRequired ? String(inquiry.sessionsRequired) : "Not specified",
    },
    {
      label: "Estimated hours",
      value: inquiry.estimatedHours ? String(inquiry.estimatedHours) : "Not specified",
    },
    { label: "Content type", value: inquiry.contentType || "Not specified" },
    {
      label: "Preferred start",
      value: inquiry.preferredStartDate
        ? formatLongDate(parseDateKey(inquiry.preferredStartDate)!)
        : "Not specified",
    },
    { label: "Received", value: formatDateTime(new Date(inquiry.createdAt)) },
  ];

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-semibold text-ink">{inquiry.organisation}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={`mailto:${inquiry.email}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-700 underline underline-offset-4"
            >
              <Mail className="size-3.5" aria-hidden />
              {inquiry.email}
            </a>
            <a
              href={`tel:${inquiry.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-700 underline underline-offset-4"
            >
              <Phone className="size-3.5" aria-hidden />
              {inquiry.phone}
            </a>
          </div>
        </div>
        <InquiryStatusBadge status={inquiry.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12.5px]">
        {details.map((row) => (
          <div key={row.label}>
            <dt className="text-muted">{row.label}</dt>
            <dd className="text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      {inquiry.requirements ? (
        <div className="mt-3 rounded-lg bg-paper px-3 py-2.5">
          <p className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">
            Requirements
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            {inquiry.requirements}
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <Field label="Status">
          {(props) => (
            <Select
              {...props}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Internal notes">
          {(props) => (
            <Textarea
              {...props}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="What was agreed, who is following up, next steps."
            />
          )}
        </Field>

        <Button onClick={handleSave} loading={saving} disabled={!dirty} size="sm">
          Save
        </Button>
      </div>
    </div>
  );
}
