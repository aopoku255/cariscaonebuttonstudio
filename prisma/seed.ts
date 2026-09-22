import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed data for the One Button Studio platform (a production space by CARISCA).
 *
 * Everything here is written with `upsert` keyed on a natural unique column, so the
 * seed is safe to re-run: it refreshes the starting catalogue without duplicating rows
 * or overwriting bookings. Change the constants below to change the starting data.
 */

const missingDbVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"].filter(
  (name) => !process.env[name],
);
if (missingDbVars.length) {
  throw new Error(`Missing ${missingDbVars.join(", ")}. Copy .env.example to .env first.`);
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(
    {
      host: process.env.DB_HOST!,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
    },
    { useTextProtocol: true },
  ),
});

const cedis = (amount: number) => Math.round(amount * 100);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const STUDIO_PACKAGES = [
  {
    slug: "studio-1-hour",
    name: "1 Hour",
    summary: "A focused session for a single recording.",
    description:
      "One hour of studio time with the standard lighting and recording setup ready to go. Ideal for a short interview, a single podcast segment or a batch of social clips.",
    priceMinor: cedis(200),
    durationMinutes: 60,
    sortOrder: 1,
    isPopular: false,
    features: [
      "Studio access",
      "Basic lighting",
      "Basic studio setup",
      "Wi-Fi",
      "Air conditioning",
    ],
  },
  {
    slug: "studio-3-hours",
    name: "3 Hours",
    summary: "Room to record a full episode without rushing.",
    description:
      "Three hours of studio time, enough to set up, record a full podcast episode or interview, and pick up any retakes you need.",
    priceMinor: cedis(550),
    durationMinutes: 180,
    sortOrder: 2,
    isPopular: true,
    features: ["Studio access", "Basic lighting", "Studio setup", "Wi-Fi", "Air conditioning"],
  },
  {
    slug: "studio-half-day",
    name: "Half Day",
    summary: "Four hours for a multi-segment shoot.",
    description:
      "A half day in the studio with equipment included. Built for shoots that need several setups, multiple guests or a mix of video and stills.",
    priceMinor: cedis(700),
    durationMinutes: 240,
    sortOrder: 3,
    isPopular: false,
    features: ["Studio access", "Basic lighting", "Studio setup", "Basic equipment", "Wi-Fi"],
  },
  {
    slug: "studio-full-day",
    name: "Full Day",
    summary: "Eight hours to produce a whole series.",
    description:
      "The studio for a full working day. The usual choice for recording a season of episodes in one sitting or running a full production schedule.",
    priceMinor: cedis(1200),
    durationMinutes: 480,
    sortOrder: 4,
    isPopular: false,
    features: ["Studio access", "Basic lighting", "Studio setup", "Basic equipment", "Wi-Fi"],
  },
];

const MEMBERSHIP_PACKAGES = [
  {
    slug: "membership-creator",
    name: "Creator",
    summary: "Four studio hours a month, used whenever you need them.",
    description:
      "For independent creators publishing on a regular schedule. Your hours can be split across as many separate bookings as you like.",
    priceMinor: cedis(500),
    includedHours: 4,
    extraHourDiscountPercent: 10,
    validityDays: 30,
    priorityBooking: false,
    sortOrder: 1,
    isPopular: false,
    features: [
      "4 studio hours",
      "Can split hours across multiple bookings",
      "10% discount on additional studio hours",
    ],
  },
  {
    slug: "membership-pro-creator",
    name: "Pro Creator",
    summary: "Eight hours a month with priority on the calendar.",
    description:
      "For creators and small teams producing weekly. Includes priority booking and the basic equipment set at no extra cost.",
    priceMinor: cedis(900),
    includedHours: 8,
    extraHourDiscountPercent: 15,
    validityDays: 30,
    priorityBooking: true,
    sortOrder: 2,
    isPopular: true,
    features: [
      "8 studio hours",
      "Priority booking",
      "15% discount on additional hours",
      "Basic equipment included",
    ],
  },
  {
    slug: "membership-business",
    name: "Business / Organisation",
    summary: "Fifteen hours a month with production support.",
    description:
      "For organisations with an ongoing content programme. Includes priority booking and basic production assistance on every session.",
    priceMinor: cedis(1500),
    includedHours: 15,
    extraHourDiscountPercent: 20,
    validityDays: 30,
    priorityBooking: true,
    sortOrder: 3,
    isPopular: false,
    features: [
      "15 studio hours",
      "Priority booking",
      "20% discount on additional hours",
      "Basic production assistance",
    ],
  },
];

/**
 * Student Studio session packages. Short, affordable slots built for the kind of
 * content KNUST students actually make: reels, TikToks, quick two-person podcasts and
 * batch content days. `studentOnly` gates these to verified KNUST_STUDENT customers.
 */
const STUDENT_PACKAGES = [
  {
    slug: "student-quick-create",
    name: "Quick Create",
    category: "STUDENT" as const,
    studentOnly: true,
    summary: "Thirty minutes for a reel, a TikTok, or a quick announcement.",
    description:
      "A fast, affordable slot for short-form content: reels, TikToks, quick videos and personal branding shots.",
    priceMinor: cedis(80),
    durationMinutes: 30,
    sortOrder: 1,
    isPopular: false,
    features: ["Studio access", "Basic lighting", "Basic studio setup"],
  },
  {
    slug: "student-hour",
    name: "Student Hour",
    category: "STUDENT" as const,
    studentOnly: true,
    summary: "A full hour, the most popular student booking.",
    description: "An hour of studio time for a single recording, at the student rate.",
    priceMinor: cedis(120),
    durationMinutes: 60,
    sortOrder: 2,
    isPopular: true,
    features: ["Studio access", "Basic lighting", "Basic studio setup", "Wi-Fi"],
  },
  {
    slug: "student-duo",
    name: "Student Duo",
    category: "STUDENT" as const,
    studentOnly: true,
    summary: "Two hours, built for two-person content.",
    description:
      "Room and basic audio for podcasts, interviews and two-person content, or a student project that needs a bit more time.",
    priceMinor: cedis(200),
    durationMinutes: 120,
    sortOrder: 3,
    isPopular: false,
    features: [
      "Studio access",
      "Basic lighting",
      "Basic audio setup",
      "Studio furniture",
      "Wi-Fi",
    ],
  },
  {
    slug: "student-creator",
    name: "Student Creator",
    category: "STUDENT" as const,
    studentOnly: true,
    summary: "Four hours for batch-creating content.",
    description:
      "For students who want to record several pieces of content in one visit, with priority booking on the calendar.",
    priceMinor: cedis(350),
    durationMinutes: 240,
    sortOrder: 4,
    isPopular: false,
    priorityBooking: true,
    features: [
      "Studio access",
      "Basic lighting",
      "Basic equipment",
      "Basic audio setup",
      "Priority booking",
    ],
  },
];

/** Student Studio memberships: the same prepaid-hours model as the general
 * memberships, just priced and scoped for KNUST students via `studentOnly`. */
const STUDENT_MEMBERSHIP_PACKAGES = [
  {
    slug: "student-membership-monthly",
    name: "Student Monthly",
    summary: "Three studio hours a month, at the student rate.",
    description:
      "For students who create regularly. Split your hours across as many bookings as you like.",
    priceMinor: cedis(300),
    includedHours: 3,
    extraHourDiscountPercent: 10,
    validityDays: 30,
    priorityBooking: false,
    sortOrder: 5,
    isPopular: false,
    features: [
      "3 studio hours per month",
      "Can split hours across multiple bookings",
      "10% discount on additional studio hours",
    ],
  },
  {
    slug: "student-membership-pro",
    name: "Student Pro",
    summary: "Six studio hours a month, with priority booking.",
    description:
      "For students producing content at volume: a podcast, a student organisation's channel, a personal brand.",
    priceMinor: cedis(550),
    includedHours: 6,
    extraHourDiscountPercent: 15,
    validityDays: 30,
    priorityBooking: true,
    sortOrder: 6,
    isPopular: false,
    features: [
      "6 studio hours per month",
      "Priority booking",
      "Basic equipment included",
      "15% discount on additional studio hours",
    ],
  },
];

const ADD_ONS = [
  {
    slug: "camera-operator",
    name: "Camera Operator",
    description:
      "A trained operator runs the cameras for your session so you can concentrate on the content.",
    priceMinor: cedis(150),
    pricingUnit: "PER_HOUR" as const,
    maxQuantity: 2,
    sortOrder: 1,
  },
  {
    slug: "audio-podcast-setup",
    name: "Audio / Podcast Setup",
    description:
      "Full podcast microphone setup with a technician monitoring levels throughout the session.",
    priceMinor: cedis(150),
    pricingUnit: "PER_HOUR" as const,
    maxQuantity: 1,
    sortOrder: 2,
  },
  {
    slug: "editing",
    name: "Editing",
    description:
      "Post-production editing of your recording. Starting price covers a single standard edit; longer or more complex work is quoted after the session.",
    priceMinor: cedis(200),
    pricingUnit: "PER_BOOKING" as const,
    maxQuantity: 5,
    sortOrder: 3,
  },
  {
    slug: "full-production",
    name: "Full Production",
    description:
      "End-to-end production: planning, filming, editing and delivery. Priced per project, the team will contact you with a quote.",
    priceMinor: 0,
    pricingUnit: "CUSTOM" as const,
    maxQuantity: 1,
    sortOrder: 4,
  },
  {
    slug: "teleprompter",
    name: "Teleprompter",
    description: "Teleprompter with an operator to pace your script.",
    priceMinor: cedis(100),
    pricingUnit: "PER_BOOKING" as const,
    maxQuantity: 1,
    sortOrder: 5,
  },
  {
    slug: "additional-equipment",
    name: "Additional Equipment",
    description:
      "Extra cameras, lights, microphones or stands beyond the standard studio setup.",
    priceMinor: cedis(150),
    pricingUnit: "PER_BOOKING" as const,
    maxQuantity: 5,
    sortOrder: 6,
  },
];

const EQUIPMENT = [
  {
    slug: "camera",
    name: "Camera",
    description: "Professional video cameras on tripods, configured for interview and presenter setups.",
    quantity: 3,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 1,
  },
  {
    slug: "microphone",
    name: "Microphone",
    description: "Broadcast condenser and lavalier microphones with boom arms and pop filters.",
    quantity: 4,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 2,
  },
  {
    slug: "lighting",
    name: "Lighting",
    description: "Softbox key, fill and back lighting with adjustable colour temperature.",
    quantity: 4,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 3,
  },
  {
    slug: "tripod",
    name: "Tripod",
    description: "Fluid-head tripods for smooth pans and stable locked-off shots.",
    quantity: 4,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 4,
  },
  {
    slug: "teleprompter",
    name: "Teleprompter",
    description: "Camera-mounted teleprompter with remote speed control.",
    quantity: 1,
    includedInPackages: false,
    rentalPriceMinor: cedis(100),
    sortOrder: 5,
  },
  {
    slug: "green-screen",
    name: "Green Screen",
    description: "Evenly lit chroma key backdrop for virtual sets and keyed backgrounds.",
    quantity: 1,
    includedInPackages: false,
    rentalPriceMinor: cedis(80),
    sortOrder: 6,
  },
  {
    slug: "backdrop",
    name: "Backdrop",
    description: "Interchangeable neutral and branded backdrops for interviews and portraits.",
    quantity: 3,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 7,
  },
  {
    slug: "monitor",
    name: "Monitor",
    description: "Confidence monitors so presenters and guests can see the live framing.",
    quantity: 2,
    includedInPackages: true,
    rentalPriceMinor: 0,
    sortOrder: 8,
  },
];

/**
 * Gallery entries for the public "Inside One Button Studio" section. `imageUrl` is
 * left blank on every entry, so each renders as a labelled placeholder until real
 * photography is added from Admin -> Studio gallery.
 */
const GALLERY_IMAGES = [
  { caption: "Studio overview", category: "Studio", sortOrder: 1 },
  { caption: "Podcast setup", category: "Audio", sortOrder: 2 },
  { caption: "Camera setup", category: "Video", sortOrder: 3 },
  { caption: "Lighting", category: "Video", sortOrder: 4 },
  { caption: "Recording area", category: "Studio", sortOrder: 5 },
  { caption: "Interview setup", category: "Video", sortOrder: 6 },
];

const FAQS = [
  {
    question: "How do I book the studio?",
    answer:
      "Choose a package, pick a date and time, add any production services you need, enter your details and pay online. The whole thing takes a couple of minutes and you do not need an account.",
    category: "Booking",
    sortOrder: 1,
  },
  {
    question: "Can I cancel my booking?",
    answer:
      "Yes. Cancel more than 24 hours before your session for a full refund or a free reschedule. Inside 24 hours, bookings are non-refundable. You can cancel from your booking page or by calling the studio.",
    category: "Booking",
    sortOrder: 2,
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept Mobile Money and debit or credit cards through Paystack, plus bank transfer. Payment is taken at the time of booking, which is what secures your slot.",
    category: "Payment",
    sortOrder: 3,
  },
  {
    question: "Can I bring my own equipment?",
    answer:
      "Absolutely. The studio is yours for the session, so bring whatever kit you prefer to work with. Tell us in the special requirements box if you need particular power or mounting arrangements.",
    category: "Studio",
    sortOrder: 4,
  },
  {
    question: "Can I book for an entire day?",
    answer:
      "Yes. The Full Day package covers eight hours, which is the usual choice for recording a whole series in one sitting. If you need longer, request a corporate package and we will arrange it.",
    category: "Booking",
    sortOrder: 5,
  },
  {
    question: "Do you provide a camera operator?",
    answer:
      "Yes, as an add-on. A trained operator runs the cameras throughout your session so you can focus on the content. You can add this when you book.",
    category: "Production",
    sortOrder: 6,
  },
  {
    question: "Do you provide editing?",
    answer:
      "Yes. Add editing to your booking and we will handle post-production after the session. For larger projects, choose Full Production and the team will send you a quote.",
    category: "Production",
    sortOrder: 7,
  },
  {
    question: "Can students get discounts?",
    answer:
      "Researchers get a discounted rate on standard studio time, applied automatically at checkout. KNUST students get more than a discount: a dedicated Student Studio with its own affordable packages, built for the content students actually make. See the Student Studio page for details.",
    category: "Pricing",
    sortOrder: 8,
  },
  {
    question: "How do I book as a KNUST student?",
    answer:
      "Choose \"KNUST Student\" at the start of the booking flow. Book with your KNUST email address and your student status is verified instantly; otherwise you can enter your student ID and our team will verify it before your session is confirmed.",
    category: "Pricing",
    sortOrder: 9,
  },
  {
    question: "Can organisations book recurring sessions?",
    answer:
      "Yes. Organisations that need regular studio access can request a corporate package, and we will put together a schedule and rate that fits your programme.",
    category: "Corporate",
    sortOrder: 10,
  },
];

/** Monday–Friday 08:00–18:00, Saturday 09:00–16:00, Sunday closed. */
const OPERATING_HOURS = [
  { dayOfWeek: 0, isOpen: false, openMinute: 9 * 60, closeMinute: 16 * 60 },
  { dayOfWeek: 1, isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 },
  { dayOfWeek: 2, isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 },
  { dayOfWeek: 3, isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 },
  { dayOfWeek: 4, isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 },
  { dayOfWeek: 5, isOpen: true, openMinute: 8 * 60, closeMinute: 18 * 60 },
  { dayOfWeek: 6, isOpen: true, openMinute: 9 * 60, closeMinute: 16 * 60 },
];

// ---------------------------------------------------------------------------

async function seedPackages() {
  for (const pkg of STUDIO_PACKAGES) {
    const { features, ...data } = pkg;
    const record = await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: { ...data, category: "STUDIO_RENTAL" },
      update: { ...data, category: "STUDIO_RENTAL" },
    });
    await prisma.packageFeature.deleteMany({ where: { packageId: record.id } });
    await prisma.packageFeature.createMany({
      data: features.map((label, index) => ({
        packageId: record.id,
        label,
        sortOrder: index,
      })),
    });
  }

  for (const pkg of MEMBERSHIP_PACKAGES) {
    const { features, includedHours, ...rest } = pkg;
    const data = {
      ...rest,
      includedHours,
      // A membership booking draws on prepaid hours rather than being a fixed session,
      // so the duration mirrors the included allowance.
      durationMinutes: includedHours * 60,
      category: "MEMBERSHIP" as const,
    };
    const record = await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: data,
      update: data,
    });
    await prisma.packageFeature.deleteMany({ where: { packageId: record.id } });
    await prisma.packageFeature.createMany({
      data: features.map((label, index) => ({
        packageId: record.id,
        label,
        sortOrder: index,
      })),
    });
  }

  for (const pkg of STUDENT_PACKAGES) {
    const { features, ...data } = pkg;
    const record = await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: data,
      update: data,
    });
    await prisma.packageFeature.deleteMany({ where: { packageId: record.id } });
    await prisma.packageFeature.createMany({
      data: features.map((label, index) => ({
        packageId: record.id,
        label,
        sortOrder: index,
      })),
    });
  }

  for (const pkg of STUDENT_MEMBERSHIP_PACKAGES) {
    const { features, includedHours, ...rest } = pkg;
    const data = {
      ...rest,
      includedHours,
      durationMinutes: includedHours * 60,
      category: "MEMBERSHIP" as const,
      studentOnly: true,
    };
    const record = await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: data,
      update: data,
    });
    await prisma.packageFeature.deleteMany({ where: { packageId: record.id } });
    await prisma.packageFeature.createMany({
      data: features.map((label, index) => ({
        packageId: record.id,
        label,
        sortOrder: index,
      })),
    });
  }

  console.log(
    `  ✓ ${STUDIO_PACKAGES.length} studio packages, ${MEMBERSHIP_PACKAGES.length} memberships, ${STUDENT_PACKAGES.length} student packages, ${STUDENT_MEMBERSHIP_PACKAGES.length} student memberships`,
  );
}

async function seedAddOns() {
  for (const addOn of ADD_ONS) {
    await prisma.addOn.upsert({
      where: { slug: addOn.slug },
      create: addOn,
      update: addOn,
    });
  }
  console.log(`  ✓ ${ADD_ONS.length} add-ons`);
}

async function seedEquipment() {
  for (const item of EQUIPMENT) {
    await prisma.equipment.upsert({
      where: { slug: item.slug },
      create: item,
      update: item,
    });
  }
  console.log(`  ✓ ${EQUIPMENT.length} equipment items`);
}

async function seedGallery() {
  for (const image of GALLERY_IMAGES) {
    const existing = await prisma.galleryImage.findFirst({ where: { caption: image.caption } });
    if (existing) {
      await prisma.galleryImage.update({ where: { id: existing.id }, data: image });
    } else {
      await prisma.galleryImage.create({ data: image });
    }
  }
  console.log(`  ✓ ${GALLERY_IMAGES.length} gallery entries (as placeholders, ready for real photos)`);
}

async function seedFaqs() {
  for (const faq of FAQS) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (existing) {
      await prisma.faq.update({ where: { id: existing.id }, data: faq });
    } else {
      await prisma.faq.create({ data: faq });
    }
  }
  console.log(`  ✓ ${FAQS.length} FAQs`);
}

async function seedOperatingHours() {
  for (const hours of OPERATING_HOURS) {
    await prisma.operatingHour.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      create: hours,
      update: hours,
    });
  }
  console.log("  ✓ Operating hours (Mon–Fri 08:00–18:00, Sat 09:00–16:00, Sun closed)");
}

async function seedDiscountRule() {
  const name = "Student & Researcher rate";
  const existing = await prisma.discountRule.findFirst({ where: { name } });
  const data = {
    name,
    description:
      "Discounted studio time for students and researchers. Change the percentage, eligibility and verification requirement from Admin → Discounts.",
    percentOff: 10,
    eligibleUserTypes: "STUDENT,RESEARCHER",
    requiresVerification: false,
    isActive: true,
    appliesToAllPackages: true,
  };

  if (existing) {
    await prisma.discountRule.update({ where: { id: existing.id }, data });
  } else {
    await prisma.discountRule.create({ data });
  }
  console.log("  ✓ Student & Researcher discount (10%)");
}

async function seedAdminUser() {
  const email = (process.env.ADMIN_EMAIL || "admin@carisca.org").toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    console.log(`  · Admin user ${email} already exists, password left unchanged`);
    return;
  }

  // Prefer an explicit password, but never fall back to a well-known default: an
  // unattended seed generates a strong one and prints it once.
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD || `${randomBytes(9).toString("base64url")}Aa1`;

  await prisma.adminUser.create({
    data: {
      email,
      name: process.env.ADMIN_NAME || "Studio Administrator",
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log(`  ✓ Super Admin created: ${email}`);
  if (generated) {
    console.log("");
    console.log("    ┌──────────────────────────────────────────────────────┐");
    console.log("    │  Generated admin password: copy it now, it is not    │");
    console.log("    │  stored anywhere and will not be shown again.        │");
    console.log("    └──────────────────────────────────────────────────────┘");
    console.log(`      Email:    ${email}`);
    console.log(`      Password: ${password}`);
    console.log("");
  }
}

async function main() {
  console.log("Seeding One Button Studio...\n");
  await seedPackages();
  await seedAddOns();
  await seedEquipment();
  await seedGallery();
  await seedFaqs();
  await seedOperatingHours();
  await seedDiscountRule();
  await seedAdminUser();
  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
