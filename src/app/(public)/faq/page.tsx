import type { Metadata } from "next";

import { FaqAccordion } from "@/components/public/faq-accordion";
import { Container, Section } from "@/components/public/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { getActiveFaqs, getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "How to book One Button Studio, what payment methods we accept, cancellation and refunds, student discounts, equipment and production services.",
  alternates: { canonical: "/faq" },
};

export const revalidate = 300;

export default async function FaqPage() {
  const [faqs, studio] = await Promise.all([getActiveFaqs(), getStudioProfile()]);

  // Group by the admin-set category, keeping the configured order within each group.
  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) {
    const key = faq.category?.trim() || "General";
    groups.set(key, [...(groups.get(key) ?? []), faq]);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      {faqs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}

      <Section tone="paper" className="pb-0">
        <Container className="max-w-3xl">
          <h1 className="font-display text-[38px] leading-[1.08] font-semibold tracking-tight text-balance text-ink sm:text-[46px]">
            Frequently asked questions
          </h1>
          <p className="mt-5 text-[17px] leading-relaxed text-pretty text-ink-soft">
            The things people ask most often. If your question is not here,{" "}
            <a
              href={`mailto:${studio.email}`}
              className="font-semibold text-brand-700 underline underline-offset-4"
            >
              email the studio
            </a>{" "}
            and we will answer it: and probably add it to this page.
          </p>
        </Container>
      </Section>

      <Section tone="paper">
        <Container className="max-w-3xl">
          {faqs.length === 0 ? (
            <EmptyState
              title="No questions published yet"
              description="Get in touch and we will answer whatever you need to know."
              action={<ButtonLink href="/contact">Contact the studio</ButtonLink>}
            />
          ) : (
            <div className="space-y-12">
              {[...groups.entries()].map(([category, items]) => (
                <div key={category}>
                  <h2 className="text-[11.5px] font-semibold tracking-[0.16em] text-accent-600 uppercase">
                    {category}
                  </h2>
                  <div className="mt-4">
                    <FaqAccordion
                      items={items.map((faq) => ({
                        id: faq.id,
                        question: faq.question,
                        answer: faq.answer,
                      }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-14 rounded-2xl border border-line bg-surface p-7 text-center">
            <h2 className="font-display text-[22px] leading-tight font-semibold text-ink">
              Still have a question?
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              Call {studio.phone} or email {studio.email}: a real person will answer.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/book">Book the studio</ButtonLink>
              <ButtonLink href="/contact" variant="outline">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
