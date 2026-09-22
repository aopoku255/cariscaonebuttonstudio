import { z } from "zod";

/** Shared primitives so validation messages stay consistent across every form. */

export const idSchema = z.string().min(1, "Required").max(64);

export const emailSchema = z
  .email("Enter a valid email address")
  .max(180)
  .transform((value) => value.trim().toLowerCase());

/**
 * Ghanaian numbers are usually written 024 123 4567 or +233 24 123 4567. Accept both,
 * plus international numbers, and keep the user's formatting rather than rewriting it.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(24, "Enter a valid phone number")
  .regex(/^\+?[\d\s()-]{7,24}$/, "Enter a valid phone number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(120, "That name is too long");

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** Minutes from midnight, on the half-hour grid. */
export const minuteOfDaySchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));

/** Money entered by an admin in major units, stored in minor units. */
export const moneyMajorSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 550 or 550.00")
  .transform((value) => Math.round(Number.parseFloat(value) * 100));

export const percentSchema = z
  .number()
  .int("Enter a whole number")
  .min(0, "Cannot be negative")
  .max(100, "Cannot be more than 100");

/**
 * Collapse a Zod error into a `{ field: message }` map for rendering next to inputs.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/** The shape every server action returns, so forms can render results uniformly. */
export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: T;
}

export function actionError(
  message: string,
  errors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, message, errors };
}

export function actionOk<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}
