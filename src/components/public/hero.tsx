import { ArrowRight, Clock, MapPin, ShieldCheck } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Container } from "@/components/public/section";
import { formatMoney } from "@/lib/utils";

export function Hero({
  studioName,
  parentOrg,
  tagline,
  location,
  heroImageUrl,
  logoUrl,
  fromMinor,
}: {
  studioName: string;
  parentOrg: string;
  tagline: string;
  location: string;
  heroImageUrl: string;
  logoUrl: string;
  fromMinor: number | null;
}) {
  return (
    <section className="relative overflow-hidden bg-paper">
      {/* A soft blue wash behind the type, kept subtle rather than a full gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-brand-100/50 blur-3xl"
      />

      <Container className="relative">
        <div className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div className="animate-fade-up">
            {/* <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-soft">
              <MapPin className="size-3.5 text-brand-600" aria-hidden />
              {location}
            </p> */}

            {/* <div className="mt-6">
              <BrandLogo variant="studio" src={logoUrl} size="lg" />
            </div> */}

            <h1 className="font-display mt-4 text-[40px] leading-[1.05] font-semibold tracking-tight text-balance text-ink sm:text-[54px] lg:text-[58px]">
              {studioName}
            </h1>

            <p className="font-display mt-3 text-[24px] leading-tight font-medium text-brand-700 sm:text-[28px]">
              {tagline}
            </p>

            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft">
              A creative content production space by {parentOrg}, for podcasts, interviews,
              educational content, research communication, business content and more.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/book" size="lg">
                Book the Studio
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/packages" size="lg" variant="outline">
                Explore Packages
              </ButtonLink>
            </div>

            <dl className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-7">
              {fromMinor !== null ? (
                <div>
                  <dt className="text-[11.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Studio time from
                  </dt>
                  <dd className="font-display mt-1 text-[22px] font-semibold text-ink">
                    {formatMoney(fromMinor)}
                    <span className="ml-1 text-[13px] font-medium text-muted">/ hour</span>
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 text-brand-600" aria-hidden />
                <span className="text-[13.5px] text-ink-soft">Book in under two minutes</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-brand-600" aria-hidden />
                <span className="text-[13.5px] text-ink-soft">Mobile Money & card accepted</span>
              </div>
            </dl>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <ImagePlaceholder
              label="Studio Hero Image"
              aspect="hero"
              src={heroImageUrl}
              alt={studioName}
              priority
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="rounded-2xl border-line shadow-xl shadow-ink/5"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
