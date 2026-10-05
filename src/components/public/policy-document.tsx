import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/booking/print-button";
import { PolicyBlocks } from "@/components/policies/policy-content";
import { Container } from "@/components/public/section";
import { POLICY_CATALOGUE, policyPath } from "@/lib/policies/catalogue";
import { parsePolicy, type PolicyDocument } from "@/lib/policies/markdown";
import {
  getPolicySettings,
  getPublishedPolicy,
  getPublishedPolicyLinks,
} from "@/lib/policies/queries";
import { createTokenResolver } from "@/lib/policies/tokens";

/**
 * One public policy page: header with version details, a contents list that stays in
 * view on desktop and folds away on phones, numbered sections, and a print layout.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPolicyDate(date: Date | null | undefined): string | null {
  return date ? DATE_FORMAT.format(date) : null;
}

export async function policyMetadata(slug: string): Promise<Metadata> {
  const definition = POLICY_CATALOGUE.find((entry) => entry.slug === slug);
  const published = await getPublishedPolicy(slug);
  return {
    title: published?.version.title ?? definition?.title ?? "Policy",
    description: published?.policy.summary ?? definition?.summary,
    alternates: { canonical: policyPath(slug) },
  };
}

function MetaItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-[14.5px] font-medium text-ink">
        {value ?? (
          <mark className="policy-placeholder rounded bg-warning-100 px-1 py-0.5 text-[13px] font-medium text-warning-700">
            [PLACEHOLDER]
          </mark>
        )}
      </dd>
    </div>
  );
}

function Contents({ document }: { document: PolicyDocument }) {
  return (
    <ol className="space-y-1">
      {document.sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] leading-snug text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
          >
            <span className="w-5 shrink-0 text-right font-semibold text-brand-600 tabular-nums">
              {section.number}.
            </span>
            <span>{section.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export async function PolicyPage({ slug }: { slug: string }) {
  const [published, settings, links] = await Promise.all([
    getPublishedPolicy(slug),
    getPolicySettings(),
    getPublishedPolicyLinks(),
  ]);

  if (!published) notFound();

  const { policy, version } = published;
  const document = parsePolicy(version.content, createTokenResolver(settings));
  const others = links.filter((link) => link.slug !== slug);

  return (
    <div className="bg-paper">
      <Container className="py-12 sm:py-16 lg:py-20">
        <header className="policy-header max-w-3xl">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-brand-600 uppercase">
            {settings["studio.name"]} policies
          </p>
          <h1 className="font-display mt-3 text-[34px] leading-[1.1] font-semibold tracking-tight text-balance text-ink sm:text-[44px]">
            {version.title}
          </h1>
          {policy.summary ? (
            <p className="mt-4 text-[16.5px] leading-relaxed text-pretty text-muted">
              {policy.summary}
            </p>
          ) : null}

          <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5">
            <MetaItem label="Effective date" value={formatPolicyDate(version.effectiveDate)} />
            <MetaItem label="Last updated" value={formatPolicyDate(version.lastUpdatedDate)} />
            <MetaItem label="Version" value={version.version} />
          </dl>

          <div className="print:hidden mt-5">
            <PrintButton />
          </div>
        </header>

        <div className="mt-10 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
          {/* Contents: folds away on phones, stays in view beside the text on desktop. */}
          <nav aria-label="On this page" className="print:hidden">
            <details className="group rounded-xl border border-line bg-surface lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                On this page
                <span className="text-[12px] font-medium text-muted group-open:hidden">
                  {document.sections.length} sections
                </span>
                <span className="hidden text-[12px] font-medium text-muted group-open:inline">
                  Hide
                </span>
              </summary>
              <div className="border-t border-line p-2">
                <Contents document={document} />
              </div>
            </details>

            <div className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 lg:block">
              <p className="px-2.5 pb-2 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
                On this page
              </p>
              <Contents document={document} />
            </div>
          </nav>

          <article className="policy-article mt-8 max-w-3xl min-w-0 lg:mt-0">
            {document.intro.length ? (
              <div className="mb-10">
                <PolicyBlocks blocks={document.intro} idPrefix="intro" />
              </div>
            ) : null}

            <div className="space-y-12">
              {document.sections.map((section) => (
                <section key={section.id} id={section.id} className="policy-section scroll-mt-24">
                  <h2 className="font-display flex gap-3 text-[23px] leading-tight font-semibold tracking-tight text-ink">
                    <span className="text-brand-600 tabular-nums">{section.number}.</span>
                    <span>{section.title}</span>
                  </h2>
                  <div className="mt-4">
                    <PolicyBlocks blocks={section.blocks} idPrefix={section.id} />
                  </div>
                </section>
              ))}
            </div>

            {others.length ? (
              <aside className="print:hidden mt-16 rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-display text-[17px] font-semibold text-ink">Other policies</h2>
                <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {others.map((link) => (
                    <li key={link.slug}>
                      <Link
                        href={policyPath(link.slug)}
                        className="text-[14.5px] font-medium text-brand-700 underline underline-offset-4 hover:text-brand-900"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </article>
        </div>
      </Container>
    </div>
  );
}
