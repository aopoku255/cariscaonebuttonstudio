import type { Metadata } from "next";
import {
  Briefcase,
  Camera,
  FileText,
  GraduationCap,
  Hash,
  Mail,
  Mic,
  Newspaper,
  Presentation,
  Rocket,
  ShoppingBag,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

import { Container, Eyebrow, Section, SectionHeading } from "@/components/public/section";
import { PackageCard } from "@/components/public/package-card";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Alert } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { PackageCategory } from "@/generated/prisma/enums";
import { getActivePackages, getStudioProfile } from "@/lib/queries/public";
import { getStudentPolicy } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Student Studio",
  description:
    "Affordable studio access for KNUST students: TikToks, reels, YouTube content, podcasts, personal branding and research communication, at student prices.",
  alternates: { canonical: "/students" },
};

export const revalidate = 300;

const USE_CASES = [
  { label: "TikTok videos", Icon: Video },
  { label: "Instagram Reels", Icon: Hash },
  { label: "YouTube content", Icon: Video },
  { label: "Podcasts", Icon: Mic },
  { label: "Interviews", Icon: Users },
  { label: "Personal branding content", Icon: Sparkles },
  { label: "Student organisation content", Icon: Users },
  { label: "Academic presentations", Icon: Presentation },
  { label: "Research communication", Icon: FileText },
  { label: "Startup content", Icon: Rocket },
  { label: "Product photography", Icon: Camera },
  { label: "Business content", Icon: Briefcase },
  { label: "Event content", Icon: Newspaper },
  { label: "Everything else you're building", Icon: ShoppingBag },
];

export default async function StudentsPage() {
  const [studio, studentPolicy, sessionPackages, membershipPackages] = await Promise.all([
    getStudioProfile(),
    getStudentPolicy(),
    getActivePackages(PackageCategory.STUDENT),
    getActivePackages(PackageCategory.MEMBERSHIP),
  ]);

  const studentMemberships = membershipPackages.filter((pkg) => pkg.studentOnly);

  const verificationCopy =
    studentPolicy.verificationMethod === "STUDENT_ID"
      ? "Enter your student ID when you book, and our team verifies it before your session is confirmed."
      : studentPolicy.verificationMethod === "EITHER"
        ? `Book with an email ending in @${studentPolicy.knustEmailDomain} for instant verification, or enter your student ID and we will verify it manually.`
        : `Book with your KNUST email address, ending in @${studentPolicy.knustEmailDomain}, and you are verified instantly, no waiting.`;

  return (
    <>
      <Section tone="paper" className="pb-0">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-soft">
                <GraduationCap className="size-3.5 text-brand-600" aria-hidden />
                For KNUST students
              </p>

              <h1 className="font-display mt-5 text-[38px] leading-[1.06] font-semibold tracking-tight text-balance text-ink sm:text-[48px]">
                Create more. Spend less.
              </h1>

              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-soft">
                {studio.name} gives KNUST students affordable access to a professional
                studio: short, low-cost sessions built for the content you actually
                make, not a discount bolted onto packages designed for someone else.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="#packages" size="lg">
                  Explore Student Packages
                </ButtonLink>
                <ButtonLink href="/book?category=KNUST_STUDENT" size="lg" variant="outline">
                  Book a Student Session
                </ButtonLink>
              </div>
            </div>

            <ImagePlaceholder
              label="Student Studio Image"
              aspect="hero"
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="rounded-2xl shadow-xl shadow-ink/5"
            />
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container>
          <SectionHeading
            eyebrow="What you can make"
            title="Built for what KNUST students actually create"
            description="Bring the idea. The lighting, the audio and the cameras are already set up."
          />

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {USE_CASES.map((item, index) => (
              <Reveal key={item.label} delay={index * 30}>
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-paper px-4 py-3.5">
                  <item.Icon className="size-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="text-[13.5px] leading-snug font-medium text-ink-soft">
                    {item.label}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {sessionPackages.length ? (
        <Section tone="paper" id="packages">
          <Container>
            <SectionHeading
              eyebrow="Student pricing"
              title="Student session packages"
              description="Priced and timed for student budgets and student schedules."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {sessionPackages.map((pkg, index) => (
                <Reveal key={pkg.id} delay={index * 60}>
                  <PackageCard
                    pkg={pkg}
                    href={`/book?package=${pkg.id}&category=KNUST_STUDENT`}
                    className="h-full"
                  />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {studentMemberships.length ? (
        <Section tone="surface">
          <Container>
            <SectionHeading
              eyebrow="Student memberships"
              title="For students who create every week"
              description="A prepaid bundle of hours at a better rate than booking one session at a time. Split them across as many bookings as you like."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {studentMemberships.map((pkg, index) => (
                <Reveal key={pkg.id} delay={index * 60}>
                  <PackageCard
                    pkg={pkg}
                    href={`/contact?subject=${encodeURIComponent(`Student membership: ${pkg.name}`)}`}
                    ctaLabel="Enquire about this plan"
                    className="h-full"
                  />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <Section tone="deep">
        <Container className="max-w-3xl">
          <SectionHeading eyebrow="Verification" title="How student pricing is verified" align="center" />
          <Alert tone="info" className="mt-8">
            {verificationCopy}
          </Alert>
          <div className="mt-8 flex items-center justify-center gap-2 text-[13.5px] text-muted">
            <Mail className="size-4 shrink-0" aria-hidden />
            Questions about verification? Email {studio.email}.
          </div>
        </Container>
      </Section>

      <Section tone="brand">
        <Container>
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow tone="inverse">Ready when you are</Eyebrow>
            <h2 className="font-display mt-4 text-[30px] leading-[1.1] font-semibold tracking-tight text-balance text-white sm:text-[38px]">
              Your ideas are one button away
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-pretty text-brand-200">
              Choose a student package, pick a time, and start creating.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/book?category=KNUST_STUDENT" size="lg" variant="accent">
                Book a Student Session
              </ButtonLink>
              <ButtonLink
                href="/packages"
                size="lg"
                variant="outline"
                className="border-brand-700 text-white hover:bg-brand-900"
              >
                See all packages
              </ButtonLink>
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
