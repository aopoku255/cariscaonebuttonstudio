import { CustomerType } from "@/generated/prisma/enums";

/**
 * Display labels and icons for every customer category.
 *
 * Kept in one place because `CustomerType` values are rendered in a dozen spots
 * (booking flow, admin forms, customer tables, discount rules) and a generic
 * title-case of `KNUST_STUDENT` reads as "Knust Student", not the "KNUST Student"
 * a KNUST audience expects to see.
 */
export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  [CustomerType.KNUST_STUDENT]: "KNUST Student",
  [CustomerType.STUDENT]: "Student",
  [CustomerType.RESEARCHER]: "Researcher",
  [CustomerType.CREATOR]: "Content Creator",
  [CustomerType.STARTUP]: "Startup / Entrepreneur",
  [CustomerType.BUSINESS]: "Business / Organisation",
  [CustomerType.NGO]: "NGO",
  [CustomerType.CORPORATE]: "Corporate",
  [CustomerType.OTHER]: "Other",
};

/** Short form used where space is tight (tables, badges). */
export const CUSTOMER_TYPE_SHORT_LABELS: Record<CustomerType, string> = {
  ...CUSTOMER_TYPE_LABELS,
  [CustomerType.STARTUP]: "Startup",
  [CustomerType.BUSINESS]: "Business",
};

export const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  CustomerType.KNUST_STUDENT,
  CustomerType.STUDENT,
  CustomerType.RESEARCHER,
  CustomerType.STARTUP,
  CustomerType.CREATOR,
  CustomerType.BUSINESS,
  CustomerType.NGO,
  CustomerType.CORPORATE,
  CustomerType.OTHER,
].map((value) => ({ value, label: CUSTOMER_TYPE_LABELS[value] }));

/**
 * The "Who are you?" step at the start of the booking flow uses a smaller, more
 * conversational set of six categories rather than the full admin-facing list, each
 * mapped onto the real `CustomerType` values used everywhere else.
 */
export const BOOKING_CATEGORY_CHOICES: {
  type: CustomerType;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    type: CustomerType.KNUST_STUDENT,
    emoji: "🎓",
    label: "KNUST Student",
    description: "Special student rates",
  },
  {
    type: CustomerType.RESEARCHER,
    emoji: "🔬",
    label: "Researcher",
    description: "Research and academic rates",
  },
  {
    type: CustomerType.STARTUP,
    emoji: "🚀",
    label: "Startup / Entrepreneur",
    description: "Creator and business packages",
  },
  {
    type: CustomerType.CREATOR,
    emoji: "🎙️",
    label: "Content Creator",
    description: "Standard creator packages",
  },
  {
    type: CustomerType.BUSINESS,
    emoji: "🏢",
    label: "Business / Organisation",
    description: "Corporate packages",
  },
  {
    type: CustomerType.OTHER,
    emoji: "👤",
    label: "Other",
    description: "Standard studio rates",
  },
];
