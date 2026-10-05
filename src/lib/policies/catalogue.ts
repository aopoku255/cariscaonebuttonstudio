/**
 * The policy documents the site publishes. Shared by the seed, the public routes, the
 * footer and checkout, and deliberately free of imports so the seed script can load it.
 */

export interface PolicyDefinition {
  slug: string;
  title: string;
  /** Short label for the footer and admin lists. */
  shortTitle: string;
  summary: string;
  requiredAtCheckout: boolean;
}

export const POLICY_CATALOGUE: PolicyDefinition[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    shortTitle: "Privacy Policy",
    summary: "What personal information the studio collects, why, who sees it and the rights you have over it.",
    requiredAtCheckout: true,
  },
  {
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    shortTitle: "Terms & Conditions",
    summary: "The agreement between you and the studio when you book, buy a membership or use the website.",
    requiredAtCheckout: true,
  },
  {
    slug: "studio-policy",
    title: "Studio Policy",
    shortTitle: "Studio Policy",
    summary: "Conduct, equipment, security, access and the standards expected of everyone in the studio.",
    requiredAtCheckout: true,
  },
  {
    slug: "booking-policy",
    title: "Booking and Cancellation Policy",
    shortTitle: "Booking & Cancellation",
    summary: "How bookings work, from arrival and overtime to rescheduling, cancellation and closures.",
    requiredAtCheckout: false,
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    shortTitle: "Refund Policy",
    summary: "When a refund is and is not available, and how refunds are processed.",
    requiredAtCheckout: false,
  },
  {
    slug: "content-policy",
    title: "Content and Recording Policy",
    shortTitle: "Content Policy",
    summary: "Rules for what is recorded in the studio, consent, minors, branding and intellectual property.",
    requiredAtCheckout: false,
  },
  {
    slug: "health-safety",
    title: "Health, Safety and Conduct",
    shortTitle: "Health & Safety",
    summary: "Keeping people safe in the studio: emergencies, electrical and equipment safety, and reporting.",
    requiredAtCheckout: false,
  },
  {
    slug: "student-policy",
    title: "Student Booking Policy",
    shortTitle: "Student Policy",
    summary: "Who qualifies for student pricing, how student status is verified and the rules that apply.",
    requiredAtCheckout: false,
  },
];

export const CHECKOUT_POLICY_SLUGS = {
  terms: "terms-and-conditions",
  privacy: "privacy-policy",
  studio: "studio-policy",
} as const;

/**
 * The eight standard policies have their own top-level address. Any further policy an
 * administrator creates is published under /policies/.
 */
export function policyPath(slug: string): string {
  return POLICY_CATALOGUE.some((policy) => policy.slug === slug) ? `/${slug}` : `/policies/${slug}`;
}
