import type { Metadata } from "next";

import { BookingFlow } from "@/components/booking/booking-flow";
import { Container } from "@/components/public/section";
import { CustomerType } from "@/generated/prisma/enums";
import { isPaystackConfigured } from "@/lib/env";
import {
  getActiveAddOns,
  getBookablePackages,
  getPublicDiscounts,
} from "@/lib/queries/public";
import { getStudentPolicy } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Book the studio",
  description:
    "Book One Button Studio in Kumasi. Choose a package, pick a date and time, add production services and pay securely with Mobile Money or card.",
  alternates: { canonical: "/book" },
};

// Availability is read live inside the flow, so the shell itself must not be cached
// with stale catalogue data.
export const dynamic = "force-dynamic";

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const params = await searchParams;
  const [packages, addOns, discounts, studentPolicy] = await Promise.all([
    getBookablePackages(),
    getActiveAddOns(),
    getPublicDiscounts(),
    getStudentPolicy(),
  ]);

  const requestedPackage = typeof params.package === "string" ? params.package : undefined;
  const requestedAddOn = typeof params.addon === "string" ? params.addon : undefined;
  const requestedCategory =
    typeof params.category === "string" && params.category === CustomerType.KNUST_STUDENT
      ? CustomerType.KNUST_STUDENT
      : undefined;

  // Only honour a prefilled package if it is genuinely bookable right now.
  const initialPackageId = packages.some((pkg) => pkg.id === requestedPackage)
    ? requestedPackage
    : undefined;

  const addOnSlugToId = Object.fromEntries(addOns.map((addOn) => [addOn.slug, addOn.id]));

  const best = discounts[0];
  const discountNote = best
    ? `${best.name}: ${best.percentOff}% off studio time for eligible customers.${
        best.requiresVerification
          ? " You may be asked to verify your status before the session."
          : " Choose your category on the details step and it is applied automatically."
      }`
    : null;

  return (
    <div className="bg-paper">
      <Container className="py-10 sm:py-14">
        <header className="mb-10 max-w-2xl">
          <h1 className="font-display text-[34px] leading-tight font-semibold tracking-tight text-ink sm:text-[42px]">
            Book the studio
          </h1>
          <p className="mt-3 text-[16.5px] leading-relaxed text-muted">
            A few quick steps and you are done. No account required.
          </p>
        </header>

        <BookingFlow
          packages={packages.map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            summary: pkg.summary,
            priceMinor: pkg.priceMinor,
            durationMinutes: pkg.durationMinutes,
            category: pkg.category,
            isPopular: pkg.isPopular,
            studentOnly: pkg.studentOnly,
            features: pkg.features.map((feature) => ({
              id: feature.id,
              label: feature.label,
            })),
          }))}
          addOns={addOns.map((addOn) => ({
            id: addOn.id,
            name: addOn.name,
            description: addOn.description,
            priceMinor: addOn.priceMinor,
            pricingUnit: addOn.pricingUnit,
            maxQuantity: addOn.maxQuantity,
          }))}
          initialPackageId={initialPackageId}
          initialAddOnSlug={requestedAddOn}
          initialCategory={requestedCategory}
          addOnSlugToId={addOnSlugToId}
          discountNote={discountNote}
          paymentEnabled={isPaystackConfigured()}
          studentVerificationMethod={studentPolicy.verificationMethod}
          knustEmailDomain={studentPolicy.knustEmailDomain}
        />
      </Container>
    </div>
  );
}
