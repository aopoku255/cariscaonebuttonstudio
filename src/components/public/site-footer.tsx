import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { BrandLogo } from "@/components/ui/brand-logo";
import { getOpeningHoursSummary, getStudioProfile } from "@/lib/queries/public";

const EXPLORE_LINKS = [
  { href: "/packages", label: "Packages & pricing" },
  { href: "/students", label: "Student Studio" },
  { href: "/memberships", label: "Creator memberships" },
  { href: "/studio", label: "The studio & equipment" },
  { href: "/corporate", label: "Corporate & institutional" },
  { href: "/faq", label: "Frequently asked questions" },
];

const BOOKING_LINKS = [
  { href: "/book", label: "Book now" },
  { href: "/account", label: "My bookings" },
  { href: "/booking/lookup", label: "Find a booking" },
  { href: "/contact", label: "Contact the studio" },
];

export async function SiteFooter() {
  const [studio, hours] = await Promise.all([getStudioProfile(), getOpeningHoursSummary()]);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line bg-brand-950 text-brand-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="studio" src={studio.logoUrl} size="md" tone="dark" />
              <span className="leading-tight">
                <span className="block text-[13.5px] font-bold tracking-tight text-white">
                  {studio.name}
                </span>
                <span className="block text-[10.5px] font-medium tracking-[0.14em] text-brand-300 uppercase">
                  By {studio.parentOrg}
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-brand-200">
              {studio.description}
            </p>
          </div>

          <div>
            <h2 className="text-[11.5px] font-semibold tracking-[0.14em] text-brand-300 uppercase">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13.5px] text-brand-100 transition-colors hover:text-accent-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[11.5px] font-semibold tracking-[0.14em] text-brand-300 uppercase">
              Booking
            </h2>
            <ul className="mt-4 space-y-2.5">
              {BOOKING_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13.5px] text-brand-100 transition-colors hover:text-accent-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[11.5px] font-semibold tracking-[0.14em] text-brand-300 uppercase">
              Visit & contact
            </h2>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-2.5 text-[13.5px] text-brand-100">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                <span>{studio.location}</span>
              </li>
              <li className="flex gap-2.5 text-[13.5px]">
                <Phone className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                <a
                  href={`tel:${studio.phone.replace(/\s/g, "")}`}
                  className="text-brand-100 transition-colors hover:text-accent-300"
                >
                  {studio.phone}
                </a>
              </li>
              <li className="flex gap-2.5 text-[13.5px]">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand-300" aria-hidden />
                <a
                  href={`mailto:${studio.email}`}
                  className="text-brand-100 transition-colors hover:text-accent-300"
                >
                  {studio.email}
                </a>
              </li>
            </ul>

            <h2 className="mt-6 text-[11.5px] font-semibold tracking-[0.14em] text-brand-300 uppercase">
              Opening hours
            </h2>
            <ul className="mt-3 space-y-1.5">
              {hours.map((group) => (
                <li
                  key={group.days}
                  className="flex justify-between gap-4 text-[13px] text-brand-100"
                >
                  <span className="text-brand-200">{group.days}</span>
                  <span className="text-right font-medium">{group.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-brand-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="carisca" src={studio.cariscaLogoUrl} size="sm" tone="dark" />
            <p className="text-[12.5px] leading-snug text-brand-300">
              {studio.name} is a production space by {studio.parentOrg}, the Centre for
              Applied Research and Innovation in Supply Chain Africa.
              <br />© {year} {studio.parentOrg}. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/terms"
              className="text-[12.5px] text-brand-300 transition-colors hover:text-accent-300"
            >
              Terms & cancellation
            </Link>
            <Link
              href="/privacy"
              className="text-[12.5px] text-brand-300 transition-colors hover:text-accent-300"
            >
              Privacy
            </Link>
            <Link
              href="/admin"
              className="text-[12.5px] text-brand-300 transition-colors hover:text-accent-300"
            >
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
