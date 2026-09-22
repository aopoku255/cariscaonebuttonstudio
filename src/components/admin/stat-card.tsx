import Link from "next/link";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  href?: string;
  tone?: "default" | "accent" | "warning";
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11.5px] font-semibold tracking-[0.1em] text-muted uppercase">
          {label}
        </p>
        {Icon ? (
          <Icon
            className={cn(
              "size-4 shrink-0",
              tone === "accent"
                ? "text-accent-600"
                : tone === "warning"
                  ? "text-warning-700"
                  : "text-brand-500",
            )}
          />
        ) : null}
      </div>
      <p className="font-display mt-3 text-[26px] leading-none font-semibold tracking-tight text-ink">
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12.5px] text-muted">{hint}</p> : null}
    </>
  );

  const className = cn(
    "rounded-xl border bg-surface p-5 transition-shadow",
    tone === "warning" ? "border-warning-100" : "border-line",
    href && "hover:shadow-md hover:shadow-ink/5",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
