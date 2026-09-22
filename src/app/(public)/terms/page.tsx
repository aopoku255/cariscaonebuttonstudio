import type { Metadata } from "next";

import { Container, Section } from "@/components/public/section";
import { getBookingPolicy, getSettings } from "@/lib/settings";
import { getStudioProfile } from "@/lib/queries/public";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Terms & cancellation policy",
  description:
    "Booking terms and the cancellation policy for One Button Studio in Kumasi.",
  alternates: { canonical: "/terms" },
};

export const revalidate = 300;

/**
 * The terms reflect the live configuration rather than repeating fixed numbers: if an
 * admin changes the cancellation window in Settings, this page changes with it.
 */
export default async function TermsPage() {
  const [studio, policy, settings] = await Promise.all([
    getStudioProfile(),
    getBookingPolicy(),
    getSettings(),
  ]);

  const sections: { heading: string; paragraphs: string[] }[] = [
    {
      heading: "Making a booking",
      paragraphs: [
        `A booking is confirmed once payment has been received and verified. Until then the slot is held for ${policy.pendingExpiryMinutes} minutes and then released so someone else can take it.`,
        `Sessions can be booked from ${policy.leadTimeHours} hours ahead and up to ${policy.maxAdvanceDays} days in advance. The shortest session is ${formatDuration(policy.minDurationMinutes)} and the longest is ${formatDuration(policy.maxDurationMinutes)}.`,
        "You do not need an account to book. The details you give at checkout are used to confirm the booking and to reach you about that session.",
      ],
    },
    {
      heading: "Payment",
      paragraphs: [
        `All prices are in ${policy.currency} and are calculated by the studio from the published rates. Payment is taken online through Paystack, which accepts Mobile Money, debit and credit cards, and bank transfer.`,
        policy.taxPercent > 0
          ? `A ${policy.taxLabel.toLowerCase()} of ${policy.taxPercent}% is applied to the discounted subtotal and shown separately before you pay.`
          : "No separate service charge is applied: the total you see at checkout is the total you pay.",
        "Discounts, including the student and researcher rate, are applied automatically at checkout when you qualify. Where a discount requires verification, we may ask for proof before your session.",
      ],
    },
    {
      heading: "Cancellation and refunds",
      paragraphs: [
        settings["cancellation.policyText"],
        policy.lateRefundPercent > 0
          ? `Cancellations inside ${policy.freeCancellationHours} hours of the session are refunded at ${policy.lateRefundPercent}%.`
          : `Cancellations inside ${policy.freeCancellationHours} hours of the session are not refundable, because the slot can rarely be filled at that notice.`,
        "You can cancel from your booking page using the link in your confirmation email, or by calling the studio. Refunds are returned to the original payment method.",
        "If the studio has to cancel your session for any reason, you will be offered a full refund or a reschedule at no cost.",
      ],
    },
    {
      heading: "Using the studio",
      paragraphs: [
        "Please arrive about ten minutes before your session so we can get you set up and start on time. Your session ends at the booked time, as another booking may follow immediately.",
        "The standard lighting and recording setup is included. You are welcome to bring your own equipment; tell us in advance if you need particular power or mounting arrangements.",
        "You are responsible for any damage to studio equipment caused during your session beyond normal wear.",
        "You own the content you record. The studio claims no rights over your recordings.",
      ],
    },
    {
      heading: "Memberships",
      paragraphs: [
        "Memberships are prepaid bundles of studio hours, not automatic subscriptions. Your hours are available for the period stated on the plan and are not renewed or recharged unless you ask us to.",
        "Unused hours expire at the end of the membership period. Contact the studio before your expiry date if you need an extension.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        `Questions about these terms or a specific booking: ${studio.email} or ${studio.phone}. We are at ${studio.location}.`,
      ],
    },
  ];

  return (
    <Section tone="paper">
      <Container className="max-w-3xl">
        <h1 className="font-display text-[36px] leading-[1.1] font-semibold tracking-tight text-balance text-ink sm:text-[44px]">
          Terms &amp; cancellation policy
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          These terms apply to bookings made through this website. They reflect the studio&rsquo;s
          current settings, so they stay accurate if a policy changes.
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
