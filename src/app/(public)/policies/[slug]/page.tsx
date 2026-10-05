import { notFound, permanentRedirect } from "next/navigation";

import { PolicyPage, policyMetadata } from "@/components/public/policy-document";
import { POLICY_CATALOGUE, policyPath } from "@/lib/policies/catalogue";

export const revalidate = 300;

/** Policies created by an administrator beyond the standard eight. */
export async function generateMetadata({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  return policyMetadata(slug);
}

export default async function Page({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  // The standard policies live at their own top-level address.
  if (POLICY_CATALOGUE.some((policy) => policy.slug === slug)) permanentRedirect(policyPath(slug));
  return <PolicyPage slug={slug} />;
}
