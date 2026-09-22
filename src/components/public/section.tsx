import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Consistent page rhythm: one container width and one vertical scale for the whole site. */

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  tone = "paper",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "paper" | "surface" | "deep" | "brand";
}) {
  const tones = {
    paper: "bg-paper",
    surface: "bg-surface",
    deep: "bg-paper-deep",
    brand: "bg-brand-950 text-brand-100",
  } as const;

  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "inverse";
}) {
  return (
    <p
      className={cn(
        "text-[11.5px] font-semibold tracking-[0.16em] uppercase",
        tone === "inverse" ? "text-accent-300" : "text-accent-600",
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "default",
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "default" | "inverse";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? <Eyebrow tone={tone}>{eyebrow}</Eyebrow> : null}
        <h2
          className={cn(
            "font-display mt-3 text-[30px] leading-[1.12] font-semibold tracking-tight text-balance sm:text-[38px]",
            tone === "inverse" ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-4 text-[16px] leading-relaxed text-pretty",
              tone === "inverse" ? "text-brand-200" : "text-muted",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
