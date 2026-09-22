import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { Container, Section } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";
import { getOpeningHoursSummary, getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Contact the studio",
  description:
    "Get in touch with One Button Studio in Kumasi: phone, email, location and opening hours.",
  alternates: { canonical: "/contact" },
};

export const revalidate = 300;

export default async function ContactPage() {
  const [studio, hours] = await Promise.all([getStudioProfile(), getOpeningHoursSummary()]);

  return (
    <Section tone="paper">
      <Container className="max-w-4xl">
        <h1 className="font-display text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[46px]">
          Contact the studio
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-pretty text-ink-soft">
          For bookings, the quickest route is to{" "}
          <a href="/book" className="font-semibold text-brand-700 underline underline-offset-4">
            book online
          </a>
          . For anything else (corporate packages, memberships, unusual requirements), talk
          to us directly.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <a
            href={`tel:${studio.phone.replace(/\s/g, "")}`}
            className="group rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-ink/5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Phone className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">Call us</h2>
            <p className="mt-1.5 text-[15px] font-medium text-brand-700">{studio.phone}</p>
            <p className="mt-1 text-[13px] text-muted">
              Fastest for anything time-sensitive.
            </p>
          </a>

          <a
            href={`mailto:${studio.email}`}
            className="group rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-ink/5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Mail className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">Email us</h2>
            <p className="mt-1.5 text-[15px] font-medium break-words text-brand-700">
              {studio.email}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Best for detailed briefs and quotes.
            </p>
          </a>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <MapPin className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">Visit</h2>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">
              {studio.location}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Clock className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">Opening hours</h2>
            <dl className="mt-2 space-y-1">
              {hours.map((group) => (
                <div key={group.days} className="flex justify-between gap-3 text-[13.5px]">
                  <dt className="text-muted">{group.days}</dt>
                  <dd
                    className={
                      group.hours === "Closed" ? "text-muted" : "font-medium text-ink"
                    }
                  >
                    {group.hours}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-paper-deep p-7">
          <h2 className="font-display text-[20px] leading-tight font-semibold text-ink">
            Booking for an organisation?
          </h2>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted">
            If you need a block of sessions or a standing slot in the calendar, the corporate
            form collects everything we need to put a proposal together.
          </p>
          <ButtonLink href="/corporate" className="mt-5">
            Request a corporate package
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
