import type { Metadata } from "next";

import { Container, Section, SectionHeading } from "@/components/public/section";
import { PackagesFilter } from "@/components/public/packages-filter";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import {
  getActiveAddOns,
  getAllActivePackages,
  getPublicDiscounts,
  getStudioProfile,
} from "@/lib/queries/public";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Packages & pricing",
  description:
    "Studio rental packages, the Student Studio, creator memberships and production add-ons at One Button Studio in Kumasi. Transparent pricing, filterable by category.",
  alternates: { canonical: "/packages" },
};

export const revalidate = 300;

const UNIT_LABELS: Record<string, string> = {
  PER_HOUR: "per hour",
  PER_BOOKING: "per booking",
  FIXED: "fixed price",
  CUSTOM: "quoted per project",
};

export default async function PackagesPage() {
  const [studio, allPackages, addOns, discounts] = await Promise.all([
    getStudioProfile(),
    // Every bookable and enquiry-based category in one list; the filter tabs slice it
    // client-side rather than the server re-fetching per tab.
    getAllActivePackages(),
    getActiveAddOns(),
    getPublicDiscounts(),
  ]);

  const best = discounts[0];

  return (
    <>
      <Section tone="paper" className="pb-0">
        <Container>
          <div className="max-w-2xl">
            <h1 className="font-display text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[48px]">
              Packages &amp; pricing
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">
              Every studio package includes the room, the standard lighting and recording
              setup, Wi-Fi and air conditioning. What you add on top is up to you.
            </p>
          </div>

          {best ? (
            <Alert tone="info" className="mt-8 max-w-2xl" title={best.name}>
              {best.percentOff}% off studio time for eligible customers.{" "}
              {best.requiresVerification
                ? "You may be asked to verify your status before the session."
                : "Choose your category when booking and it is applied automatically."}{" "}
              KNUST students have their own dedicated packages under the Students filter,
              rather than a discount on standard pricing.
            </Alert>
          ) : null}
        </Container>
      </Section>

      <Section tone="paper">
        <Container>
          <PackagesFilter packages={allPackages} />
        </Container>
      </Section>

      {addOns.length ? (
        <Section tone="deep">
          <Container>
            <SectionHeading
              eyebrow="Add-ons"
              title="Production services"
              description="Add any of these to a booking at checkout."
            />

            <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface">
              <ul className="divide-y divide-line">
                {addOns.map((addOn) => (
                  <li
                    key={addOn.id}
                    className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <h3 className="text-[15.5px] font-semibold text-ink">{addOn.name}</h3>
                      {addOn.description ? (
                        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                          {addOn.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-left sm:text-right">
                      <span className="font-display block text-[19px] font-semibold text-ink">
                        {addOn.pricingUnit === "CUSTOM"
                          ? "On request"
                          : formatMoney(addOn.priceMinor)}
                      </span>
                      <span className="text-[12.5px] text-muted">
                        {UNIT_LABELS[addOn.pricingUnit] ?? ""}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>
      ) : null}

      <Section tone="brand">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[30px] leading-tight font-semibold tracking-tight text-balance text-white sm:text-[38px]">
              Ready to book?
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-brand-200">
              Check live availability and pay online in a couple of minutes. Or call{" "}
              {studio.phone} if you would rather talk it through.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/book" size="lg" variant="accent">
                Book the studio
              </ButtonLink>
              <ButtonLink
                href="/corporate"
                size="lg"
                variant="outline"
                className="border-brand-700 text-white hover:bg-brand-900"
              >
                Request a corporate package
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
