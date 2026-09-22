"use client";

import { Badge } from "@/components/ui/badge";
import { ResourceManager, type FieldDef } from "@/components/admin/resource-manager";
import { deleteFaq, saveFaq, toggleFaq } from "@/app/admin/(dashboard)/catalogue-actions";
import { truncate } from "@/lib/utils";

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

const FIELDS: FieldDef[] = [
  {
    key: "question",
    label: "Question",
    type: "text",
    required: true,
    wide: true,
    placeholder: "How do I book the studio?",
  },
  {
    key: "answer",
    label: "Answer",
    type: "textarea",
    required: true,
    wide: true,
    rows: 5,
    placeholder: "Write it the way you would say it to someone standing in front of you.",
  },
  {
    key: "category",
    label: "Category",
    type: "text",
    placeholder: "Booking",
    description: "Optional grouping, e.g. Booking, Payment, Studio.",
  },
  { key: "sortOrder", label: "Sort order", type: "number", placeholder: "0" },
  {
    key: "isActive",
    label: "Published",
    type: "checkbox",
    description: "Unpublished questions stay saved but are hidden from the website.",
  },
];

export function FaqsManager({ faqs }: { faqs: AdminFaq[] }) {
  return (
    <ResourceManager<AdminFaq>
      rows={faqs}
      titleOf={(row) => row.question}
      subtitleOf={(row) => row.category}
      isActive={(row) => row.isActive}
      columns={[
        {
          label: "Question",
          render: (row) => (
            <>
              <span className="font-semibold text-ink">{truncate(row.question, 70)}</span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {truncate(row.answer, 90)}
              </span>
            </>
          ),
        },
        {
          label: "Category",
          mobile: true,
          render: (row) => row.category ?? <span className="text-muted">-</span>,
        },
        { label: "Order", mobile: true, render: (row) => String(row.sortOrder) },
        {
          label: "Status",
          render: (row) => (
            <Badge tone={row.isActive ? "success" : "neutral"}>
              {row.isActive ? "Published" : "Hidden"}
            </Badge>
          ),
        },
      ]}
      fields={FIELDS}
      emptyForm={{
        question: "",
        answer: "",
        category: "",
        sortOrder: "0",
        isActive: true,
      }}
      toForm={(row) => ({
        question: row.question,
        answer: row.answer,
        category: row.category ?? "",
        sortOrder: String(row.sortOrder),
        isActive: row.isActive,
      })}
      save={saveFaq}
      toggle={toggleFaq}
      remove={deleteFaq}
      labels={{
        createButton: "New FAQ",
        createTitle: "New FAQ",
        editTitle: "Edit FAQ",
        emptyTitle: "No FAQs yet",
        emptyDescription:
          "Answer the questions customers actually ask, and you will field far fewer phone calls.",
        deleteWarning: () => "This question will be removed permanently.",
      }}
    />
  );
}
