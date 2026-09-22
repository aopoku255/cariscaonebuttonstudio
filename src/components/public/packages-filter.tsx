"use client";

import { useMemo, useState } from "react";

import { PackageCard } from "@/components/public/package-card";
import { EmptyState } from "@/components/ui/feedback";
import type { PublicPackage } from "@/lib/queries/public";
import { cn } from "@/lib/utils";

/**
 * Client-side filter over the full package catalogue. The server fetches everything
 * once; filtering by category happens instantly in the browser rather than round
 * tripping, and the URL stays on `/packages` so the page remains linkable and
 * server-rendered for search engines.
 */

type FilterKey = "all" | "students" | "creators" | "corporate" | "memberships";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "students", label: "Students" },
  { key: "creators", label: "Creators" },
  { key: "corporate", label: "Corporate" },
  { key: "memberships", label: "Memberships" },
];

function matches(pkg: PublicPackage, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "students":
      return pkg.studentOnly || pkg.category === "STUDENT";
    case "creators":
      return (
        !pkg.studentOnly &&
        (pkg.category === "STUDIO_RENTAL" || pkg.category === "PRODUCTION" || pkg.category === "OTHER")
      );
    case "corporate":
      return pkg.category === "CORPORATE";
    case "memberships":
      return pkg.category === "MEMBERSHIP" && !pkg.studentOnly;
  }
}

export function PackagesFilter({ packages }: { packages: PublicPackage[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => packages.filter((pkg) => matches(pkg, filter)),
    [packages, filter],
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter packages"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((option) => {
          const active = filter === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors",
                active
                  ? "border-brand-700 bg-brand-800 text-white"
                  : "border-line-strong bg-surface text-ink-soft hover:border-brand-300 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No packages in this category yet"
          description="Try another filter, or view everything the studio offers."
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((pkg) => {
            const isMembership = pkg.category === "MEMBERSHIP";
            return (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                href={
                  isMembership
                    ? pkg.studentOnly
                      ? `/contact?subject=${encodeURIComponent(`Student membership: ${pkg.name}`)}`
                      : "/memberships"
                    : pkg.studentOnly
                      ? `/book?package=${pkg.id}&category=KNUST_STUDENT`
                      : undefined
                }
                ctaLabel={isMembership ? "Enquire about this plan" : undefined}
                className="h-full"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
