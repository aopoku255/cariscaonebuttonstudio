import { z } from "zod";

import {
  AddOnPricingUnit,
  AdminRole,
  BlockType,
  BookingStatus,
  InquiryStatus,
  MembershipStatus,
  PackageCategory,
} from "@/generated/prisma/enums";
import { customerTypeSchema } from "@/lib/validation/booking";
import {
  dateKeySchema,
  emailSchema,
  idSchema,
  moneyMajorSchema,
  nameSchema,
  optionalText,
  percentSchema,
  phoneSchema,
} from "@/lib/validation/common";

const enumSchema = <T extends Record<string, string>>(values: T) =>
  z.enum(Object.values(values) as [string, ...string[]]);

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const packageSchema = z.object({
  name: z.string().trim().min(2, "Enter a package name").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .max(120),
  category: enumSchema(PackageCategory),
  summary: optionalText(300),
  description: optionalText(3000),
  priceMajor: moneyMajorSchema,
  durationMinutes: z.coerce
    .number()
    .int()
    .min(30, "Minimum 30 minutes")
    .max(24 * 60, "Cannot exceed 24 hours"),
  imageUrl: optionalText(500),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  studentOnly: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  features: z.array(z.string().trim().max(160)).max(20).default([]),

  // Membership-only
  includedHours: z.coerce.number().int().min(0).max(999).optional(),
  extraHourDiscountPercent: percentSchema.optional(),
  validityDays: z.coerce.number().int().min(1).max(3650).optional(),
  priorityBooking: z.boolean().default(false),
});

export type PackagePayload = z.infer<typeof packageSchema>;

export const addOnSchema = z.object({
  name: z.string().trim().min(2, "Enter an add-on name").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .max(120),
  description: optionalText(1000),
  priceMajor: moneyMajorSchema,
  pricingUnit: enumSchema(AddOnPricingUnit),
  maxQuantity: z.coerce.number().int().min(1).max(20).default(1),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Enter an equipment name").max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens")
    .max(120),
  description: optionalText(1000),
  imageUrl: optionalText(500),
  quantity: z.coerce.number().int().min(0).max(999).default(1),
  isAvailable: z.boolean().default(true),
  includedInPackages: z.boolean().default(false),
  rentalPriceMajor: moneyMajorSchema.default(0),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Enter a question").max(300),
  answer: z.string().trim().min(5, "Enter an answer").max(3000),
  category: optionalText(80),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const discountRuleSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  description: optionalText(500),
  percentOff: percentSchema,
  eligibleUserTypes: z
    .array(customerTypeSchema)
    .min(1, "Choose at least one customer category"),
  requiresVerification: z.boolean().default(false),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  appliesToAllPackages: z.boolean().default(true),
  packageIds: z.array(idSchema).max(100).default([]),
});

export const operatingHoursSchema = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.coerce.number().int().min(0).max(6),
        isOpen: z.boolean(),
        open: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
        close: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
      }),
    )
    .length(7),
});

export const blockedDateSchema = z.object({
  date: dateKeySchema,
  reason: z.string().trim().min(2, "Give a reason").max(200),
  type: enumSchema(BlockType),
});

export const blockedTimeSchema = z
  .object({
    date: dateKeySchema,
    start: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
    end: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
    reason: z.string().trim().min(2, "Give a reason").max(200),
    type: enumSchema(BlockType),
  })
  .refine((value) => value.start < value.end, {
    message: "The end time must be after the start time",
    path: ["end"],
  });

export const adminBookingSchema = z.object({
  packageId: idSchema,
  dateKey: dateKeySchema,
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
  durationMinutes: z.coerce.number().int().min(30).max(24 * 60),
  addOns: z
    .array(z.object({ addOnId: idSchema, quantity: z.coerce.number().int().min(1).max(20) }))
    .max(20)
    .default([]),
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  organisation: optionalText(160),
  userType: customerTypeSchema,
  paymentMode: z.enum(["PAYSTACK", "PAY_LATER", "PAID_MANUAL", "COMPLIMENTARY"]),
  useMembership: z.boolean().default(false),
  allowOutsideHours: z.boolean().default(false),
  purpose: optionalText(500),
  internalNotes: optionalText(2000),
});

export const bookingStatusUpdateSchema = z.object({
  bookingId: idSchema,
  status: enumSchema(BookingStatus),
  reason: optionalText(500),
});

export const rescheduleBookingSchema = z.object({
  bookingId: idSchema,
  dateKey: dateKeySchema,
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM"),
  durationMinutes: z.coerce.number().int().min(30).max(24 * 60),
  allowOutsideHours: z.boolean().default(false),
});

export const bookingNoteSchema = z.object({
  bookingId: idSchema,
  internalNotes: z.string().trim().max(4000),
});

export const membershipSchema = z.object({
  customerEmail: emailSchema,
  customerName: nameSchema,
  customerPhone: phoneSchema.optional().or(z.literal("")),
  packageId: idSchema,
  totalHours: z.coerce.number().min(0.5, "Enter at least half an hour").max(999),
  startDate: dateKeySchema,
  validityDays: z.coerce.number().int().min(1).max(3650).default(30),
  status: enumSchema(MembershipStatus).default(MembershipStatus.ACTIVE),
  pricePaidMajor: moneyMajorSchema.default(0),
  priorityBooking: z.boolean().default(false),
  extraHourDiscountPercent: percentSchema.default(0),
  autoRenew: z.boolean().default(false),
});

export const membershipAdjustSchema = z.object({
  membershipId: idSchema,
  /** Positive adds hours, negative removes them. */
  hoursDelta: z.coerce.number().min(-999).max(999),
  note: optionalText(200),
});

export const membershipExtendSchema = z.object({
  membershipId: idSchema,
  extraDays: z.coerce.number().int().min(1).max(3650),
});

export const customerUpdateSchema = z.object({
  customerId: idSchema,
  name: nameSchema,
  phone: phoneSchema,
  organisation: optionalText(160),
  userType: customerTypeSchema,
  isVerified: z.boolean().default(false),
  notes: optionalText(2000),
});

export const inquiryUpdateSchema = z.object({
  inquiryId: idSchema,
  status: enumSchema(InquiryStatus),
  adminNotes: optionalText(2000),
});

export const adminUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: enumSchema(AdminRole),
  password: z.string().min(10, "Use at least 10 characters").max(200).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.object({
  values: z.record(z.string(), z.string().max(4000)),
});

export const paymentFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
