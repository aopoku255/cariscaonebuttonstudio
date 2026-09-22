import type { Metadata } from "next";
import { MapPin, Wifi, Wind } from "lucide-react";

import { Container, Section, SectionHeading } from "@/components/public/section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Reveal } from "@/components/ui/reveal";
import {
  getActiveEquipment,
  getOpeningHoursSummary,
  getStudioProfile,
} from "@/lib/queries/public";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "The studio & equipment",
  description:
    "Inside One Button Studio in Kumasi: cameras, microphones, lighting, teleprompter, green screen and backdrops, plus opening hours and how to find us.",
  alternates: { canonical: "/studio" },
};

export const revalidate = 300;

export default async function StudioPage() {
  const [studio, equipment, hours] = await Promise.all([
    getStudioProfile(),
    getActiveEquipment(),
    getOpeningHoursSummary(),
  ]);

  const included = equipment.filter((item) => item.includedInPackages);
  const extras = equipment.filter((item) => !item.includedInPackages);

  return (
    <>
      <Section tone="paper" className="pb-0">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-[11.5px] font-semibold tracking-[0.16em] text-accent-600 uppercase">
                The studio
              </p>
              <h1 className="font-display mt-4 text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[46px]">
                A room built for recording
              </h1>
              <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">
                {studio.description}
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-pretty text-muted">
                The set is permanent, so nothing has to be assembled before you start. Walk
                in, sit down, and record.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13.5px] text-ink-soft">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-accent-600" aria-hidden />
                  {studio.location}
                </span>
                <span className="flex items-center gap-2">
                  <Wifi className="size-4 text-accent-600" aria-hidden />
                  Wi-Fi throughout
                </span>
                <span className="flex items-center gap-2">
                  <Wind className="size-4 text-accent-600" aria-hidden />
                  Air conditioned
                </span>
              </div>
            </div>

            <ImagePlaceholder
              label="Studio Overview Image"
              aspect="hero"
              src={studio.heroImageUrl}
              alt="Inside One Button Studio"
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="rounded-2xl shadow-xl shadow-ink/5"
            />
          </div>
        </Container>
      </Section>

      {included.length ? (
        <Section tone="paper">
          <Container>
            <SectionHeading
              eyebrow="Included"
              title="What comes with every booking"
              description="This is the standard setup. It is already in the room and already configured: no extra charge, no extra setup time."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {included.map((item, index) => (
                <Reveal key={item.id} delay={index * 45}>
                  <div className="h-full rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15.5px] font-semibold text-ink">{item.name}</h3>
                      <Badge tone="success">Included</Badge>
                    </div>
                    {item.description ? (
                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    ) : null}
                    {item.quantity > 1 ? (
                      <p className="mt-3 text-[12.5px] text-muted">
                        {item.quantity} available
                      </p>
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {extras.length ? (
        <Section tone="surface">
          <Container>
            <SectionHeading
              eyebrow="Extras"
              title="Available on request"
              description="Specialist kit you can add to a booking."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {extras.map((item, index) => (
                <Reveal key={item.id} delay={index * 45}>
                  <div className="h-full rounded-2xl border border-line bg-paper p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15.5px] font-semibold text-ink">{item.name}</h3>
                      {item.isAvailable ? null : <Badge tone="warning">Unavailable</Badge>}
                    </div>
                    {item.description ? (
                      <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-4 text-[13px] font-semibold text-accent-700">
                      {item.rentalPriceMinor > 0
                        ? `+ ${formatMoney(item.rentalPriceMinor)}`
                        : "Price on request"}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <Section tone="deep">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading eyebrow="Visit" title="Opening hours" />
              <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {hours.map((group) => (
                  <div key={group.days} className="flex justify-between gap-4 px-5 py-3.5">
                    <dt className="text-[14px] text-ink-soft">{group.days}</dt>
                    <dd
                      className={
                        group.hours === "Closed"
                          ? "text-[14px] text-muted"
                          : "text-[14px] font-semibold text-ink"
                      }
                    >
                      {group.hours}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-[13.5px] text-muted">
                Need the studio outside these hours? Ask us: we can sometimes open specially
                for larger bookings.
              </p>
            </div>

            <div>
              <SectionHeading eyebrow="Find us" title="Where we are" />
              <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
                <p className="text-[15px] leading-relaxed text-ink">{studio.location}</p>
                <dl className="mt-5 space-y-2 border-t border-line pt-5 text-[14px]">
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-muted">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${studio.phone.replace(/\s/g, "")}`}
                        className="font-medium text-brand-700 underline underline-offset-4"
                      >
                        {studio.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-muted">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${studio.email}`}
                        className="font-medium text-brand-700 underline underline-offset-4"
                      >
                        {studio.email}
                      </a>
                    </dd>
                  </div>
                </dl>
                <ButtonLink href="/book" className="mt-6" fullWidth>
                  Book the studio
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
