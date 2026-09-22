"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * Accordion built on `<details>`/`<summary>`, which is keyboard accessible and works
 * before hydration. The open state is tracked only to animate the icon.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details
          key={item.id}
          open={openId === item.id}
          onToggle={(event) => {
            if (event.currentTarget.open) setOpenId(item.id);
            else if (openId === item.id) setOpenId(null);
          }}
          className="group"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
            <h3 className="text-[16px] leading-snug font-semibold text-balance text-ink">
              {item.question}
            </h3>
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform duration-200",
                "group-open:rotate-45 group-open:border-brand-200 group-open:bg-brand-50 group-open:text-brand-700",
              )}
              aria-hidden
            >
              <Plus className="size-4" />
            </span>
          </summary>
          <div className="pb-6 text-[14.5px] leading-relaxed text-pretty text-muted">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
