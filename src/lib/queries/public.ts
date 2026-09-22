import "server-only";

import { cache } from "react";

import { PackageCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { formatMinuteOfDay12 } from "@/lib/booking/time";
import { getSettings } from "@/lib/settings";

/**
 * Read models for the public site.
 *
 * Nothing on the public site hardcodes a price, a package or an FAQ: it all comes
 * from here, which reads what the admin has configured.
 */

export const getActivePackages = cache(async (category?: PackageCategory) => {
  return prisma.package.findMany({
    where: { isActive: true, ...(category ? { category } : {}) },
    include: { features: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }],
  });
});

export type PublicPackage = Awaited<ReturnType<typeof getActivePackages>>[number];

/** Every active package across every category, for the filterable /packages page. */
export const getAllActivePackages = cache(async () => {
  return prisma.package.findMany({
    where: { isActive: true },
    include: { features: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { priceMinor: "asc" }],
  });
});

/** Packages a customer can actually book a time slot for (memberships are bought, not slotted). */
export const getBookablePackages = cache(async () => {
  return prisma.package.findMany({
    where: {
      isActive: true,
      category: {
        in: [
          PackageCategory.STUDIO_RENTAL,
          PackageCategory.PRODUCTION,
          PackageCategory.STUDENT,
          PackageCategory.OTHER,
        ],
      },
    },
    include: { features: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { priceMinor: "asc" }],
  });
});

export const getActiveAddOns = cache(async () => {
  return prisma.addOn.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

export const getActiveFaqs = cache(async () => {
  return prisma.faq.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export const getActiveGalleryImages = cache(async () => {
  return prisma.galleryImage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export const getActiveEquipment = cache(async () => {
  return prisma.equipment.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
});

export const getOperatingHours = cache(async () => {
  return prisma.operatingHour.findMany({ orderBy: { dayOfWeek: "asc" } });
});

/** The active student/researcher-style discounts, for the public pricing note. */
export const getPublicDiscounts = cache(async () => {
  const now = new Date();
  return prisma.discountRule.findMany({
    where: {
      isActive: true,
      percentOff: { gt: 0 },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { percentOff: "desc" },
  });
});

export interface ServiceCard {
  slug: string;
  title: string;
  description: string;
  /** Lowest realistic starting price in minor units, or null when quoted on request. */
  fromMinor: number | null;
  ctaHref: string;
  ctaLabel: string;
  /** Tailwind-friendly icon key, mapped in the component. */
  icon: string;
}

/**
 * The six service cards on the homepage.
 *
 * The copy is editorial, but every price is derived from live catalogue rows, so a
 * price change in the admin flows straight through to these cards.
 */
export const getServiceCards = cache(async (): Promise<ServiceCard[]> => {
  const [packages, addOns] = await Promise.all([
    prisma.package.findMany({
      where: { isActive: true, category: PackageCategory.STUDIO_RENTAL },
      orderBy: { priceMinor: "asc" },
    }),
    prisma.addOn.findMany({ where: { isActive: true } }),
  ]);

  const cheapest = packages[0]?.priceMinor ?? null;
  const halfDay =
    packages.find((pkg) => pkg.durationMinutes >= 240)?.priceMinor ?? cheapest;

  const addOnPrice = (slug: string) =>
    addOns.find((addOn) => addOn.slug === slug)?.priceMinor ?? 0;

  const withAddOn = (slug: string) =>
    cheapest === null ? null : cheapest + addOnPrice(slug);

  return [
    {
      slug: "studio-rental",
      title: "Studio Rental",
      description:
        "Book the studio and use the available setup for your own production, on your own terms.",
      fromMinor: cheapest,
      ctaHref: "/book",
      ctaLabel: "Book the studio",
      icon: "studio",
    },
    {
      slug: "podcast-production",
      title: "Podcast Production",
      description:
        "Record professional podcast episodes with proper microphones and a technician on the desk.",
      fromMinor: withAddOn("audio-podcast-setup"),
      ctaHref: "/book?addon=audio-podcast-setup",
      ctaLabel: "Book a podcast session",
      icon: "podcast",
    },
    {
      slug: "video-production",
      title: "Video Production",
      description:
        "Record interviews, educational videos, social media content and presentations with an operator.",
      fromMinor: withAddOn("camera-operator"),
      ctaHref: "/book?addon=camera-operator",
      ctaLabel: "Book a video shoot",
      icon: "video",
    },
    {
      slug: "content-creation",
      title: "Content Creation",
      description:
        "Take a half or full day and produce several pieces of content in a single session.",
      fromMinor: halfDay,
      ctaHref: "/packages",
      ctaLabel: "See longer sessions",
      icon: "content",
    },
    {
      slug: "photography",
      title: "Photography",
      description:
        "Use the studio, lighting and backdrops for professional portraits and product photography.",
      fromMinor: cheapest,
      ctaHref: "/book",
      ctaLabel: "Book studio time",
      icon: "photo",
    },
    {
      slug: "corporate",
      title: "Corporate & Institutional",
      description:
        "Custom studio and production packages for organisations with an ongoing content programme.",
      fromMinor: null,
      ctaHref: "/corporate",
      ctaLabel: "Request a package",
      icon: "corporate",
    },
  ];
});

/** Opening hours grouped into readable lines, e.g. "Monday – Friday · 8:00 AM – 6:00 PM". */
export const getOpeningHoursSummary = cache(async () => {
  const hours = await getOperatingHours();
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Walk Monday→Sunday so the common Mon–Fri block groups naturally.
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((day) => hours.find((row) => row.dayOfWeek === day))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const groups: { days: number[]; label: string }[] = [];

  for (const row of ordered) {
    const label = row.isOpen
      ? `${formatMinuteOfDay12(row.openMinute)} – ${formatMinuteOfDay12(row.closeMinute)}`
      : "Closed";
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.days.push(row.dayOfWeek);
    } else {
      groups.push({ days: [row.dayOfWeek], label });
    }
  }

  return groups.map((group) => ({
    days:
      group.days.length === 1
        ? names[group.days[0]]
        : `${names[group.days[0]]} – ${names[group.days[group.days.length - 1]]}`,
    hours: group.label,
  }));
});

/** Studio contact details and copy, for the header, footer and contact page. */
export const getStudioProfile = cache(async () => {
  const settings = await getSettings();
  return {
    name: settings["studio.name"],
    parentOrg: settings["studio.parentOrg"],
    tagline: settings["studio.tagline"],
    positioning: settings["studio.positioning"],
    description: settings["studio.description"],
    location: settings["studio.location"],
    phone: settings["studio.phone"],
    email: settings["studio.email"],
    heroImageUrl: settings["studio.heroImageUrl"],
    logoUrl: settings["studio.logoUrl"],
    cariscaLogoUrl: settings["studio.cariscaLogoUrl"],
    cancellationPolicy: settings["cancellation.policyText"],
  };
});
