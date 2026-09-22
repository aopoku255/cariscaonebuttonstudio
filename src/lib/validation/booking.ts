import { z } from "zod";

import { CustomerType } from "@/generated/prisma/enums";
import {
  dateKeySchema,
  emailSchema,
  idSchema,
  minuteOfDaySchema,
  nameSchema,
  optionalText,
  phoneSchema,
} from "@/lib/validation/common";

/**
 * Public booking input.
 *
 * Note what is *absent*: no prices, no totals, no duration. The client picks a package,
 * a time and some add-ons; the server looks up everything that costs money.
 */

export const customerTypeSchema = z.enum(
  Object.values(CustomerType) as [CustomerType, ...CustomerType[]],
);

export const addOnSelectionSchema = z.object({
  addOnId: idSchema,
  quantity: z.number().int().min(1).max(20).default(1),
});

export const customerDetailsSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  organisation: optionalText(160),
  userType: customerTypeSchema,
  /** A KNUST student ID reference, collected when the studio verifies by ID. */
  studentIdRef: optionalText(60),
});

export const createBookingSchema = z.object({
  packageId: idSchema,
  dateKey: dateKeySchema,
  startMinute: minuteOfDaySchema,
  addOns: z.array(addOnSelectionSchema).max(20).default([]),
  customer: customerDetailsSchema,
  purpose: optionalText(500),
  specialRequirements: optionalText(1000),
  useMembership: z.boolean().default(false),
});

export type CreateBookingPayload = z.infer<typeof createBookingSchema>;

export const quoteRequestSchema = z.object({
  packageId: idSchema,
  addOns: z.array(addOnSelectionSchema).max(20).default([]),
  userType: customerTypeSchema.default(CustomerType.OTHER),
  email: z.string().optional(),
  useMembership: z.boolean().default(false),
});

export const availabilityQuerySchema = z.object({
  date: dateKeySchema,
  packageId: idSchema.optional(),
  days: z.coerce.number().int().min(1).max(62).optional(),
});

export const corporateInquirySchema = z.object({
  organisation: z.string().trim().min(2, "Enter your organisation name").max(160),
  contactName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  sessionsRequired: z.coerce
    .number()
    .int("Enter a whole number")
    .min(1, "Enter at least 1")
    .max(999)
    .optional(),
  estimatedHours: z.coerce
    .number()
    .int("Enter a whole number")
    .min(1, "Enter at least 1")
    .max(9999)
    .optional(),
  contentType: optionalText(160),
  preferredStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  requirements: optionalText(2000),
});

export type CorporateInquiryPayload = z.infer<typeof corporateInquirySchema>;

export const cancelBookingSchema = z.object({
  reference: z.string().trim().min(4).max(64),
  email: emailSchema,
  reason: optionalText(500),
});
