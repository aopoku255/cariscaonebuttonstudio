import type { Metadata } from "next";
import Link from "next/link";

import { PrintButton } from "@/components/booking/print-button";
import { Container } from "@/components/public/section";
import { getStudioProfile } from "@/lib/queries/public";

export const metadata: Metadata = {
  title: "Participant release and recording consent",
  description:
    "A form for recording the consent of people who appear in content made at One Button Studio.",
  alternates: { canonical: "/participant-release" },
};

export const revalidate = 300;

function Line({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="h-9 border-b border-ink/50" />
      <p className="mt-1.5 text-[12px] text-muted">{label}</p>
    </div>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded-[3px] border border-ink/60" />
      <span>{children}</span>
    </li>
  );
}

/**
 * A printable form. It is completed on paper (or as a saved PDF) and kept by whoever
 * is responsible for the recording; nothing typed here is sent to the studio.
 */
export default async function ParticipantReleasePage() {
  const studio = await getStudioProfile();

  return (
    <div className="bg-paper">
      <Container className="max-w-3xl py-12 sm:py-16">
        <div className="print:hidden mb-8 rounded-xl border border-line bg-paper-deep px-4 py-3.5 text-[14px] leading-relaxed text-ink-soft">
          Print this form and have each person who appears in your recording complete it before
          the session. Keep the signed copy. See the{" "}
          <Link href="/content-policy" className="font-medium text-brand-700 underline underline-offset-4">
            Content and Recording Policy
          </Link>{" "}
          for when consent is needed.
          <div className="mt-3">
            <PrintButton />
          </div>
        </div>

        <article className="print-sheet policy-article rounded-2xl border border-line bg-surface p-6 sm:p-10">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-brand-600 uppercase">
            {studio.name}
          </p>
          <h1 className="font-display mt-2 text-[28px] leading-tight font-semibold tracking-tight text-ink">
            Participant Release and Recording Consent
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            This form records that a person agrees to be recorded and to the use of the recording
            described below. It is an agreement between the participant and the person or
            organisation responsible for the recording.
          </p>

          <h2 className="font-display mt-8 text-[17px] font-semibold text-ink">1. The recording</h2>
          <div className="mt-2 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Line label="Title or description of the recording" wide />
            <Line label="Person or organisation responsible" />
            <Line label="Booking reference (if known)" />
            <Line label="Date of recording" />
            <Line label="Location" />
          </div>

          <h2 className="font-display mt-8 text-[17px] font-semibold text-ink">
            2. How the recording will be used
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            Describe where and how the recording will be published or shared (for example a
            podcast, a named social media channel, teaching material, or internal use only).
          </p>
          <div className="mt-1 grid gap-y-3">
            <Line label="Intended use" wide />
            <Line label="Any limits the participant has asked for" wide />
          </div>

          <h2 className="font-display mt-8 text-[17px] font-semibold text-ink">
            3. Participant&rsquo;s consent
          </h2>
          <ul className="mt-3 space-y-2.5 text-[14.5px] leading-relaxed text-ink-soft">
            <Tick>I understand that I am being recorded (audio, video or photographs).</Tick>
            <Tick>I understand how the recording will be used, as described above.</Tick>
            <Tick>I agree to my voice, image and contribution being used in that way.</Tick>
            <Tick>
              I understand that I can ask the person responsible, named above, to stop using the
              recording, and that this may not be possible for material already published.
            </Tick>
          </ul>
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Line label="Participant's full name" />
            <Line label="Contact (phone or email)" />
            <Line label="Signature" />
            <Line label="Date" />
          </div>

          <h2 className="font-display mt-8 text-[17px] font-semibold text-ink">
            4. If the participant is under 18
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">
            A parent or guardian must complete this section before the session. A minor must not
            be recorded without it.
          </p>
          <ul className="mt-3 space-y-2.5 text-[14.5px] leading-relaxed text-ink-soft">
            <Tick>I am the parent or guardian of the participant named above.</Tick>
            <Tick>I consent to the participant being recorded and to the use described above.</Tick>
          </ul>
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Line label="Parent or guardian's full name" />
            <Line label="Relationship to the participant" />
            <Line label="Signature" />
            <Line label="Date" />
          </div>

          <p className="mt-10 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
            This form is provided by {studio.name} for the convenience of people using the studio.
            It is not legal advice. The person responsible for the recording remains responsible
            for obtaining the permissions the recording needs.
          </p>
        </article>
      </Container>
    </div>
  );
}
