import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Camera,
  CreditCard,
  Headphones,
  Images,
  Layers,
  Lightbulb,
  Mic,
  Quote,
  Sparkles,
  Users,
  Video,
  Wifi,
  Wind,
} from "lucide-react";
import type { ComponentType } from "react";

import { Container, Eyebrow, Section, SectionHeading } from "@/components/public/section";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import type { ServiceCard } from "@/lib/queries/public";
import { formatMoney } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Studio introduction                                                         */
/* -------------------------------------------------------------------------- */

export function StudioIntro({
  description,
  studioName,
  parentOrg,
}: {
  description: string;
  studioName: string;
  parentOrg: string;
}) {
  return (
    <Section tone="surface">
      <Container>
        <Reveal className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <Eyebrow>The studio</Eyebrow>
            <h2 className="font-display mt-3 text-[30px] leading-[1.12] font-semibold tracking-tight text-balance text-ink sm:text-[38px]">
              Your Ideas. One Button Away.
            </h2>
          </div>
          <div className="space-y-5 text-[16px] leading-relaxed text-pretty text-ink-soft">
            <p>{description}</p>
            <p>
              {parentOrg} is a research, innovation and entrepreneurship centre, and{" "}
              {studioName} grew out of a simple need: good ideas were not reaching the
              people they were meant for. Researchers had findings nobody heard. Founders
              had products nobody saw. So {parentOrg} built a room that removes the excuse.
            </p>
            <p>
              It is open to everyone: students, researchers, creators, startups, businesses,
              NGOs and institutions. The lighting is set, the audio is treated, and the
              cameras are ready. You bring the idea.
            </p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Services                                                                    */
/* -------------------------------------------------------------------------- */

const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  studio: Layers,
  podcast: Mic,
  video: Video,
  content: Sparkles,
  photo: Camera,
  corporate: Building2,
};

export function ServicesSection({ services }: { services: ServiceCard[] }) {
  return (
    <Section id="services">
      <Container>
        <SectionHeading
          eyebrow="What you can do here"
          title="Services"
          description="Book the room on its own, or add the people and kit that turn a recording into a finished piece of content."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => {
            const Icon = SERVICE_ICONS[service.icon] ?? Layers;
            return (
              <Reveal key={service.slug} delay={index * 60}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg hover:shadow-ink/5">
                  <ImagePlaceholder
                    label={`${service.title} Image`}
                    aspect="video"
                    className="rounded-none border-none"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />

                  <div className="flex flex-1 flex-col p-6">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-100">
                      <Icon className="size-5" aria-hidden />
                    </span>

                    <h3 className="font-display mt-5 text-[20px] leading-tight font-semibold text-ink">
                      {service.title}
                    </h3>
                    <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                      {service.description}
                    </p>

                    <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-5 [margin-top:auto]">
                      <div>
                        <p className="text-[11.5px] font-semibold tracking-[0.12em] text-muted uppercase">
                          {service.fromMinor === null ? "Pricing" : "Starting from"}
                        </p>
                        <p className="font-display mt-1 text-[20px] font-semibold text-ink">
                          {service.fromMinor === null
                            ? "On request"
                            : formatMoney(service.fromMinor)}
                        </p>
                      </div>
                      <Link
                        href={service.ctaHref}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                      >
                        {service.ctaLabel}
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    number: "01",
    title: "Choose your package",
    description: "An hour for a single recording, or a full day to produce a whole series.",
    Icon: Layers,
  },
  {
    number: "02",
    title: "Choose your date and time",
    description: "Live availability, so the slot you choose is genuinely free.",
    Icon: CalendarCheck,
  },
  {
    number: "03",
    title: "Add the services you need",
    description: "A camera operator, audio setup, teleprompter or editing, if you need them.",
    Icon: Headphones,
  },
  {
    number: "04",
    title: "Pay and create",
    description: "Mobile Money or card. Your confirmation and receipt arrive by email.",
    Icon: CreditCard,
  },
];

export function HowItWorks() {
  return (
    <Section tone="deep" id="how-it-works">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From idea to recording in four steps"
          align="center"
        />

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 70} as="li">
              <div className="relative h-full rounded-2xl border border-line bg-surface p-6">
                <span className="font-display text-[34px] leading-none font-semibold text-accent-300">
                  {step.number}
                </span>
                <h3 className="mt-4 text-[16.5px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  {step.description}
                </p>
                <step.Icon
                  className="absolute top-6 right-6 size-5 text-brand-300"
                  aria-hidden
                />
              </div>
            </Reveal>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <ButtonLink href="/book" size="lg">
            Start your booking
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* The studio experience                                                       */
/* -------------------------------------------------------------------------- */

const EXPERIENCE_ITEMS = [
  {
    title: "Professional space",
    description:
      "An acoustically treated room with a proper set, not a meeting room with a camera in the corner.",
    Icon: Lightbulb,
  },
  {
    title: "Quality equipment",
    description:
      "Broadcast microphones, controlled lighting and cameras configured for interviews and presenters.",
    Icon: Mic,
  },
  {
    title: "Flexible bookings",
    description:
      "One hour, three hours, a half day or a full day. Members split their hours however they like.",
    Icon: CalendarCheck,
  },
  {
    title: "Production support",
    description:
      "Add a camera operator, an audio technician or full production when you want a hand.",
    Icon: Users,
  },
  {
    title: "Comfortable environment",
    description:
      "Air conditioned and set up so your session starts on time and stays comfortable throughout.",
    Icon: Wind,
  },
  {
    title: "Convenient online booking",
    description:
      "Check availability, book and pay by Mobile Money or card, without a single phone call.",
    Icon: CreditCard,
  },
];

export function StudioExperience() {
  return (
    <Section id="why">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14">
          <Reveal>
            <ImagePlaceholder
              label="Studio Experience Image"
              aspect="portrait"
              sizes="(max-width: 1024px) 100vw, 42vw"
            />
          </Reveal>

          <div>
            <SectionHeading
              eyebrow="Why book here"
              title="The One Button Studio experience"
              description="Everything in the room is set up so that your session starts on time and the recording is usable when you walk out."
            />

            <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {EXPERIENCE_ITEMS.map((item, index) => (
                <Reveal key={item.title} delay={index * 50}>
                  <div className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                      <item.Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-[15.5px] font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Equipment                                                                   */
/* -------------------------------------------------------------------------- */

const EQUIPMENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  camera: Camera,
  microphone: Mic,
  lighting: Lightbulb,
  tripod: Video,
  teleprompter: Layers,
  "green-screen": Images,
  backdrop: Images,
  monitor: Video,
};

export function EquipmentSection({
  equipment,
}: {
  equipment: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    includedInPackages: boolean;
    rentalPriceMinor: number;
  }[];
}) {
  if (equipment.length === 0) return null;

  return (
    <Section tone="brand" id="equipment">
      <Container>
        <SectionHeading
          eyebrow="In the room"
          title="Equipment"
          tone="inverse"
          description="The standard setup is included with every booking. A few specialist items can be added for a small extra charge."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {equipment.map((item, index) => {
            const Icon = EQUIPMENT_ICONS[item.slug] ?? Camera;
            return (
              <Reveal key={item.id} delay={index * 45}>
                <div className="h-full rounded-2xl border border-brand-800 bg-brand-900/60 p-5">
                  <Icon className="size-5 text-accent-300" aria-hidden />
                  <h3 className="mt-4 text-[15.5px] font-semibold text-white">{item.name}</h3>
                  {item.description ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-brand-200">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-4 text-[12px] font-semibold tracking-wide text-accent-300 uppercase">
                    {item.includedInPackages
                      ? "Included"
                      : item.rentalPriceMinor > 0
                        ? `+ ${formatMoney(item.rentalPriceMinor)}`
                        : "On request"}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-brand-800 pt-7 text-[13.5px] text-brand-200">
          <span className="flex items-center gap-2">
            <Wifi className="size-4 text-accent-300" aria-hidden />
            Wi-Fi throughout
          </span>
          <span className="flex items-center gap-2">
            <Wind className="size-4 text-accent-300" aria-hidden />
            Air conditioned
          </span>
          <span className="flex items-center gap-2">
            <Users className="size-4 text-accent-300" aria-hidden />
            Room for guests and crew
          </span>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Studio gallery                                                              */
/* -------------------------------------------------------------------------- */

export interface GalleryEntry {
  id: string;
  caption: string;
  category: string | null;
  imageUrl: string | null;
}

export function GallerySection({
  images,
  studioName,
}: {
  images: GalleryEntry[];
  studioName: string;
}) {
  if (images.length === 0) return null;

  return (
    <Section tone="surface" id="gallery">
      <Container>
        <SectionHeading
          eyebrow="Take a look inside"
          title={`Inside ${studioName}`}
          description="A closer look at the set, the equipment and the recording areas."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <Reveal
              key={image.id}
              delay={index * 50}
              className={index === 0 ? "sm:col-span-2 lg:col-span-1 lg:row-span-2" : undefined}
            >
              <div className="relative h-full overflow-hidden rounded-2xl border border-line">
                <ImagePlaceholder
                  label={image.caption}
                  aspect={index === 0 ? "portrait" : "square"}
                  src={image.imageUrl}
                  className="h-full rounded-2xl"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {image.category ? (
                  <span className="absolute top-3 left-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                    {image.category}
                  </span>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Student promotion                                                           */
/* -------------------------------------------------------------------------- */

export function StudentPromotion() {
  return (
    <Section tone="paper" id="students">
      <Container>
        <Reveal>
          <div className="grid gap-8 overflow-hidden rounded-3xl border border-line bg-surface lg:grid-cols-2">
            <div className="relative">
              <ImagePlaceholder
                label="Student Studio Image"
                aspect="square"
                className="h-full rounded-none border-none lg:rounded-l-3xl"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            <div className="flex flex-col justify-center p-8 lg:p-12">
              <Eyebrow>For KNUST students</Eyebrow>
              <h2 className="font-display mt-3 text-[28px] leading-tight font-semibold tracking-tight text-balance text-ink sm:text-[34px]">
                Built for KNUST Creators
              </h2>
              <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-pretty text-ink-soft">
                Whether you&rsquo;re building a startup, running a student organisation,
                creating content, recording a podcast or telling your research story,
                One Button Studio gives you a professional space to create, at a price
                built for student budgets.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/students">Explore Student Packages</ButtonLink>
                <ButtonLink href="/book?category=KNUST_STUDENT" variant="outline">
                  Book a Student Session
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Corporate                                                                   */
/* -------------------------------------------------------------------------- */

export function CorporateSection({ parentOrg }: { parentOrg: string }) {
  return (
    <Section tone="deep" id="corporate">
      <Container>
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12 lg:p-12">
              <div>
                <Eyebrow>Corporate &amp; institutional</Eyebrow>
                <h2 className="font-display mt-3 text-[28px] leading-tight font-semibold tracking-tight text-balance text-ink sm:text-[34px]">
                  Need regular access to the studio?
                </h2>
                <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-pretty text-ink-soft">
                  Organisations can use the studio for interviews, training content,
                  podcasts, research communication, educational videos, corporate
                  communication and campaign content, as part of {parentOrg}&rsquo;s wider
                  work in research, innovation and entrepreneurship.
                </p>

                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {[
                    "A block of sessions at an agreed rate",
                    "Priority slots in the calendar",
                    "Dedicated production support",
                    "Consolidated invoicing",
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5 text-[14px] text-ink-soft">
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:justify-self-end">
                <ButtonLink href="/corporate" size="lg" fullWidth>
                  Request a Corporate Package
                </ButtonLink>
                <p className="mt-3 text-center text-[13px] text-muted">
                  We usually reply within two working days.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                                */
/* -------------------------------------------------------------------------- */

const TESTIMONIALS = [
  {
    quote:
      "We recorded a six episode series on supply chain resilience in one day. The audio needed almost no cleaning up, which has never been true of anything we have recorded before.",
    name: "Dr. Ama Boateng",
    role: "Research Fellow, KNUST School of Business",
  },
  {
    quote:
      "As a founder you are always choosing between doing it cheaply and doing it properly. Booking here was the first time those were the same option.",
    name: "Kwesi Mensah",
    role: "Founder, Adinkra Logistics",
  },
  {
    quote:
      "I book three hours most months and split them across two shoots. Being able to see real availability and pay with MoMo on my phone is the whole reason I keep coming back.",
    name: "Efua Asante",
    role: "Content creator",
  },
];

export function Testimonials() {
  return (
    <Section id="testimonials">
      <Container>
        <SectionHeading
          eyebrow="What people say"
          title="Trusted by researchers, founders and creators"
          align="center"
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={index * 70}>
              <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                <Quote className="size-6 text-accent-400" aria-hidden />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-pretty text-ink-soft">
                  {testimonial.quote}
                </blockquote>
                <figcaption className="mt-6 border-t border-line pt-4">
                  <p className="text-[14px] font-semibold text-ink">{testimonial.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{testimonial.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing CTA                                                                 */
/* -------------------------------------------------------------------------- */

export function ClosingCta({ studioName, phone }: { studioName: string; phone: string }) {
  return (
    <Section tone="brand">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <Eyebrow tone="inverse">Ready when you are</Eyebrow>
          <h2 className="font-display mt-4 text-[32px] leading-[1.1] font-semibold tracking-tight text-balance text-white sm:text-[44px]">
            Ready to create?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-pretty text-brand-200">
            Book your session at {studioName}. Pick a package, choose a time that is
            genuinely free, and pay online. You do not need an account, and the whole
            thing takes about two minutes.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/book" size="lg" variant="accent">
              Book Now
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink
              href="/contact"
              size="lg"
              variant="outline"
              className="border-brand-700 text-white hover:bg-brand-900"
            >
              Talk to the team
            </ButtonLink>
          </div>

          <p className="mt-6 text-[13.5px] text-brand-300">
            Prefer to call? {phone}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
