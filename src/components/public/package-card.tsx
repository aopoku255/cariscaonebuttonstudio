import Image from "next/image";
import { Check } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PublicPackage } from "@/lib/queries/public";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

export function PackageCard({
  pkg,
  href,
  ctaLabel = "Book this package",
  className,
}: {
  pkg: PublicPackage;
  href?: string;
  ctaLabel?: string;
  className?: string;
}) {
  const isMembership = pkg.category === "MEMBERSHIP";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-2xl border bg-surface p-6 transition-shadow duration-200 hover:shadow-lg hover:shadow-ink/5",
        pkg.isPopular ? "border-accent-300 ring-1 ring-accent-200" : "border-line",
        className,
      )}
    >
      {pkg.isPopular || pkg.studentOnly ? (
        <div className="absolute -top-2.5 left-6 flex gap-1.5">
          {pkg.studentOnly ? <Badge tone="brand">KNUST Student</Badge> : null}
          {pkg.isPopular ? <Badge tone="accent">Most popular</Badge> : null}
        </div>
      ) : null}

      {/* An admin-set photo renders here once one exists; until then the card stays
          text-focused, which keeps a dense pricing grid easy to scan. */}
      {pkg.imageUrl ? (
        <div className="relative -m-6 mb-1 aspect-video overflow-hidden rounded-t-2xl">
          <Image
            src={pkg.imageUrl}
            alt={pkg.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
          />
        </div>
      ) : null}

      <header className={pkg.imageUrl ? "mt-5" : undefined}>
        <h3 className="font-display text-[22px] leading-tight font-semibold text-ink">
          {pkg.name}
        </h3>
        <p className="mt-1.5 text-[13.5px] text-muted">
          {isMembership
            ? `${pkg.includedHours ?? 0} studio hours${pkg.validityDays ? ` · valid ${pkg.validityDays} days` : ""}`
            : formatDuration(pkg.durationMinutes)}
        </p>
      </header>

      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-display text-[34px] leading-none font-semibold tracking-tight text-ink">
          {formatMoney(pkg.priceMinor)}
        </span>
        {isMembership ? (
          <span className="text-[14px] font-medium text-muted">/ month</span>
        ) : null}
      </p>

      {pkg.summary ? (
        <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">{pkg.summary}</p>
      ) : null}

      {pkg.features.length ? (
        <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
          {pkg.features.map((feature) => (
            <li key={feature.id} className="flex gap-2.5 text-[13.5px] text-ink-soft">
              <Check className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 pt-1 [margin-top:auto]">
        <ButtonLink
          href={href ?? `/book?package=${pkg.id}`}
          variant={pkg.isPopular ? "primary" : "outline"}
          fullWidth
        >
          {ctaLabel}
        </ButtonLink>
      </div>
    </article>
  );
}
