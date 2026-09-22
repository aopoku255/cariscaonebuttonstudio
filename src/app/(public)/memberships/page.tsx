import type { Metadata } from "next";
import { CalendarCheck, Clock, Percent, Sparkles } from "lucide-react";

import { Container, Section, SectionHeading } from "@/components/public/section";
import { PackageCard } from "@/components/public/package-card";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { PackageCategory } from "@/generated/prisma/enums";
import { getActivePackages, getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Creator memberships",
  description:
    "Monthly prepaid studio hours for creators, teams and organisations in Kumasi. Split your hours across sessions, get priority booking and a discount on additional hours.",
  alternates: { canonical: "/memberships" },
};

export const revalidate = 300;

const HOW_IT_WORKS = [
  {
    title: "Buy a block of hours",
    description:
      "Each plan is a set number of studio hours for the month, at a better rate than booking them individually.",
    Icon: Clock,
  },
  {
    title: "Use them how you like",
    description:
      "Split your hours across as many separate sessions as suits your schedule: an hour here, three hours there.",
    Icon: CalendarCheck,
  },
  {
    title: "Pay less for extra time",
    description:
      "Need more than your allowance? Additional hours are discounted at your plan's member rate.",
    Icon: Percent,
  },
  {
    title: "Nothing renews on its own",
    description:
      "Your hours simply run to their expiry date. We never charge you again without you asking us to.",
    Icon: Sparkles,
  },
];

export default async function MembershipsPage() {
  const [memberships, studio] = await Promise.all([
    getActivePackages(PackageCategory.MEMBERSHIP),
    getStudioProfile(),
  ]);

  return (
    <>
      <Section tone="paper" className="pb-0">
        <Container>
          <div className="max-w-2xl">
            <p className="text-[11.5px] font-semibold tracking-[0.16em] text-accent-600 uppercase">
              Memberships
            </p>
            <h1 className="font-display mt-4 text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[48px]">
              Studio hours, ready when you are
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">
              If you publish regularly, buying your studio time in a block costs less and
              takes the monthly negotiation out of it. Choose a plan, get your hours, and use
              them across as many sessions as you need.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container>
          {memberships.length === 0 ? (
            <Alert tone="info">
              Membership plans are not published at the moment. Get in touch at{" "}
              {studio.email} and we will work something out.
            </Alert>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              {memberships.map((pkg, index) => (
                <Reveal key={pkg.id} delay={index * 70}>
                  <PackageCard
                    pkg={pkg}
                    href={`/contact?subject=${encodeURIComponent(`Membership enquiry: ${pkg.name}`)}`}
                    ctaLabel="Enquire about this plan"
                    className="h-full"
                  />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <SectionHeading eyebrow="How it works" title="Prepaid hours, not a subscription" />

          <div className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {HOW_IT_WORKS.map((item, index) => (
              <Reveal key={item.title} delay={index * 60}>
                <div className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <item.Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink">{item.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Alert tone="info" className="mt-10" title="Getting started">
            Memberships are set up by the studio team so we can confirm your hours and
            billing with you first. Email {studio.email} or call {studio.phone} and we will
            have you set up the same day.
          </Alert>
        </Container>
      </Section>

      <Section tone="brand">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[30px] leading-tight font-semibold tracking-tight text-balance text-white sm:text-[38px]">
              Not sure which plan fits?
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-brand-200">
              Tell us roughly how often you record and what you are making, and we will point
              you at the plan that works out cheapest.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/contact" size="lg" variant="accent">
                Talk to the team
              </ButtonLink>
              <ButtonLink
                href="/book"
                size="lg"
                variant="outline"
                className="border-brand-700 text-white hover:bg-brand-900"
              >
                Book a single session
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
