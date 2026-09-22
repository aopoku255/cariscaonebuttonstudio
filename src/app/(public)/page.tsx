import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { Container, Section, SectionHeading } from "@/components/public/section";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { Hero } from "@/components/public/hero";
import {
  ClosingCta,
  CorporateSection,
  EquipmentSection,
  GallerySection,
  HowItWorks,
  ServicesSection,
  StudentPromotion,
  StudioExperience,
  StudioIntro,
  Testimonials,
} from "@/components/public/home-sections";
import { PackageCard } from "@/components/public/package-card";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { PackageCategory } from "@/generated/prisma/enums";
import { appUrl } from "@/lib/env";
import {
  getActiveEquipment,
  getActiveFaqs,
  getActiveGalleryImages,
  getActivePackages,
  getOpeningHoursSummary,
  getServiceCards,
  getStudioProfile,
} from "@/lib/queries/public";

export const metadata: Metadata = {
  // `absolute` stops the root layout appending the site name to its own name.
  title: {
    absolute: "One Button Studio by CARISCA: Podcast, Video and Content Studio in Kumasi",
  },
  description:
    "Book One Button Studio, a creative content production space by CARISCA in Kumasi. Hourly, half-day and full-day packages, creator memberships, production add-ons and instant online payment.",
  alternates: { canonical: "/" },
};

// Catalogue changes should appear promptly without rebuilding the site.
export const revalidate = 300;

export default async function HomePage() {
  const [studio, services, packages, equipment, gallery, faqs, hours] = await Promise.all([
    getStudioProfile(),
    getServiceCards(),
    getActivePackages(PackageCategory.STUDIO_RENTAL),
    getActiveEquipment(),
    getActiveGalleryImages(),
    getActiveFaqs(),
    getOpeningHoursSummary(),
  ]);

  const cheapest = packages.length
    ? Math.min(...packages.map((pkg) => pkg.priceMinor))
    : null;

  /**
   * Structured data. `LocalBusiness` gives search engines the address and opening
   * hours; `FAQPage` makes the questions below eligible for rich results.
   */
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${appUrl()}/#studio`,
        name: studio.name,
        description: studio.description,
        parentOrganization: { "@type": "Organization", name: studio.parentOrg },
        url: appUrl(),
        telephone: studio.phone,
        email: studio.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: studio.location,
          addressLocality: "Kumasi",
          addressRegion: "Ashanti",
          addressCountry: "GH",
        },
        priceRange: cheapest ? `from GHS ${(cheapest / 100).toFixed(0)}` : undefined,
        openingHours: hours
          .filter((group) => group.hours !== "Closed")
          .map((group) => `${group.days} ${group.hours}`),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.slice(0, 10).map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Structured data is generated from our own database rows, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Hero
        studioName={studio.name}
        parentOrg={studio.parentOrg}
        tagline={studio.tagline}
        location={studio.location}
        heroImageUrl={studio.heroImageUrl}
        fromMinor={cheapest}
      />

      <StudioIntro
        description={studio.description}
        studioName={studio.name}
        parentOrg={studio.parentOrg}
      />

      <ServicesSection services={services} />

      {packages.length ? (
        <Section tone="surface" id="packages">
          <Container>
            <SectionHeading
              eyebrow="Packages"
              title="Straightforward studio pricing"
              description="Every package includes the room, the standard lighting and recording setup, Wi-Fi and air conditioning. No hidden extras."
              action={
                <ButtonLink href="/packages" variant="outline">
                  All packages &amp; memberships
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              }
            />

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pkg, index) => (
                <Reveal key={pkg.id} delay={index * 60}>
                  <PackageCard pkg={pkg} className="h-full" />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <HowItWorks />

      <StudentPromotion />

      <StudioExperience />

      <EquipmentSection equipment={equipment} />

      <GallerySection images={gallery} studioName={studio.name} />

      <CorporateSection parentOrg={studio.parentOrg} />

      <Testimonials />

      {faqs.length ? (
        <Section tone="deep" id="faq">
          <Container className="max-w-3xl">
            <SectionHeading
              eyebrow="Questions"
              title="Frequently asked questions"
              align="center"
            />
            <div className="mt-10">
              <FaqAccordion
                items={faqs.slice(0, 8).map((faq) => ({
                  id: faq.id,
                  question: faq.question,
                  answer: faq.answer,
                }))}
              />
            </div>
            <p className="mt-8 text-center text-[14px] text-muted">
              Still unsure?{" "}
              <a
                href={`mailto:${studio.email}`}
                className="font-semibold text-brand-700 underline underline-offset-4"
              >
                Email the studio
              </a>{" "}
              and we will get back to you.
            </p>
          </Container>
        </Section>
      ) : null}

      <ClosingCta studioName={studio.name} phone={studio.phone} />
    </>
  );
}
