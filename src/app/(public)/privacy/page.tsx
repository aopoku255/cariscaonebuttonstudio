import type { Metadata } from "next";

import { Container, Section } from "@/components/public/section";
import { getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What personal information One Button Studio collects when you book, why, and how long it is kept.",
  alternates: { canonical: "/privacy" },
};

export const revalidate = 300;

export default async function PrivacyPage() {
  const studio = await getStudioProfile();

  const sections: { heading: string; paragraphs: string[] }[] = [
    {
      heading: "What we collect",
      paragraphs: [
        "When you book a session we collect your name, email address, phone number and, if you give one, your organisation and customer category. You can also optionally tell us the purpose of the booking and any special requirements.",
        "We record the booking itself: the date, time, package, add-ons and amount. We keep a record of each payment, including the reference Paystack gives us and the payment method used.",
        "We do not see or store your card details or Mobile Money credentials. Those are handled entirely by Paystack on their own systems.",
      ],
    },
    {
      heading: "Why we collect it",
      paragraphs: [
        "To confirm and run your booking, to take payment for it, and to contact you about that session: a confirmation, a reminder, and a note if something changes.",
        "To keep accurate financial records, which we are required to do.",
        "Your customer category is used to work out whether a discount applies to your booking.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "Paystack, our payment processor, receives your email address and the amount so it can take the payment.",
        "Our email provider receives your email address and the content of the messages we send you.",
        "We do not sell your information, and we do not share it with anyone for marketing.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Booking and payment records are kept for as long as we are required to retain financial records.",
        "If you would like your contact details removed from our system, email us and we will do it, keeping only what we are obliged to retain for accounting.",
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "You can book as a guest without creating an account. If you do create one, you can sign in to see your upcoming and past bookings, your membership and your receipts.",
        "Sessions are kept in a signed-in cookie. We use no advertising or tracking cookies of any kind.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `For any question about your information, email ${studio.email} or call ${studio.phone}.`,
      ],
    },
  ];

  return (
    <Section tone="paper">
      <Container className="max-w-3xl">
        <h1 className="font-display text-[36px] leading-[1.1] font-semibold tracking-tight text-balance text-ink sm:text-[44px]">
          Privacy
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          A plain description of what we collect when you book, why we need it, and what we
          do with it.
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-[22px] leading-tight font-semibold text-ink">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-[15px] leading-relaxed text-pretty text-ink-soft"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </Section>
  );
}
