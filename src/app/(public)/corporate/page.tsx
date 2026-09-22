import type { Metadata } from "next";
import { Building2, CalendarRange, FileText, Users } from "lucide-react";

import { CorporateForm } from "@/components/public/corporate-form";
import { Container, Section } from "@/components/public/section";
import { getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Corporate & institutional packages",
  description:
    "Custom studio and production packages for universities, NGOs, government bodies and companies in Ghana. Request a tailored block of sessions at One Button Studio.",
  alternates: { canonical: "/corporate" },
};

const BENEFITS = [
  {
    title: "A block of sessions",
    description: "Agree a number of sessions up front at a rate that reflects the volume.",
    Icon: CalendarRange,
  },
  {
    title: "Priority in the calendar",
    description: "Hold a standing slot so your production schedule is never at risk.",
    Icon: Users,
  },
  {
    title: "Dedicated production support",
    description: "A camera operator and audio technician assigned to your sessions.",
    Icon: Building2,
  },
  {
    title: "Consolidated invoicing",
    description: "One invoice for the programme, with the paperwork your finance team needs.",
    Icon: FileText,
  },
];

export default async function CorporatePage() {
  const studio = await getStudioProfile();

  return (
    <>
      <Section tone="paper" className="pb-0">
        <Container>
          <div className="max-w-2xl">
            <p className="text-[11.5px] font-semibold tracking-[0.16em] text-accent-600 uppercase">
              Corporate &amp; institutional
            </p>
            <h1 className="font-display mt-4 text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[46px]">
              Need regular access to the studio?
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">
              Universities, research centres, NGOs, government bodies and companies running an
              ongoing content programme can arrange a custom package. Tell us what you are
              planning and we will put together a schedule and a rate that fits.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <h2 className="text-[17px] font-semibold text-ink">What a package includes</h2>
              <ul className="mt-6 space-y-6">
                {BENEFITS.map((benefit) => (
                  <li key={benefit.title} className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <benefit.Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{benefit.title}</h3>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                        {benefit.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-xl border border-line bg-surface p-5">
                <p className="text-[13.5px] leading-relaxed text-muted">
                  Prefer to talk it through first? Call{" "}
                  <a
                    href={`tel:${studio.phone.replace(/\s/g, "")}`}
                    className="font-semibold text-brand-700 underline underline-offset-4"
                  >
                    {studio.phone}
                  </a>{" "}
                  or email{" "}
                  <a
                    href={`mailto:${studio.email}`}
                    className="font-semibold text-brand-700 underline underline-offset-4"
                  >
                    {studio.email}
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
              <h2 className="font-display text-[22px] leading-tight font-semibold text-ink">
                Request a corporate package
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">
                We usually reply within two working days.
              </p>
              <div className="mt-6">
                <CorporateForm />
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
