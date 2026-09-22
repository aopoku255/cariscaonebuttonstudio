"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/ui/brand-logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/studio", label: "Studio" },
  { href: "/#services", label: "Services" },
  { href: "/packages", label: "Packages" },
  { href: "/students", label: "Students" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({
  studioName,
  parentOrg,
  logoUrl,
}: {
  studioName: string;
  parentOrg: string;
  logoUrl: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The drawer closes from the links themselves rather than from a route-change
  // effect, which would cause an extra render on every navigation.
  const close = () => setOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Prevent the page behind the drawer from scrolling.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-200",
        scrolled
          ? "border-line bg-paper/90 backdrop-blur-md"
          : "border-transparent bg-paper",
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label={`${studioName}, by ${parentOrg}`}
        >
          <BrandLogo variant="studio" src={logoUrl} size="md" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-[13.5px] font-bold tracking-tight text-ink">
              {studioName}
            </span>
            <span className="block text-[10.5px] font-medium tracking-[0.14em] text-muted uppercase">
              By {parentOrg}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((link) => {
            const active = !link.href.includes("#") && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                  active ? "text-brand-800" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink md:block"
          >
            My bookings
          </Link>
          <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
            Book Now
          </ButtonLink>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="-mr-1.5 rounded-lg p-2 text-ink transition-colors hover:bg-paper-deep lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id="mobile-nav"
        hidden={!open}
        className="animate-fade-in border-t border-line bg-paper lg:hidden"
      >
        <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/account"
            onClick={close}
            className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            My bookings
          </Link>
          <ButtonLink href="/book" fullWidth className="mt-3" onClick={close}>
            Book Now
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
