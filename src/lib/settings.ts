import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";

/**
 * Studio settings live in a key/value table so admins can change operating policy
 * without a deploy. Defaults below are the source of truth for shape and fallback
 * values: a missing row simply means "still on the default".
 */

export const SETTING_DEFAULTS = {
  // Studio identity. One Button Studio is CARISCA's content production space;
  // "studio.parentOrg" carries the "by CARISCA" relationship shown in the logo
  // lockup, without hardcoding it into every component.
  "studio.name": "One Button Studio",
  "studio.parentOrg": "CARISCA",
  "studio.tagline": "Create. Record. Share.",
  "studio.positioning": "Where ideas become content.",
  "studio.description":
    "A creative content production space by CARISCA, for podcasts, interviews, educational content, research communication, business content and social media.",
  "studio.location": "CARISCA, KNUST School of Business, Kumasi, Ghana",
  "studio.phone": "+233 32 249 4067",
  "studio.email": "studio@carisca.org",
  /// Optional hero photograph. When blank the site renders a labelled placeholder.
  "studio.heroImageUrl": "",
  /// Optional logo files. When blank the site renders a labelled placeholder box,
  /// never a fabricated mark, so the real logos can be dropped in later.
  "studio.logoUrl": "",
  "studio.cariscaLogoUrl": "",

  // Booking rules
  "booking.intervalMinutes": "60",
  "booking.minDurationMinutes": "60",
  "booking.maxDurationMinutes": "480",
  /// How far ahead of "now" the earliest bookable slot sits.
  "booking.leadTimeHours": "2",
  "booking.maxAdvanceDays": "120",
  /// PENDING_PAYMENT bookings are released after this many minutes.
  "booking.pendingExpiryMinutes": "30",
  "booking.requireApproval": "false",

  // Pricing
  "pricing.currency": "GHS",
  "pricing.taxPercent": "0",
  "pricing.taxLabel": "Service charge",

  // Student Studio verification. EMAIL trusts a matching KNUST email address and
  // verifies instantly; STUDENT_ID collects an ID reference and holds the booking
  // at Pending approval for staff to check manually; EITHER tries email first and
  // falls back to student ID.
  "student.verificationMethod": "EMAIL",
  "student.knustEmailDomain": "knust.edu.gh",

  // Cancellation policy
  "cancellation.freeCancellationHours": "24",
  "cancellation.lateRefundPercent": "0",
  "cancellation.policyText":
    "Cancel more than 24 hours before your session for a full refund or a free reschedule. Inside 24 hours, bookings are non-refundable.",

  // Notifications
  "notifications.adminEmail": "studio@carisca.org",
  "notifications.sendBookingConfirmation": "true",
  "notifications.sendReminders": "true",
  "notifications.reminderHoursBefore": "24",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type StudioSettings = Record<SettingKey, string>;

/**
 * Load every setting, merged over the defaults. Memoised per request so a page that
 * reads settings in several components still issues one query.
 */
export const getSettings = cache(async (): Promise<StudioSettings> => {
  const rows = await prisma.studioSetting.findMany();
  const settings = { ...SETTING_DEFAULTS } as StudioSettings;
  for (const row of rows) {
    if (row.key in settings) {
      settings[row.key as SettingKey] = row.value;
    }
  }
  return settings;
});

export function settingInt(settings: StudioSettings, key: SettingKey, fallback = 0): number {
  const parsed = Number.parseInt(settings[key], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function settingBool(settings: StudioSettings, key: SettingKey): boolean {
  return settings[key] === "true";
}

/** Narrow, typed view of the rules the booking engine needs. */
export interface BookingPolicy {
  intervalMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  leadTimeHours: number;
  maxAdvanceDays: number;
  pendingExpiryMinutes: number;
  requireApproval: boolean;
  taxPercent: number;
  taxLabel: string;
  currency: string;
  freeCancellationHours: number;
  lateRefundPercent: number;
}

export function toBookingPolicy(settings: StudioSettings): BookingPolicy {
  return {
    intervalMinutes: Math.max(30, settingInt(settings, "booking.intervalMinutes", 60)),
    minDurationMinutes: Math.max(30, settingInt(settings, "booking.minDurationMinutes", 60)),
    maxDurationMinutes: Math.max(30, settingInt(settings, "booking.maxDurationMinutes", 480)),
    leadTimeHours: Math.max(0, settingInt(settings, "booking.leadTimeHours", 2)),
    maxAdvanceDays: Math.max(1, settingInt(settings, "booking.maxAdvanceDays", 120)),
    pendingExpiryMinutes: Math.max(5, settingInt(settings, "booking.pendingExpiryMinutes", 30)),
    requireApproval: settingBool(settings, "booking.requireApproval"),
    taxPercent: Math.max(0, settingInt(settings, "pricing.taxPercent", 0)),
    taxLabel: settings["pricing.taxLabel"],
    currency: settings["pricing.currency"] || "GHS",
    freeCancellationHours: Math.max(0, settingInt(settings, "cancellation.freeCancellationHours", 24)),
    lateRefundPercent: Math.min(100, Math.max(0, settingInt(settings, "cancellation.lateRefundPercent", 0))),
  };
}

export async function getBookingPolicy(): Promise<BookingPolicy> {
  return toBookingPolicy(await getSettings());
}

/** Narrow, typed view of how the studio verifies KNUST students. */
export interface StudentPolicy {
  verificationMethod: "EMAIL" | "STUDENT_ID" | "EITHER";
  knustEmailDomain: string;
}

export function toStudentPolicy(settings: StudioSettings): StudentPolicy {
  const raw = settings["student.verificationMethod"];
  const verificationMethod: StudentPolicy["verificationMethod"] =
    raw === "STUDENT_ID" || raw === "EITHER" ? raw : "EMAIL";

  return {
    verificationMethod,
    knustEmailDomain: (settings["student.knustEmailDomain"] || "knust.edu.gh")
      .trim()
      .toLowerCase()
      .replace(/^@/, ""),
  };
}

export async function getStudentPolicy(): Promise<StudentPolicy> {
  return toStudentPolicy(await getSettings());
}

/** Persist a batch of settings. Unknown keys are ignored rather than stored. */
export async function updateSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
  const entries = Object.entries(values).filter(
    ([key]) => key in SETTING_DEFAULTS,
  ) as [SettingKey, string][];

  if (entries.length === 0) return;

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.studioSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    ),
  );
}
