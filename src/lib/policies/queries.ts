import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import { CHECKOUT_POLICY_SLUGS } from "@/lib/policies/catalogue";
import { getSettings } from "@/lib/settings";

/** The published version of a policy, or null when nothing is published. */
export const getPublishedPolicy = cache(async (slug: string) => {
  const policy = await prisma.policy.findUnique({
    where: { slug },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });

  const version = policy?.versions[0];
  if (!policy || !version) return null;
  return { policy, version };
});

/** Slugs of every policy that currently has a published version, in display order. */
export const getPublishedPolicyLinks = cache(async () => {
  const policies = await prisma.policy.findMany({
    where: { versions: { some: { status: "PUBLISHED" } } },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, title: true },
  });
  return policies;
});

export interface CheckoutPolicyVersion {
  slug: string;
  title: string;
  versionId: string;
  version: string;
}

export interface CheckoutPolicies {
  terms: CheckoutPolicyVersion | null;
  privacy: CheckoutPolicyVersion | null;
  studio: CheckoutPolicyVersion | null;
}

/**
 * The versions a customer accepts at checkout. Always read on the server at the moment
 * of booking: the browser never tells us which version it agreed to.
 */
export async function getCheckoutPolicies(): Promise<CheckoutPolicies> {
  const slugs = Object.values(CHECKOUT_POLICY_SLUGS);
  const rows = await prisma.policyVersion.findMany({
    where: { status: "PUBLISHED", policy: { slug: { in: slugs } } },
    orderBy: { publishedAt: "desc" },
    select: { id: true, version: true, title: true, policy: { select: { slug: true } } },
  });

  const pick = (slug: string): CheckoutPolicyVersion | null => {
    const row = rows.find((candidate) => candidate.policy.slug === slug);
    return row ? { slug, title: row.title, versionId: row.id, version: row.version } : null;
  };

  return {
    terms: pick(CHECKOUT_POLICY_SLUGS.terms),
    privacy: pick(CHECKOUT_POLICY_SLUGS.privacy),
    studio: pick(CHECKOUT_POLICY_SLUGS.studio),
  };
}

/** Settings in the loose shape the token resolver takes. */
export async function getPolicySettings(): Promise<Record<string, string>> {
  return { ...(await getSettings()) };
}
